import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reportType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "custom"],
      required: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dateRange: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
    },
    metrics: {
      totalBookings: Number,
      totalDelivered: Number,
      totalFailed: Number,
      totalCancelled: Number,
      totalRevenue: Number,
      totalCOD: Number,
      averageDeliveryTime: Number,
    },
    fileUrl: String,
    status: {
      type: String,
      enum: ["generating", "completed", "failed"],
      default: "generating",
    },
  },
  {
    timestamps: true,
  }
);

reportSchema.index({ generatedBy: 1, createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
