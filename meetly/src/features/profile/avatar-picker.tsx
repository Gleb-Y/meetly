// src/features/profile/avatar-picker.tsx

import { useUploadAvatar } from "@/src/entities/api/user/user.query";
import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";

type Props = {
  avatar: string | null;
  onAvatarChange: (uri: string) => void;
};

export function AvatarPicker({ avatar, onAvatarChange }: Props) {
  const uploadAvatarMutation = useUploadAvatar();

  const handlePickImage = async () => {
    // Запрос разрешений
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Ошибка", "Нужно разрешение на доступ к галерее");
      return;
    }

    // Выбор изображения
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const fileUri = result.assets[0].uri;

      try {
        console.log("📤 Uploading avatar:", fileUri);

        // 🔥 Загружаем на сервер
        const response = await uploadAvatarMutation.mutateAsync(fileUri);

        console.log("✅ Avatar uploaded:", response.avatar);

        // 👇 ОБНОВЛЯЕМ STATE В РОДИТЕЛЬСКОМ КОМПОНЕНТЕ
        onAvatarChange(response.avatar);

        Alert.alert("Успех! 🎉", "Аватар обновлен");
      } catch (error: any) {
        console.error("❌ Upload error:", error);
        Alert.alert(
          "Ошибка",
          error.response?.data?.message || "Не удалось загрузить фото"
        );
      }
    }
  };

  return (
    <Pressable onPress={handlePickImage} style={styles.container}>
      {uploadAvatarMutation.isPending ? (
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color={colors.accentTurquoise} />
        </View>
      ) : avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="person" size={48} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.editBadge}>
        <Ionicons name="camera" size={16} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 120,
    alignSelf: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.tabBarBorder,
  },
  placeholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.tabBarBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentTurquoise,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.bg,
  },
});
