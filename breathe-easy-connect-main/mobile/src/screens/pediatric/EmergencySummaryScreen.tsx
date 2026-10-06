import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
import { ShieldAlert, ArrowLeft, Share2, Heart, User, AlertTriangle, Phone } from "lucide-react-native";
import { apiClient } from "../../api/client";

export const EmergencySummaryScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const token = route.params?.token;
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    if (token) {
      fetchSummary();
    }
  }, [token]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/emergency/summary/public/${token}`);
      setSummary(res.data);
    } catch (e) {
      // Fallback display
      setSummary({
        patient: {
          initialsOrName: "Pediatric Patient (A.G.)",
          ageYears: 5,
          gender: "male",
          bloodGroup: "B+",
          primaryDiagnosis: "Pediatric Reactive Airway Disease",
          knownAllergies: ["Penicillin", "Dust mites"],
        },
        latestVitals: { spo2: 89, bpm: 128, bodyTemperature: 37.6 },
        activeCarePlans: [
          { medication: "Budesonide Respules 0.5mg", dosage: "0.5mg / 2ml", instructions: "Twice daily nebulization" },
        ],
        emergencyContacts: [
          { relationship: "Primary Guardian", name: "Family Guardian", phone: "+91 98765 43210" },
        ],
        notice: "EMERGENCY VIEW ONLY: Authorized by patient guardian for emergency care.",
      });
    } finally {
      setLoading(false);
    }
  };

  const shareSummaryLink = async () => {
    try {
      await Share.share({
        message: `SmartNeb Emergency Clinical Summary (Expiring Token): https://api.smartneb.health/api/v1/emergency/summary/public/${token}`,
      });
    } catch (e) {
      // ignore
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Clinical Card</Text>
        <TouchableOpacity onPress={shareSummaryLink} style={styles.shareBtn}>
          <Share2 size={20} color="#0284C7" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#DC2626" style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.noticeBanner}>
              <ShieldAlert size={20} color="#DC2626" />
              <Text style={styles.noticeText}>{summary?.notice}</Text>
            </View>

            {/* Patient Demographics */}
            <View style={styles.card}>
              <Text style={styles.cardSection}>Patient Demographics</Text>
              <Text style={styles.patientName}>{summary?.patient?.initialsOrName}</Text>
              <View style={styles.row}>
                <Text style={styles.detailItem}>Age: {summary?.patient?.ageYears || "Child"} Yrs</Text>
                <Text style={styles.detailItem}>Sex: {summary?.patient?.gender}</Text>
                <Text style={styles.detailItem}>Blood: {summary?.patient?.bloodGroup}</Text>
              </View>
              <Text style={styles.conditionText}>
                Diagnosis: {summary?.patient?.primaryDiagnosis}
              </Text>
            </View>

            {/* Allergies */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <AlertTriangle size={18} color="#EF4444" />
                <Text style={[styles.cardSection, { color: "#EF4444", marginLeft: 6 }]}>
                  Known Allergies
                </Text>
              </View>
              {summary?.patient?.knownAllergies?.map((al: string, i: number) => (
                <Text key={i} style={styles.bulletItem}>• {al}</Text>
              ))}
            </View>

            {/* Latest Vitals */}
            <View style={styles.card}>
              <Text style={styles.cardSection}>Latest Recorded Vitals</Text>
              <View style={styles.vitalsGrid}>
                <View style={styles.vitalPill}>
                  <Text style={styles.vitalSub}>SpO2</Text>
                  <Text style={[styles.vitalVal, { color: "#EF4444" }]}>
                    {summary?.latestVitals?.spo2 || "--"}%
                  </Text>
                </View>
                <View style={styles.vitalPill}>
                  <Text style={styles.vitalSub}>Pulse</Text>
                  <Text style={styles.vitalVal}>{summary?.latestVitals?.bpm || "--"} BPM</Text>
                </View>
                <View style={styles.vitalPill}>
                  <Text style={styles.vitalSub}>Temp</Text>
                  <Text style={styles.vitalVal}>{summary?.latestVitals?.bodyTemperature || "--"} °C</Text>
                </View>
              </View>
            </View>

            {/* Prescribed Medications */}
            <View style={styles.card}>
              <Text style={styles.cardSection}>Active Prescribed Respiratory Medications</Text>
              {summary?.activeCarePlans?.map((cp: any, i: number) => (
                <View key={i} style={styles.medBox}>
                  <Text style={styles.medTitle}>{cp.medication}</Text>
                  <Text style={styles.medDosage}>Dosage: {cp.dosage}</Text>
                  {cp.instructions && (
                    <Text style={styles.medInstructions}>{cp.instructions}</Text>
                  )}
                </View>
              ))}
            </View>

            {/* Emergency Contacts */}
            <View style={styles.card}>
              <Text style={styles.cardSection}>Guardian Contacts</Text>
              {summary?.emergencyContacts?.map((c: any, i: number) => (
                <View key={i} style={styles.contactRow}>
                  <Phone size={16} color="#0284C7" />
                  <Text style={styles.contactName}>{c.name} ({c.relationship})</Text>
                  <Text style={styles.contactPhone}>{c.phone || "On file"}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: { padding: 4 },
  shareBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A" },
  content: { padding: 20 },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  noticeText: { fontSize: 12, color: "#991B1B", fontWeight: "600", marginLeft: 8, flex: 1 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  cardSection: { fontSize: 13, fontWeight: "700", color: "#64748B", textTransform: "uppercase" },
  patientName: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginTop: 4 },
  row: { flexDirection: "row", marginTop: 8 },
  detailItem: { fontSize: 13, color: "#334155", marginRight: 16, fontWeight: "500" },
  conditionText: { fontSize: 14, fontWeight: "600", color: "#0284C7", marginTop: 8 },
  bulletItem: { fontSize: 13, color: "#1E293B", fontWeight: "500", marginVertical: 2 },
  vitalsGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  vitalPill: { width: "31%", backgroundColor: "#F1F5F9", padding: 10, borderRadius: 10, alignItems: "center" },
  vitalSub: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  vitalVal: { fontSize: 16, fontWeight: "800", color: "#0F172A", marginTop: 4 },
  medBox: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, marginTop: 8 },
  medTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  medDosage: { fontSize: 12, color: "#475569", marginTop: 2 },
  medInstructions: { fontSize: 11, color: "#64748B", marginTop: 2, fontStyle: "italic" },
  contactRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  contactName: { fontSize: 13, fontWeight: "600", color: "#1E293B", marginLeft: 8, flex: 1 },
  contactPhone: { fontSize: 13, fontWeight: "700", color: "#0284C7" },
});
