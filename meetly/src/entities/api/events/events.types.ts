import type { UserProfile } from "../user/user.types";

export enum EventCategory {
  PARTY = "party",
  SPORTS = "sports",
  HOOPS = "hoops",
  BAR = "bar",
  FOOD = "food",
  MUSIC = "music",
  ART = "art",
  OUTDOOR = "outdoor",
  CUSTOM = "custom",
}

// 👇 Основная структура ивента
export type Event = {
  id: string;
  title: string;
  description: string;
  date: string;
  isAllDay: boolean;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  visibility: "PUBLIC" | "PRIVATE";
  isPrivate: boolean; // Convenience field: true when visibility === "PRIVATE"
  category: EventCategory;
  status: "ACTIVE" | "COMPLETED" | "FINALIZED"; // Статус события
  maxParticipants: number;
  participantsCount: number;
  creatorId: string;
  creator: UserProfile;
  participants: UserProfile[];
  chatId: string; // ID чата ивента
  createdAt: string;
  updatedAt: string;
};

export type JoinEventRequest = {
  eventId: string;
};

export type JoinEventResponse = {
  event: Event;
  chatId: string;
  message: string;
};

export type LeaveEventRequest = {
  eventId: string;
};

export type LeaveEventResponse = {
  message: string;
};

// 👇 Запросы на создание и обновление события
export type CreateEventRequest = {
  eventName: string;
  category?: EventCategory;
  description: string;
  maxParticipants: number;
  locationName?: string; // Опционально
  locationAddress: string;
  locationLatitude: number;
  locationLongitude: number;
  visibility: "PUBLIC" | "PRIVATE";
  date: string; // ISO 8601 формат: "2026-04-27T18:00:00Z"
  isAllDay?: boolean;
};

export type UpdateEventRequest = Partial<CreateEventRequest>;

export type QueryEventsRequest = {
  category?: EventCategory;
  visibility?: "PUBLIC" | "PRIVATE";
  locationLatitude?: number;
  locationLongitude?: number;
  radius?: number;
};

// 👇 Обновлённая структура под реальный бэкенд
export type EventResponse = {
  id: string;
  eventName: string;
  category: EventCategory;
  description: string;
  maxParticipants: number;
  locationName: string;
  locationAddress: string;
  locationLatitude: number;
  locationLongitude: number;
  visibility: "PUBLIC" | "PRIVATE";
  chatId: string;
  isActive: boolean;
  creatorId: string;
  hostId: string;
  host: UserProfile;

  date: string;
  isAllDay: boolean;

  // 👇 Вложенные объекты от Prisma
  creator: {
    id: string;
    firstName: string | null;
    username: string | null;
    avatar: string | null;
    phoneNumber: string;
  };

  // 👇 Массив участников
  participants: {
    id: string;
    userId: string;
    eventId: string;
    joinedAt: string;
    user: {
      id: string;
      firstName: string | null;
      username: string | null;
      avatar: string | null;
    };
  }[];

  participantsCount: number;
  isUserParticipant: boolean;

  createdAt: string;
  updatedAt: string;
};

export type EventsListResponse = EventResponse[];
