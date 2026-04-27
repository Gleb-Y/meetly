// src/entities/api/events/events.queries.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventsApi } from "./events.api";
import type {
  CreateEventRequest,
  QueryEventsRequest,
  UpdateEventRequest,
} from "./events.types";

/**
 * Получить все ивенты
 */
export function useEvents(params?: QueryEventsRequest) {
  return useQuery({
    queryKey: ["events", params],
    queryFn: () => eventsApi.getEvents(params),
    staleTime: 1000 * 60 * 5, // 5 минут
  });
}

/**
 * Получить мои ивенты
 */
export function useMyEvents() {
  return useQuery({
    queryKey: ["events", "my"],
    queryFn: () => eventsApi.getMyEvents(),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Получить ивент по ID
 */
export function useEvent(id: string) {
  return useQuery({
    queryKey: ["events", id],
    queryFn: () => eventsApi.getEventById(id),
    enabled: !!id,
  });
}

/**
 * Создать ивент
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEventRequest) => eventsApi.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["events", "my"] });
    },
  });
}

/**
 * Обновить ивент
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEventRequest }) =>
      eventsApi.updateEvent(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["events", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["events", "my"] });
    },
  });
}

/**
 * Удалить ивент
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => eventsApi.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["events", "my"] });
    },
  });
}

/**
 * Присоединиться к ивенту
 */
export function useJoinEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) => eventsApi.joinEvent(eventId),
    onSuccess: (data) => {
      console.log("✅ Joined event, chatId:", data.chatId);

      // Обновляем кеш ивентов
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["events", "my"] });
      queryClient.invalidateQueries({ queryKey: ["events", data.id] });

      // Обновляем список чатов
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: (error: any) => {
      console.error("❌ Error joining event:", error);
    },
  });
}

/**
 * Покинуть ивент
 */
export function useLeaveEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) => eventsApi.leaveEvent(eventId),
    onSuccess: (data) => {
      console.log("✅ Left event");

      // Обновляем кеш
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["events", "my"] });
      queryClient.invalidateQueries({ queryKey: ["events", data.id] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: (error: any) => {
      console.error("❌ Error leaving event:", error);
    },
  });
}
