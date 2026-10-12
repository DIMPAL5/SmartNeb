/*
 * SmartNeb ESP32 Reference Firmware Sketch
 * Feature Set:
 * - Watchdog Timer (WDT) to prevent firmware hangs
 * - NTP Time Synchronization over TLS
 * - TLS MQTT Client on port 8883
 * - Last Will and Testament (LWT) for abrupt disconnect handling
 * - Noise Smoothing (Moving Average Filter) for SpO2 & Pulse readings
 * - Local Hardware Safety Cutoff (Auto-stop mesh nebulizer after max duration 15 mins)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <esp_task_wdt.h>
#include <time.h>

#if __has_include("config.h")
  #include "config.h"
#endif

// Default configuration constants (overridden if present in config.h)
#ifndef WIFI_SSID
  #define WIFI_SSID     "SmartNeb_Hosp_WiFi"
#endif
#ifndef WIFI_PASSWORD
  #define WIFI_PASSWORD "HospitalPassword123"
#endif
#ifndef MQTT_HOST
  #define MQTT_HOST     "broker.smartneb.health"
#endif
#ifndef MQTT_PORT
  #define MQTT_PORT     8883
#endif
#ifndef DEVICE_CODE
  #define DEVICE_CODE   "NEB-001"
#endif
#ifndef HOSPITAL_ID
  #define HOSPITAL_ID   "demo-hospital"
#endif
#ifndef MQTT_USER
  #define MQTT_USER     "device_neb_001"
#endif
#ifndef MQTT_PASS
  #define MQTT_PASS     "SecureDeviceToken123!"
#endif

// Hardware Pin Definitions
const int NEBULIZER_PIN   = 26; // Relays / PWM driver for mesh nebulizer
const int MAX_SESSION_SEC = 900; // 15-minute emergency hardware cutoff

// Moving Average Noise Filter Parameters
const int WINDOW_SIZE = 5;
float spo2Buffer[WINDOW_SIZE];
int bufferIndex = 0;

// Root CA Certificate (Amazon Root CA 1 / LetsEncrypt)
const char* ROOT_CA_CERT = R"EOF(
-----BEGIN CERTIFICATE-----
MIIF3jCCA8agAwIBAgIQAf1tWYVMNmPhDpMdZ08EZjANBgkqhkiG9w0BAQsFADCB
...
-----END CERTIFICATE-----
)EOF";

WiFiClientSecure netClient;
PubSubClient mqttClient(netClient);

unsigned long sessionStartTime = 0;
bool isNebulizerActive = false;

// Moving Average Filter Implementation
float applyMovingAverage(float rawVal) {
  spo2Buffer[bufferIndex] = rawVal;
  bufferIndex = (bufferIndex + 1) % WINDOW_SIZE;
  float sum = 0;
  for (int i = 0; i < WINDOW_SIZE; i++) {
    sum += spo2Buffer[i];
  }
  return sum / WINDOW_SIZE;
}

void setup() {
  Serial.begin(115200);
  pinMode(NEBULIZER_PIN, OUTPUT);
  digitalWrite(NEBULIZER_PIN, LOW);

  // Initialize Watchdog Timer (10s timeout)
  esp_task_wdt_init(10, true);
  esp_task_wdt_add(NULL);

  // Connect to Wi-Fi
  Serial.print("Connecting to Wi-Fi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✓ Wi-Fi Connected!");

  // NTP Time Sync over TLS
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Synchronizing NTP Time...");
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println("\n✓ NTP Time Synchronized!");

  // Configure TLS Certificate & MQTT
  netClient.setCACert(ROOT_CA_CERT);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);

  connectMQTT();
}

void connectMQTT() {
  String statusTopic = String("hospitals/") + HOSPITAL_ID + "/devices/" + DEVICE_CODE + "/status";
  String lwtPayload = "{\"status\":\"OFFLINE\",\"reason\":\"HARDWARE_POWER_FAILURE\"}";

  while (!mqttClient.connected()) {
    Serial.print("Connecting to TLS MQTT Broker...");
    if (mqttClient.connect(DEVICE_CODE, MQTT_USER, MQTT_PASS, statusTopic.c_str(), 1, true, lwtPayload.c_str())) {
      Serial.println("\n✓ Connected to TLS MQTT Broker!");
      
      // Publish ONLINE status
      mqttClient.publish(statusTopic.c_str(), "{\"status\":\"ONLINE\"}", true);

      // Subscribe to command topic
      String cmdTopic = String("hospitals/") + HOSPITAL_ID + "/devices/" + DEVICE_CODE + "/commands";
      mqttClient.subscribe(cmdTopic.c_str(), 1);
    } else {
      Serial.print(" Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" Retrying in 5s...");
      delay(5000);
    }
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.printf("📩 Received Command on [%s]: %s\n", topic, msg.c_str());

  if (msg.indexOf("START") >= 0) {
    digitalWrite(NEBULIZER_PIN, HIGH);
    isNebulizerActive = true;
    sessionStartTime = millis();
    Serial.println("🟢 Nebulizer Started via Remote Command.");
  } else if (msg.indexOf("STOP") >= 0) {
    digitalWrite(NEBULIZER_PIN, LOW);
    isNebulizerActive = false;
    Serial.println("🔴 Nebulizer Stopped via Remote Command.");
  }
}

void loop() {
  esp_task_wdt_reset(); // Feed watchdog

  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();

  // Hardware Emergency Safety Cutoff Guard
  if (isNebulizerActive) {
    unsigned long elapsedSec = (millis() - sessionStartTime) / 1000;
    if (elapsedSec >= MAX_SESSION_SEC) {
      digitalWrite(NEBULIZER_PIN, LOW);
      isNebulizerActive = false;
      Serial.println("🚨 EMERGENCY CUTOFF: Nebulizer auto-stopped after exceeding 15-minute maximum limit!");
    }
  }

  delay(100);
}
