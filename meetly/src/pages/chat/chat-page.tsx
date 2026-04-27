import { useChats } from "@/src/entities/api/chat/chat.query";
import type { Chat, ChatFilter } from "@/src/entities/api/chat/chat.types";
import { colors } from "@/src/shared/theme/colors";
import { MainLayout } from "@/src/widgets/layout/main-layout";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const FILTERS: { value: ChatFilter; label: string; icon: string }[] = [
  { value: "all", label: "Все", icon: "apps" },
  { value: "unread", label: "Непрочитанные", icon: "mail-unread" },
  { value: "party", label: "Вечеринки", icon: "musical-notes" },
  { value: "gym", label: "Спорт", icon: "barbell" },
  { value: "basketball", label: "Баскетбол", icon: "basketball" },
  { value: "cocktail", label: "Бары", icon: "wine" },
];

export default function ChatListScreen() {
  const router = useRouter();
  const { data: chats, isLoading } = useChats();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ChatFilter>("all");

  // Фильтрация + поиск
  const filteredChats = useMemo(() => {
    if (!chats) return [];

    let filtered = chats;

    // Фильтр по категории
    if (activeFilter === "unread") {
      filtered = filtered.filter((chat) => chat.unreadCount > 0);
    } else if (activeFilter !== "all") {
      filtered = filtered.filter(
        (chat) => chat.event.category === activeFilter
      );
    }

    // Поиск
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter((chat) =>
        chat.event.title.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [chats, activeFilter, search]);

  // Подсчёт для каждого фильтра
  const filterCounts = useMemo(() => {
    if (!chats) return {};

    return {
      all: chats.length,
      unread: chats.filter((c) => c.unreadCount > 0).length,
      party: chats.filter((c) => c.event.category === "party").length,
      gym: chats.filter((c) => c.event.category === "gym").length,
      basketball: chats.filter((c) => c.event.category === "basketball").length,
      cocktail: chats.filter((c) => c.event.category === "cocktail").length,
    };
  }, [chats]);

  const handleOpenChat = (chat: Chat) => {
    router.push(`/(tabs)/chat/${chat.id}`);
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const hasUnread = item.unreadCount > 0;
    const lastMessageTime = item.lastMessage
      ? formatTime(item.lastMessage.createdAt)
      : "";

    return (
      <Pressable
        onPress={() => handleOpenChat(item)}
        style={[styles.chatItem, hasUnread && styles.chatItemUnread]}
      >
        {/* Event Icon */}
        <View
          style={[
            styles.chatAvatar,
            { backgroundColor: getCategoryColor(item.event.category) },
          ]}
        >
          <Ionicons
            name={getCategoryIcon(item.event.category) as any}
            size={24}
            color="#FFFFFF"
          />
        </View>

        {/* Info */}
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text
              style={[styles.chatTitle, hasUnread && styles.chatTitleUnread]}
              numberOfLines={1}
            >
              {item.event.title}
            </Text>
            {lastMessageTime && (
              <Text style={styles.chatTime}>{lastMessageTime}</Text>
            )}
          </View>

          {item.lastMessage && (
            <Text
              style={[
                styles.chatMessage,
                hasUnread && styles.chatMessageUnread,
              ]}
              numberOfLines={1}
            >
              {item.lastMessage.sender.username ||
                item.lastMessage.sender.firstName}
              : {item.lastMessage.content}
            </Text>
          )}

          <View style={styles.chatMeta}>
            <View style={styles.participantsInfo}>
              <Ionicons name="people" size={14} color={colors.textSecondary} />
              <Text style={styles.participantsCount}>
                {item.participantsCount}
              </Text>
            </View>

            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentTurquoise} />
        </View>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Чаты</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по чатам..."
            placeholderTextColor={colors.textSecondary}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>

        {/* Filters */}
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => {
            const isActive = activeFilter === item.value;
            const count = filterCounts[item.value] || 0;

            return (
              <Pressable
                onPress={() => setActiveFilter(item.value)}
                style={[
                  styles.filterButton,
                  isActive && styles.filterButtonActive,
                ]}
              >
                <Ionicons
                  name={item.icon as any}
                  size={16}
                  color={isActive ? "#FFFFFF" : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterText,
                    isActive && styles.filterTextActive,
                  ]}
                >
                  {item.label}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.filterBadge,
                      isActive && styles.filterBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterBadgeText,
                        isActive && styles.filterBadgeTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />

        {/* Chats List */}
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.chatsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>
                {search ? "Чаты не найдены" : "У вас пока нет чатов"}
              </Text>
            </View>
          }
        />
      </View>
    </MainLayout>
  );
}

// Helper functions
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    party: "#8B5CF6",
    gym: "#EF4444",
    basketball: "#F97316",
    cocktail: "#10B981",
  };
  return colors[category] || "#22D3EE";
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    party: "musical-notes",
    gym: "barbell",
    basketball: "basketball",
    cocktail: "wine",
  };
  return icons[category] || "chatbubbles";
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Только что";
  if (diffMins < 60) return `${diffMins}м назад`;
  if (diffHours < 24) return `${diffHours}ч назад`;
  if (diffDays === 1) return "Вчера";
  if (diffDays < 7) return `${diffDays}д назад`;

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

const styles = StyleSheet.create({
  container: {
    // flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  filtersList: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
    flexGrow: 0,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    borderRadius: 20,
    paddingHorizontal: 12, // 👈 Уменьшено с 16
    paddingVertical: 8,
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: colors.accentTurquoise,
    borderColor: colors.accentTurquoise,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  filterBadge: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  filterBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  filterBadgeTextActive: {
    color: "#FFFFFF",
  },
  chatsList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  chatItem: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  chatItemUnread: {
    borderColor: colors.accentTurquoise,
    borderWidth: 2,
  },
  chatAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  chatInfo: {
    flex: 1,
    gap: 6,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  chatTitleUnread: {
    fontWeight: "700",
  },
  chatTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chatMessage: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  chatMessageUnread: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  chatMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  participantsInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  participantsCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  unreadBadge: {
    backgroundColor: colors.accentTurquoise,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: "center",
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
