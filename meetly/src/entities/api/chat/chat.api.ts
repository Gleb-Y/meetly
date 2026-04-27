import { apiClient } from "../client/api-client";
import type { ChatsListResponse, Chat, ChatMessage } from "./chat.types";

export const chatApi = {
  /**
   * Получить список всех чатов пользователя
   * GET /api/chats
   */
  getChats: async (): Promise<ChatsListResponse> => {
    const response = await apiClient.get<ChatsListResponse>("/chats");
    return response.data;
  },

  /**
   * Получить конкретный чат
   * GET /api/chats/:chatId
   */
  getChat: async (chatId: string): Promise<Chat> => {
    const response = await apiClient.get<Chat>(`/chats/${chatId}`);
    return response.data;
  },

  /**
   * Отправить сообщение
   * POST /api/chats/:chatId/messages
   */
  sendMessage: async (
    chatId: string,
    content: string
  ): Promise<ChatMessage> => {
    const response = await apiClient.post<ChatMessage>(
      `/chats/${chatId}/messages`,
      { content }
    );
    return response.data;
  },

  /**
   * Пометить все сообщения как прочитанные
   * POST /api/chats/:chatId/read
   */
  markAsRead: async (chatId: string): Promise<void> => {
    await apiClient.post(`/chats/${chatId}/read`);
  },
};
