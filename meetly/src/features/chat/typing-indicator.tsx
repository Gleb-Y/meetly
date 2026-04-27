import { colors } from "@/src/shared/theme/colors";
import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

type Props = {
  typingUsers: {
    id: string;
    username?: string | null;
    firstName?: string | null;
    avatar?: string | null;
  }[];
};

export function TypingIndicator({ typingUsers }: Props) {
  if (typingUsers.length === 0) return null;

  // Берём первого печатающего юзера
  const user = typingUsers[0];
  const userName = user.username || user.firstName || "Кто-то";

  return (
    <View style={styles.container}>
      {/* Аватар */}
      <View style={styles.avatarContainer}>
        {user.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {userName[0]?.toUpperCase() || "?"}
            </Text>
          </View>
        )}
      </View>

      {/* Баббл с анимированными точками */}
      <View style={styles.bubble}>
        <Text style={styles.userName}>{userName}</Text>
        <AnimatedDots />
      </View>
    </View>
  );
}

/**
 * Компонент анимированных точек
 */
function AnimatedDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation1 = animate(dot1, 0);
    const animation2 = animate(dot2, 150);
    const animation3 = animate(dot3, 300);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, []);

  const animatedStyle = (animValue: Animated.Value) => ({
    opacity: animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        scale: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1.2],
        }),
      },
    ],
  });

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, animatedStyle(dot1)]} />
      <Animated.View style={[styles.dot, animatedStyle(dot2)]} />
      <Animated.View style={[styles.dot, animatedStyle(dot3)]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  avatarContainer: {
    width: 32,
    height: 32,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    backgroundColor: colors.accentPurple,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 80,
    gap: 4,
  },
  userName: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 2,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
  },
});
