export type UserInterest = "party" | "gym" | "basketball" | "cocktail";

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
  firstName?: string | null;
  username?: string | null;
  avatar?: string | null;
  bio?: string | null;
  age?: number | null;
  interests?: UserInterest[];
};
