import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes inactivity timeout
const BIOMETRIC_ENABLED_KEY = "smartneb_biometric_enabled";
const PIN_HASH_KEY = "smartneb_pin_hash";
const LAST_ACTIVE_KEY = "smartneb_last_active_timestamp";

/**
 * Manages biometric preferences, auto-lock timeouts, and PIN security fallbacks
 */
export const BiometricSecurity = {
  /**
   * Check if biometric / PIN lock is enabled
   */
  async isLockEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return enabled === "true";
    } catch {
      return false;
    }
  },

  /**
   * Enable or disable app lock
   */
  async setLockEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
  },

  /**
   * Set security PIN hash
   */
  async setSecurityPin(pin: string): Promise<void> {
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
    await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
    await this.setLockEnabled(true);
  },

  /**
   * Validate provided security PIN
   */
  async verifySecurityPin(pin: string): Promise<boolean> {
    try {
      const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
      if (!storedHash) return true;
      const inputHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
      return storedHash === inputHash;
    } catch {
      return false;
    }
  },

  /**
   * Record user activity to reset auto-lock countdown
   */
  async recordActivity(): Promise<void> {
    try {
      await SecureStore.setItemAsync(LAST_ACTIVE_KEY, Date.now().toString());
    } catch {
      // non-fatal
    }
  },

  /**
   * Check if the session has expired due to inactivity
   */
  async isSessionTimedOut(): Promise<boolean> {
    try {
      const enabled = await this.isLockEnabled();
      if (!enabled) return false;

      const lastActive = await SecureStore.getItemAsync(LAST_ACTIVE_KEY);
      if (!lastActive) return false;

      const elapsed = Date.now() - parseInt(lastActive, 10);
      return elapsed > AUTO_LOCK_TIMEOUT_MS;
    } catch {
      return false;
    }
  },
};
