// src/shared/ui/animated-marker.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

type Props = {
  trigger: number; // <-- теперь число, а не объект
};

export function AnimatedMarker({ trigger }: Props) {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Прыгает только когда trigger обновился
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: -12,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(bounceAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [trigger]);

  return (
    <Animated.View
      style={[
        styles.icon,
        {
          transform: [{ translateY: bounceAnim }],
        },
      ]}
    >
      <Ionicons name="location" size={48} color={colors.accentTurquoise} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  icon: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -24,
    marginTop: -48,
    zIndex: 10,
  },
});
