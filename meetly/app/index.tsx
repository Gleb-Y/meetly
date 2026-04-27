import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");

      console.log("🔍 Checking auth...");
      console.log("Token:", token ? "exists" : "missing");

      // Небольшая задержка для expo-router
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (token) {
        console.log("✅ User authenticated, redirecting to map");
        router.replace("/(tabs)/map");
      } else {
        console.log("❌ No token, redirecting to welcome");
        router.replace("/(auth)/welcome");
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      router.replace("/(auth)/welcome");
    }
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#050816",
      }}
    >
      <ActivityIndicator size="large" color="#22D3EE" />
    </View>
  );
}
