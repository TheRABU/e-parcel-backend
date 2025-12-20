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
  } catch (error) {
    console.log("Could not update error::", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not update data Server issue occurred please try later",
    });
  }
};

export const ParcelController = {
  bookParcel,
  myParcelHistory,
};
