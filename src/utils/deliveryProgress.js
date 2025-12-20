import { calculateDistance } from "./distanceCalculator.js";

export const calculateDeliveryProgress = (parcel, currentLocation) => {
  const statusWeights = {
    pending: 0,
    assigned: 20,
    "picked-up": 40,
    "in-transit": 60,
    "out-for-delivery": 80,
    delivered: 100,
    failed: 0,
    cancelled: 0,
  };

  let percentage = statusWeights[parcel.status] || 0;
  let stage = parcel.status;
  let nextMilestone = null;
  let estimatedTimeRemaining = null;

  if (currentLocation && parcel.status === "in-transit" && parcel.distance) {
    const pickupToDeliveryDistance = parcel.distance; // km
    const currentToPickupDistance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      parcel.pickupLocation.coordinates.lat,
      parcel.pickupLocation.coordinates.lng
    );

    const currentToDeliveryDistance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      parcel.deliveryLocation.coordinates.lat,
      parcel.deliveryLocation.coordinates.lng
    );

    if (pickupToDeliveryDistance > 0) {
      const distanceProgress =
        ((pickupToDeliveryDistance - currentToDeliveryDistance) /
          pickupToDeliveryDistance) *
        100;
      percentage = Math.max(40, Math.min(80, 40 + distanceProgress * 0.4)); // 40-80% range
    }

    if (currentToDeliveryDistance) {
      const averageSpeed = 30; // km/h
      estimatedTimeRemaining = Math.max(
        0.5,
        (currentToDeliveryDistance / averageSpeed).toFixed(1)
      ); // hours
    }
  }

  const statusFlow = [
    "pending",
    "assigned",
    "picked-up",
    "in-transit",
    "out-for-delivery",
    "delivered",
  ];
  const currentIndex = statusFlow.indexOf(parcel.status);
  if (currentIndex < statusFlow.length - 1) {
    nextMilestone = statusFlow[currentIndex + 1];
  }

  return {
    percentage,
    stage,
    nextMilestone,
    estimatedTimeRemaining: estimatedTimeRemaining
      ? `${estimatedTimeRemaining} hours`
      : null,
  };
};
