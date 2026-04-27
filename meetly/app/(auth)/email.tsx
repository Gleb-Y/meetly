import { EmailAuthScreen } from "@/src/pages/auth/email-auth-page/email-auth-page";
import { useSendEmailCode } from "@/src/entities/api/auth/auth.queries";
import { useRouter } from "expo-router";
import React from "react";
import { Alert } from "react-native";

export default function Email() {
  const router = useRouter();
  const { mutate: sendCode, isPending } = useSendEmailCode();

  const handleContinue = (phoneNumber: string) => {
    sendCode(phoneNumber, {
      onSuccess: () => {
        router.push({
          pathname: "/(auth)/code",
          params: { email: phoneNumber }, // Передаём как email в params для совместимости
        });
      },
      onError: (error: any) => {
        Alert.alert(
          "Ошибка",
          error.response?.data?.message || "Не удалось отправить код"
        );
      },
    });
  };

  return (
    <EmailAuthScreen
      onContinue={handleContinue}
      onBack={() => router.back()}
      isLoading={isPending}
    />
  );
}
