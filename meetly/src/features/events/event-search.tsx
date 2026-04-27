import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TextInput, View } from "react-native";

type EventSearchProps = {
  value: string;
  onChangeText: (text: string) => void;
};

export function EventSearch({ value, onChangeText }: EventSearchProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} color={colors.textSecondary} />
      <TextInput
        style={styles.input}
        placeholder="Поиск ивентов..."
        placeholderTextColor={colors.accentTurquoise}
        value={value}
        onChangeText={onChangeText}
      />
      {value.length > 0 && (
        <Ionicons
          name="close-circle"
          size={20}
          color={colors.textSecondary}
          onPress={() => onChangeText("")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
});
