import { collection, query, where, onSnapshot, GeoPoint, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { reduceCoordinatePrecision, calculateDistance } from './geo-utils';

export interface NearbyUser {
  id: string;
  email: string;
  location: {
    latitude: number;
    longitude: number;
  };
  lastUpdated: Date;
  distance?: number;
}

const NEARBY_RADIUS_KM = 5; // Users within 5km radius

/**
 * Update user's location in Firestore
 */
export async function updateUserLocation(
  userId: string,
  latitude: number,
  longitude: number
) {
  try {
    // Reduce precision for privacy
    const lat = reduceCoordinatePrecision(latitude);
    const lng = reduceCoordinatePrecision(longitude);

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      location: new GeoPoint(lat, lng),
      lastLocationUpdate: new Date()
    });
  } catch (error) {
    console.error('Error updating user location:', error);
    throw error;
  }
}

/**
 * Subscribe to nearby users updates
 */
export function subscribeToNearbyUsers(
  currentUserId: string,
  currentLocation: { latitude: number; longitude: number },
  onUpdate: (users: NearbyUser[]) => void
) {
  // Query users collection
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef,
    where('lastLocationUpdate', '>', new Date(Date.now() - 15 * 60 * 1000)) // Only users active in last 15 minutes
  );

  // Subscribe to updates
  return onSnapshot(q, (snapshot) => {
    const nearbyUsers: NearbyUser[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      
      // Skip current user
      if (doc.id === currentUserId) return;

      // Skip users without location
      if (!data.location) return;

      // Calculate distance
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        data.location.latitude,
        data.location.longitude
      );

      // Only include users within radius
      if (distance <= NEARBY_RADIUS_KM) {
        nearbyUsers.push({
          id: doc.id,
          email: data.email,
          location: {
            latitude: data.location.latitude,
            longitude: data.location.longitude
          },
          lastUpdated: data.lastLocationUpdate.toDate(),
          distance
        });
      }
    });

    // Sort by distance
    nearbyUsers.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    
    onUpdate(nearbyUsers);
  });
}