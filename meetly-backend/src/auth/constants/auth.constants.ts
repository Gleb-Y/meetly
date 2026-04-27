export const VALID_INTERESTS = [
  'food',
  'sport',
  'music',
  'art',
  'travel',
  'photo',
  'games',
  'reading',
  'cinema',
] as const;

export type InterestType = (typeof VALID_INTERESTS)[number];

export const USER_PRIVATE_SELECT = {
  id: true,
  phoneNumber: true,
  // email: true,       <-- Удалите или закомментируйте
  interests: true,
  isActive: true,
  // firstName: true,   <-- Удалите или закомментируйте
  createdAt: true,
  // lastName: true,    <-- Удалите или закомментируйте
  updatedAt: true,
  username: true,
  avatar: true,
  bio: true,
  age: true,
  friendsCountVisibility: true,
  showFriendsInProfile: true,
  isProfileClosed: true,
};
