export interface Event {
  id: string;
  title: string;
  description: string;
  category: "sport" | "party" | "culture" | "outdoor" | "other";
  date: Date;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  creator: {
    id: string;
    name: string;
    avatar?: string;
  };
  participants: string[];
  maxParticipants: number;
  status: "pending" | "confirmed" | "cancelled";
}

export interface User {
  id: string;
  name: string;
  age: number;
  avatar?: string;
  bio?: string;
  interests: string[];
}
