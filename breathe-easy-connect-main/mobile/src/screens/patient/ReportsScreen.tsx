import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { exportHealthSummaryPdf } from "../../utils/pdfExporter";
import { AppHaptics } from "../../utils/haptics";

export const ReportsScreen = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (user?.patientId) {
      apiClient
        .get(`/reports/summary?patientId=${user.patientId}`)
        .then((res) => setReport(res.data?.report))
        .catch(console.error);
    }
  }, [user?.patientId]);

  const handleExportPDF = async () => {
    setExporting(true);
    await AppHaptics.triggerMediumImpact();
    try {
      const adherencePct = Math.round((report?.adherenceAvg ?? 0.92) * 100);
      await exportHealthSummaryPdf({
        patientName: user?.fullName || "Patient",
        mrn: user?.patientId ? `MRN-${user.patientId.slice(0, 8).toUpperCase()}` : "MRN-PT-00128",
        condition: "Asthma / Pulmonology Care",
        spo2: 98,
        heartRate: 76,
        temperature: 36.8,
        adherenceRate: adherencePct,
        medication: "Salbutamol Inhalation Solution",
        dosage: "2.5 mg / 2.5 ml",
        frequency: "Twice Daily (Morning & Evening)",
        notes: `Analyzed over ${report?.sessionsCount ?? 2} recorded nebulizer therapy sessions. System alerts flagged: ${report?.alertsCount ?? 0}.`,
      });
    } finally {
      setExporting(false);
    }
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
            <Text style={styles.statVal}>{Math.round((report?.adherenceAvg ?? 0.92) * 100)}%</Text>
            <Text style={styles.statLab}>Adherence</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{report?.alertsCount ?? 0}</Text>
            <Text style={styles.statLab}>Alerts</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.pdfBtn, exporting && { opacity: 0.7 }]}
          onPress={handleExportPDF}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.pdfBtnText}>📄 Export PDF Clinical Summary</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { padding: 18, paddingBottom: 40 },
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
