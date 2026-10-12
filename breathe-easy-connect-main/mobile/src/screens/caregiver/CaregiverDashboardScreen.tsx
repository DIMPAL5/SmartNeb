import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { VitalsCard } from "../../components/VitalsCard";
import { SkeletonCard } from "../../components/SkeletonLoader";
import { OfflineBanner } from "../../components/OfflineBanner";
import { OfflineCache } from "../../utils/offlineCache";
import { AppHaptics } from "../../utils/haptics";
import { exportHealthSummaryPdf } from "../../utils/pdfExporter";

export const CaregiverDashboardScreen = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("");

  const caregiverId = user?.caregiverId || user?.userId || "caregiver_default";

  const fetchAssigned = async () => {
    try {
      const res = await apiClient.get("/patients");
      if (res.data?.patients) {
        setPatients(res.data.patients);
        setIsOffline(false);
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setLastSyncedTime(timeStr);
        await OfflineCache.cacheCaregiverRoster(caregiverId, res.data.patients);
      }
    } catch (e: any) {
      console.warn("Caregiver API request failed, serving cached roster:", e.message);
      const cached = await OfflineCache.getCachedCaregiverRoster<any[]>(caregiverId);
      if (cached) {
        setPatients(cached.data);
        setIsOffline(true);
        setLastSyncedTime(cached.formattedTime);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAssigned();
  }, []);

  const handleExportPatientPdf = async (patient: any) => {
    await AppHaptics.triggerLightImpact();
    await exportHealthSummaryPdf({
      patientName: patient.fullName,
      mrn: patient.mrn,
      condition: patient.condition || "Asthma / Respiratory Care",
      spo2: 98,
      heartRate: 76,
      temperature: 36.8,
      adherenceRate: 92,
      medication: "Salbutamol Inhalation",
      dosage: "2.5 mg / 2.5 ml",
      frequency: "Twice Daily",
    });
  };

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
            fetchAssigned();
          }}
          tintColor="#38bdf8"
        />
      }
    >
      {/* Offline Status Banner */}
      <OfflineBanner isOffline={isOffline} lastSyncedTime={lastSyncedTime} />

      <Text style={styles.title}>Caregiver Monitoring Portal</Text>
      <Text style={styles.subtitle}>{user?.fullName} • Family Caregiver</Text>

      {/* Loading Skeleton States */}
      {loading ? (
        <View style={{ gap: 12 }}>
          <SkeletonCard height={180} />
          <SkeletonCard height={180} />
        </View>
      ) : patients.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No assigned patients in your care circle.</Text>
        </View>
      ) : (
        patients.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.patientName}>{p.fullName}</Text>
                <Text style={styles.mrn}>
                  MRN: {p.mrn} | Condition: {p.condition || "Asthma"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.exportBtn}
                onPress={() => handleExportPatientPdf(p)}
              >
                <Text style={styles.exportBtnText}>📄 Export PDF</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 8 }}>
              <VitalsCard
                label="SpO2 Blood Oxygen"
                value={98}
                unit="%"
                type="spo2"
                subtext="Threshold: ≥95% Safe"
              />
              <VitalsCard
                label="Heart Rate"
                value={76}
                unit="BPM"
                type="bpm"
                subtext="Target: 60-100 BPM"
              />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { padding: 18, paddingBottom: 40 },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginBottom: 16 },
  card: { backgroundColor: "#1e293b", borderRadius: 20, padding: 18, marginBottom: 16 },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  patientName: { color: "#38bdf8", fontSize: 20, fontWeight: "800" },
  mrn: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  exportBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  exportBtnText: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
  },
});
