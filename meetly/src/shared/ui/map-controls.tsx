import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

type MapControlsProps = {
  onLocateMe: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function MapControls({
  onLocateMe,
  onZoomIn,
  onZoomOut,
}: MapControlsProps) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onLocateMe}
        style={({ pressed }) => [
          styles.controlButtonLarge,
          pressed && styles.controlButtonPressed,
        ]}
      >
        <Ionicons
          name="navigate-outline"
          size={20}
          color={colors.textPrimary}
        />
      </Pressable>

      <View style={styles.zoomGroup}>
        <Pressable
          onPress={onZoomIn}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && styles.controlButtonPressed,
          ]}
        >
          <Ionicons name="add" size={22} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.zoomDivider} />

        <Pressable
          onPress={onZoomOut}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && styles.controlButtonPressed,
          ]}
        >
          <Ionicons name="remove" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  controlButtonLarge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.96)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
  },
  zoomGroup: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.96)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
  },
  controlButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomDivider: {
    height: 1,
    backgroundColor: "rgba(148,163,184,0.4)",
    marginHorizontal: 6,
  },
  controlButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
