import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type EmailAuthScreenProps = {
  onContinue: (phoneNumber: string) => void;
  onBack: () => void;
  isLoading?: boolean;
};

export function EmailAuthScreen({
  onContinue,
  onBack,
  isLoading = false,
}: EmailAuthScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState("");

  // Валидация E.164: международный формат
  // +[код страны][номер] - от 11 до 15 цифр всего
  // Примеры: +380989123456 (Украина), +77017544227 (Казахстан), +14155552671 (США)
  const isValidPhone = /^\+[1-9]\d{10,14}$/.test(phoneNumber.replace(/[\s\-()]/g, ""));

  const handleContinue = () => {
    if (isValidPhone && !isLoading) {
      // Отправляем в стандартном формате (убираем пробелы и скобки)
      const cleanPhone = phoneNumber.replace(/[\s\-()]/g, "");
      onContinue(cleanPhone);
    }
  };

  const handlePhoneChange = (text: string) => {
    // Позволяем вводить т только цифры, +, скобки и дефисы
    const cleaned = text.replace(/[^0-9+\-()]/g, "");
    setPhoneNumber(cleaned);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            style={styles.backButton}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.main}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>Введите номер телефона</Text>
            <Text style={styles.subtitle}>
              Мы отправим 6-значный код подтверждения на ваш номер телефона
            </Text>
          </View>

          <View style={styles.inputSection}>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              placeholder="+380XXXXXXXXX"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!isLoading}
            />
          </View>

          <View style={styles.info}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.infoText}>
              Мы не будем делиться вашим номером с другими пользователями
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleContinue}
          disabled={!isValidPhone || isLoading}
          style={[
            styles.button,
            (!isValidPhone || isLoading) && styles.buttonDisabled,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.buttonText}>Продолжить</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  main: {
    flex: 1,
    gap: 32,
  },
  titleSection: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  inputSection: {
    gap: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 18,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  info: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTurquoise,
    borderRadius: 16,
    paddingVertical: 18,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
