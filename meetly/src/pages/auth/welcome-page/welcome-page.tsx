import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type WelcomeScreenProps = {
  onGetStarted: () => void;
};

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="people" size={64} color={colors.accentTurquoise} />
          </View>
          <Text style={styles.logoText}>Meetly</Text>
          <Text style={styles.tagline}>Встречайся с новыми людьми</Text>
        </View>

        <View style={styles.features}>
          <FeatureItem
            icon="map"
            title="Найди ивенты рядом"
            description="Открывай события в твоем городе"
          />
          <FeatureItem
            icon="people"
            title="Знакомься с людьми"
            description="Встречай единомышленников"
          />
          <FeatureItem
            icon="calendar"
            title="Создавай события"
            description="Организуй свои встречи"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={onGetStarted} style={styles.button}>
          <Text style={styles.buttonText}>Начать</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.terms}>
          Продолжая, вы соглашаетесь с{" "}
          <Text style={styles.termsLink}>Условиями использования</Text>
        </Text>
      </View>
    </View>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon as any} size={28} color={colors.accentTurquoise} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: 48,
  },
  logoContainer: {
    alignItems: "center",
    gap: 16,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.accentTurquoise,
  },
  logoText: {
    fontSize: 42,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  features: {
    gap: 24,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footer: {
    paddingBottom: 40,
    gap: 16,
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
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  terms: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  termsLink: {
    color: colors.accentTurquoise,
    fontWeight: "600",
  },
});
