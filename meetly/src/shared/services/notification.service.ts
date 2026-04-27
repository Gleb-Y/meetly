// notifications.service.ts
import { apiClient } from "@/src/entities/api/client/api-client";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== "granted") {
    console.log("Push notifications not granted");
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log("Push token:", token);

  // Отправить token на бэкенд
  await apiClient.post("/users/push-token", { token });
}
