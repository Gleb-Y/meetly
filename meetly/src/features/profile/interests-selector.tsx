import { colors } from "@/src/shared/theme/colors";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type Interest = "food" | "sport" | "music" | "art" | "travel" | "photo" | "games" | "reading" | "cinema";

type Props = {
  selected: Interest[];
  onChange: (interests: Interest[]) => void;
};

const INTERESTS = [
  {
    id: "sport" as Interest,
    label: "Спорт",
    icon: require("@assets/images/map-icons/dumbbell.png"),
  },
  {
    id: "food" as Interest,
    label: "Еда",
    icon: require("@assets/images/map-icons/disco.png"),
  },
  {
    id: "games" as Interest,
    label: "Игры",
    icon: require("@assets/images/map-icons/basketball.png"),
  },
  {
    id: "music" as Interest,
    label: "Музыка",
    icon: require("@assets/images/map-icons/cocktail.png"),
  },
  {
    id: "travel" as Interest,
    label: "Путешествия",
    icon: undefined,
  },
  {
    id: "art" as Interest,
    label: "Искусство",
    icon: undefined,
  },
  {
    id: "photo" as Interest,
    label: "Фотография",
    icon: undefined,
  },
  {
    id: "reading" as Interest,
    label: "Чтение",
    icon: undefined,
  },
  {
    id: "cinema" as Interest,
    label: "Кино",
    icon: undefined,
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
              {interest.icon ? (
                <Image source={interest.icon} style={styles.icon} />
              ) : (
                <Text style={styles.emoji}>✨</Text>
              )}
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
  emoji: {
    fontSize: 32,
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
