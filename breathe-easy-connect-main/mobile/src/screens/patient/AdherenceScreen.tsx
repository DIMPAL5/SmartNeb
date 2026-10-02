import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";

export const AdherenceScreen = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCarePlans = async () => {
    try {
      const res = await apiClient.get(`/care-plans?patientId=${user?.patientId}`);
      if (res.data?.plans) {
        setPlans(res.data.plans);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCarePlans();
  }, [user?.patientId]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchCarePlans();
          }}
          tintColor="#38bdf8"
        />
      }
    >
      <Text style={styles.title}>Session Adherence</Text>
      <Text style={styles.subtitle}>Track prescribed nebulization compliance</Text>

      {/* Overview Stat Card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Weekly Adherence Rate</Text>
        <Text style={styles.adherenceScore}>100%</Text>
        <Text style={styles.adherenceSub}>2 of 2 prescribed sessions completed today</Text>
      </View>

      <Text style={styles.sectionTitle}>Prescribed Care Plan</Text>
      {plans.length === 0 ? (
        <Text style={styles.emptyText}>No care plans found.</Text>
      ) : (
        plans.map((p) => (
          <View key={p.id} style={styles.planCard}>
            <Text style={styles.medTitle}>{p.medication}</Text>
            <Text style={styles.planDetail}>
              Dosage: {p.dosage} | Duration: {p.durationMinutes} mins
            </Text>
            <Text style={styles.planDetail}>Frequency: {p.frequencyPerDay} times per day</Text>
            <Text style={styles.instructions}>
              Instructions: {p.instructions || "Inhale via nebulizer as prescribed."}
            </Text>
          </View>
        ))
      )}
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
  subtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#38bdf8",
  },
  cardLabel: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  adherenceScore: {
    color: "#10b981",
    fontSize: 48,
    fontWeight: "900",
    marginVertical: 4,
  },
  adherenceSub: {
    color: "#cbd5e1",
    fontSize: 13,
  },
  sectionTitle: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  planCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  medTitle: {
    color: "#38bdf8",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  planDetail: {
    color: "#f8fafc",
    fontSize: 14,
    marginVertical: 2,
  },
  instructions: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 6,
    fontStyle: "italic",
  },
  emptyText: {
    color: "#64748b",
    fontStyle: "italic",
  },
});
