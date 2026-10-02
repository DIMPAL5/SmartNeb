import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { apiClient } from "../../api/client";

export const SuperAdminDashboardScreen = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAuditLogs = async () => {
    try {
      const res = await apiClient.get("/admin/audit-logs");
      if (res.data?.logs) setLogs(res.data.logs);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
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
            fetchAuditLogs();
          }}
          tintColor="#38bdf8"
        />
      }
    >
      <Text style={styles.title}>Super Admin Root Console</Text>
      <Text style={styles.subtitle}>Global Security & Audit Logs</Text>

      <Text style={styles.sectionHeader}>System Audit Trail</Text>
      {logs.length === 0 ? (
        <Text style={styles.emptyText}>No audit logs recorded yet.</Text>
      ) : (
        logs.map((log) => (
          <View key={log.id} style={styles.logCard}>
            <Text style={styles.actionText}>{log.action}</Text>
            <Text style={styles.actorText}>Actor: {log.actorName || log.actorId || "System"}</Text>
            <Text style={styles.timeText}>{new Date(log.createdAt).toLocaleString()}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { padding: 18 },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginBottom: 16 },
  sectionHeader: { color: "#cbd5e1", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  logCard: { backgroundColor: "#1e293b", borderRadius: 14, padding: 12, marginBottom: 8 },
  actionText: { color: "#38bdf8", fontSize: 14, fontWeight: "800" },
  actorText: { color: "#f8fafc", fontSize: 12, marginTop: 2 },
  timeText: { color: "#64748b", fontSize: 11, marginTop: 4 },
  emptyText: { color: "#64748b", fontStyle: "italic" },
});
