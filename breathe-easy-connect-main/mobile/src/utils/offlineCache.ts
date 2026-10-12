import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CachedRecord<T> {
  data: T;
  timestamp: number;
  formattedTime: string;
}

export const OfflineCache = {
  /**
   * Save patient snapshot to local device storage
   */
  async cachePatientSnapshot<T>(patientId: string, data: T): Promise<void> {
    try {
      const record: CachedRecord<T> = {
        data,
        timestamp: Date.now(),
        formattedTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      await AsyncStorage.setItem(`smartneb_cache_patient_${patientId}`, JSON.stringify(record));
    } catch (e) {
      console.warn("Failed to cache patient snapshot:", e);
    }
  },

  /**
   * Retrieve cached patient snapshot
   */
  async getCachedPatientSnapshot<T>(patientId: string): Promise<CachedRecord<T> | null> {
    try {
      const raw = await AsyncStorage.getItem(`smartneb_cache_patient_${patientId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Save doctor patient roster
   */
  async cacheDoctorRoster<T>(doctorId: string, data: T): Promise<void> {
    try {
      const record: CachedRecord<T> = {
        data,
        timestamp: Date.now(),
        formattedTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      await AsyncStorage.setItem(`smartneb_cache_doctor_${doctorId}`, JSON.stringify(record));
    } catch (e) {
      console.warn("Failed to cache doctor roster:", e);
    }
  },

  /**
   * Retrieve cached doctor patient roster
   */
  async getCachedDoctorRoster<T>(doctorId: string): Promise<CachedRecord<T> | null> {
    try {
      const raw = await AsyncStorage.getItem(`smartneb_cache_doctor_${doctorId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Save caregiver people-in-care list
   */
  async cacheCaregiverRoster<T>(caregiverId: string, data: T): Promise<void> {
    try {
      const record: CachedRecord<T> = {
        data,
        timestamp: Date.now(),
        formattedTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      await AsyncStorage.setItem(`smartneb_cache_caregiver_${caregiverId}`, JSON.stringify(record));
    } catch (e) {
      console.warn("Failed to cache caregiver roster:", e);
    }
  },

  /**
   * Retrieve cached caregiver people-in-care list
   */
  async getCachedCaregiverRoster<T>(caregiverId: string): Promise<CachedRecord<T> | null> {
    try {
      const raw = await AsyncStorage.getItem(`smartneb_cache_caregiver_${caregiverId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
};
