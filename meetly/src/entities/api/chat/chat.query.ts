import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "./chat.api";

/**
 * Получить список чатов
 */
export function useChats() {
  return useQuery({
    queryKey: ["chats"],
    queryFn: () => chatApi.getChats(),
    staleTime: 1000 * 30, // 30 секунд
  });
}

/**
 * Получить конкретный чат
 */
export function useChat(chatId: string) {
  return useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => chatApi.getChat(chatId),
    enabled: !!chatId,
  });
}

/**
 * Отправить сообщение
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chatId, content }: { chatId: string; content: string }) =>
      chatApi.sendMessage(chatId, content),
    onSuccess: (newMessage, { chatId }) => {
      // Обновляем кеш чата — добавляем новое сообщение
      queryClient.setQueryData(["chat", chatId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          messages: [...(oldData.messages || []), newMessage],
          lastMessage: newMessage,
        };
      });

      // Обновляем список чатов
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}

/**
 * Пометить сообщения как прочитанные
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chatId: string) => chatApi.markAsRead(chatId),
    onSuccess: (_, chatId) => {
      // Обновляем кеш чата — помечаем все сообщения как прочитанные
      queryClient.setQueryData(["chat", chatId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          messages: oldData.messages?.map((msg: any) => ({
            ...msg,
            isRead: true,
          })),
          unreadCount: 0,
        };
      });

      // Обновляем список чатов
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}
