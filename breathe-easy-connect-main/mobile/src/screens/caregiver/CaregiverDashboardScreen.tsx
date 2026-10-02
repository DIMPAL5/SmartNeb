import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { VitalsCard } from "../../components/VitalsCard";

export const CaregiverDashboardScreen = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAssigned = async () => {
    try {
      const res = await apiClient.get("/patients");
      if (res.data?.patients) {
        setPatients(res.data.patients);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAssigned();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchAssigned();
          }}
          tintColor="#38bdf8"
        />
      }
    >
      <Text style={styles.title}>Caregiver Monitoring Portal</Text>
      <Text style={styles.subtitle}>{user?.fullName} • Family Caregiver</Text>

      {patients.map((p) => (
        <View key={p.id} style={styles.card}>
          <Text style={styles.patientName}>{p.fullName}</Text>
          <Text style={styles.mrn}>
            MRN: {p.mrn} | Condition: {p.condition}
          </Text>

          <VitalsCard label="SpO2 Blood Oxygen" value="98%" unit="SpO2" status="normal" />
          <VitalsCard label="Heart Rate" value="76" unit="BPM" status="normal" />
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { padding: 18 },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginBottom: 16 },
  card: { backgroundColor: "#1e293b", borderRadius: 20, padding: 18, marginBottom: 16 },
  patientName: { color: "#38bdf8", fontSize: 20, fontWeight: "800" },
  mrn: { color: "#94a3b8", fontSize: 12, marginBottom: 10 },
});
