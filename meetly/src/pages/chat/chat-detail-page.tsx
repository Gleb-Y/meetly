import { useChat, useMarkAsRead } from "@/src/entities/api/chat/chat.query";
import type { ChatMessage } from "@/src/entities/api/chat/chat.types";
import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProfile } from "@/src/entities/api/user/user.query";
import { socketService } from "@/src/shared/services/socket.service";
import { useQueryClient } from "@tanstack/react-query";
import { TypingIndicator } from "@/src/features/chat/typing-indicator";

export default function ChatDetailScreen() {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const [typingUsersData, setTypingUsersData] = useState<
    {
      id: string;
      username?: string | null;
      firstName?: string | null;
      avatar?: string | null;
    }[]
  >([]);

  useEffect(() => {
    socketService.onUserTyping((data) => {
      console.log("⌨️ User typing event:", data);

      if (data.isTyping) {
        // Добавляем пользователя в список печатающих
        setTypingUsersData((prev) => {
          // Проверяем что его ещё нет в списке
          if (prev.some((u) => u.id === data.userId)) return prev;

          return [
            ...prev,
            {
              id: data.userId,
              username: data.username,
              firstName: data.firstName,
              avatar: data.avatar,
            },
          ];
        });
      } else {
        // Убираем пользователя из списка
        setTypingUsersData((prev) => prev.filter((u) => u.id !== data.userId));
      }
    });

    return () => {
      socketService.offAll();
    };
  }, []);

  const { data: chat, isLoading } = useChat(chatId!);
  const { data: profile } = useProfile();

  const markAsReadMutation = useMarkAsRead();

  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (chat?.messages) {
      console.log("📊 Chat messages:", JSON.stringify(chat.messages, null, 2));
      console.log("👤 First message sender:", chat.messages[0]?.sender);
      console.log("🖼️ First message avatar:", chat.messages[0]?.sender?.avatar);
    }
  }, [chat?.messages]);

  const currentUserId = profile?.id ?? "";

  // -----------------------------------------
  // 🔌 SOCKET CONNECTION + ROOM JOIN
  // -----------------------------------------
  useEffect(() => {
    if (!chatId) return;
    if (!chat) return;
    if (!profile) return;

    // 1. Connect socket
    socketService.connect();

    // 2. Join chat room using eventId + userId
    socketService.joinChat(chat.id);

    // 3. Listen for real-time messages
    socketService.onNewMessage((msg) => {
      console.log("📩 Realtime message:", msg);

      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    // 4. Listen for "messages read"
    socketService.onMessagesRead(() => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    });

    return () => {
      console.log("👋 Leaving chat room...");
      socketService.leaveChat(chat.id);
      socketService.offAll();
    };
  }, [chatId, chat, profile]);

  useEffect(() => {
    socketService.onUserTyping((data) => {
      if (data.isTyping) {
        setTypingUsers((prev) => [...prev, data.userId]);
      } else {
        setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
      }
    });
  }, []);

  // -----------------------------------------
  // AUTO SCROLL
  // -----------------------------------------
  useEffect(() => {
    if (chat?.messages?.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [chat?.messages?.length]);

  // -----------------------------------------
  // AUTO MARK AS READ
  // -----------------------------------------
  useEffect(() => {
    if (!chatId || !chat) return;

    if (chat.unreadCount > 0) {
      markAsReadMutation.mutate(chatId);
    }
  }, [chat?.unreadCount]);

  // -----------------------------------------
  // SEND MESSAGE
  // -----------------------------------------
  // Убираем userId из sendMessage
  const handleSend = async () => {
    if (!messageText.trim()) return;

    const content = messageText.trim();
    setMessageText("");

    // ❌ Удаляем HTTP
    // await sendMessageMutation.mutateAsync({ chatId, content });

    // ✅ ОТПРАВЛЯЕМ ТОЛЬКО ЧЕРЕЗ SOCKET
    socketService.sendMessage(chatId, content);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // -----------------------------------------
  // RENDER MESSAGE
  // -----------------------------------------
  const renderMessage = ({
    item,
    index,
  }: {
    item: ChatMessage;
    index: number;
  }) => {
    const isMyMessage = item.senderId === currentUserId;
    const next = chat?.messages?.[index + 1];
    const showAvatar = !next || next.senderId !== item.senderId;

    const senderName =
      item.sender.username || item.sender.firstName || "Аноним";

    return (
      <View style={[styles.messageRow, isMyMessage && styles.myMessageRow]}>
        {!isMyMessage && (
          <View style={styles.avatarContainer}>
            {showAvatar ? (
              // 👇 Проверяем что avatar существует и не null
              item.sender.avatar ? (
                <Image
                  source={{ uri: item.sender.avatar }}
                  style={styles.avatar}
                />
              ) : (
                // 👇 Плейсхолдер если нет аватара
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>
                    {senderName[0]?.toUpperCase() || "?"}
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.avatarSpacer} />
            )}
          </View>
        )}

        <View
          style={[
            styles.messageContent,
            isMyMessage && styles.myMessageContent,
          ]}
        >
          {!isMyMessage && showAvatar && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}

          <View
            style={[
              styles.messageBubble,
              isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
              ]}
            >
              {item.content}
            </Text>
          </View>

          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>
              {new Date(item.createdAt).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {isMyMessage && (
              <Ionicons
                name={item.isRead ? "checkmark-done" : "checkmark"}
                size={12}
                color={
                  item.isRead ? colors.accentTurquoise : colors.textSecondary
                }
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  // -----------------------------------------
  // LOADING
  // -----------------------------------------
  if (isLoading || !chat) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accentTurquoise} />
      </SafeAreaView>
    );
  }

  // -----------------------------------------
  // UI
  // -----------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons
              name="chevron-back"
              size={26}
              color={colors.textPrimary}
            />
          </Pressable>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{chat.event.title}</Text>
            <Text style={styles.headerSubtitle}>
              {chat.participantsCount} участников
            </Text>
          </View>

          <Ionicons
            name="ellipsis-horizontal"
            size={22}
            color={colors.textPrimary}
          />
        </View>

        {/* MESSAGE LIST */}
        <FlatList
          ref={flatListRef}
          data={chat.messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />

        <TypingIndicator typingUsers={typingUsersData} />

        {/* INPUT */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={messageText}
              placeholder="Сообщение..."
              placeholderTextColor={colors.textSecondary}
              multiline
              onChangeText={(text) => {
                setMessageText(text);
                socketService.typing(chatId, text.length > 0);
              }}
              onBlur={() => socketService.typing(chatId, false)}
            />
          </View>

          <Pressable
            onPress={handleSend}
            style={[
              styles.sendButton,
              !messageText.trim() && styles.sendButtonDisabled,
            ]}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --------------------
// STYLES
// --------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.tabBarBorder,
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-end",
  },
  myMessageRow: {
    flexDirection: "row-reverse",
  },
  avatarContainer: {
    width: 32,
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarSpacer: {
    width: 32,
    height: 32,
  },
  messageContent: {
    maxWidth: "75%",
    gap: 4,
  },
  myMessageContent: {
    alignItems: "flex-end",
  },
  senderName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myMessageBubble: {
    backgroundColor: colors.accentTurquoise,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
  },
  myMessageText: {
    color: "#fff",
  },
  otherMessageText: {
    color: colors.textPrimary,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  inputContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.tabBarBorder,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  input: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  avatarPlaceholder: {
    backgroundColor: colors.accentPurple, // 👈 Добавь цвет фона
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accentTurquoise,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
