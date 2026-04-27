import type { EventResponse } from "@/src/entities/api/events/events.types";
import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import { BlurView } from "expo-blur";
import { useJoinEvent } from "@/src/entities/api/events/events.queries";

type Props = {
  event: EventResponse;
  onClose: () => void;
};

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

export function SelectedEventCard({ event, onClose }: Props) {
  const router = useRouter();
  const joinEventMutation = useJoinEvent();
  const [isJoining, setIsJoining] = useState(false);

  const categoryLabel = CATEGORY_LABELS[event.category] || event.category;
  const categoryColor =
    CATEGORY_COLORS[event.category] || colors.accentTurquoise;

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
            onClose();
            router.push(`/(tabs)/chat/${result.chatId}`);
          },
        },
        { text: "Позже", style: "cancel", onPress: onClose },
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

  const handleOpenDetails = () => {
    onClose();
    router.push(`/(tabs)/events/${event.id}`);
  };

  const handleRequestInvite = () => {
    // Для закрытых ивентов - переход на страницу деталей
    router.push({
      pathname: "/(tabs)/events",
      params: { eventId: event.id },
    });
  };

  const handleAction = event.isPrivate ? handleRequestInvite : handleJoinEvent;

  // const buttonConfig = event.isPrivate
  //   ? {
  //       text: "Запросить приглашение",
  //       icon: "mail" as const,
  //       color: "#8B5CF6",
  //     }
  //   : {
  //       text: "Присоединиться",
  //       icon: "checkmark-circle" as const,
  //       color: colors.accentTurquoise,
  //     };

  const buttonConfig = { icon: "chevron-forward" as const };

  return (
    <>
      {/* Address Banner (top) */}
      <View style={styles.topBanner}>
        <BlurView intensity={30} tint="dark" style={styles.topBannerBlur}>
          <View style={styles.topBannerContent}>
            <Ionicons
              name="location"
              size={18}
              color={colors.accentTurquoise}
            />
            <Text style={styles.addressText} numberOfLines={1}>
              {event.address}
            </Text>
            <Pressable onPress={onClose} style={styles.topCloseButton}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </BlurView>
      </View>

      {/* Compact Bottom Card */}
      <View style={styles.bottomContainer}>
        <BlurView intensity={20} tint="dark" style={styles.blurContainer}>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: categoryColor },
                  ]}
                >
                  <Text style={styles.categoryText}>{categoryLabel}</Text>
                </View>

                {event.isPrivate && (
                  <View style={styles.privateBadge}>
                    <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                    <Text style={styles.privateBadgeText}>Закрытый</Text>
                  </View>
                )}
              </View>

              <View style={styles.participantsRow}>
                <Ionicons
                  name="people"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.participantsCount}>
                  {participantsCount}/{event.maxParticipants}
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title} numberOfLines={1}>
              {event.title}
            </Text>

            {/* Creator + Action */}
            <View style={styles.footer}>
              <View style={styles.creatorInfo}>
                {event.creator.avatar ? (
                  <Image
                    source={{ uri: event.creator.avatar }}
                    style={styles.creatorAvatar}
                  />
                ) : (
                  <View style={styles.creatorAvatarPlaceholder}>
                    <Ionicons
                      name="person"
                      size={14}
                      color={colors.textSecondary}
                    />
                  </View>
                )}
                <Text style={styles.creatorName} numberOfLines={1}>
                  {event.creator.username
                    ? `@${event.creator.username}`
                    : event.creator.firstName || "Аноним"}
                </Text>
              </View>

              <Pressable
                onPress={handleOpenDetails}
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.accentTurquoise },
                ]}
              >
                {isJoining ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.actionButtonText}>Подробнее</Text>
                    <Ionicons
                      name={buttonConfig.icon}
                      size={16}
                      color="#FFFFFF"
                    />
                  </>
                )}
              </Pressable>
            </View>

            {/* Warning (if spots low) */}
            {!event.isPrivate && spotsLeft > 0 && spotsLeft <= 3 && (
              <View style={styles.warningBanner}>
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={colors.accentPink}
                />
                <Text style={styles.warningText}>
                  Осталось {spotsLeft} {spotsLeft === 1 ? "место" : "места"}
                </Text>
              </View>
            )}
          </View>
        </BlurView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Top Banner
  topBanner: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  topBannerBlur: {
    borderRadius: 16,
    overflow: "hidden",
  },
  topBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(11, 16, 32, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  topCloseButton: {
    padding: 4,
  },

  // Bottom Card
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  blurContainer: {
    borderRadius: 20,
    overflow: "hidden",
  },
  card: {
    backgroundColor: "rgba(11, 16, 32, 0.95)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#8B5CF6",
  },
  privateBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  participantsCount: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 24,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  creatorInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  creatorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.accentTurquoise,
  },
  creatorAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.tabBarBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  creatorName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  warningText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accentPink,
  },
});
