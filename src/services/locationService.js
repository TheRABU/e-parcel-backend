import Parcel from "../models/Parcel.js";
import User from "../models/User.js";

class LocationService {
  static async updateAgentLocation(agentId, latitude, longitude) {
    try {
      await User.findByIdAndUpdate(agentId, {
        "agentDetails.currentLocation": {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        updatedAt: new Date(),
      });

      const activeParcels = await Parcel.find({
        agentId,
        status: {
          $in: ["assigned", "picked-up", "in-transit", "out-for-delivery"],
        },
      });

      const updatePromises = activeParcels.map(async (parcel) => {
        parcel.agentInformation.currentLocation = {
          coordinates: { lat: latitude, lng: longitude },
          updatedAt: new Date(),
        };

        parcel.agentInformation.locationHistory = [
          {
            coordinates: { lat: latitude, lng: longitude },
            timestamp: new Date(),
          },
          ...parcel.agentInformation.locationHistory.slice(0, 49),
        ];

        // Update last known location
        parcel.agentInformation.lastKnownLocation = {
          coordinates: { lat: latitude, lng: longitude },
          updatedAt: new Date(),
        };

        return parcel.save();
      });

      await Promise.all(updatePromises);

      return {
        agentId,
        location: { lat: latitude, lng: longitude },
        timestamp: new Date(),
        updatedParcelsCount: activeParcels.length,
      };
    } catch (error) {
      console.error("Error updating agent location:", error);
      throw error;
    }
  }

  // get agent's location with caching
  static async getAgentLocation(agentId, useCache = true) {
    try {
      const agent = await User.findById(agentId)
        .select("agentDetails.currentLocation updatedAt name")
        .lean();

      if (!agent || !agent.agentDetails?.currentLocation?.coordinates) {
        return null;
      }

      const [lng, lat] = agent.agentDetails.currentLocation.coordinates;

      return {
        coordinates: { lat, lng },
        updatedAt: agent.updatedAt,
        agentName: agent.name,
      };
    } catch (error) {
      console.error("Error getting agent location:", error);
      return null;
    }
  }

  // Calculate estimated time of arrival
  static async calculateETA(parcelId, currentLocation) {
    const parcel = await Parcel.findById(parcelId).lean();

    if (!parcel || !currentLocation) return null;

    const distanceToDelivery = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      parcel.deliveryLocation.coordinates.lat,
      parcel.deliveryLocation.coordinates.lng
    );

    // Average speed based on vehicle type
    const speedMap = {
      bike: 25,
      car: 40,
      van: 35,
      default: 30,
    };

    const agent = await User.findById(parcel.agentId)
      .select("agentDetails.vehicleType")
      .lean();

    const vehicleType = agent?.agentDetails?.vehicleType || "default";
    const averageSpeed = speedMap[vehicleType] || speedMap.default;

    const etaHours = distanceToDelivery / averageSpeed;

    const bufferFactor = 1.3;
    const totalHours = etaHours * bufferFactor;

    return {
      eta: new Date(Date.now() + totalHours * 60 * 60 * 1000),
      hours: parseFloat(totalHours.toFixed(1)),
      distanceRemaining: parseFloat(distanceToDelivery.toFixed(2)),
    };
  }
}

export default LocationService;
