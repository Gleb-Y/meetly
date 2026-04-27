import { EventCategory } from "@/src/shared/lib/data/db";
import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

type EventFiltersProps = {
  selectedCategory: EventCategory | "all";
  onSelectCategory: (category: EventCategory | "all") => void;
};

const FILTERS = [
  { key: "all" as const, icon: "apps", label: "Все" },
  { key: "party" as const, icon: "musical-notes", label: "Вечеринки" },
  { key: "gym" as const, icon: "barbell", label: "Спорт" },
  { key: "basketball" as const, icon: "basketball", label: "Баскетбол" },
  { key: "cocktail" as const, icon: "wine", label: "Бары" },
];

export function EventFilters({
  selectedCategory,
  onSelectCategory,
}: EventFiltersProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {FILTERS.map((filter) => {
        const isSelected = selectedCategory === filter.key;
        return (
          <Pressable
            key={filter.key}
            onPress={() => onSelectCategory(filter.key)}
            style={({ pressed }) => [
              styles.chip,
              isSelected && styles.chipSelected,
              pressed && styles.chipPressed,
            ]}
          >
            <Ionicons
              name={filter.icon as any}
              size={18}
              color={isSelected ? "#FFFFFF" : colors.textSecondary}
            />
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  chipSelected: {
    backgroundColor: colors.bg,
    borderColor: colors.textPrimary,
  },
  chipPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  labelSelected: {
    color: "#FFFFFF",
  },
});
