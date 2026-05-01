import {
  useProfile,
  useUpdateProfile,
} from "@/src/entities/api/user/user.query";
import type { UserInterest } from "@/src/entities/api/user/user.types";

import { AvatarPicker } from "@/src/features/profile/avatar-picker";
import { InterestsSelector } from "@/src/features/profile/interests-selector";
import { colors } from "@/src/shared/theme/colors";
import { MainLayout } from "@/src/widgets/layout/main-layout";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Image,
  TextInput,
  View,
} from "react-native";

type Tab = "edit" | "preview";

export default function EditProfileScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { mutate: updateProfile, isPending } = useUpdateProfile();

  const [activeTab, setActiveTab] = useState<Tab>("edit");

  const [formData, setFormData] = useState({
    username: profile?.username || "",
    bio: profile?.bio || "",
    age: profile?.age?.toString() || "",
    avatar: profile?.avatar || null,
    interests: (profile?.interests || []) as UserInterest[],
  });

  const handleSave = () => {
    if (!formData.username.trim()) {
      Alert.alert("Ошибка", "Укажите никнейм");
      return;
    }

    updateProfile(
      {
        username: formData.username.trim() || undefined,
        bio: formData.bio.trim() || undefined,
        age: formData.age ? parseInt(formData.age) : undefined,
        interests: formData.interests,
      },
      {
        onSuccess: () => {
          Alert.alert("Успех", "Профиль обновлён", [
            { text: "OK", onPress: () => router.push("/(tabs)/profile") },
          ]);
        },
      }
    );
  };

  const renderEditTab = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.formContainer}>
        {/* Avatar */}
        <AvatarPicker
          avatar={formData.avatar}
          onAvatarChange={(uri) => setFormData({ ...formData, avatar: uri })}
        />

        {/* Username */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Никнейм <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.username}
            onChangeText={(username) => setFormData({ ...formData, username })}
            placeholder="username"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
        </View>

        {/* Age */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Возраст</Text>
          <TextInput
            style={styles.input}
            value={formData.age}
            onChangeText={(age) => setFormData({ ...formData, age })}
            placeholder="18"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        {/* Bio */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>О себе</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.bio}
            onChangeText={(bio) => setFormData({ ...formData, bio })}
            placeholder="Расскажите о себе..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={300}
          />
          <Text style={styles.charCount}>{formData.bio.length}/300</Text>
        </View>

        {/* Interests */}
        <InterestsSelector
          selected={formData.interests}
          onChange={(interests) => setFormData({ ...formData, interests })}
        />

        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={isPending}
          style={[styles.saveButton, isPending && styles.saveButtonDisabled]}
        >
          <Text style={styles.saveButtonText}>
            {isPending ? "Сохранение..." : "Сохранить"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderPreviewTab = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.previewWrapper}>
        {/* Profile Card */}
        <View style={styles.previewCard}>
          {/* Avatar & Info */}
          <View style={styles.previewTopSection}>
            {/* Avatar */}
            {formData.avatar ? (
              <Image
                source={{ uri: formData.avatar }}
                style={styles.previewAvatar}
              />
            ) : (
              <View style={styles.previewAvatarPlaceholder}>
                <Text style={styles.previewAvatarText}>?</Text>
              </View>
            )}

            {/* Info */}
            <View style={styles.previewInfoSection}>
              {formData.username ? (
                <Text style={styles.previewUsername}>@{formData.username}</Text>
              ) : (
                <Text style={styles.previewUsernameEmpty}>@username</Text>
              )}

              {formData.firstName && (
                <Text style={styles.previewFirstName}>
                  {formData.firstName}
                </Text>
              )}

              {formData.age && (
                <View style={styles.previewAgeContainer}>
                  <Text style={styles.previewAgeText}>{formData.age} лет</Text>
                </View>
              )}
            </View>
          </View>

          {/* Bio */}
          {formData.bio && (
            <Text style={styles.previewBio} numberOfLines={3}>
              {formData.bio}
            </Text>
          )}

          {/* Stats (mock) */}
          <View style={styles.previewStatsRow}>
            <View style={styles.previewStatItem}>
              <Text style={styles.previewStatValue}>0</Text>
              <Text style={styles.previewStatLabel}>Создано</Text>
            </View>
            <View style={styles.previewStatDivider} />
            <View style={styles.previewStatItem}>
              <Text style={styles.previewStatValue}>0</Text>
              <Text style={styles.previewStatLabel}>Участий</Text>
            </View>
          </View>
        </View>

        {/* Interests */}
        {formData.interests.length > 0 && (
          <View style={styles.previewInterestsSection}>
            <Text style={styles.previewSectionTitle}>Интересы</Text>
            <View style={styles.previewInterestsList}>
              {formData.interests.map((interest) => {
                const icon = getInterestIcon(interest);
                return (
                  <View key={interest} style={styles.previewInterestCard}>
                    {icon && (
                      <Image source={icon} style={styles.previewInterestIcon} />
                    )}
                    <Text style={styles.previewInterestText}>
                      {getInterestLabel(interest)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );

  function getInterestIcon(interest: string) {
    const icons: Record<string, any> = {
      party: require("@assets/images/map-icons/disco.png"),
      gym: require("@assets/images/map-icons/dumbbell.png"),
      basketball: require("@assets/images/map-icons/basketball.png"),
      cocktail: require("@assets/images/map-icons/cocktail.png"),
    };
    return icons[interest];
  }

  return (
    <MainLayout>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <Pressable
            onPress={() => setActiveTab("edit")}
            style={[styles.tab, activeTab === "edit" && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "edit" && styles.tabTextActive,
              ]}
            >
              Редактирование
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("preview")}
            style={[styles.tab, activeTab === "preview" && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "preview" && styles.tabTextActive,
              ]}
            >
              Предпросмотр
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        {activeTab === "edit" ? renderEditTab() : renderPreviewTab()}
      </KeyboardAvoidingView>
    </MainLayout>
  );
}

function getInterestLabel(interest: string): string {
  const labels: Record<string, string> = {
    party: "Вечеринки",
    gym: "Спорт",
    basketball: "Баскетбол",
    cocktail: "Бары",
  };
  return labels[interest] || interest;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.tabBarBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accentTurquoise,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.accentTurquoise,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 100,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  required: {
    color: colors.accentPink,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "right",
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: colors.accentTurquoise,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: colors.buttonDisabled,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  previewWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    padding: 20,
    marginBottom: 16,
  },
  previewTopSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  previewAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  previewAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.tabBarBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  previewAvatarText: {
    fontSize: 32,
    color: colors.textSecondary,
  },
  previewInfoSection: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  previewUsername: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.accentTurquoise,
    marginBottom: 2,
  },
  previewUsernameEmpty: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 2,
    fontStyle: "italic",
  },
  previewFirstName: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  previewAgeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewAgeText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  previewBio: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  previewStatsRow: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 16,
  },
  previewStatItem: {
    flex: 1,
    alignItems: "center",
  },
  previewStatDivider: {
    width: 1,
    backgroundColor: colors.tabBarBorder,
    marginHorizontal: 16,
  },
  previewStatValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.accentTurquoise,
    marginBottom: 4,
  },
  previewStatLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  previewInterestsSection: {
    marginTop: 8,
  },
  previewSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  previewInterestsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  previewInterestCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewInterestIcon: {
    width: 20,
    height: 20,
  },
  previewInterestText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
