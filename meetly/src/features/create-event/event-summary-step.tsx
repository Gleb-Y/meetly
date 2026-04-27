import type { CreateEventData } from "@/src/pages/create-event/create-event";
import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";

type Props = {
  data: CreateEventData;
  onBack: () => void;
  onCreate: () => void;
  isLoading?: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  party: "Вечеринка",
  gym: "Спорт",
  basketball: "Баскетбол",
  cocktail: "Бар",
};

export function EventSummaryStep({ data, onBack, onCreate, isLoading }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Проверьте данные</Text>

        <View style={styles.card}>
          {/* Название */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Название</Text>
            <Text style={styles.rowValue}>{data.title}</Text>
          </View>

          <View style={styles.divider} />

          {/* Категория */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Категория</Text>
            <Text style={styles.rowValue}>
              {CATEGORY_LABELS[data.category] || data.category}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Описание */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Описание</Text>
            <Text style={styles.rowValueMultiline}>{data.description}</Text>
          </View>

          <View style={styles.divider} />

          {/* Участников */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Участников</Text>
            <Text style={styles.rowValue}>
              До {data.maxParticipants} человек
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Адрес */}
          <View style={styles.rowColumn}>
            <Text style={styles.rowLabel}>Адрес</Text>
            <Text style={styles.rowValueMultiline}>{data.address}</Text>
          </View>

          <View style={styles.divider} />

          {/* Тип */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Тип</Text>
            <View style={styles.badge}>
              <Ionicons
                name={data.isPrivate ? "lock-closed" : "globe"}
                size={16}
                color={
                  data.isPrivate ? colors.accentPink : colors.accentTurquoise
                }
              />
              <Text
                style={[
                  styles.badgeText,
                  data.isPrivate && styles.badgeTextPrivate,
                ]}
              >
                {data.isPrivate ? "Закрытый" : "Открытый"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Кнопки */}
      <View style={styles.buttons}>
        <Pressable
          onPress={onBack}
          style={styles.buttonSecondary}
          disabled={isLoading}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.buttonSecondaryText}>Назад</Text>
        </Pressable>

        <Pressable
          onPress={onCreate}
          style={[styles.button, isLoading && styles.buttonDisabled]} // 👈 добавь
          disabled={isLoading} // 👈 добавь
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.buttonText}>Создать ивент</Text>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </>
          )}
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
    paddingBottom: 40,
    gap: 24,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowColumn: {
    gap: 8,
  },
  buttonDisabled: {
    backgroundColor: colors.buttonDisabled,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    flex: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  rowValueMultiline: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textPrimary,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.tabBarBorder,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accentTurquoise,
  },
  badgeTextPrivate: {
    color: colors.accentPink,
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
