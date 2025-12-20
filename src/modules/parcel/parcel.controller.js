import { calculateDeliveryProgress } from "../../utils/deliveryProgress.js";
import { calculateDistance } from "../../utils/distanceCalculator.js";
import Parcel from "./parcel.model.js";

// customer's operations
const bookParcel = async (req, res) => {
  try {
    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      pickupContactPerson,
      pickupContactPhone,

      deliveryAddress,
      deliveryLat,
      deliveryLng,
      deliveryContactPerson,
      deliveryContactPhone,

      weight,
      size,
      type,
      description,
      quantity,

      paymentMethod,
      amount,
      codAmount,
      estimatedDeliveryDate,
    } = req.body;

    const customerId = req.user.userId;

    if (!pickupAddress || !pickupLat || !pickupLng) {
      return res.status(400).json({
        message: "Pickup location details are required",
      });
    }

    if (
      !deliveryAddress ||
      !deliveryLat ||
      !deliveryLng ||
      !deliveryContactPerson ||
      !deliveryContactPhone
    ) {
      return res.status(400).json({
        message: "Delivery location details are required",
      });
    }

    if (!weight || !size || !type) {
      return res.status(400).json({
        message: "Parcel details (weight, size, type) are required",
      });
    }

    if (!paymentMethod || !amount) {
      return res.status(400).json({
        message: "Payment details are required",
      });
    }

    if (!["cod", "prepaid"].includes(paymentMethod)) {
      return res.status(400).json({
        message: 'Payment method must be either "cod" or "prepaid"',
      });
    }

    if (paymentMethod === "cod" && (!codAmount || codAmount <= 0)) {
      return res.status(400).json({
        message: "COD amount is required for COD payments",
      });
    }

    const validSizes = ["small", "medium", "large", "extra-large"];
    if (!validSizes.includes(size)) {
      return res.status(400).json({
        message: `Size must be one of: ${validSizes.join(", ")}`,
      });
    }

    const validTypes = [
      "document",
      "package",
      "fragile",
      "electronics",
      "food",
      "other",
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        message: `Type must be one of: ${validTypes.join(", ")}`,
      });
    }

    const trackingNumber =
      "TRK" + Date.now() + Math.floor(Math.random() * 1000);

    const distance = calculateDistance(
      pickupLat,
      pickupLng,
      deliveryLat,
      deliveryLng
    );

    const parcelData = {
      trackingNumber,
      customerId,
      pickupLocation: {
        address: pickupAddress,
        coordinates: {
          lat: parseFloat(pickupLat),
          lng: parseFloat(pickupLng),
        },
        contactPerson: pickupContactPerson || "",
        contactPhone: pickupContactPhone || "",
      },
      deliveryLocation: {
        address: deliveryAddress,
        coordinates: {
          lat: parseFloat(deliveryLat),
          lng: parseFloat(deliveryLng),
        },
        contactPerson: deliveryContactPerson,
        contactPhone: deliveryContactPhone,
      },
      distance: distance,
      parcelDetails: {
        weight: parseFloat(weight),
        size,
        type,
        description: description || "",
        quantity: quantity ? parseInt(quantity) : 1,
      },
      paymentDetails: {
        paymentMethod,
        amount: parseFloat(amount),
        codAmount: paymentMethod === "cod" ? parseFloat(codAmount) : 0,
        isPaid: paymentMethod === "prepaid" ? false : false,
      },
      status: "pending",
      statusHistory: [
        {
          status: "pending",
          timestamp: new Date(),
          remarks: "Parcel booked successfully",
        },
      ],
    };

    if (estimatedDeliveryDate) {
      parcelData.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
    }

    const parcel = await Parcel.create(parcelData);

    res.status(201).json({
      success: true,
      message: "Parcel booked successfully",
      data: {
        parcelId: parcel._id,
        trackingNumber: parcel.trackingNumber,
        status: parcel.status,
        estimatedDeliveryDate: parcel.estimatedDeliveryDate,
        paymentDetails: parcel.paymentDetails,
        distance: distance,
      },
    });
  } catch (error) {
    console.error("Error booking parcel:", error.message);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Tracking number already exists. Please try again.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((err) => err.message)
          .join(", "),
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const myParcelHistory = async (req, res) => {
  try {
    const customerId = req.user.userId;

    const parcels = await Parcel.find({ customerId })
      .populate("agentId", "name email phone")
      .sort({ createdAt: -1 })
      .lean();

    if (!parcels || parcels.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          parcels: [],
          message: "No parcels found for this customer",
        },
      });
    }
    const formattedParcels = parcels.map((parcel) => ({
      id: parcel._id,
      trackingNumber: parcel.trackingNumber,
      status: parcel.status,
      pickupAddress: parcel.pickupLocation.address,
      deliveryAddress: parcel.deliveryLocation.address,
      parcelType: parcel.parcelDetails.type,
      parcelSize: parcel.parcelDetails.size,
      weight: parcel.parcelDetails.weight,
      paymentMethod: parcel.paymentDetails.paymentMethod,
      amount: parcel.paymentDetails.amount,
      codAmount: parcel.paymentDetails.codAmount,
      isPaid: parcel.paymentDetails.isPaid,
      estimatedDeliveryDate: parcel.estimatedDeliveryDate,
      actualDeliveryDate: parcel.actualDeliveryDate,
      createdAt: parcel.createdAt,
      updatedAt: parcel.updatedAt,
      agent: parcel.agentId
        ? {
            name: parcel.agentId.name,
            phone: parcel.agentId.phone,
            email: parcel.agentId.email,
          }
        : null,

      statusHistory: parcel.statusHistory || [],
      failureReason: parcel.failureReason || null,
      attemptCount: parcel.attemptCount || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        parcels: formattedParcels,
        count: parcels.length,
        customerId: customerId,
      },
    });
  } catch (error) {
    console.error("Error fetching parcel history:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateMyParcel = async (req, res) => {
  try {
    const customerId = req.user.userId;
    const { parcelId } = req.params;
    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      pickupContactPerson,
      pickupContactPhone,

      deliveryAddress,
      deliveryLat,
      deliveryLng,
      deliveryContactPerson,
      deliveryContactPhone,

      weight,
      size,
      type,
      description,
      quantity,

      paymentMethod,
      amount,
      codAmount,
      estimatedDeliveryDate,
    } = req.body;

    if (!customerId) {
      return res.status(500).json({
        success: false,
        message: "No customer id found!",
      });
    }

    if (!parcelId) {
      return res.status(400).json({
        success: false,
        message: "Parcel ID is required in URL parameters",
      });
    }

    const parcel = await Parcel.findById(parcelId);

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found",
      });
    }

    if (parcel.customerId.toString() !== customerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this parcel",
      });
    }

    const notAllowedStatuses = [
      "picked-up",
      "in-transit",
      "out-for-delivery",
      "delivered",
      "failed",
    ];
    if (notAllowedStatuses.includes(parcel.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update parcel with status: ${parcel.status}. Parcel is already in transit or delivered.`,
        allowedStatuses: ["pending", "assigned"],
      });
    }

    // now prepare the update data

    const updateData = {};

    // update pickup location
    if (pickupAddress || pickupLat || pickupLng) {
      updateData.pickupLocation = {
        address: pickupAddress || parcel.pickupLocation.address,
        coordinates: {
          lat: pickupLat
            ? parseFloat(pickupLat)
            : parcel.pickupLocation.coordinates.lat,
          lng: pickupLng
            ? parseFloat(pickupLng)
            : parcel.pickupLocation.coordinates.lng,
        },
        contactPerson:
          pickupContactPerson || parcel.pickupLocation.contactPerson || "",
        contactPhone:
          pickupContactPhone || parcel.pickupLocation.contactPhone || "",
      };
    }

    // Update delivery location if provided
    if (
      deliveryAddress ||
      deliveryLat ||
      deliveryLng ||
      deliveryContactPerson ||
      deliveryContactPhone
    ) {
      updateData.deliveryLocation = {
        address: deliveryAddress || parcel.deliveryLocation.address,
        coordinates: {
          lat: deliveryLat
            ? parseFloat(deliveryLat)
            : parcel.deliveryLocation.coordinates.lat,
          lng: deliveryLng
            ? parseFloat(deliveryLng)
            : parcel.deliveryLocation.coordinates.lng,
        },
        contactPerson:
          deliveryContactPerson || parcel.deliveryLocation.contactPerson,
        contactPhone:
          deliveryContactPhone || parcel.deliveryLocation.contactPhone,
      };
    }

    if (weight || size || type || description || quantity) {
      updateData.parcelDetails = {
        weight: weight ? parseFloat(weight) : parcel.parcelDetails.weight,
        size: size || parcel.parcelDetails.size,
        type: type || parcel.parcelDetails.type,
        description: description || parcel.parcelDetails.description || "",
        quantity: quantity ? parseInt(quantity) : parcel.parcelDetails.quantity,
      };
    }

    if (paymentMethod || amount || codAmount) {
      if (paymentMethod && !["cod", "prepaid"].includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: 'Payment method must be either "cod" or "prepaid"',
        });
      }

      updateData.paymentDetails = {
        paymentMethod: paymentMethod || parcel.paymentDetails.paymentMethod,
        amount: amount ? parseFloat(amount) : parcel.paymentDetails.amount,
        codAmount: codAmount
          ? parseFloat(codAmount)
          : parcel.paymentDetails.codAmount,
        isPaid: parcel.paymentDetails.isPaid,
        paidAt: parcel.paymentDetails.paidAt,
      };
      if (
        paymentMethod === "cod" &&
        parcel.paymentDetails.paymentMethod === "prepaid"
      ) {
        updateData.paymentDetails.isPaid = false;
        updateData.paymentDetails.paidAt = null;
      }
    }

    if (estimatedDeliveryDate) {
      updateData.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
    }

    if (size) {
      const validSizes = ["small", "medium", "large", "extra-large"];
      if (!validSizes.includes(size)) {
        return res.status(400).json({
          success: false,
          message: `Size must be one of: ${validSizes.join(", ")}`,
        });
      }
    }

    if (type) {
      const validTypes = [
        "document",
        "package",
        "fragile",
        "electronics",
        "food",
        "other",
      ];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Type must be one of: ${validTypes.join(", ")}`,
        });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data provided to update",
        data: parcel,
      });
    }

    // Update parcel in database
    const updatedParcel = await Parcel.findByIdAndUpdate(parcelId, updateData, {
      new: true,
      runValidators: true,
    }).populate("agentId", "name email phone");

    // update to status history
    updatedParcel.statusHistory.push({
      status: updatedParcel.status,
      timestamp: new Date(),
      remarks: "Parcel details updated by customer",
      updatedBy: customerId,
    });

    await updatedParcel.save();

    const formattedParcel = {
      id: updatedParcel._id,
      trackingNumber: updatedParcel.trackingNumber,
      status: updatedParcel.status,
      pickupAddress: updatedParcel.pickupLocation.address,
      deliveryAddress: updatedParcel.deliveryLocation.address,
      parcelType: updatedParcel.parcelDetails.type,
      parcelSize: updatedParcel.parcelDetails.size,
      weight: updatedParcel.parcelDetails.weight,
      paymentMethod: updatedParcel.paymentDetails.paymentMethod,
      amount: updatedParcel.paymentDetails.amount,
      codAmount: updatedParcel.paymentDetails.codAmount,
      isPaid: updatedParcel.paymentDetails.isPaid,
      estimatedDeliveryDate: updatedParcel.estimatedDeliveryDate,
      actualDeliveryDate: updatedParcel.actualDeliveryDate,
      createdAt: updatedParcel.createdAt,
      updatedAt: updatedParcel.updatedAt,
      agent: updatedParcel.agentId
        ? {
            name: updatedParcel.agentId.name,
            phone: updatedParcel.agentId.phone,
            email: updatedParcel.agentId.email,
          }
        : null,
    };

    res.status(200).json({
      success: true,
      message: "Parcel updated successfully",
      data: formattedParcel,
      updatedFields: Object.keys(updateData),
    });
  } catch (error) {
    console.log("Could not update error::", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not update data Server issue occurred please try later",
    });
  }
};

const trackParcel = async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message:
          "No userId found to track your parcel...please login and try again!",
      });
    }

    if (!trackingNumber || trackingNumber.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tracking number is required",
      });
    }

    const parcel = await Parcel.findOne({ trackingNumber })
      .populate("customerId", "name email phone")
      .populate("agentId", "name phone agentDetails.vehicleType")
      .lean();

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found with this tracking number",
      });
    }

    let currentLocation = null;
    let locationSource = "parcel_cache";
    let locationTimestamp = null;

    if (parcel.agentId && parcel.agentId._id) {
      const agent = await User.findById(parcel.agentId._id)
        .select("agentDetails.currentLocation updatedAt")
        .lean();

      if (agent && agent.agentDetails?.currentLocation?.coordinates) {
        const [lng, lat] = agent.agentDetails.currentLocation.coordinates;
        currentLocation = { lat, lng };
        locationSource = "agent_realtime";
        locationTimestamp = agent.updatedAt;
      }
    }

    if (
      !currentLocation &&
      parcel.agentInformation?.currentLocation?.coordinates?.lat
    ) {
      currentLocation = parcel.agentInformation.currentLocation.coordinates;
      locationTimestamp = parcel.agentInformation.currentLocation.updatedAt;
    }

    if (
      !currentLocation &&
      parcel.agentInformation?.lastKnownLocation?.coordinates?.lat
    ) {
      currentLocation = parcel.agentInformation.lastKnownLocation.coordinates;
      locationTimestamp = parcel.agentInformation.lastKnownLocation.updatedAt;
      locationSource = "last_known";
    }

    const progressInfo = calculateDeliveryProgress(parcel, currentLocation);

    const trackingData = {
      trackingNumber: parcel.trackingNumber,
      status: parcel.status,
      currentStatus: parcel.status,
      currentLocation: currentLocation
        ? {
            coordinates: currentLocation,
            source: locationSource,
            lastUpdated: locationTimestamp,
            accuracy: "high",
          }
        : null,

      route: {
        pickup: {
          address: parcel.pickupLocation.address,
          coordinates: parcel.pickupLocation.coordinates,
        },
        delivery: {
          address: parcel.deliveryLocation.address,
          coordinates: parcel.deliveryLocation.coordinates,
        },
        distance: parcel.distance || null,
      },

      agent: parcel.agentId
        ? {
            id: parcel.agentId._id,
            name: parcel.agentId.name || parcel.agentInformation?.agentName,
            phone: parcel.agentId.phone,
            vehicleType: parcel.agentId.agentDetails?.vehicleType || "bike",
          }
        : null,

      statusHistory:
        parcel.statusHistory?.map((item) => ({
          status: item.status,
          timestamp: item.timestamp,
          location: item.location,
          remarks: item.remarks,
        })) || [],

      estimatedDelivery: parcel.estimatedDeliveryDate,
      actualDelivery: parcel.actualDeliveryDate,
      attemptCount: parcel.attemptCount || 0,
      failureReason: parcel.failureReason || null,

      progress: progressInfo.percentage,
      currentStage: progressInfo.stage,
      nextMilestone: progressInfo.nextMilestone,
      estimatedTimeRemaining: progressInfo.estimatedTimeRemaining,

      isLiveTrackingAvailable:
        currentLocation !== null &&
        ["picked-up", "in-transit", "out-for-delivery"].includes(parcel.status),
      lastUpdated: parcel.updatedAt,
      createdAt: parcel.createdAt,
    };

    res.status(200).json({
      success: true,
      data: trackingData,
      meta: {
        trackingNumber: parcel.trackingNumber,
        serverTime: new Date().toISOString(),
        cacheControl: "no-cache",
      },
    });
  } catch (error) {
    console.error("Error tracking parcel:", error.message);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid tracking number format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Unable to track parcel at the moment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const ParcelController = {
  bookParcel,
  myParcelHistory,
  updateMyParcel,
  trackParcel,
};
