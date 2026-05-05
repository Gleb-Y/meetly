import { apiClient } from "../client/api-client";
import type {
  CreateEventRequest,
  Event,
  EventResponse,
  EventsListResponse,
  QueryEventsRequest,
  UpdateEventRequest,
} from "./events.types";

/**
 * Преобразовать URL с неправильным IP на правильный
 */
function fixImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
  const apiBase = baseUrl.replace("/api", ""); // http://192.168.1.13:3000
  
  // Если URL содержит /uploads, заменить на правильный базовый URL
  if (url.includes("/uploads")) {
    const uploadPath = url.substring(url.indexOf("/uploads"));
    return `${apiBase}${uploadPath}`;
  }
  
  return url;
}

// 👇 Трансформирует ответ backend (новые названия) в формат frontend (старые названия)
function transformEventResponse(data: any): Event {
  const visibility = data.visibility || "PUBLIC";
  
  // Фиксим аватар создателя события
  if (data.creator && data.creator.avatar) {
    data.creator.avatar = fixImageUrl(data.creator.avatar);
  }
  
  return {
    id: data.id,
    title: data.eventName,
    description: data.description,
    date: data.date,
    isAllDay: data.isAllDay || false,
    location: {
      address: data.locationAddress,
      latitude: data.locationLatitude,
      longitude: data.locationLongitude,
    },
    visibility: visibility,
    isPrivate: visibility === "PRIVATE",
    category: data.category,
    status: data.status || "ACTIVE",
    maxParticipants: data.maxParticipants,
    participantsCount: data.participantsCount || 0,
    creatorId: data.creatorId,
    creator: data.creator,
    participants: data.participants?.map((p: any) => p.user) || [],
    chatId: data.chatId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export const eventsApi = {
  /**
   * Создать ивент
   * Трансформирует frontend данные в backend формат
   * POST /api/events
   */
  createEvent: async (data: CreateEventRequest): Promise<Event> => {
    // Трансформируем данные перед отправкой (frontend format -> backend format)
    const transformedData = {
      eventName: data.eventName,
      category: data.category,
      description: data.description,
      maxParticipants: data.maxParticipants,
      locationName: data.locationName || data.eventName,
      locationAddress: data.locationAddress,
      locationLatitude: data.locationLatitude,
      locationLongitude: data.locationLongitude,
      visibility: data.visibility,
      date: data.date,
      isAllDay: data.isAllDay || false,
    };

    const response = await apiClient.post("/events", transformedData);
    
    // Трансформируем ответ обратно (backend format -> frontend format)
    return transformEventResponse(response.data);
  },

  /**
   * Получить все ивенты (с фильтрами)
   * GET /api/events
   */
  getEvents: async (
    params?: QueryEventsRequest
  ): Promise<Event[]> => {
    console.log("📤 Fetching events with params:", params);
    const response = await apiClient.get("/events", { params });
    console.log("✅ Events response:", response.data);
    console.log("Events count:", response.data?.length || 0);
    return Array.isArray(response.data) 
      ? response.data.map(transformEventResponse)
      : [];
  },

  /**
   * Получить мои ивенты (созданные мной)
   * GET /api/events/my
   */
  getMyEvents: async (): Promise<Event[]> => {
    const response = await apiClient.get("/events/my");
    return Array.isArray(response.data)
      ? response.data.map(transformEventResponse)
      : [];
  },

  /**
   * Получить ивент по ID
   * GET /api/events/:id
   */
  getEventById: async (id: string): Promise<Event> => {
    const response = await apiClient.get(`/events/${id}`);
    return transformEventResponse(response.data);
  },

  /**
   * Обновить ивент
   * PATCH /api/events/:id
   */
  updateEvent: async (
    id: string,
    data: UpdateEventRequest
  ): Promise<Event> => {
    const response = await apiClient.patch(`/events/${id}`, data);
    return transformEventResponse(response.data);
  },

  /**
   * Удалить ивент
   * DELETE /api/events/:id
   */
  deleteEvent: async (id: string): Promise<void> => {
    await apiClient.delete(`/events/${id}`);
  },

  /**
   * Присоединиться к ивенту
   * POST /api/events/:id/join
   */
  joinEvent: async (id: string): Promise<Event> => {
    const response = await apiClient.post(`/events/${id}/join`);
    return transformEventResponse(response.data);
  },

  /**
   * Покинуть ивент
   * POST /api/events/:id/leave
   */
  leaveEvent: async (id: string): Promise<Event> => {
    const response = await apiClient.post(`/events/${id}/leave`);
    return transformEventResponse(response.data);
  },
};
