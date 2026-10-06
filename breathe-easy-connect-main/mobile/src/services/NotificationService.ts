/**
 * Mobile NotificationService
 * Production push notification registration, notification channels,
 * and deep-link handling for Expo/React Native.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiClient } from "../api/client";

// Set default notification presentation options for foreground display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class MobileNotificationService {
  /**
   * Request push permissions and register token with backend
   */
  static async registerForPushNotifications(): Promise<string | null> {
    try {
      if (Platform.OS === "web") {
        console.log("Push notifications not supported on web client");
        return null;
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("Push notification permission not granted");
        return null;
      }

      // Configure Android High-Priority / Critical Channels
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("smartneb_critical_alerts", {
          name: "SmartNeb Critical Vitals",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#EF4444",
          sound: "default",
          bypassDnd: true,
        });

        await Notifications.setNotificationChannelAsync("smartneb_vitals_alerts", {
          name: "SmartNeb Vitals Warnings",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 200, 200],
          lightColor: "#F59E0B",
          sound: "default",
        });

        await Notifications.setNotificationChannelAsync("smartneb_treatment_reminders", {
          name: "Treatment Adherence Reminders",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: "default",
        });
      }

      // Obtain token
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      // Register with SmartNeb backend
      await apiClient.post("/push-tokens", {
        token,
        platform: Platform.OS,
        deviceModel: Platform.OS === "ios" ? "Apple iPhone" : "Android Device",
      });

      console.log("✓ Mobile push token registered with SmartNeb backend:", token);
      return token;
    } catch (err: any) {
      console.warn("Could not register push token:", err.message);
      return null;
    }
  }

  /**
   * Remove push token upon logout
   */
  static async unregisterPushToken(token: string): Promise<void> {
    try {
      await apiClient.delete("/push-tokens", { data: { token } });
    } catch (err) {
      // Ignore cleanup error
    }
  }

  /**
   * Attach listener for received notifications
   */
  static addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Attach listener for tapped notifications (Deep linking)
   */
  static addNotificationResponseReceivedListener(
    navigationCallback: (screen: string, params?: any) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen) {
        navigationCallback(String(data.screen), data);
      }
    });
  }
}
