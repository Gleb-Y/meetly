import { User } from "../../model/types";
import { apiClient } from "../client/api-client";
import type { UpdateProfileRequest, UserProfile } from "./user.types";

/**
 * Преобразовать URL с неправильным IP на правильный
 */
function fixImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
  const apiBase = baseUrl.replace("/api", ""); // http://192.168.1.13:3000
  
  // Если URL содержит /uploads, заменить на правильный базовый URL
  if (url.includes("/uploads")) {
    const uploadPath = url.substring(url.indexOf("/uploads"));
    return `${apiBase}${uploadPath}`;
  }
  
  return url;
}

export const userApi = {
  /**
   * Получить текущий профиль
   * GET /api/auth/profile
   */
  getProfile: async (): Promise<UserProfile> => {
    const response = await apiClient.get("/auth/profile");
    const profile = response.data;
    
    // Фиксим URL аватара
    if (profile.avatar) {
      profile.avatar = fixImageUrl(profile.avatar);
    }
    
    return profile;
  },

  getUserProfile: async (userId: string): Promise<UserProfile> => {
    const response = await apiClient.get<UserProfile>(`/users/${userId}`);
    const profile = response.data;
    
    // Фиксим URL аватара
    if (profile.avatar) {
      profile.avatar = fixImageUrl(profile.avatar);
    }
    
    return profile;
  },

  uploadAvatar: async (fileUri: string): Promise<{ avatar: string }> => {
    const formData = new FormData();

    // Получаем имя файла из URI
    const filename = fileUri.split("/").pop() || "avatar.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";

    formData.append("file", {
      uri: fileUri,
      name: filename,
      type,
    } as any);

    const response = await apiClient.post("/users/me/avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    // Фиксим URL в ответе
    if (response.data.avatar) {
      response.data.avatar = fixImageUrl(response.data.avatar);
    }

    return response.data;
  },

  /**
   * Обновить профиль
   * PATCH /api/auth/profile
   */
  updateProfile: async (data: UpdateProfileRequest): Promise<UserProfile> => {
    const response = await apiClient.patch("/auth/profile", data);
    const profile = response.data;
    
    // Фиксим URL аватара
    if (profile.avatar) {
      profile.avatar = fixImageUrl(profile.avatar);
    }
    
    return profile;
  },
};
