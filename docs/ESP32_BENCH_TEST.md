# ESP32 Physical Hardware Bench Testing Guide

**Target Audience:** Hardware Engineers & Quality Assurance Testers  
**Hardware Target:** ESP32-WROOM-32 / ESP32-S3 with MAX30102 Pulse Oximeter & Piezoelectric Mesh Nebulizer Driver  
**Protocol:** MQTT over TLS 1.3 (Port 8883) or Local Mosquitto (Port 1883)

---

## 1. Bench Setup Requirements `[YOU MUST DO THIS]`

1. **Hardware Equipment:**
   - ESP32 Development Board (USB-C or Micro-USB).
   - MAX30102 I2C sensor module (SDA -> GPIO 21, SCL -> GPIO 22).
   - Piezoelectric mesh nebulizer module (PWM Driver -> GPIO 25).
2. **Firmware Flashing Tool:**
   - Install [esptool.py](https://docs.espressif.com/projects/esptool/en/latest/esp32/) or VS Code PlatformIO.
3. **Local MQTT Broker:**
   - Ensure local Mosquitto or Docker container is running (`docker-compose -f docker-compose.mosquitto.yml up -d`).

---

## 2. Hardware Bench Test Procedure & Checklist

| Test Step | Operator Instructions `[YOU MUST DO THIS]` | Expected Hardware & Cloud Behavior | Status |
| :--- | :--- | :--- | :---: |
| **BENCH-01** | **Firmware Flash & Provisioning** | 1. Flash compiled `smartneb_firmware.bin` to ESP32.<br>2. Power ON device.<br>3. Open Serial Monitor at 115200 baud. | ESP32 outputs: `[NVS] Loaded Wi-Fi Credentials`. Connects to local Wi-Fi router and obtains IP address. | `[ ] UNTESTED` |
| **BENCH-02** | **MQTTS Handshake & LWT Register** | 1. Observe Serial Monitor output during broker connect. | ESP32 performs TLS 1.3 handshake with `mqtt.smartneb.health:8883`, registers LWT on `hospitals/{id}/devices/{code}/status`, and sends `ONLINE` status. | `[ ] UNTESTED` |
| **BENCH-03** | **Live Vitals Telemetry Ingestion** | 1. Place index finger on MAX30102 pulse oximeter sensor.<br>2. Observe mobile app dashboard. | Hardware reads IR/Red LED absorption, computes SpO2 and Pulse Rate every 1000ms, and publishes packet. Mobile UI updates vitals in real time. | `[ ] UNTESTED` |
| **BENCH-04** | **Abrupt Disconnect & LWT Offline Detection** | 1. Unplug USB power cable from ESP32 mid-session.<br>2. Wait 10 seconds. | Broker detects lost TCP connection, publishes retained LWT message (`OFFLINE`), backend updates DB, and mobile app displays **"Device Offline"** banner. | `[ ] UNTESTED` |
| **BENCH-05** | **Low SpO2 Critical Alert Trigger** | 1. Cover MAX30102 sensor partially to simulate SpO2 drop below 90%.<br>2. Check mobile notifications and backend logs. | Backend alert engine detects SpO2 < 92%, creates `CRITICAL` alert record in database, and issues push notification to clinician. | `[ ] UNTESTED` |
| **BENCH-06** | **Remote Nebulizer Command & ACK Response** | 1. In mobile app, tap "Start Nebulizer".<br>2. Monitor ESP32 PWM pin output with oscilloscope/multimeter or LED.<br>3. Observe Serial Monitor. | ESP32 receives `START_TREATMENT` on command topic, sets GPIO 25 HIGH (nebulizer mesh active), and publishes ACK to `commands/ack`. | `[ ] UNTESTED` |

---

## 3. Command Line Simulation Script (Software Bench Test)

To test the backend without physical hardware attached, run:
```bash
# Standard Telemetry Simulation
node scripts/simulate-esp32.js

# Low SpO2 Critical Alert Test
node scripts/simulate-esp32.js --low-spo2

# Abrupt TCP Disconnect (LWT) Test
node scripts/simulate-esp32.js --disconnect

# Command Timeout Test
node scripts/simulate-esp32.js --timeout
```
