import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { apiClient } from "../../api/client";
import { VitalsCard } from "../../components/VitalsCard";
import { FluidGauge } from "../../components/FluidGauge";
import { BatteryIndicator } from "../../components/BatteryIndicator";
import { VoiceController } from "../../components/VoiceController";

export const PatientDashboardScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { latestVitalsUpdate, isConnected } = useSocket();
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSnapshot = async () => {
    if (!user?.patientId) return;
    try {
      const res = await apiClient.get(`/patients/${user.patientId}/snapshot`);
      if (res.data?.snapshot) {
        setSnapshot(res.data.snapshot);
      }
    } catch (err: any) {
      console.error("Fetch Snapshot Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();
  }, [user?.patientId]);

  useEffect(() => {
    if (latestVitalsUpdate && latestVitalsUpdate.patientId === user?.patientId) {
      setSnapshot((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          latestVitals: latestVitalsUpdate.telemetry || prev.latestVitals,
        };
      });
    }
  }, [latestVitalsUpdate]);

  const triggerSOS = async () => {
    Alert.alert(
      "🚨 EMERGENCY SOS",
      "Are you sure you want to trigger an Emergency SOS dispatch to your Doctor and Caregiver?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "TRIGGER SOS",
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.post("/sos/trigger", {
                patientId: user?.patientId,
                source: "mobile_app",
                vitals: {
                  BPM: snapshot?.latestVitals?.bpm || 80,
                  SpO2: snapshot?.latestVitals?.spo2 || 95,
                },
              });
              Alert.alert(
                "Emergency Alert Sent",
                "Your doctor and caregiver have been notified instantly via WebSockets and Push.",
              );
            } catch (err) {
              Alert.alert("Error", "Failed to trigger SOS.");
            }
          },
        },
      ],
    );
  };

  const handleVoiceCommand = (cmd: string) => {
    if (cmd.includes("start")) navigation.navigate("Nebulizer");
    else if (cmd.includes("oxygen") || cmd.includes("spo2") || cmd.includes("heart"))
      navigation.navigate("Health");
    else if (cmd.includes("sos") || cmd.includes("emergency")) triggerSOS();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading SmartNeb Command Center...</Text>
      </View>
    );
  }

  const latest = snapshot?.latestVitals || {};
  const device = snapshot?.device || {};

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchSnapshot();
            }}
            tintColor="#38bdf8"
          />
        }
      >
        {/* Header Greeting */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good Evening, {user?.fullName || "Patient"}</Text>
            <Text style={styles.subtitle}>Your health and nebulizer status</Text>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: isConnected ? "#10b981" : "#f59e0b" }]}
          >
            <Text style={styles.statusText}>{isConnected ? "LIVE CONNECTED" : "PAUSED"}</Text>
          </View>
        </View>

        {/* Emergency SOS Button */}
        <TouchableOpacity
          style={styles.sosButton}
          onPress={() => navigation.navigate("EmergencySos")}
        >
          <Text style={styles.sosText}>🚨 EMERGENCY SOS</Text>
        </TouchableOpacity>

        {/* Voice Assistant Controller */}
        <VoiceController onCommandRecognized={handleVoiceCommand} />

        {/* Pediatric Healthcare Suite */}
        <Text style={styles.sectionTitle}>Pediatric Care Suite</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: "#0284c7" }]}
            onPress={() => navigation.navigate("BreatheWithBunny")}
          >
            <Text style={styles.actionIcon}>🐰</Text>
            <Text style={styles.actionTitle}>Breathe with Bunny</Text>
            <Text style={styles.actionSub}>Pediatric Therapy Pacer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: "#059669" }]}
            onPress={() => navigation.navigate("AirQuality")}
          >
            <Text style={styles.actionIcon}>🍃</Text>
            <Text style={styles.actionTitle}>Air Quality (AQI)</Text>
            <Text style={styles.actionSub}>PM2.5 & Health Advisories</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: "#d97706" }]}
            onPress={() => navigation.navigate("PEFTracker")}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionTitle}>Peak Flow (PEF)</Text>
            <Text style={styles.actionSub}>Asthma Action Zones</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: "#7c3aed" }]}
            onPress={() => navigation.navigate("MedicationScanner")}
          >
            <Text style={styles.actionIcon}>🔍</Text>
            <Text style={styles.actionTitle}>Verify Medication</Text>
            <Text style={styles.actionSub}>Barcode & Ampoule Check</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: "#2563eb" }]}
            onPress={() => navigation.navigate("Telehealth")}
          >
            <Text style={styles.actionIcon}>📹</Text>
            <Text style={styles.actionTitle}>Doctor Video Call</Text>
            <Text style={styles.actionSub}>WebRTC with Live Vitals</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: "#475569" }]}
            onPress={() => navigation.navigate("AddSmartNeb")}
          >
            <Text style={styles.actionIcon}>📡</Text>
            <Text style={styles.actionTitle}>Pair SmartNeb</Text>
            <Text style={styles.actionSub}>BLE Device Setup</Text>
          </TouchableOpacity>
        </View>

        {/* Live Vitals Grid */}
        <Text style={styles.sectionTitle}>Real-time Vitals</Text>
        <VitalsCard
          label="Blood Oxygen (SpO2)"
          value={latest.spo2 ? `${latest.spo2}%` : "98%"}
          unit="SpO2"
          status={latest.spo2 && latest.spo2 < 92 ? "critical" : "normal"}
          subtext="Target: >92%"
        />

        <VitalsCard
          label="Heart Rate"
          value={latest.bpm || "76"}
          unit="BPM"
          status="normal"
          subtext="Normal resting rate"
        />

        <VitalsCard
          label="Body Temperature"
          value={latest.bodyTemperature ? `${latest.bodyTemperature}°C` : "36.8°C"}
          unit="°C"
          status="normal"
          subtext="Normal range"
        />

        {/* Device & Nebulizer Control Summary Card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>My Nebulizer ({device.deviceCode || "NEB-001"})</Text>
            <Text
              style={[
                styles.stateText,
                { color: device.nebulizerState === "RUNNING" ? "#10b981" : "#38bdf8" },
              ]}
            >
              {device.nebulizerState || "OFF"}
            </Text>
          </View>
          <Text style={styles.cardSub}>
            Status: {device.status || "online"} | Firmware: {device.firmware || "1.0.0"}
          </Text>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate("Nebulizer")}
          >
            <Text style={styles.actionBtnText}>Open Nebulizer Controller →</Text>
          </TouchableOpacity>
        </View>

        {/* Fluid Chamber & Battery Telemetry */}
        <FluidGauge level={device.fluidLevel || 85} />
        <BatteryIndicator percentage={88} voltage={4.1} temperature={28.5} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scroll: {
    padding: 18,
  },
  center: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#94a3b8",
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  greeting: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  sosButton: {
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  sosText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sectionTitle: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  stateText: {
    fontSize: 14,
    fontWeight: "800",
  },
  cardSub: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },
  actionBtn: {
    backgroundColor: "#0284c7",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },
  actionBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  actionCard: {
    width: "48%",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  actionSub: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
});
