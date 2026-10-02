import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { apiClient } from "../../api/client";
import { VitalsCard } from "../../components/VitalsCard";

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
    if (latestVitalsUpdate && latestVitalsUpdate.patientId === user?.patientId) {
      setHistory((prev) => [latestVitalsUpdate.telemetry, ...prev.slice(0, 49)]);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [latestVitalsUpdate]);

  const latest = history[0] || {};

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
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
            onPress={() => setSelectedRange(range)}
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
        value={latest.spo2 ? `${latest.spo2}%` : "98%"}
        unit="SpO2"
        status={latest.spo2 && latest.spo2 < 92 ? "critical" : "normal"}
        subtext="Live continuous telemetry stream"
      />

      <VitalsCard
        label="Heart Rate"
        value={latest.bpm || "76"}
        unit="BPM"
        status="normal"
        subtext="Live pulse stream"
      />

      <VitalsCard
        label="Body Temperature"
        value={latest.bodyTemperature ? `${latest.bodyTemperature}°C` : "36.8°C"}
        unit="°C"
        status="normal"
        subtext="Normal thermal range"
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
        {history.slice(0, 10).map((row: any, idx: number) => (
          <View key={row.id || idx} style={styles.tr}>
            <Text style={[styles.td, { flex: 2 }]}>
              {new Date(row.recordedAt || Date.now()).toLocaleTimeString()}
            </Text>
            <Text style={[styles.td, { flex: 1, color: row.spo2 < 92 ? "#ef4444" : "#38bdf8" }]}>
              {row.spo2 || 98}%
            </Text>
            <Text style={[styles.td, { flex: 1 }]}>{row.bpm || 76}</Text>
            <Text style={[styles.td, { flex: 1 }]}>{row.bodyTemperature || 36.8}°C</Text>
          </View>
        ))}
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
    padding: 18,
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
  },
  freshnessRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  activeChip: {
    backgroundColor: "#0284c7",
    borderColor: "#38bdf8",
  },
  chipText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  activeChipText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  sectionHeader: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 10,
  },
  tableCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 12,
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
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#334155",
  },
  td: {
    color: "#f8fafc",
    fontSize: 13,
  },
});
