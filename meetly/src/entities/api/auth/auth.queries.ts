import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "./auth.api";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * SMS Auth - Отправить код на телефон
 */
export function useSendEmailCode() {
  return useMutation({
    mutationFn: (phoneNumber: string) => authApi.sendEmailCode({ phoneNumber }),
    onSuccess: () => {
      console.log("✅ SMS code sent successfully");
    },
    onError: (error: any) => {
      console.error("❌ Error sending SMS code:", error);
    },
  });
}

/**
 * SMS Auth - Проверить код
 */
export function useVerifyEmailCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ phoneNumber, code }: { phoneNumber: string; code: string }) =>
      authApi.verifyEmailCode({ phoneNumber, code }),
    onSuccess: async (data) => {
      console.log("✅ Code verified, saving token");

      // Сохраняем JWT токен
      await AsyncStorage.setItem("access_token", data.accessToken);

      // Кешируем профиль
      queryClient.setQueryData(["profile"], data.user);
    },
    onError: (error: any) => {
      console.error("❌ Error verifying code:", error);
    },
  });
}

/**
 * Google OAuth
 */
export function useGoogleAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idToken: string) => authApi.googleAuth({ idToken }),
    onSuccess: async (data) => {
      console.log("✅ Google auth successful");

      await AsyncStorage.setItem("access_token", data.accessToken);
      queryClient.setQueryData(["profile"], data.user);
    },
    onError: (error: any) => {
      console.error("❌ Google auth error:", error);
    },
  });
}

/**
 * Apple OAuth
 */
export function useAppleAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      identityToken: string;
      user?: { email?: string; firstName?: string; lastName?: string };
    }) => authApi.appleAuth(data),
    onSuccess: async (data) => {
      console.log("✅ Apple auth successful");

      await AsyncStorage.setItem("access_token", data.accessToken);
      queryClient.setQueryData(["profile"], data.user);
    },
    onError: (error: any) => {
      console.error("❌ Apple auth error:", error);
    },
  });
}

/**
 * Выйти из аккаунта
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: async () => {
      await AsyncStorage.removeItem("access_token");
      queryClient.clear();
    },
  });
}
