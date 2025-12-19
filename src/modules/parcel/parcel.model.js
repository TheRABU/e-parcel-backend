import mongoose from "mongoose";

const parcelSchema = new mongoose.Schema(
  {
    trackingNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // pickup location
    pickupLocation: {
      address: {
        type: String,
        required: true,
      },
      coordinates: {
        lat: {
          type: Number,
          required: true,
        },
        lng: {
          type: Number,
          required: true,
        },
      },
      contactPerson: String,
      contactPhone: String,
    },
    // delivery location
    deliveryLocation: {
      address: {
        type: String,
        required: true,
      },
      coordinates: {
        lat: {
          type: Number,
          required: true,
        },
        lng: {
          type: Number,
          required: true,
        },
      },
      contactPerson: {
        type: String,
        required: true,
      },
      contactPhone: {
        type: String,
        required: true,
      },

      // details
    },
    // parcel details
    parcelDetails: {
      weight: {
        type: Number,
        required: true,
      },
      size: {
        type: String,
        enum: ["small", "medium", "large", "extra-large"],
        required: true,
      },
      type: {
        type: String,
        enum: [
          "document",
          "package",
          "fragile",
          "electronics",
          "food",
          "other",
        ],
        required: true,
      },
      description: String,
      quantity: {
        type: Number,
        default: 1,
      },
    },

    // payment method
    paymentDetails: {
      paymentMethod: {
        type: String,
        enum: ["cod", "prepaid"],
        required: true,
      },
      amount: {
        type: Number,
        required: true,
      },
      codAmount: {
        type: Number,
        default: 0,
      },
      isPaid: {
        type: Boolean,
        default: false,
      },
      paidAt: Date,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "assigned",
        "picked-up",
        "in-transit",
        "out-for-delivery",
        "delivered",
        "failed",
        "cancelled",
      ],
      default: "pending",
    },
    statusHistory: [
      {
        status: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        location: {
          lat: Number,
          lng: Number,
        },
        remarks: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,
    failureReason: String,
    attemptCount: {
      type: Number,
      default: 0,
    },

    qrCode: String,
    barcode: String,

    customerRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    customerFeedback: String,
  },
  {
    timestamps: true,
  }
);

parcelSchema.pre("save", async function (next) {
  if (!this.trackingNumber) {
    this.trackingNumber = "TRK" + Date.now() + Math.floor(Math.random() * 1000);
  }
  next();
});

parcelSchema.index({ trackingNumber: 1 });
parcelSchema.index({ customerId: 1 });
parcelSchema.index({ agentId: 1 });
parcelSchema.index({ status: 1 });
parcelSchema.index({ createdAt: -1 });

const Parcel = mongoose.model("Parcel", parcelSchema);

export default Parcel;
