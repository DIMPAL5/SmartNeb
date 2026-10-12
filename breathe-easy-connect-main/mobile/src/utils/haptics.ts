import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Commercial-grade tactile micro-interactions and haptic feedback
 */
export const AppHaptics = {
  /**
   * Heavy haptic impact for Emergency SOS triggers and critical alarm clearance
   */
  async triggerHeavyImpact() {
    if (Platform.OS === "web") return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Graceful fallback on devices without haptic motors
    }
  },

  /**
   * Medium haptic feedback when pressing "Start Nebulizer" session or relay controls
   */
  async triggerMediumImpact() {
    if (Platform.OS === "web") return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  },

  /**
   * Light haptic feedback for button taps and UI toggles
   */
  async triggerLightImpact() {
    if (Platform.OS === "web") return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  },

  /**
   * Subtle selection haptic for tab bar switching, dosage selectors, and filter chips
   */
  async triggerSelection() {
    if (Platform.OS === "web") return;
    try {
      await Haptics.selectionAsync();
    } catch {}
  },

  /**
   * Notification success chime for saved profile, PDF export, or care plan update
   */
  async triggerSuccess() {
    if (Platform.OS === "web") return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  },

  /**
   * Notification warning chime for SpO2 threshold caution
   */
  async triggerWarning() {
    if (Platform.OS === "web") return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
  },

  /**
   * Notification error pattern for critical vital alert or SOS emergency
   */
  async triggerError() {
    if (Platform.OS === "web") return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  },
};
