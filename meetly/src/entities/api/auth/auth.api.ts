import { apiClient } from "../client/api-client";
import type {
  SendEmailCodeRequest,
  SendEmailCodeResponse,
  VerifyEmailCodeRequest,
  VerifyEmailCodeResponse,
  GoogleAuthRequest,
  GoogleAuthResponse,
  AppleAuthRequest,
  AppleAuthResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from "./auth.types";

export const authApi = {
  /**
   * SMS Auth - Отправить код на номер телефона
   * Требует номер в международном формате (e.g., +79991234567)
   * POST /api/auth/send-code
   */
  sendEmailCode: async (
    data: SendEmailCodeRequest
  ): Promise<SendEmailCodeResponse> => {
    const response = await apiClient.post("/auth/send-code", data);
    return response.data;
  },

  /**
   * SMS Auth - Проверить код и получить токен
   * POST /api/auth/verify-code
   */
  verifyEmailCode: async (
    data: VerifyEmailCodeRequest
  ): Promise<VerifyEmailCodeResponse> => {
    const response = await apiClient.post("/auth/verify-code", data);
    return response.data;
  },

  /**
   * Google OAuth - Авторизация через Google (не реализовано в backend)
   * Используется SMS авторизация как fallback
   * POST /api/auth/send-code
   */
  googleAuth: async (data: GoogleAuthRequest): Promise<GoogleAuthResponse> => {
    // Временная реализация - использует send-code вместо google endpoint
    // Ожидаем что фронтенд передаст phoneNumber в имеющемся поле
    const response = await apiClient.post("/auth/send-code", {
      phoneNumber: data.idToken, // Используем idToken как phoneNumber для fallback
    });
    return response.data;
  },

  /**
   * Apple OAuth - Авторизация через Apple (не реализовано в backend)
   * Используется SMS авторизация как fallback
   * POST /api/auth/send-code
   */
  appleAuth: async (data: AppleAuthRequest): Promise<AppleAuthResponse> => {
    // Временная реализация - использует send-code вместо apple endpoint
    // Ожидаем что фронтенд передаст phoneNumber в имеющемся поле
    const response = await apiClient.post("/auth/send-code", {
      phoneNumber: data.identityToken, // Используем identityToken как phoneNumber для fallback
    });
    return response.data;
  },

  /**
   * Обновить токен
   * POST /api/auth/refresh-token
   */
  refreshToken: async (
    data: RefreshTokenRequest
  ): Promise<RefreshTokenResponse> => {
    const response = await apiClient.post("/auth/refresh-token", data);
    return response.data;
  },

  /**
   * Выйти из аккаунта
   * POST /api/auth/logout
   */
  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },
};
