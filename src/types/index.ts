export interface Venue {
  id: string;
  name: string;
  description: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  imageURL: string;
  entryPrice: number;
  activityType: string;
  activities: string[];
  createdAt: Date;
  createdBy: string;
}

export interface ChatMessage {
  id: string;
  locationId: string;
  userId: string;
  userDisplayName: string;
  message: string;
  timestamp: Date;
}

export interface OnlineUser {
  id: string;
  displayName: string;
  lastSeen: Date;
}

export interface VenueFormValues {
  name: string;
  description: string;
  imageURL: string;
  entryPrice: string;
  activityType: string;
  activities: string;
}