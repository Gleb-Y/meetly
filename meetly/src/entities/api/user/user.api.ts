import { User } from "../../model/types";
import { apiClient } from "../client/api-client";
import type { UpdateProfileRequest, UserProfile } from "./user.types";

export const userApi = {
  /**
   * Получить текущий профиль
   * GET /api/auth/profile
   */
  getProfile: async (): Promise<UserProfile> => {
    const response = await apiClient.get("/auth/profile");
    return response.data;
  },

  getUserProfile: async (userId: string): Promise<UserProfile> => {
    const response = await apiClient.get<UserProfile>(`/users/${userId}`);
    return response.data;
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

    return response.data;
  },

  /**
   * Обновить профиль
   * PATCH /api/auth/profile
   */
  updateProfile: async (data: UpdateProfileRequest): Promise<UserProfile> => {
    const response = await apiClient.patch("/auth/profile", data);
    return response.data;
  },
};
