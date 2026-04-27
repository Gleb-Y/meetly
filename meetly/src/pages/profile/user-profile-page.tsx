import { useUserProfile } from "@/src/entities/api/user/user.query";
import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: user, isLoading } = useUserProfile(id!);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentTurquoise} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Пользователь не найден</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fullName = [user.firstName].filter(Boolean).join(" ");
  const displayName = fullName || user.username || "Аноним";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Профиль</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          {user.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={64} color={colors.textSecondary} />
            </View>
          )}

          <Text style={styles.displayName}>{displayName}</Text>
          {user.username && (
            <Text style={styles.username}>@{user.username}</Text>
          )}
        </View>

        {/* Info Cards */}
        <View style={styles.cardsContainer}>
          {/* Phone Number */}
          {user.phoneNumber && (
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={colors.accentTurquoise}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Телефон</Text>
                <Text style={styles.infoValue}>{user.phoneNumber}</Text>
              </View>
            </View>
          )}

          {/* Bio */}
          {user.bio && (
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.accentPurple}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>О себе</Text>
                <Text style={styles.infoValue}>{user.bio}</Text>
              </View>
            </View>
          )}

          {/* Joined Date */}
          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="time-outline"
                size={20}
                color={colors.accentTurquoise}
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>В Meetly с</Text>
              <Text style={styles.infoValue}>{formatDate(user.createdAt)}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Write Message */}
          <Pressable
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => {
              // TODO: Открыть личный чат с пользователем
              console.log("Open chat with user:", user.id);
            }}
          >
            <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Написать сообщение</Text>
          </Pressable>

          {/* Block User */}
          <Pressable
            style={[styles.actionButton, styles.dangerButton]}
            onPress={() => {
              // TODO: Заблокировать пользователя
              console.log("Block user:", user.id);
            }}
          >
            <Ionicons name="ban" size={20} color={colors.textPrimary} />
            <Text style={styles.dangerButtonText}>Заблокировать</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.tabBarBorder,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.accentTurquoise,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.tabBarBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: colors.accentTurquoise,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  dangerButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
