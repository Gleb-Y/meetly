export type UserInterest = "food" | "sport" | "music" | "art" | "travel" | "photo" | "games" | "reading" | "cinema";

export type UserProfile = {
  id: string;
  phoneNumber: string;
  firstName: string | null;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  age: number | null;
  interests: UserInterest[];
  createdAt: string;
  updatedAt: string;
};

export type UpdateProfileRequest = {
  username?: string | null;
  bio?: string | null;
  age?: number | null;
  interests?: UserInterest[];
  // Note: avatar is uploaded separately via POST /users/me/avatar
};
