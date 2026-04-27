import type { UserProfile } from "../user/user.types";

/**
 * SMS Auth - Отправка кода на телефон
 * Требует номер в международном формате: +79991234567
 */
export type SendEmailCodeRequest = {
  phoneNumber: string; // Формат: +380XXXXXXXXX (международный)
};

export type SendEmailCodeResponse = {
  message: string;
};

/**
 * SMS Auth - Проверка кода
 */
export type VerifyEmailCodeRequest = {
  phoneNumber: string; // Тот же номер что отправляли
  code: string; // 6-значный код
};

export type VerifyEmailCodeResponse = {
  user: UserProfile;
  accessToken: string;
};

/**
 * Google OAuth (не реализовано в backend)
 */
export type GoogleAuthRequest = {
  idToken: string;
};

export type GoogleAuthResponse = {
  user: UserProfile;
  accessToken: string;
};

/**
 * Apple OAuth (не реализовано в backend)
 */
export type AppleAuthRequest = {
  identityToken: string;
  user?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
};

export type AppleAuthResponse = {
  user: UserProfile;
  accessToken: string;
};

/**
 * Refresh Token
 */
export type RefreshTokenRequest = {
  refreshToken: string;
};

export type RefreshTokenResponse = {
  accessToken: string;
};
