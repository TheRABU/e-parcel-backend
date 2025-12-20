const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number"
  ) {
    throw new Error("All parameters must be numbers");
  }

  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
    throw new Error("Latitude must be between -90 and 90 degrees");
  }

  if (lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) {
    throw new Error("Longitude must be between -180 and 180 degrees");
  }

  const R = 6371;

  const toRad = (degree) => degree * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceKm = R * c;

  const distanceMiles = distanceKm * 0.621371;

  const distanceInKilometer = parseFloat(distanceKm.toFixed(2));

  return distanceInKilometer;
  //   return {
  //     kilometers: parseFloat(distanceKm.toFixed(2)),
  //     miles: parseFloat(distanceMiles.toFixed(2)),
  //     meters: parseFloat((distanceKm * 1000).toFixed(0)),
  //   };
};

const estimateDeliveryTime = (distanceKm, vehicleType = "bike") => {
  const speedMap = {
    bike: 25,
    car: 40,
    truck: 30,
    walking: 5,
  };

  const avgSpeed = speedMap[vehicleType.toLowerCase()] || speedMap.bike;

  const hours = distanceKm / avgSpeed;

  const bufferFactor = 1.3;
  const totalHours = hours * bufferFactor;

  const hoursInt = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hoursInt) * 60);

  return {
    hours: hoursInt,
    minutes: minutes,
    totalHours: parseFloat(totalHours.toFixed(2)),
    vehicleType: vehicleType,
  };
};

const calculateDistanceAndTime = (pickup, delivery, vehicleType = "bike") => {
  try {
    const distance = calculateDistance(
      pickup.lat,
      pickup.lng,
      delivery.lat,
      delivery.lng
    );

    const timeEstimate = estimateDeliveryTime(distance.kilometers, vehicleType);

    return {
      distance,
      timeEstimate,
      pickup: {
        coordinates: { lat: pickup.lat, lng: pickup.lng },
      },
      delivery: {
        coordinates: { lat: delivery.lat, lng: delivery.lng },
      },
      calculatedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Failed to calculate distance: ${error.message}`);
  }
};

export { calculateDistance, estimateDeliveryTime, calculateDistanceAndTime };
