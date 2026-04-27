import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;
  private readonly BASE_URL =
    process.env.EXPO_PUBLIC_API_URL?.replace("/api", "") ||
    "http://localhost:3000";

  /**
   * Подключиться к Socket.IO с токеном
   */
  async connect() {
    if (this.socket?.connected) {
      console.log("✅ Socket already connected");
      return;
    }

    // Отключаем старый socket если есть
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
      console.error("❌ No auth token found");
      return;
    }

    const socketUrl = `${this.BASE_URL}/chat`;
    console.log("🔌 Connecting to socket:", socketUrl);
    console.log("🔑 Token:", token ? `${token.substring(0, 20)}...` : "null");

    this.socket = io(socketUrl, {
      transports: ["polling", "websocket"], // ← Сначала polling, потом websocket
      auth: {
        token,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000, // ← Таймаут подключения 10 секунд
    });

    this.socket.on("connect", () => {
      console.log("✅ Socket connected:", this.socket?.id);
    });

    this.socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message);
      console.error("📍 Socket URL:", socketUrl);
      console.error("🔍 Error details:", error);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("👋 Socket disconnected:", reason);

      // Если сервер закрыл соединение - не переподключаемся автоматически
      if (reason === "io server disconnect") {
        console.log("⚠️ Server closed connection, manual reconnect required");
      }
    });

    this.socket.on("error", (error) => {
      console.error("❌ Socket error:", error);
    });
  }

  typing(chatId: string, isTyping: boolean) {
    if (!this.socket?.connected) return;

    this.socket.emit("typing", { chatId, isTyping });
  }

  onUserTyping(
    callback: (data: {
      userId: string;
      username?: string;
      firstName?: string;
      avatar?: string;
      isTyping: boolean;
    }) => void
  ) {
    if (!this.socket) return;

    this.socket.off("userTyping");
    this.socket.on("userTyping", callback);
  }

  /**
   * Отключиться от Socket.IO
   */
  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners(); // ← Удаляем все listeners
      this.socket.disconnect();
      this.socket = null;
      console.log("👋 Socket disconnected manually");
    }
  }

  /**
   * Проверить что socket подключен
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Присоединиться к чату
   */
  joinChat(chatId: string) {
    if (!this.socket || !this.socket.connected) {
      console.error("❌ Socket not connected, cannot join chat");
      return;
    }

    console.log("📥 Joining chat:", chatId);

    this.socket.emit("joinChat", { chatId }, (response: any) => {
      if (response?.success) {
        console.log("✅ Joined chat:", chatId);
      } else {
        console.error("❌ Failed to join chat:", response?.error);
      }
    });
  }

  /**
   * Покинуть чат
   */
  leaveChat(chatId: string) {
    if (!this.socket || !this.socket.connected) return;

    console.log("👋 Leaving chat:", chatId);

    this.socket.emit("leaveChat", { chatId }, (response: any) => {
      if (response?.success) {
        console.log("✅ Left chat:", chatId);
      } else {
        console.error("❌ Failed to leave chat:", response?.error);
      }
    });
  }

  /**
   * Отправить сообщение
   */
  sendMessage(chatId: string, content: string) {
    if (!this.socket || !this.socket.connected) {
      console.error("❌ Socket not connected, cannot send message");
      return;
    }

    console.log("📤 Sending message to chat:", chatId);

    this.socket.emit("sendMessage", { chatId, content }, (response: any) => {
      if (response?.success) {
        console.log("✅ Message sent:", response.message?.id);
      } else {
        console.error("❌ Failed to send message:", response?.error);
      }
    });
  }

  /**
   * Слушать новые сообщения
   */
  onNewMessage(callback: (message: any) => void) {
    if (!this.socket) return;

    // Удаляем старый listener перед добавлением нового
    this.socket.off("newMessage");

    this.socket.on("newMessage", (message) => {
      console.log("📩 New message received:", message.id);
      callback(message);
    });
  }

  /**
   * Пометить сообщение как прочитанное
   */
  markAsRead(messageId: string) {
    if (!this.socket || !this.socket.connected) return;

    this.socket.emit("markAsRead", { messageId }, (response: any) => {
      if (response?.success) {
        console.log("✅ Message marked as read:", messageId);
      } else {
        console.error("❌ Failed to mark as read:", response?.error);
      }
    });
  }

  /**
   * Слушать события "сообщения прочитаны"
   */
  onMessagesRead(callback: () => void) {
    if (!this.socket) return;

    this.socket.off("messagesRead");

    this.socket.on("messagesRead", () => {
      console.log("✅ Messages marked as read");
      callback();
    });
  }

  /**
   * Отписаться от всех событий
   */
  offAll() {
    if (this.socket) {
      this.socket.off("newMessage");
      this.socket.off("messagesRead");
    }
  }
}

export const socketService = new SocketService();
