import type { EventResponse } from "@/src/entities/api/events/events.types";
import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type EventListCardProps = {
  event: EventResponse;
  onPress: (event: EventResponse) => void;
};

const CATEGORY_CONFIG = {
  party: { icon: "musical-notes", color: "#8B5CF6", label: "Вечеринка" },
  gym: { icon: "barbell", color: "#EF4444", label: "Спорт" },
  basketball: { icon: "basketball", color: "#F97316", label: "Баскетбол" },
  cocktail: { icon: "wine", color: "#10B981", label: "Бар" },
} as const;

const CATEGORY_ICONS: Record<string, any> = {
  party: require("@assets/images/map-icons/disco.png"),
  gym: require("@assets/images/map-icons/dumbbell.png"),
  basketball: require("@assets/images/map-icons/basketball.png"),
  cocktail: require("@assets/images/map-icons/cocktail.png"),
};

export function EventListCard({ event, onPress }: EventListCardProps) {
  const config = CATEGORY_CONFIG[event.category];
  const icon = CATEGORY_ICONS[event.category];
  const participantsCount = event.participants?.length || 0;

  return (
    <Pressable
      onPress={() => onPress(event)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.content}>
        {/* Только иконка, без фона */}
        {icon && (
          <Image source={icon} style={styles.icon} resizeMode="contain" />
        )}

        {/* Информация о ивенте */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.category}>{config.label}</Text>

          {event.address && (
            <View style={styles.addressContainer}>
              <Ionicons
                name="location-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.address} numberOfLines={1}>
                {event.address}
              </Text>
            </View>
          )}

          {/* Участники */}
          <View style={styles.participantsContainer}>
            <Ionicons name="people" size={14} color={colors.textSecondary} />
            <Text style={styles.participants}>
              {participantsCount}/{event.maxParticipants}
            </Text>
            {event.isPrivate && (
              <>
                <View style={styles.dot} />
                <Ionicons
                  name="lock-closed"
                  size={12}
                  color={colors.accentPink}
                />
                <Text style={styles.privateText}>Закрытый</Text>
              </>
            )}
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  icon: {
    width: 48,
    height: 48,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  category: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  address: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  participantsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  participants: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textSecondary,
  },
  privateText: {
    fontSize: 12,
    color: colors.accentPink,
    fontWeight: "600",
  },
});
