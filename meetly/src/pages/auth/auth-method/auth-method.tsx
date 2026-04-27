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
import { SafeAreaView } from "react-native-safe-area-context";

type AuthMethodScreenProps = {
  onEmailAuth: (phoneNumber: string) => void;
  onGoogleAuth: () => void;
  onAppleAuth: () => void;
  onBack: () => void;
  isLoading?: boolean;
};

export function AuthMethodScreen({
  onEmailAuth,
  onGoogleAuth,
  onAppleAuth,
  onBack,
  isLoading = false,
}: AuthMethodScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState("");

  // Валидация E.164: международный формат
  // +[код страны][номер] - от 11 до 15 цифр всего
  // Примеры: +380989123456 (Украина), +77017544227 (Казахстан), +14155552671 (США)
  const isValidPhone = /^\+[1-9]\d{10,14}$/.test(phoneNumber.replace(/[\s\-()]/g, ""));

  const handlePhoneContinue = () => {
    if (isValidPhone && !isLoading) {
      const cleanPhone = phoneNumber.replace(/[\s\-()]/g, "");
      onEmailAuth(cleanPhone);
    }
  };

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/[^0-9+\-()]/g, "");
    setPhoneNumber(cleaned);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={onBack}
              style={styles.backButton}
              disabled={isLoading}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.textPrimary}
              />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.main}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>Войти в Meetly</Text>
              <Text style={styles.subtitle}>
                Введите номер телефона для получения кода подтверждения
              </Text>
            </View>

            {/* Phone Input */}
            <View style={styles.emailSection}>
              <TextInput
                style={styles.emailInput}
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

              <Pressable
                onPress={handlePhoneContinue}
                disabled={!isValidPhone || isLoading}
                style={[
                  styles.continueButton,
                  (!isValidPhone || isLoading) && styles.continueButtonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.continueButtonText}>Продолжить</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  </>
                )}
              </Pressable>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>или войти через</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Auth Buttons */}
            <View style={styles.socialButtons}>
              {/* Google */}
              <Pressable
                style={styles.socialButton}
                onPress={onGoogleAuth}
                disabled={isLoading}
              >
                <View
                  style={[styles.socialIcon, { backgroundColor: "#FFFFFF" }]}
                >
                  <Ionicons name="logo-google" size={24} color="#4285F4" />
                </View>
                <Text style={styles.socialButtonText}>Google</Text>
              </Pressable>

              {/* Apple */}
              <Pressable
                style={styles.socialButton}
                onPress={onAppleAuth}
                disabled={isLoading}
              >
                <View
                  style={[styles.socialIcon, { backgroundColor: "#000000" }]}
                >
                  <Ionicons name="logo-apple" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.socialButtonText}>Apple</Text>
              </Pressable>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Продолжая, вы принимаете{" "}
              <Text style={styles.footerLink}>Условия использования</Text> и{" "}
              <Text style={styles.footerLink}>Политику конфиденциальности</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
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
    fontSize: 32,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  emailSection: {
    gap: 16,
  },
  emailInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 18,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTurquoise,
    borderRadius: 16,
    paddingVertical: 18,
    gap: 8,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.tabBarBorder,
  },
  dividerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  socialButtons: {
    flexDirection: "row",
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    gap: 12,
  },
  socialIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  footer: {
    paddingTop: 24,
  },
  footerText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  footerLink: {
    color: colors.accentTurquoise,
    fontWeight: "600",
  },
});
