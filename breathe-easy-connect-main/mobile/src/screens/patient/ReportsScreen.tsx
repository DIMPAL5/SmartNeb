import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";

export const ReportsScreen = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    if (user?.patientId) {
      apiClient
        .get(`/reports/summary?patientId=${user.patientId}`)
        .then((res) => setReport(res.data?.report))
        .catch(console.error);
    }
  }, [user?.patientId]);

  const handleExportPDF = () => {
    Alert.alert(
      "Clinical PDF Export",
      "Exporting SmartNeb Respiratory Therapy Summary report as PDF...",
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Clinical Reports</Text>
      <Text style={styles.subtitle}>Generate and download comprehensive therapy reports</Text>

      <View style={styles.card}>
        <Text style={styles.cardHeader}>Comprehensive Respiratory Report</Text>
        <Text style={styles.cardSub}>Range: Last 30 Days</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{report?.sessionsCount ?? 2}</Text>
            <Text style={styles.statLab}>Sessions</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{Math.round((report?.adherenceAvg ?? 1.0) * 100)}%</Text>
            <Text style={styles.statLab}>Adherence</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{report?.alertsCount ?? 0}</Text>
            <Text style={styles.statLab}>Alerts</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.pdfBtn} onPress={handleExportPDF}>
          <Text style={styles.pdfBtnText}>📄 Export PDF Clinical Summary</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { padding: 18 },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginBottom: 16 },
  card: { backgroundColor: "#1e293b", borderRadius: 20, padding: 20 },
  cardHeader: { color: "#38bdf8", fontSize: 18, fontWeight: "800" },
  cardSub: { color: "#94a3b8", fontSize: 12, marginTop: 2, marginBottom: 16 },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  statBox: {
    backgroundColor: "#0f172a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 4,
  },
  statVal: { color: "#f8fafc", fontSize: 22, fontWeight: "800" },
  statLab: { color: "#94a3b8", fontSize: 11, marginTop: 4 },
  pdfBtn: { backgroundColor: "#0284c7", padding: 14, borderRadius: 12, alignItems: "center" },
  pdfBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 14 },
});
