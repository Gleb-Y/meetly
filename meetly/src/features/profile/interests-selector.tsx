import { colors } from "@/src/shared/theme/colors";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type Interest = "party" | "gym" | "basketball" | "cocktail";

type Props = {
  selected: Interest[];
  onChange: (interests: Interest[]) => void;
};

const INTERESTS = [
  {
    id: "party" as Interest,
    label: "Вечеринки",
    icon: require("@assets/images/map-icons/disco.png"),
  },
  {
    id: "gym" as Interest,
    label: "Спорт",
    icon: require("@assets/images/map-icons/dumbbell.png"),
  },
  {
    id: "basketball" as Interest,
    label: "Баскетбол",
    icon: require("@assets/images/map-icons/basketball.png"),
  },
  {
    id: "cocktail" as Interest,
    label: "Бары",
    icon: require("@assets/images/map-icons/cocktail.png"),
  },
];

export function InterestsSelector({ selected, onChange }: Props) {
  const toggleInterest = (id: Interest) => {
    if (selected.includes(id)) {
      onChange(selected.filter((i) => i !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Интересы</Text>
      <View style={styles.grid}>
        {INTERESTS.map((interest) => {
          const isSelected = selected.includes(interest.id);
          return (
            <Pressable
              key={interest.id}
              onPress={() => toggleInterest(interest.id)}
              style={[styles.card, isSelected && styles.cardSelected]}
            >
              <Image source={interest.icon} style={styles.icon} />
              <Text style={[styles.text, isSelected && styles.textSelected]}>
                {interest.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.tabBarBorder,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  cardSelected: {
    borderColor: colors.accentTurquoise,
    backgroundColor: "rgba(34, 211, 238, 0.1)",
  },
  icon: {
    width: 40,
    height: 40,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  textSelected: {
    color: colors.accentTurquoise,
  },
});
