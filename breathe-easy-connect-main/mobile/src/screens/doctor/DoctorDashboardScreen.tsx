import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { SkeletonRosterItem } from "../../components/SkeletonLoader";
import { OfflineBanner } from "../../components/OfflineBanner";
import { OfflineCache } from "../../utils/offlineCache";
import { AppHaptics } from "../../utils/haptics";
import { exportHealthSummaryPdf } from "../../utils/pdfExporter";

export const DoctorDashboardScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("");

  const doctorId = user?.doctorId || user?.userId || "doctor_default";

  const fetchPatients = async () => {
    try {
      const res = await apiClient.get("/patients");
      if (res.data?.patients) {
        setPatients(res.data.patients);
        setIsOffline(false);
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setLastSyncedTime(timeStr);
        await OfflineCache.cacheDoctorRoster(doctorId, res.data.patients);
      }
    } catch (e: any) {
      console.warn("API request failed, retrieving cached doctor roster:", e.message);
      const cached = await OfflineCache.getCachedDoctorRoster<any[]>(doctorId);
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
    fetchPatients();
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
      adherenceRate: 94,
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
            fetchPatients();
          }}
          tintColor="#38bdf8"
        />
      }
    >
      {/* Offline Status Banner */}
      <OfflineBanner isOffline={isOffline} lastSyncedTime={lastSyncedTime} />

      <Text style={styles.title}>Doctor Command Console</Text>
      <Text style={styles.subtitle}>{user?.fullName} • Pulmonology & Critical Care</Text>

      {/* KPI Stats Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiVal}>{patients.length}</Text>
          <Text style={styles.kpiLab}>Assigned Patients</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={[styles.kpiVal, { color: "#10b981" }]}>
            {patients.filter((p) => p.devices?.some((d: any) => d.status === "online")).length}
          </Text>
          <Text style={styles.kpiLab}>Online Devices</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={[styles.kpiVal, { color: "#ef4444" }]}>1</Text>
          <Text style={styles.kpiLab}>Critical Alerts</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Assigned Patient Registry</Text>

      {/* Skeleton Loading State */}
      {loading ? (
        <View style={{ gap: 8 }}>
          <SkeletonRosterItem />
          <SkeletonRosterItem />
          <SkeletonRosterItem />
        </View>
      ) : patients.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No assigned patients found.</Text>
        </View>
      ) : (
        patients.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.patientCard}
            onPress={() => {
              AppHaptics.triggerSelection();
              navigation.navigate("PatientDetail", { patient: p });
            }}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.patientName}>{p.fullName}</Text>
              <Text style={styles.mrn}>{p.mrn}</Text>
            </View>

            <Text style={styles.conditionText}>
              Condition: {p.condition || "Respiratory Assessment"}
            </Text>
            <Text style={styles.thresholdText}>
              SpO2 Threshold: {p.spo2Threshold || 92}% | BPM Target: {p.bpmLowThreshold || 55}-
              {p.bpmHighThreshold || 110}
            </Text>

            <View style={styles.cardFooter}>
              <Text style={styles.viewDetailText}>Open Clinical Snapshot →</Text>
              <TouchableOpacity
                style={styles.pdfBadgeBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  handleExportPatientPdf(p);
                }}
              >
                <Text style={styles.pdfBadgeText}>📄 Export PDF</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
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
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  kpiBox: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  kpiVal: { color: "#38bdf8", fontSize: 24, fontWeight: "900" },
  kpiLab: { color: "#94a3b8", fontSize: 10, marginTop: 4, textAlign: "center" },
  sectionHeader: { color: "#cbd5e1", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  patientCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  patientName: { color: "#f8fafc", fontSize: 18, fontWeight: "800" },
  mrn: { color: "#38bdf8", fontSize: 12, fontWeight: "700" },
  conditionText: { color: "#cbd5e1", fontSize: 13, marginTop: 4 },
  thresholdText: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#334155",
    marginTop: 12,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewDetailText: { color: "#38bdf8", fontWeight: "700", fontSize: 13 },
  pdfBadgeBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  pdfBadgeText: {
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
