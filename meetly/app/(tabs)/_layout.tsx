import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs, useSegments } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

const TAB_HEIGHT = 78;

function CustomTabBar({ state, navigation }: any) {
  const segments = useSegments(); // 👈 Получаем текущий путь

  // Скрываем таб-бар на детальном чате
  const shouldHideTabBar = segments.includes("[id]");

  if (shouldHideTabBar) {
    return null; // 👈 Не рендерим таб-бар
  }

  return (
    <View pointerEvents="box-none" style={styles.tabWrapper}>
      <BlurView tint="dark" intensity={70} style={styles.tabBlur}>
        <View style={styles.tabInner}>
          {/* Левая группа */}
          <View style={styles.sideTabs}>
            {["map", "events"].map((routeName) => {
              const routeIndex = state.routes.findIndex(
                (r: any) => r.name === routeName
              );
              const isFocused = state.index === routeIndex;

              const iconName =
                routeName === "map" ? "map-outline" : "footsteps-outline";

              return (
                <Pressable
                  key={routeName}
                  onPress={() => navigation.navigate(routeName)}
                  style={styles.iconButton}
                >
                  <Ionicons
                    name={iconName as any}
                    size={32}
                    color={
                      isFocused ? colors.accentTurquoise : colors.textSecondary
                    }
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Правая группа */}
          <View style={styles.sideTabs}>
            {[
              { name: "chat", icon: "chatbubble-ellipses-outline" },
              { name: "profile", icon: "person-circle-outline" },
            ].map(({ name, icon }) => {
              const routeIndex = state.routes.findIndex(
                (r: any) => r.name === name
              );
              const isFocused = state.index === routeIndex;

              return (
                <Pressable
                  key={name}
                  onPress={() => navigation.navigate(name)}
                  style={styles.iconButton}
                >
                  <Ionicons
                    name={icon as any}
                    size={32}
                    color={
                      isFocused
                        ? name === "profile"
                          ? colors.accentPurple
                          : colors.accentTurquoise
                        : colors.textSecondary
                    }
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </BlurView>

      {/* FAB */}
      <View pointerEvents="box-none" style={styles.fabWrapper}>
        <Pressable
          onPress={() => navigation.navigate("create-event")}
          style={({ pressed }) => [
            styles.fabOuter,
            { transform: [{ scale: pressed ? 0.96 : 1 }] },
          ]}
        >
          <View style={styles.fabInner}>
            <Ionicons name="add" size={32} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="map" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="create-event" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="chat/[id]" /> {/* 👈 Убрал href: null */}
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="user/[id]" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabBlur: {
    marginHorizontal: 16,
    marginBottom: Platform.OS === "ios" ? 20 : 16,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  tabInner: {
    height: TAB_HEIGHT,
    backgroundColor: colors.tabBarBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 26,
  },
  sideTabs: {
    flexDirection: "row",
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 14,
  },
  fabWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Platform.OS === "ios" ? 46 : 40,
    alignItems: "center",
  },
  fabOuter: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    shadowColor: colors.accentPink,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.accentPink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
