import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userApi } from "./user.api";
import type { UpdateProfileRequest } from "./user.types";

/**
 * Получить профиль текущего пользователя
 */
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => userApi.getProfile(),
    staleTime: 1000 * 60 * 5, // 5 минут
  });
}

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: () => userApi.getUserProfile(userId),
    enabled: !!userId,
  });
}
/**
 * Обновить профиль
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => userApi.updateProfile(data),
    onSuccess: (updatedProfile) => {
      console.log("✅ Profile updated");
      queryClient.setQueryData(["profile"], updatedProfile);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: any) => {
      console.error("❌ Failed to update profile:", error.response?.data);
    },
  });
}

/**
 * Загрузить аватар
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileUri: string) => userApi.uploadAvatar(fileUri),
    onSuccess: (data) => {
      console.log("✅ Avatar uploaded, updating cache:", data.avatar);

      // 👇 Обновляем профиль в кеше
      queryClient.setQueryData(["profile"], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          avatar: data.avatar, // 👈 Обновляем аватар
        };
      });

      // Или полностью перезагружаем профиль
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: any) => {
      console.error("❌ Error uploading avatar:", error);
    },
  });
}
