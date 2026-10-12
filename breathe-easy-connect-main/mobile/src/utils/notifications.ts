import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiClient } from "../api/client";

// Configure default notification handler for foreground display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register device for high-priority push notifications and synchronize with SmartNeb backend
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission was not granted.");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "2bd91227-c802-42c0-9c74-8486c949583f",
    });
    token = tokenData.data;

    // Set high-importance notification channel on Android for medical alerts
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("critical-health-alerts", {
        name: "Critical Health & SOS Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#ef4444",
        sound: "default",
      });

      await Notifications.setNotificationChannelAsync("medication-adherence", {
        name: "Medication Adherence Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 200],
        lightColor: "#10b981",
        sound: "default",
      });
    }

    // Synchronize token with backend
    if (token) {
      await apiClient.post("/users/push-token", { pushToken: token }).catch((err) => {
        console.warn("Failed to sync push token with backend:", err.message);
      });
    }
  } catch (error: any) {
    console.warn("Error registering for push notifications:", error?.message);
  }

  return token;
}

/**
 * Dispatch an immediate local critical alert notification
 */
export async function triggerLocalCriticalAlert(title: string, body: string, data?: Record<string, any>) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // deliver immediately
    });
  } catch (e) {
    console.warn("Failed to schedule local notification:", e);
  }
}
