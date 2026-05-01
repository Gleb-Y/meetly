import type { Event } from "@/src/entities/api/events/events.types";
import { colors } from "@/src/shared/theme/colors";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

type Props = {
  event: Event;
  isSelected: boolean;
};

const CATEGORY_ICONS: Record<string, any> = {
  party: require("@assets/images/map-icons/disco.png"),
  gym: require("@assets/images/map-icons/dumbbell.png"),
  basketball: require("@assets/images/map-icons/basketball.png"),
  cocktail: require("@assets/images/map-icons/cocktail.png"),
};

export function EventMarker({ event, isSelected }: Props) {
  const icon = CATEGORY_ICONS[event.category];

  return (
    <View style={styles.container}>
      {/* Только иконка, без фона */}
      {icon && (
        <Image
          source={icon}
          style={[styles.icon, isSelected && styles.iconSelected]}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  icon: {
    width: 60,
    height: 60,
  },
  iconSelected: {
    width: 50,
    height: 50,
  },
  labelContainer: {
    position: "absolute",
    top: -35,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    maxWidth: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
