import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { PhoneCall, AlertOctagon, Share2, MapPin, Activity, ShieldAlert, ArrowLeft } from "lucide-react-native";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";

export const EmergencySosScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const { latestVitalsUpdate } = useSocket();
  const [sosActive, setSosActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emergencyToken, setEmergencyToken] = useState<string | null>(null);
  const [vitals, setVitals] = useState({
    spo2: latestVitalsUpdate?.spo2 || 88,
    bpm: latestVitalsUpdate?.bpm || 135,
    temp: latestVitalsUpdate?.bodyTemperature || 37.8,
  });

  useEffect(() => {
    if (latestVitalsUpdate) {
      setVitals({
        spo2: latestVitalsUpdate.spo2 || vitals.spo2,
        bpm: latestVitalsUpdate.bpm || vitals.bpm,
        temp: latestVitalsUpdate.bodyTemperature || vitals.temp,
      });
    }
  }, [latestVitalsUpdate]);

  const triggerSOS = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post("/emergency/sos", {
        source: "mobile_sos_button",
      });

      if (res.data) {
        setSosActive(true);
        // Generate emergency summary token for first responders
        const tokenRes = await apiClient.post("/emergency/summary/token", {
          validityHours: 24,
        });
        if (tokenRes.data?.token) {
          setEmergencyToken(tokenRes.data.token);
        }
      }
    } catch (e: any) {
      Alert.alert("Emergency Error", e.response?.data?.error || "Could not broadcast SOS.");
    } finally {
      setLoading(false);
    }
  };

  const dialEmergency = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EMERGENCY SOS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Massive 1-Tap SOS Button */}
        <View style={styles.sosCenter}>
          <TouchableOpacity
            style={[styles.sosButton, sosActive && styles.sosButtonActive]}
            onPress={triggerSOS}
            disabled={loading || sosActive}
          >
            {loading ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <>
                <AlertOctagon size={48} color="#FFFFFF" />
                <Text style={styles.sosButtonText}>
                  {sosActive ? "SOS ACTIVE 🚨" : "TRIGGER SOS"}
                </Text>
                <Text style={styles.sosButtonSub}>
                  {sosActive ? "Alert dispatched to caregivers & ER" : "Tap for immediate emergency alert"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Live Vitals Snapshot Box */}
        <View style={styles.vitalsCard}>
          <Text style={styles.vitalsCardTitle}>Emergency Vitals Snapshot</Text>
          <View style={styles.vitalsRow}>
            <View style={styles.vitalBox}>
              <Text style={styles.vitalLabel}>SpO2</Text>
              <Text style={[styles.vitalVal, { color: vitals.spo2 < 90 ? "#EF4444" : "#10B981" }]}>
                {vitals.spo2}%
              </Text>
            </View>
            <View style={styles.vitalBox}>
              <Text style={styles.vitalLabel}>Pulse (BPM)</Text>
              <Text style={styles.vitalVal}>{vitals.bpm}</Text>
            </View>
            <View style={styles.vitalBox}>
              <Text style={styles.vitalLabel}>Body Temp</Text>
              <Text style={styles.vitalVal}>{vitals.temp}°C</Text>
            </View>
          </View>
        </View>

        {/* 1-Tap Dial Emergency Services */}
        <Text style={styles.sectionHeader}>Instant Emergency Contacts</Text>
        <TouchableOpacity style={styles.callRow} onPress={() => dialEmergency("108")}>
          <View style={styles.phoneIconBox}>
            <PhoneCall size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.callLabel}>Dial National Ambulance (108)</Text>
            <Text style={styles.callSub}>Pediatric emergency medical dispatch</Text>
          </View>
          <Text style={styles.dialBadge}>CALL 108</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.callRow} onPress={() => dialEmergency("112")}>
          <View style={styles.phoneIconBox}>
            <PhoneCall size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.callLabel}>Dial Emergency Police/Rescue (112)</Text>
            <Text style={styles.callSub}>Central government response helpline</Text>
          </View>
          <Text style={styles.dialBadge}>CALL 112</Text>
        </TouchableOpacity>

        {/* Emergency Summary Token Link for Paramedics */}
        {emergencyToken && (
          <View style={styles.summaryBox}>
            <ShieldAlert size={22} color="#DC2626" />
            <Text style={styles.summaryTitle}>Paramedic / ER Doctor Summary Card</Text>
            <Text style={styles.summaryDesc}>
              A secure, expiring clinical summary token was generated. Paramedics can view child's condition, allergies, and active medications.
            </Text>
            <TouchableOpacity
              style={styles.summaryBtn}
              onPress={() => navigation.navigate("EmergencySummary", { token: emergencyToken })}
            >
              <Share2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.summaryBtnText}>Open / Share Emergency Summary</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#7F1D1D" },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#991B1B",
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  content: { padding: 20 },
  sosCenter: { alignItems: "center", marginVertical: 16 },
  sosButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 4,
    borderColor: "#FCA5A5",
  },
  sosButtonActive: { backgroundColor: "#B91C1C", borderColor: "#F87171" },
  sosButtonText: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", marginTop: 8 },
  sosButtonSub: { color: "#FEE2E2", fontSize: 11, textAlign: "center", marginTop: 4 },
  vitalsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginVertical: 14,
  },
  vitalsCardTitle: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 12 },
  vitalsRow: { flexDirection: "row", justifyContent: "space-between" },
  vitalBox: { width: "31%", backgroundColor: "#F8FAFC", padding: 12, borderRadius: 12, alignItems: "center" },
  vitalLabel: { fontSize: 11, fontWeight: "600", color: "#64748B" },
  vitalVal: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginTop: 4 },
  sectionHeader: { fontSize: 14, fontWeight: "700", color: "#FEE2E2", marginTop: 12, marginBottom: 10 },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  phoneIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#DC2626", justifyContent: "center", alignItems: "center" },
  callLabel: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  callSub: { fontSize: 11, color: "#64748B", marginTop: 2 },
  dialBadge: {
    backgroundColor: "#FEF2F2",
    color: "#DC2626",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    fontWeight: "800",
    fontSize: 12,
  },
  summaryBox: {
    backgroundColor: "#FEF2F2",
    padding: 18,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  summaryTitle: { fontSize: 14, fontWeight: "800", color: "#991B1B", marginTop: 6 },
  summaryDesc: { fontSize: 12, color: "#7F1D1D", marginTop: 4, lineHeight: 18 },
  summaryBtn: {
    backgroundColor: "#DC2626",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  summaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
});
