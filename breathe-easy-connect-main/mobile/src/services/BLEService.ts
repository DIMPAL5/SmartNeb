/**
 * BLEService
 * Manages Bluetooth Low Energy discovery, pairing handshake,
 * and Wi-Fi credential provisioning for SmartNeb portable nebulizers.
 */

import { apiClient } from "../api/client";

export interface DiscoveredSmartNebDevice {
  id: string;
  name: string;
  deviceCode: string;
  rssi: number;
  firmwareVersion: string;
}

export class BLEService {
  /**
   * Scan for nearby SmartNeb devices
   */
  static async scanForDevices(): Promise<DiscoveredSmartNebDevice[]> {
    // In production React Native BLE plx or simulated hardware BLE scanner:
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: "BLE-SN-A101",
            name: "SmartNeb Portable Mesh #101",
            deviceCode: "SN-ESP32-MESH-01",
            rssi: -58, // Excellent signal
            firmwareVersion: "2.4.0",
          },
          {
            id: "BLE-SN-B202",
            name: "SmartNeb Portable Mesh #202",
            deviceCode: "SN-ESP32-MESH-02",
            rssi: -78, // Moderate signal
            firmwareVersion: "2.4.0",
          },
        ]);
      }, 1200);
    });
  }

  /**
   * Provision Wi-Fi credentials to ESP32 device via BLE
   * Never stores or logs Wi-Fi passwords in plain text.
   */
  static async provisionWifiAndPair({
    deviceCode,
    ssid,
    password,
    patientId,
  }: {
    deviceCode: string;
    ssid: string;
    password: string;
    patientId?: string;
  }): Promise<{ success: boolean; message: string; device?: any }> {
    if (!ssid || !password) {
      throw new Error("Wi-Fi network name (SSID) and password are required.");
    }

    // 1. Request temporary provisioning session from backend
    const sessionRes = await apiClient.post("/devices/provision/start", { patientId });
    const { sessionToken } = sessionRes.data;

    // 2. Perform simulated BLE characteristic write to ESP32 GATT Service
    // UUID: 0000FFFF-0000-1000-8000-00805F9B34FB
    await new Promise((res) => setTimeout(res, 1500));

    // 3. Complete provisioning handshake with backend
    const completeRes = await apiClient.post("/devices/provision/complete", {
      sessionToken,
      deviceCode,
      macAddress: "3C:71:BF:84:4E:9A",
      firmwareVersion: "2.4.0",
    });

    return {
      success: true,
      message: "SmartNeb Connected ✓",
      device: completeRes.data?.device,
    };
  }
}
