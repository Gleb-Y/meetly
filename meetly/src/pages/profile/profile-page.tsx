import { useEvents } from "@/src/entities/api/events/events.queries";
import { useProfile } from "@/src/entities/api/user/user.query";
import { colors } from "@/src/shared/theme/colors";
import { MainLayout } from "@/src/widgets/layout/main-layout";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ProfileScreen() {
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();
  const { data: events } = useEvents();

  const hasProfile = profile?.username || profile?.avatar || profile?.bio;

  // Статистика
  const stats = useMemo(() => {
    if (!profile || !events) return { created: 0, participated: 0 };

    const created = events.filter((e) => e.creatorId === profile.id).length;
    const participated = events.filter((e) =>
      e.participants.some((p) => p.userId === profile.id)
    ).length;

    return { created, participated };
  }, [profile, events]);

  const handleEdit = () => {
    router.push("/(tabs)/edit-profile");
  };

  const handleLogout = () => {
    AsyncStorage.removeItem("authToken").then(() => {
      router.replace("/(auth)/welcome");
    });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentTurquoise} />
        </View>
      </MainLayout>
    );
  }

  if (!hasProfile) {
    return (
      <MainLayout>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyAvatarPlaceholder}>
            <Ionicons name="person" size={64} color={colors.textSecondary} />
          </View>

          <Text style={styles.emptyTitle}>Заполните профиль</Text>
          <Text style={styles.emptySubtitle}>
            Расскажите о себе, чтобы другие пользователи могли узнать вас лучше
          </Text>

          <Pressable onPress={handleEdit} style={styles.fillButton}>
            <Text style={styles.fillButtonText}>Заполнить профиль</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Профиль</Text>
            <Pressable onPress={handleEdit} style={styles.editButton}>
              <Ionicons
                name="create-outline"
                size={24}
                color={colors.textPrimary}
              />
            </Pressable>
          </View>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            {/* Avatar & Info */}
            <View style={styles.topSection}>
              {/* Avatar */}
              {profile?.avatar ? (
                <Image source={{ uri: profile.avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons
                    name="person"
                    size={40}
                    color={colors.textSecondary}
                  />
                </View>
              )}

              {/* Info */}
              <View style={styles.infoSection}>
                {profile?.username && (
                  <Text style={styles.username}>@{profile.username}</Text>
                )}

                {profile?.firstName && (
                  <Text style={styles.firstName}>{profile.firstName}</Text>
                )}

                {profile?.age && (
                  <View style={styles.ageContainer}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.ageText}>{profile.age} лет</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Bio */}
            {profile?.bio && (
              <Text style={styles.bio} numberOfLines={3}>
                {profile.bio}
              </Text>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.created}</Text>
                <Text style={styles.statLabel}>Создано</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.participated}</Text>
                <Text style={styles.statLabel}>Участий</Text>
              </View>
            </View>
          </View>

          {/* Interests */}
          {profile?.interests && profile.interests.length > 0 && (
            <View style={styles.interestsSection}>
              <Text style={styles.sectionTitle}>Интересы</Text>
              <View style={styles.interestsList}>
                {profile.interests.map((interest) => {
                  const icon = getInterestIcon(interest);
                  return (
                    <View key={interest} style={styles.interestCard}>
                      {icon && (
                        <Image source={icon} style={styles.interestIcon} />
                      )}
                      <Text style={styles.interestText}>
                        {getInterestLabel(interest)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
        {/* <Pressable onPress={handleLogout}>
          <Text style={styles.ageText}>выйти</Text>
        </Pressable> */}
      </ScrollView>
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

function getInterestIcon(interest: string) {
  const icons: Record<string, any> = {
    party: require("@assets/images/map-icons/disco.png"),
    gym: require("@assets/images/map-icons/dumbbell.png"),
    basketball: require("@assets/images/map-icons/basketball.png"),
    cocktail: require("@assets/images/map-icons/cocktail.png"),
  };
  return icons[interest];
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyAvatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.tabBarBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
  },
  fillButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentTurquoise,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  fillButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  editButton: {
    padding: 8,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    padding: 20,
    marginBottom: 16,
  },
  topSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.tabBarBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  infoSection: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  username: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.accentTurquoise,
    marginBottom: 2,
  },
  firstName: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  ageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ageText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  bio: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.tabBarBorder,
    marginHorizontal: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.accentTurquoise,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  interestsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  interestsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  interestCard: {
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
  interestIcon: {
    width: 20,
    height: 20,
  },
  interestText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
