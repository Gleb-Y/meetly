import type { CreateEventData } from "@/src/pages/create-event/create-event";
import type { EventCategory } from "@/src/shared/lib/data/db";
import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import React, { useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  data: Partial<CreateEventData>;
  onUpdate: (data: Partial<CreateEventData>) => void;
  onNext: () => void;
};

const CATEGORIES = [
  {
    key: "party" as const,
    icon: "musical-notes",
    label: "Вечеринка",
    color: "#8B5CF6",
  },
  { key: "sports" as const, icon: "barbell", label: "Спорт", color: "#EF4444" },
  {
    key: "hoops" as const,
    icon: "basketball",
    label: "Баскетбол",
    color: "#F97316",
  },
  { key: "bar" as const, icon: "wine", label: "Бар", color: "#10B981" },
  { key: "food" as const, icon: "restaurant", label: "Еда", color: "#F59E0B" },
  { key: "music" as const, icon: "headset", label: "Музыка", color: "#EC4899" },
  { key: "art" as const, icon: "brush", label: "Искусство", color: "#06B6D4" },
  { key: "outdoor" as const, icon: "tent", label: "На улице", color: "#84CC16" },
];

export function EventBasicInfoStep({ data, onUpdate, onNext }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const titleInputRef = useRef<TextInput>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const participantsInputRef = useRef<TextInput>(null);

  const [title, setTitle] = useState(data.title || "");
  const [category, setCategory] = useState<EventCategory | undefined>(
    data.category
  );
  const [description, setDescription] = useState(data.description || "");
  const [maxParticipants, setMaxParticipants] = useState(
    data.maxParticipants || 10
  );
  const [manualInput, setManualInput] = useState(
    (data.maxParticipants || 10).toString()
  );

  const canProceed =
    title.trim().length > 0 &&
    category &&
    description.trim().length > 0 &&
    maxParticipants >= 2;

  const handleNext = () => {
    if (canProceed) {
      onUpdate({
        title: title.trim(),
        category,
        description: description.trim(),
        maxParticipants,
      });
      onNext();
    }
  };

  const handleSliderChange = (value: number) => {
    const rounded = Math.round(value);
    setMaxParticipants(rounded);
    setManualInput(rounded.toString());
  };

  const handleManualInputChange = (text: string) => {
    setManualInput(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 2 && num <= 100) {
      setMaxParticipants(num);
    }
  };

  const handleDescriptionFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 300, animated: true });
    }, 100);
  };

  const handleParticipantsFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 500, animated: true });
    }, 100);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Название */}
      <View style={styles.section}>
        <Text style={styles.label}>Название ивента</Text>
        <TextInput
          ref={titleInputRef}
          style={styles.input}
          placeholder="Введите название..."
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          maxLength={50}
          returnKeyType="next"
          onSubmitEditing={() => descriptionInputRef.current?.focus()}
          blurOnSubmit={false}
        />
        <Text style={styles.hint}>{title.length}/50</Text>
      </View>

      {/* Категория */}
      <View style={styles.section}>
        <Text style={styles.label}>Категория</Text>
        <View style={styles.categoriesGrid}>
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                style={[
                  styles.categoryCard,
                  isSelected && { borderColor: cat.color, borderWidth: 2 },
                ]}
              >
                <View
                  style={[styles.categoryIcon, { backgroundColor: cat.color }]}
                >
                  <Ionicons name={cat.icon as any} size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.categoryLabel}>{cat.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Описание */}
      <View style={styles.section}>
        <Text style={styles.label}>Описание</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={descriptionInputRef}
            style={[styles.input, styles.textArea]}
            placeholder="Расскажите о вашем ивенте..."
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            maxLength={300}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            returnKeyType="done"
            blurOnSubmit={true}
            onFocus={handleDescriptionFocus}
          />
        </View>
        <Text style={styles.hint}>{description.length}/300</Text>
      </View>

      {/* Количество участников */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Максимум участников</Text>
          <View style={styles.manualInputWrapper}>
            <TextInput
              ref={participantsInputRef}
              style={styles.manualInput}
              value={manualInput}
              onChangeText={handleManualInputChange}
              keyboardType="number-pad"
              maxLength={3}
              returnKeyType="done"
              onFocus={handleParticipantsFocus}
              onSubmitEditing={() => {
                Keyboard.dismiss();
                participantsInputRef.current?.blur();
              }}
            />
            {participantsInputRef.current?.isFocused() && (
              <Pressable
                style={styles.miniDoneButton}
                onPress={() => {
                  Keyboard.dismiss();
                  participantsInputRef.current?.blur();
                }}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={2}
            maximumValue={100}
            step={1}
            value={maxParticipants}
            onValueChange={handleSliderChange}
            minimumTrackTintColor={colors.accentTurquoise}
            maximumTrackTintColor={colors.tabBarBorder}
            thumbTintColor={colors.accentTurquoise}
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>2</Text>
            <Text style={[styles.sliderLabel, styles.sliderLabelCenter]}>
              {maxParticipants} {maxParticipants === 1 ? "человек" : "людей"}
            </Text>
            <Text style={styles.sliderLabel}>100</Text>
          </View>
        </View>
      </View>

      {/* Кнопка */}
      <Pressable
        onPress={handleNext}
        disabled={!canProceed}
        style={[styles.button, !canProceed && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>Далее</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputWrapper: {
    position: "relative",
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
    paddingBottom: 50, // место для кнопки "Готово"
  },
  doneButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accentTurquoise,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accentTurquoise,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "right",
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  manualInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  manualInput: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "600",
    color: colors.accentTurquoise,
    borderWidth: 1,
    borderColor: colors.accentTurquoise,
    minWidth: 60,
    textAlign: "center",
  },
  miniDoneButton: {
    backgroundColor: colors.accentTurquoise,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderContainer: {
    gap: 8,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sliderLabelCenter: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accentTurquoise,
  },
  participantsPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  participantsText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTurquoise,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
