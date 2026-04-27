import { WelcomeScreen } from "@/src/pages/auth/welcome-page/welcome-page";
import { useRouter } from "expo-router";
import React from "react";

export default function Welcome() {
  const router = useRouter();

  return (
    <WelcomeScreen onGetStarted={() => router.push("/(auth)/auth-method")} />
  );
}
