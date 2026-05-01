import {
  useEvent,
  useJoinEvent,
} from "@/src/entities/api/events/events.queries";
import { useProfile } from "@/src/entities/api/user/user.query";
import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CATEGORY_LABELS: Record<string, string> = {
  party: "Вечеринка",
  gym: "Спорт",
  basketball: "Баскетбол",
  cocktail: "Бар",
};

const CATEGORY_COLORS: Record<string, string> = {
  party: "#8B5CF6",
  gym: "#EF4444",
  basketball: "#F97316",
  cocktail: "#10B981",
};

const CATEGORY_ICONS: Record<string, any> = {
  party: "musical-notes",
  gym: "barbell",
  basketball: "basketball",
  cocktail: "wine",
};

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, isLoading, refetch } = useEvent(id!);
  const { data: profile } = useProfile();
  const joinEventMutation = useJoinEvent();
  const [isJoining, setIsJoining] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentTurquoise} />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Ивент не найден</Text>
        </View>
      </SafeAreaView>
    );
  }

  const categoryLabel = CATEGORY_LABELS[event.category] || event.category;
  const categoryColor =
    CATEGORY_COLORS[event.category] || colors.accentTurquoise;
  const categoryIcon = CATEGORY_ICONS[event.category] || "calendar";

  const participantsCount = event.participants?.length || 0;
  const spotsLeft = event.maxParticipants - participantsCount;

  const handleJoinEvent = async () => {
    if (isJoining) return;

    setIsJoining(true);
    try {
      const result = await joinEventMutation.mutateAsync(event.id);

      Alert.alert("Успех! 🎉", `Вы присоединились к "${event.title}"`, [
        {
          text: "Открыть чат",
          onPress: () => {
            router.push(`/(tabs)/chat/${result.chatId}`);
          },
        },
        { text: "Позже", style: "cancel" },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Ошибка",
        error.response?.data?.message || "Не удалось присоединиться"
      );
    } finally {
      setIsJoining(false);
    }
  };

  const handleRequestInvite = () => {
    Alert.alert(
      "Запрос приглашения",
      "Организатор получит ваш запрос на участие",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Отправить",
          onPress: () => {
            // TODO: Реализовать логику отправки запроса
            Alert.alert("Успех! ✉️", "Запрос отправлен организатору");
          },
        },
      ]
    );
  };

  const handleCompleteEvent = async () => {
    Alert.alert(
      "Завершить событие?",
      "Это действие нельзя отменить. Все участники получат уведомление.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Завершить",
          style: "destructive",
          onPress: async () => {
            setIsCompleting(true);
            try {
              const response = await fetch(
                `http://192.168.1.16:3000/api/events/${id}/complete`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${await AsyncStorage.getItem("access_token")}`,
                  },
                }
              );

              if (response.ok) {
                Alert.alert("Успех! ✅", "Событие завершено", [
                  {
                    text: "OK",
                    onPress: () => {
                      refetch();
                      router.back();
                    },
                  },
                ]);
              } else {
                Alert.alert("Ошибка", "Не удалось завершить событие");
              }
            } catch (error: any) {
              Alert.alert(
                "Ошибка",
                error.message || "Не удалось завершить событие"
              );
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ]
    );
  };

  const handleAction = event.isPrivate ? handleRequestInvite : handleJoinEvent;

  const buttonConfig = event.isPrivate
    ? {
        text: "Запросить приглашение",
        icon: "mail" as const,
        color: "#8B5CF6",
      }
    : {
        text: "Присоединиться",
        icon: "checkmark-circle" as const,
        color: colors.accentTurquoise,
      };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Детали ивента</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Category Badge */}
        <View style={styles.categoryContainer}>
          <View
            style={[styles.categoryBadge, { backgroundColor: categoryColor }]}
          >
            <Ionicons name={categoryIcon} size={20} color="#FFFFFF" />
            <Text style={styles.categoryText}>{categoryLabel}</Text>
          </View>

          {event.isPrivate && (
            <View style={styles.privateBadge}>
              <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
              <Text style={styles.privateBadgeText}>Закрытый</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>{event.title}</Text>

        {/* Organizer */}
        <Pressable
          style={styles.organizerCard}
          onPress={() => router.push(`/(tabs)/user/${event.creator.id}`)}
        >
          <View style={styles.organizerHeader}>
            <Text style={styles.organizerLabel}>Организатор</Text>
          </View>

          <View style={styles.organizerInfo}>
            {event.creator.avatar ? (
              <Image
                source={{ uri: event.creator.avatar }}
                style={styles.organizerAvatar}
              />
            ) : (
              <View style={styles.organizerAvatarPlaceholder}>
                <Text style={styles.organizerAvatarText}>
                  {(event.creator.username ||
                    event.creator.firstName ||
                    "?")[0]?.toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.organizerDetails}>
              <Text style={styles.organizerName}>
                {event.creator.username || "Аноним"}
              </Text>
              {event.creator.username && (
                <Text style={styles.organizerUsername}>
                  @{event.creator.username}
                </Text>
              )}
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </View>
        </Pressable>

        {/* Info Cards */}
        <View style={styles.infoGrid}>
          {/* Date */}
          <View style={styles.infoCard}>
            <View
              style={[
                styles.infoIcon,
                { backgroundColor: "rgba(239, 68, 68, 0.15)" },
              ]}
            >
              <Ionicons name="calendar" size={20} color="#EF4444" />
            </View>
            <Text style={styles.infoLabel}>Дата</Text>
            <Text style={styles.infoValue}>
              {new Date(event.date).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>

          {/* Time */}
          <View style={styles.infoCard}>
            <View
              style={[
                styles.infoIcon,
                { backgroundColor: "rgba(34, 211, 238, 0.15)" },
              ]}
            >
              <Ionicons name="time" size={20} color={colors.accentTurquoise} />
            </View>
            <Text style={styles.infoLabel}>Время</Text>
            <Text style={styles.infoValue}>
              {new Date(event.date).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          {/* Participants */}
          <View style={styles.infoCard}>
            <View
              style={[
                styles.infoIcon,
                { backgroundColor: "rgba(139, 92, 246, 0.15)" },
              ]}
            >
              <Ionicons name="people" size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.infoLabel}>Участники</Text>
            <Text style={styles.infoValue}>
              {participantsCount}/{event.maxParticipants} человек
            </Text>
          </View>
        </View>

        {/* Location */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Ionicons
              name="location"
              size={20}
              color={colors.accentTurquoise}
            />
            <Text style={styles.locationLabel}>Локация</Text>
          </View>
          <Text style={styles.locationAddress}>{event.address}</Text>
          <Pressable
            style={styles.showMapButton}
            onPress={() => {
              router.push({
                pathname: "/(tabs)/map",
                params: { eventId: event.id },
              });
            }}
          >
            <Text style={styles.showMapButtonText}>Показать на карте</Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={colors.accentTurquoise}
            />
          </Pressable>
        </View>

        {/* Description */}
        {event.description && (
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionLabel}>Описание</Text>
            <Text style={styles.descriptionText}>{event.description}</Text>
          </View>
        )}

        {/* Warning */}
        {!event.isPrivate && spotsLeft > 0 && spotsLeft <= 3 && (
          <View style={styles.warningCard}>
            <Ionicons name="alert-circle" size={20} color={colors.accentPink} />
            <Text style={styles.warningText}>
              Осталось всего {spotsLeft} {spotsLeft === 1 ? "место" : "места"}!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={styles.bottomContainer}>
        {/* Кнопка завершения события для организатора */}
        {profile?.id === event.creatorId && event.status === "ACTIVE" && (
          <Pressable
            onPress={handleCompleteEvent}
            disabled={isCompleting}
            style={[
              styles.completeButton,
              isCompleting && styles.completeButtonDisabled,
            ]}
          >
            {isCompleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>Завершить</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Основная кнопка - присоединение или запрос */}
        {event.status === "ACTIVE" && profile?.id !== event.creatorId && (
          <Pressable
            onPress={handleAction}
            disabled={isJoining}
            style={[
              styles.actionButton,
              { backgroundColor: buttonConfig.color },
              isJoining && styles.actionButtonDisabled,
            ]}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name={buttonConfig.icon} size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>{buttonConfig.text}</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Статус если событие не активно */}
        {event.status !== "ACTIVE" && (
          <View
            style={[
              styles.actionButton,
              { backgroundColor: colors.buttonDisabled },
            ]}
          >
            <Text style={styles.actionButtonText}>Событие завершено</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.tabBarBorder,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 34,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  categoryContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#8B5CF6",
  },
  privateBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 34,
  },
  organizerCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    padding: 16,
    gap: 12,
  },
  organizerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  organizerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  organizerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  organizerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.accentTurquoise,
  },
  organizerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentPurple,
    borderWidth: 2,
    borderColor: colors.tabBarBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  organizerAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  organizerDetails: {
    flex: 1,
    gap: 2,
  },
  organizerName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  organizerUsername: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    padding: 14,
    gap: 8,
    alignItems: "center",
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  locationCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    padding: 16,
    gap: 12,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
    lineHeight: 20,
  },
  showMapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  showMapButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accentTurquoise,
  },
  descriptionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    padding: 16,
    gap: 12,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  descriptionText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.accentPink,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 34,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.tabBarBorder,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 16,
    gap: 10,
    backgroundColor: "#EF4444",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
