# 🔌 SmartNeb ESP32 Hardware Wiring & Flashing Guide

This guide details the hardware assembly, pinouts, library dependencies, flashing steps, cloud verification, and medical safety risk analysis for the SmartNeb ESP32 Nebulizer Controller.

---

## 1. Hardware Pinout & Wiring Table

| Component | Component Pin | ESP32 Pin | Description |
| :--- | :--- | :--- | :--- |
| **MAX30102 SpO2 Sensor** | VCC | `3V3` | Power Supply (3.3V) |
| **MAX30102 SpO2 Sensor** | GND | `GND` | Ground |
| **MAX30102 SpO2 Sensor** | SDA | `GPIO 21` | I2C Data Line |
| **MAX30102 SpO2 Sensor** | SCL | `GPIO 22` | I2C Clock Line |
| **MAX30102 SpO2 Sensor** | INT | `GPIO 19` | Active LOW Interrupt |
| **Nebulizer Driver Relay** | IN / Gate | `GPIO 26` | Nebulizer Relay Control (HIGH = ON, LOW = OFF) |
| **Nebulizer Driver Relay** | VCC | `5V` | Relay Driver Power (5V) |
| **Nebulizer Driver Relay** | GND | `GND` | Common Ground |
| **Status LED Indicator** | Anode (+) | `GPIO 2` | Built-in Status LED (Blinks on telemetry transmit) |

---

## 2. Required Libraries & Tooling

* **IDE Options**: PlatformIO (VS Code) or Arduino IDE 2.x
* **Required Libraries**:
  1. `PubSubClient` (v2.8+) — MQTT over TLS Client
  2. `ArduinoJson` (v7.0+) — JSON Serialization & Parsing
  3. `SparkFun MAX3010x Pulse and Proximity Sensor Library` (v1.1.2+)

---

## 3. Step-by-Step Flashing Instructions

### Method A: Flashing via PlatformIO
1. Open `firmware/` in VS Code with PlatformIO extension installed.
2. Copy `config.h.example` to `config.h`.
3. Open `config.h` and populate:
   * Wi-Fi SSID & Password
   * Provisioned `MQTT_USER` and `MQTT_PASS` (from `POST /api/v1/devices/:id/provision-credentials`).
4. Connect the ESP32 via Micro-USB / USB-C cable.
5. Click **Build & Upload** (`Ctrl + Alt + U`).

### Method B: Flashing via Arduino IDE
1. Open `firmware/esp32_smartneb_reference.ino` in Arduino IDE.
2. Under **Tools -> Board**, select **ESP32 Dev Module**.
3. Under **Tools -> Library Manager**, install `PubSubClient`, `ArduinoJson`, `SparkFun MAX3010x`.
4. Update `WIFI_SSID`, `WIFI_PASSWORD`, `MQTT_USER`, and `MQTT_PASS`.
5. Press **Upload**.

---

## 4. Verifying Cloud Connectivity

1. Open Serial Monitor at **115200 baud**.
2. Confirm the startup log sequence:
   ```text
   Connecting to Wi-Fi...
   ✓ Wi-Fi Connected!
   Synchronizing NTP Time...
   ✓ NTP Time Synchronized!
   Connecting to TLS MQTT Broker...
   ✓ Connected to TLS MQTT Broker!
   ```
3. Verify telemetry publishing in the backend console or via `simulate-esp32.js` / test scripts:
   ```bash
   node backend/scripts/simulate-esp32.js
   ```

---

## ⚠️ 5. Medical Safety & Failure Mode Risk Assessment

> [!CAUTION] Critical Hardware Safety Rules
> 1. **Emergency Hardware Cutoff**: The ESP32 firmware enforces a strict 15-minute (`900s`) local hardware cutoff timer independent of Wi-Fi or MQTT connectivity. If network connection drops while the nebulizer is running, the local watchdog automatically cuts relay power at 15 minutes to prevent drug overdose.
> 2. **Sensor Calibration & Artifact Filtering**: SpO2 readings `< 50%` or `> 100%` and pulse rates `< 30 BPM` or `> 240 BPM` are filtered as motion artifacts and discarded.
> 3. **Watchdog (WDT) Reset**: The hardware Task Watchdog Timer (`esp_task_wdt`) is set to 10 seconds. If the CPU freezes or loops indefinitely, the WDT triggers an immediate microcontroller reset, bringing the relay pin `GPIO 26` LOW (OFF).
