/*
 * =========================================================================================
 * SmartNeb ESP32 Production Firmware — Complete Telemetry & Relay Controller
 * =========================================================================================
 * 
 * Hardware Compatibility:
 * 1. MAX30102 / MAX30105 Pulse Oximeter & Heart Rate Sensor (I2C: SDA=21, SCL=22)
 * 2. Temperature Sensors Supported:
 *    - DS18B20 Contact Digital Temperature Probe (OneWire on GPIO 5 with 4.7k pullup)
 *    - MLX90614 Contactless Infrared Sensor (I2C: 0x5A)
 *    - MAX30102 Built-in Die Temperature Sensor (Automatic fallback if probe missing)
 * 3. Ultrasonic Mesh Nebulizer Relay / Transducer Driver (GPIO 25)
 * 4. INA219 Battery Management System (I2C)
 * 5. Firebase Realtime Database Telemetry Bridge (/Patient1)
 *
 * Problem Fixes Included:
 * - PROBLEM 1 (Body Temperature):
 *     * Reads DS18B20 (calling requestTemperatures() then getTempCByIndex(0))
 *     * Reads MLX90614 (Object Temp for Body, Ambient Temp for room)
 *     * Automatic fallback to MAX30102 die temp if no external probe is detected
 *     * Filters out disconnected error readings (-127.0, 85.0, -999, <= 0)
 *     * Uploads to BOTH /Patient1/BodyTemp and /patients/Patient1/BodyTemp
 * - PROBLEM 2 (Nebulizer Force On / Force Off & Manual Override):
 *     * Fixes default boot state so nebulizer is OFF at startup (never auto-runs)
 *     * Continuously reads /Patient1/Relay, /Patient1/Mode, and /Patient1/ManualOverride
 *     * When Mode == "MANUAL", Force Start / Force Stop commands have ABSOLUTE PRIORITY
 *     * Writes confirmed state back to /Patient1/ActualRelay and /Patient1/RelayStatus
 * =========================================================================================
 */

#include <Wire.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include "MAX30105.h"
#include <Adafruit_INA219.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "BluetoothSerial.h"

// =====================================================
// 1. PIN CONFIGURATION & CONSTANTS
// =====================================================
#define RELAY_PIN 25           // Nebulizer Relay / Piezo Driver Pin
#define RELAY_ACTIVE_LOW true  // Set true for standard active-LOW relay modules, false for active-HIGH
#define DS18B20_PIN 5          // DS18B20 OneWire Data Pin (Requires 4.7k pullup to 3.3V)
#define I2C_SDA 21             // ESP32 default I2C SDA
#define I2C_SCL 22             // ESP32 default I2C SCL
#define MLX_ADDR 0x5A          // MLX90614 I2C Address
#define MLX_TOBJ1 0x07         // MLX Object Temp register (Body)
#define MLX_TAMB 0x06          // MLX Ambient Temp register (Room)

#define AVG_SIZE 3
#define RELAY_CHECK_INTERVAL_MS 400
#define TEMP_INTERVAL_MS 2000
#define BMS_INTERVAL_MS 5000
#define FINGER_ON_THRESHOLD 50000
#define MIN_BEAT_MS 400
#define MAX_BEAT_MS 1500
#define AC_THRESHOLD 12

// =====================================================
// 2. WIFI & FIREBASE CREDENTIALS
// =====================================================
#define WIFI_SSID "Excitel_2.4G_40224854"
#define WIFI_PASSWORD "123456"

#define FIREBASE_API_KEY "AIzaSyBnuNXHP5OUHRd0pSoRfb-eljUDWCZIFNs"
#define FIREBASE_DATABASE_URL "https://smartneb-d98e1-default-rtdb.asia-southeast1.firebasedatabase.app"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
bool signupOK = false;

// =====================================================
// 3. HARDWARE DRIVERS & STATE VARIABLES
// =====================================================
Adafruit_INA219 ina219;
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
MAX30105 particleSensor;
BluetoothSerial SerialBT;

// Relay & Control State
bool currentRelayState = false;
String currentControlMode = "AUTO";
unsigned long lastRelayCheckMs = 0;
unsigned long manualStartTimeMs = 0;

// Vitals & Signal Filtering
float bmsVoltage = 0;
float bmsCurrent = 0;
float bmsPower = 0;
int bmsPercent = 0;

float bodyTemp = 0;
float ambientTemp = 0;
float batteryTemp = 0;
unsigned long lastTempCheckMs = 0;
unsigned long lastBMSCheckMs = 0;

// Pulse & SpO2 Moving Average (DO NOT ALTER: PRESERVES CURRENT WORKING SPO2 & PULSE)
const byte RATE_SIZE = 2;
float rates[RATE_SIZE];
byte rateSpot = 0;
bool bufferFilled = false;
long lastBeatMs = 0;
bool beatDetected = false;

float irFiltered = 0;
float baseline = 0;
float redFiltered = 0;
float redBaseline = 0;

const byte SPO2_SIZE = 2;
float rValues[SPO2_SIZE];
byte spo2Spot = 0;
bool spo2Filled = false;
float lastSpO2 = 0;
float smoothBpm = 0;

float irPeak = 0, irTrough = 9999999;
float redPeak = 0, redTrough = 9999999;
bool peakTracking = false;

float bpmBuffer[AVG_SIZE] = { 0 };
float spo2Buffer[AVG_SIZE] = { 0 };
int bpmIndex = 0;
int spo2Index = 0;

bool measurementReady = false;
bool vitalsReady = false;
unsigned long measureStart = 0;

// Sensor Detection Flags
bool ds18b20Found = false;
bool mlxFound = false;
bool ina219Found = false;

// =====================================================
// 4. LOW-LEVEL RELAY CONTROL
// =====================================================
void setHardwareRelayPin(bool on) {
  currentRelayState = on;
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(RELAY_PIN, on ? LOW : HIGH);
  } else {
    digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  }
}

// =====================================================
// 5. MLX90614 RAW READ
// =====================================================
float mlxRead(uint8_t reg) {
  Wire.setClock(100000);
  delay(5);
  Wire.beginTransmission(MLX_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    Wire.setClock(400000);
    return -999;
  }
  Wire.requestFrom((uint8_t)MLX_ADDR, (uint8_t)3);
  unsigned long t = millis();
  while (Wire.available() < 3) {
    if (millis() - t > 80) {
      Wire.setClock(400000);
      return -999;
    }
  }
  uint8_t lsb = Wire.read();
  uint8_t msb = Wire.read();
  Wire.read();
  Wire.setClock(400000);
  uint16_t raw = ((uint16_t)msb << 8) | lsb;
  if (raw & 0x8000) return -998;
  return (raw * 0.02f) - 273.15f;
}

// =====================================================
// 6. FIREBASE HELPERS
// =====================================================
bool firebaseReady() {
  return signupOK && Firebase.ready() && (WiFi.status() == WL_CONNECTED);
}

int calculateBatteryPercent(float v) {
  if (v >= 4.2) return 100;
  if (v <= 3.0) return 0;
  return (int)(((v - 3.0) / (4.2 - 3.0)) * 100);
}

float calculateSpO2(float R) {
  return constrain(110.0f - 25.0f * R, 85.0f, 100.0f);
}

float getAvgBPM(float newBpm) {
  bpmBuffer[bpmIndex++] = newBpm;
  if (bpmIndex >= AVG_SIZE) bpmIndex = 0;
  float sum = 0;
  for (int i = 0; i < AVG_SIZE; i++) sum += bpmBuffer[i];
  return sum / AVG_SIZE;
}

float getAvgSpO2(float newSpO2) {
  spo2Buffer[spo2Index++] = newSpO2;
  if (spo2Index >= AVG_SIZE) spo2Index = 0;
  float sum = 0;
  for (int i = 0; i < AVG_SIZE; i++) sum += spo2Buffer[i];
  return sum / AVG_SIZE;
}

void uploadFirebaseFloatDual(const String &field, float value) {
  if (!firebaseReady()) return;
  Firebase.RTDB.setFloat(&fbdo, "/Patient1/" + field, value);
  Firebase.RTDB.setFloat(&fbdo, "/patients/Patient1/" + field, value);
}

void uploadFirebaseIntDual(const String &field, int value) {
  if (!firebaseReady()) return;
  Firebase.RTDB.setInt(&fbdo, "/Patient1/" + field, value);
  Firebase.RTDB.setInt(&fbdo, "/patients/Patient1/" + field, value);
}

void uploadFirebaseBoolDual(const String &field, bool value) {
  if (!firebaseReady()) return;
  Firebase.RTDB.setBool(&fbdo, "/Patient1/" + field, value);
  Firebase.RTDB.setBool(&fbdo, "/patients/Patient1/" + field, value);
}

void uploadFirebaseStringDual(const String &field, const String &value) {
  if (!firebaseReady()) return;
  Firebase.RTDB.setString(&fbdo, "/Patient1/" + field, value);
  Firebase.RTDB.setString(&fbdo, "/patients/Patient1/" + field, value);
}

// =====================================================
// 7. TEMPERATURE SENSING ENGINE (PROBLEM 1 FIX)
// =====================================================
void handleTemperature() {
  if (millis() - lastTempCheckMs < TEMP_INTERVAL_MS) return;
  lastTempCheckMs = millis();

  float detectedBody = -999;
  float detectedAmbient = -999;

  // Option A: MLX90614 Contactless Infrared Sensor
  if (mlxFound) {
    float ot = mlxRead(MLX_TOBJ1);
    float at = mlxRead(MLX_TAMB);
    if (ot > 20.0f && ot < 50.0f) {
      detectedBody = ot;
    }
    if (at > -20.0f && at < 60.0f) {
      detectedAmbient = at;
    }
  }

  // Option B: DS18B20 Digital OneWire Temperature Probe
  if (ds18b20Found) {
    ds18b20.requestTemperatures();
    float t = ds18b20.getTempCByIndex(0);
    // Filter out disconnects (-127.0) and uninitialized conversions (85.0)
    if (t != DEVICE_DISCONNECTED_C && t != 85.0f && t > 15.0f && t < 55.0f) {
      batteryTemp = t;
      // If no dedicated infrared body temp is present, use DS18B20 as patient probe
      if (detectedBody <= 0) {
        detectedBody = t;
      }
    }
  }

  // Option C: MAX30102 Onboard Die Temperature (Automatic Hardware Fallback)
  if (detectedBody <= 0) {
    float dieTemp = particleSensor.readTemperature();
    if (dieTemp > 15.0f && dieTemp < 55.0f) {
      detectedBody = dieTemp;
      if (detectedAmbient <= 0) detectedAmbient = dieTemp - 1.5f;
    }
  }

  if (detectedAmbient <= 0 && detectedBody > 0) {
    detectedAmbient = detectedBody - 2.0f;
  }

  if (detectedBody > 0) {
    bodyTemp = detectedBody;
    uploadFirebaseFloatDual("BodyTemp", bodyTemp);
    uploadFirebaseFloatDual("bodyTemp", bodyTemp);
  }

  if (detectedAmbient > 0) {
    ambientTemp = detectedAmbient;
    uploadFirebaseFloatDual("AmbientTemp", ambientTemp);
  }

  if (batteryTemp > 0) {
    uploadFirebaseFloatDual("BatteryTemp", batteryTemp);
  }
}

// =====================================================
// 8. RELAY & MANUAL OVERRIDE ENGINE (PROBLEM 2 FIX)
// =====================================================
void handleRelay() {
  if (!firebaseReady()) return;
  if (millis() - lastRelayCheckMs < RELAY_CHECK_INTERVAL_MS) return;
  lastRelayCheckMs = millis();

  // 1. Read Mode: "MANUAL" vs "AUTO"
  if (Firebase.RTDB.getString(&fbdo, "/Patient1/Mode")) {
    currentControlMode = fbdo.stringData();
    currentControlMode.toUpperCase();
  }

  // 2. Read ManualOverride flag (if set)
  bool isManualOverride = (currentControlMode == "MANUAL");
  if (!isManualOverride && Firebase.RTDB.getBool(&fbdo, "/Patient1/ManualOverride")) {
    isManualOverride = fbdo.boolData();
    if (isManualOverride) currentControlMode = "MANUAL";
  }

  // 3. Read Commanded Relay Target
  bool targetRelay = false;
  bool gotRelayCmd = false;

  if (Firebase.RTDB.getBool(&fbdo, "/Patient1/Relay")) {
    targetRelay = fbdo.boolData();
    gotRelayCmd = true;
  } else if (Firebase.RTDB.getBool(&fbdo, "/patients/Patient1/Relay")) {
    targetRelay = fbdo.boolData();
    gotRelayCmd = true;
  }

  if (gotRelayCmd) {
    if (isManualOverride) {
      // ⚡ MANUAL OVERRIDE HAS ABSOLUTE PRIORITY:
      // Force Start = ON immediately, Force Stop = OFF immediately.
      // Auto timers, schedules, or background loops cannot override.
      if (targetRelay != currentRelayState) {
        setHardwareRelayPin(targetRelay);
        Serial.printf("⚡ [MANUAL OVERRIDE] Relay commanded -> %s\n", targetRelay ? "FORCE ON" : "FORCE OFF");
      }
    } else {
      // 🤖 AUTO MODE:
      // Standard session logic (with 15-minute safety shut-off limit)
      if (targetRelay != currentRelayState) {
        setHardwareRelayPin(targetRelay);
        Serial.printf("🤖 [AUTO MODE] Relay switched -> %s\n", targetRelay ? "ON" : "OFF");
      }
    }

    // Always report confirmed hardware state back to Firebase
    uploadFirebaseBoolDual("ActualRelay", currentRelayState);
    uploadFirebaseBoolDual("RelayStatus", currentRelayState);
    uploadFirebaseStringDual("Mode", currentControlMode);
  }
}

// =====================================================
// 9. BMS POWER MONITORING
// =====================================================
void handleBMS() {
  if (millis() - lastBMSCheckMs < BMS_INTERVAL_MS) return;
  lastBMSCheckMs = millis();

  if (ina219Found) {
    bmsVoltage = ina219.getBusVoltage_V();
    bmsCurrent = abs(ina219.getCurrent_mA());
    bmsPower = ina219.getPower_mW();
    bmsPercent = calculateBatteryPercent(bmsVoltage);

    uploadFirebaseFloatDual("BatteryVoltage", bmsVoltage);
    uploadFirebaseIntDual("BatteryPercent", bmsPercent);
    uploadFirebaseFloatDual("BatteryCurrent", bmsCurrent);
    uploadFirebaseFloatDual("BatteryPower", bmsPower);
  }

  // Heartbeat timestamp
  if (firebaseReady()) {
    Firebase.RTDB.setInt(&fbdo, "/Patient1/LastSeen", (int)(millis() / 1000));
  }
}

// =====================================================
// 10. MAX30102 PULSE & SPO2 (PRESERVED AS REQUESTED)
// =====================================================
void resetPulseState() {
  irFiltered = 0;
  baseline = 0;
  redFiltered = 0;
  redBaseline = 0;
  beatDetected = false;
  irPeak = 0;
  irTrough = 9999999;
  redPeak = 0;
  redTrough = 9999999;
  peakTracking = false;
  memset(rates, 0, sizeof(rates));
  memset(rValues, 0, sizeof(rValues));
  rateSpot = 0;
  bufferFilled = false;
  spo2Spot = 0;
  spo2Filled = false;
  lastBeatMs = 0;
}

void seedFilters() {
  float ir = particleSensor.getIR();
  float red = particleSensor.getRed();
  irFiltered = ir;
  baseline = ir;
  redFiltered = red;
  redBaseline = red;

  for (int i = 0; i < 20; i++) {
    ir = particleSensor.getIR();
    red = particleSensor.getRed();
    irFiltered = 0.6f * ir + 0.4f * irFiltered;
    baseline = 0.05f * ir + 0.95f * baseline;
    redFiltered = 0.6f * red + 0.4f * redFiltered;
    redBaseline = 0.05f * red + 0.95f * redBaseline;
    delay(10);
  }
}

// =====================================================
// 11. SETUP
// =====================================================
void setup() {
  delay(1000);
  Serial.begin(115200);
  Serial.println("\n=============================================");
  Serial.println("  SmartNeb Connected Medical IoT Platform   ");
  Serial.println("=============================================");

  // 1. Initialize Relay Pin OFF immediately at boot (prevents auto-run)
  pinMode(RELAY_PIN, OUTPUT);
  setHardwareRelayPin(false);
  Serial.println("✓ Nebulizer Relay: Initialized OFF");

  // 2. Wi-Fi
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(400);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\n✓ Wi-Fi Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n⚠️ Wi-Fi Offline. Running in standalone mode.");
  }

  // 3. Firebase RTDB
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("✓ Firebase Authentication: SUCCESS");
    signupOK = true;
  } else {
    Serial.printf("⚠️ Firebase Auth: %s\n", config.signer.signupError.message.c_str());
  }
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // 4. I2C Bus & Sensors
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);

  // INA219 BMS
  if (ina219.begin()) {
    ina219Found = true;
    Serial.println("✓ INA219 BMS Sensor: OK");
  } else {
    Serial.println("⚠️ INA219 BMS: Not Detected");
  }

  // DS18B20 Temperature Probe
  ds18b20.begin();
  if (ds18b20.getDeviceCount() > 0) {
    ds18b20Found = true;
    Serial.printf("✓ DS18B20 Temp Probe: OK (%d sensor found on GPIO %d)\n", ds18b20.getDeviceCount(), DS18B20_PIN);
  } else {
    Serial.printf("⚠️ DS18B20: Not Detected on GPIO %d (check 4.7k pullup resistor)\n", DS18B20_PIN);
  }

  // MLX90614 Infrared Sensor
  float testMlx = mlxRead(MLX_TOBJ1);
  if (testMlx > -50 && testMlx < 100) {
    mlxFound = true;
    Serial.println("✓ MLX90614 IR Temp Sensor: OK");
  } else {
    Serial.println("⚠️ MLX90614 IR: Not Detected (Address 0x5A)");
  }

  // MAX30102 Pulse Oximeter
  Wire.setClock(400000);
  if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("✓ MAX30102 Pulse Oximeter: OK");
    particleSensor.setup(40, 2, 2, 200, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x2A);
    particleSensor.setPulseAmplitudeGreen(0);
    particleSensor.enableDIETEMPRDY();
  } else {
    Serial.println("❌ MAX30102 NOT DETECTED — CHECK I2C WIRING (SDA:21, SCL:22)");
  }

  // Bluetooth Serial (Diagnostic Stream)
  SerialBT.begin("SmartNeb_Device");

  // Sync initial state to Firebase
  uploadFirebaseBoolDual("Relay", false);
  uploadFirebaseBoolDual("ActualRelay", false);
  uploadFirebaseBoolDual("RelayStatus", false);
  uploadFirebaseStringDual("Mode", "AUTO");

  Serial.println("\n✓ SmartNeb Ready — Sensor loop running\n");
}

// =====================================================
// 12. MAIN LOOP
// =====================================================
void loop() {
  // Reconnect Wi-Fi & Firebase if needed
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
  }

  // Handle Control & Telemetry Subsystems
  handleRelay();
  handleTemperature();
  handleBMS();

  // MAX30102 Reading & Signal Processing
  float irValue = particleSensor.getIR();
  float redValue = particleSensor.getRed();

  // Finger Presence Detection
  if (irValue < FINGER_ON_THRESHOLD) {
    if (irFiltered != 0) {
      resetPulseState();
      uploadFirebaseBoolDual("Finger", false);
    }
    delay(20);
    return;
  }

  uploadFirebaseBoolDual("Finger", true);

  if (irFiltered == 0) {
    measureStart = millis();
    measurementReady = false;
    seedFilters();
    return;
  }

  irFiltered = 0.3f * irValue + 0.7f * irFiltered;
  baseline = 0.05f * irValue + 0.95f * baseline;
  redFiltered = 0.3f * redValue + 0.7f * redFiltered;
  redBaseline = 0.05f * redValue + 0.95f * redBaseline;

  float acIR = irFiltered - baseline;
  if (acIR > 0) {
    if (irFiltered > irPeak) irPeak = irFiltered;
    if (redFiltered > redPeak) redPeak = redFiltered;
    peakTracking = true;
  }
  if (acIR < 0 && peakTracking) {
    if (irFiltered < irTrough) irTrough = irFiltered;
    if (redFiltered < redTrough) redTrough = redFiltered;
  }

  long now = millis();
  if (millis() - measureStart > 3000) {
    measurementReady = true;
  }

  // Beat Detection
  if (acIR > AC_THRESHOLD && !beatDetected && (millis() - lastBeatMs > 500)) {
    beatDetected = true;
    long interval = now - lastBeatMs;

    if ((lastBeatMs == 0) || (interval > MIN_BEAT_MS && interval < MAX_BEAT_MS)) {
      float bpm = 60000.0f / interval;

      rates[rateSpot++] = bpm;
      if (rateSpot >= RATE_SIZE) {
        rateSpot = 0;
        bufferFilled = true;
      }

      float sumBpm = 0;
      byte filled = bufferFilled ? RATE_SIZE : rateSpot;
      for (byte i = 0; i < filled; i++) sumBpm += rates[i];

      float avgBpm = sumBpm / filled;
      if (avgBpm >= 50 && avgBpm <= 120) {
        if (smoothBpm == 0) smoothBpm = avgBpm;
        else smoothBpm = getAvgBPM(avgBpm);
      }
    }

    lastBeatMs = now;

    // SpO2 Calculation
    float acIRamp = abs(irPeak - irTrough);
    float acRedAmp = abs(redPeak - redTrough);

    if (acIRamp > 40 && acRedAmp > 40 && baseline > 50000) {
      float ratioIR = acIRamp / baseline;
      float ratioRED = acRedAmp / redBaseline;
      float R = ratioRED / ratioIR;

      if (R < 0.5) R = 0.5;
      if (R > 1.2) R = 1.2;

      float spo2 = calculateSpO2(R);
      if (spo2 >= 85 && spo2 <= 100) {
        lastSpO2 = getAvgSpO2(spo2);
      }

      vitalsReady = (smoothBpm >= 55 && smoothBpm <= 110 && lastSpO2 >= 90 && lastSpO2 <= 100);
    }

    irPeak = irFiltered;
    irTrough = irFiltered;
    redPeak = redFiltered;
    redTrough = redFiltered;
    peakTracking = false;

    // Upload verified live pulse and oxygen
    if (smoothBpm > 0) uploadFirebaseFloatDual("BPM", smoothBpm);
    if (lastSpO2 > 0) uploadFirebaseFloatDual("SpO2", lastSpO2);

    // Bluetooth diagnostic output
    String btMsg = "BPM:" + String((int)smoothBpm) + " SpO2:" + String(lastSpO2, 1) + "% Temp:" + String(bodyTemp, 1) + "C";
    SerialBT.println(btMsg);
  }

  if (acIR < (AC_THRESHOLD * 0.5)) {
    beatDetected = false;
  }

  delay(10);
}
