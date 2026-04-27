import { AuthMethodScreen } from "@/src/pages/auth/auth-method/auth-method";
import {
  useSendEmailCode,
  useGoogleAuth,
  useAppleAuth,
} from "@/src/entities/api/auth/auth.queries";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";

export default function AuthMethod() {
  const router = useRouter();
  const sendEmailMutation = useSendEmailCode();
  const googleAuthMutation = useGoogleAuth();
  const appleAuthMutation = useAppleAuth();

  // Google Sign-In Configuration
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    iosClientId: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
    androidClientId: "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
  });

  React.useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      handleGoogleAuth(id_token);
    }
  }, [response]);

  const handleEmailAuth = (email: string) => {
    sendEmailMutation.mutate(email, {
      onSuccess: () => {
        router.push({
          pathname: "/(auth)/code",
          params: { email, contactType: "email" },
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

  const handleGoogleAuth = async (idToken?: string) => {
    try {
      if (!idToken) {
        await promptAsync();
        return;
      }

      await googleAuthMutation.mutateAsync(idToken);
      router.replace("/(tabs)/map");
    } catch (error: any) {
      console.error("❌ Google auth error:", error);
      Alert.alert("Ошибка", "Не удалось войти через Google");
    }
  };

  const handleAppleAuth = async () => {
    try {
      if (Platform.OS !== "ios") {
        Alert.alert("Недоступно", "Apple Sign-In доступен только на iOS");
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      await appleAuthMutation.mutateAsync({
        identityToken: credential.identityToken!,
        user: {
          email: credential.email ?? undefined,
          firstName: credential.fullName?.givenName ?? undefined,
          lastName: credential.fullName?.familyName ?? undefined,
        },
      });

      router.replace("/(tabs)/map");
    } catch (error: any) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        return;
      }
      console.error("❌ Apple auth error:", error);
      Alert.alert("Ошибка", "Не удалось войти через Apple");
    }
  };

  const isLoading =
    sendEmailMutation.isPending ||
    googleAuthMutation.isPending ||
    appleAuthMutation.isPending;

  return (
    <AuthMethodScreen
      onEmailAuth={handleEmailAuth}
      onGoogleAuth={() => handleGoogleAuth()}
      onAppleAuth={handleAppleAuth}
      onBack={() => router.back()}
      isLoading={isLoading}
    />
  );
}
