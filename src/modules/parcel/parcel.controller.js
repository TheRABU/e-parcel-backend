import Parcel from "./parcel.model.js";

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

export const ParcelController = {
  bookParcel,
};
