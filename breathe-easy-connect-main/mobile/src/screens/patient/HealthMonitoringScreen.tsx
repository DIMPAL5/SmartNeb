import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { apiClient } from "../../api/client";
import { VitalsCard } from "../../components/VitalsCard";
import { AppHaptics } from "../../utils/haptics";

export const HealthMonitoringScreen = () => {
  const { user } = useAuth();
  const { latestVitalsUpdate, isConnected } = useSocket();
  const [history, setHistory] = useState<any[]>([]);
  const [selectedRange, setSelectedRange] = useState("1h");
  const [lastUpdated, setLastUpdated] = useState<string>("Just now");
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealthHistory = async () => {
    if (!user?.patientId) return;
    try {
      const res = await apiClient.get(`/telemetry/health?patientId=${user.patientId}&limit=50`);
      if (res.data?.data) {
        setHistory(res.data.data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (e) {
      console.error("Fetch Health Error:", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthHistory();
  }, [user?.patientId]);

  useEffect(() => {
    if (
      latestVitalsUpdate &&
      (!latestVitalsUpdate.patientId ||
        latestVitalsUpdate.patientId === user?.patientId ||
        latestVitalsUpdate.source === "firebase_rtdb")
    ) {
      setHistory((prev) => [latestVitalsUpdate.telemetry, ...prev.slice(0, 49)]);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [latestVitalsUpdate]);

  const latest = history[0] || {};
  const currentTemp = latest.bodyTemperature ?? latest.temperature ?? null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            AppHaptics.triggerLightImpact();
            fetchHealthHistory();
          }}
          tintColor="#38bdf8"
        />
      }
    >
      <Text style={styles.title}>Live Health Monitoring</Text>
      <View style={styles.freshnessRow}>
        <View style={[styles.dot, { backgroundColor: isConnected ? "#10b981" : "#f59e0b" }]} />
        <Text style={styles.freshnessText}>
          {isConnected
            ? `Data connection live • Last updated ${lastUpdated}`
            : "Data connection interrupted"}
        </Text>
      </View>

      {/* Time Range Selector */}
      <View style={styles.rangeRow}>
        {["5m", "15m", "1h", "6h", "24h", "7d"].map((range) => (
          <TouchableOpacity
            key={range}
            style={[styles.chip, selectedRange === range ? styles.activeChip : null]}
            onPress={() => {
              AppHaptics.triggerSelection();
              setSelectedRange(range);
            }}
          >
            <Text style={[styles.chipText, selectedRange === range ? styles.activeChipText : null]}>
              {range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Vitals Cards */}
      <VitalsCard
        label="Blood Oxygen (SpO2)"
        value={latest.spo2 || 98}
        unit="%"
        type="spo2"
        subtext="Live continuous pulse oximetry stream"
      />

      <VitalsCard
        label="Heart Rate"
        value={latest.bpm || 76}
        unit="BPM"
        type="bpm"
        subtext="Live pulse & cardiac rhythm"
      />

      <VitalsCard
        label="Body Temperature"
        value={currentTemp}
        unit="°C"
        type="temp"
        subtext={
          currentTemp != null
            ? "Continuous biometric thermal reading"
            : "Sensor not detected (DS18B20 / MLX90614)"
        }
      />

      {/* Telemetry Stream Log Table/List */}
      <Text style={styles.sectionHeader}>Telemetry History Log ({selectedRange})</Text>
      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Timestamp</Text>
          <Text style={[styles.th, { flex: 1 }]}>SpO2</Text>
          <Text style={[styles.th, { flex: 1 }]}>BPM</Text>
          <Text style={[styles.th, { flex: 1 }]}>Temp</Text>
        </View>
        {history.slice(0, 10).map((row: any, idx: number) => {
          const rowTemp = row.bodyTemperature ?? row.temperature ?? null;
          return (
            <View key={row.id || idx} style={styles.tr}>
              <Text style={[styles.td, { flex: 2 }]}>
                {new Date(row.recordedAt || Date.now()).toLocaleTimeString()}
              </Text>
              <Text style={[styles.td, { flex: 1, color: row.spo2 < 92 ? "#ef4444" : "#38bdf8" }]}>
                {row.spo2 ? `${row.spo2}%` : "--"}
              </Text>
              <Text style={[styles.td, { flex: 1 }]}>{row.bpm || "--"}</Text>
              <Text style={[styles.td, { flex: 1 }]}>
                {rowTemp != null ? `${Number(rowTemp).toFixed(1)}°C` : "--"}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
  },
  freshnessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  freshnessText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeChip: {
    backgroundColor: "#38bdf8",
  },
  chipText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  activeChipText: {
    color: "#0f172a",
    fontWeight: "800",
  },
  sectionHeader: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 10,
  },
  tableCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    paddingBottom: 8,
    marginBottom: 8,
  },
  th: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  td: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
  },
});
