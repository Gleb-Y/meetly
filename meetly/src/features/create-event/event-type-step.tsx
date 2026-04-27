import type { CreateEventData } from "@/src/pages/create-event/create-event";
import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = {
  data: Partial<CreateEventData>;
  onUpdate: (data: Partial<CreateEventData>) => void;
  onNext: () => void;
  onBack: () => void;
};

export function EventTypeStep({ data, onUpdate, onNext, onBack }: Props) {
  const [isPrivate, setIsPrivate] = useState(data.isPrivate ?? false);

  const handleNext = () => {
    onUpdate({ isPrivate });
    onNext();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.label}>Тип ивента</Text>

        <Pressable
          onPress={() => setIsPrivate(false)}
          style={[styles.typeCard, !isPrivate && styles.typeCardSelected]}
        >
          <View style={styles.typeHeader}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="globe-outline"
                size={28}
                color={colors.accentTurquoise}
              />
            </View>
            <View style={styles.typeInfo}>
              <Text style={styles.typeTitle}>Открытый</Text>
              <Text style={styles.typeDescription}>
                Любой пользователь может увидеть и присоединиться к ивенту
              </Text>
            </View>
          </View>
          {!isPrivate && (
            <View style={styles.checkmark}>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={colors.accentTurquoise}
              />
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => setIsPrivate(true)}
          style={[styles.typeCard, isPrivate && styles.typeCardSelected]}
        >
          <View style={styles.typeHeader}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={28}
                color={colors.accentPink}
              />
            </View>
            <View style={styles.typeInfo}>
              <Text style={styles.typeTitle}>Закрытый</Text>
              <Text style={styles.typeDescription}>
                Только приглашенные пользователи смогут присоединиться
              </Text>
            </View>
          </View>
          {isPrivate && (
            <View style={styles.checkmark}>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={colors.accentPink}
              />
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.buttons}>
        <Pressable onPress={onBack} style={styles.buttonSecondary}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.buttonSecondaryText}>Назад</Text>
        </Pressable>

        <Pressable onPress={handleNext} style={styles.button}>
          <Text style={styles.buttonText}>Далее</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  typeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.tabBarBorder,
  },
  typeCardSelected: {
    borderColor: colors.accentTurquoise,
  },
  typeHeader: {
    flexDirection: "row",
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  typeInfo: {
    flex: 1,
    gap: 4,
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  typeDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  checkmark: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTurquoise,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
