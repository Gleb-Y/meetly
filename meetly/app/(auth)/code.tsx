import {
  useVerifyEmailCode,
  useSendEmailCode,
} from "@/src/entities/api/auth/auth.queries";
import { CodeScreen } from "@/src/pages/auth/code-page/code-page";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Alert } from "react-native";

export default function EmailCode() {
  const router = useRouter();
  const { email: phoneNumber } = useLocalSearchParams<{ email: string }>();
  const verifyCodeMutation = useVerifyEmailCode();
  const resendCodeMutation = useSendEmailCode();

  const handleVerify = (code: string) => {
    verifyCodeMutation.mutate(
      { phoneNumber: phoneNumber || "+380", code },
      {
        onSuccess: () => {
          router.replace("/(tabs)/map");
        },
        onError: (error: any) => {
          Alert.alert(
            "Ошибка",
            error.response?.data?.message || "Неверный код"
          );
        },
      }
    );
  };

  const handleResend = () => {
    resendCodeMutation.mutate(phoneNumber || "+380", {
      onSuccess: () => {
        Alert.alert("Успех", "Код отправлен повторно");
      },
      onError: () => {
        Alert.alert("Ошибка", "Не удалось отправить код");
      },
    });
  };

  return (
    <CodeScreen
      contact={phoneNumber}
      contactType="phone"
      onVerify={handleVerify}
      onResend={handleResend}
      onBack={() => router.back()}
      isLoading={verifyCodeMutation.isPending}
    />
  );
}
