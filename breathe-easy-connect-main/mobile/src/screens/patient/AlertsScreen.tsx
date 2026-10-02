import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert as RNAlert,
} from "react-native";
import { apiClient } from "../../api/client";

export const AlertsScreen = () => {
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = async () => {
    try {
      const res = await apiClient.get("/alerts");
      if (res.data?.alerts) {
        setAlertsList(res.data.alerts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const acknowledgeAlert = async (id: string) => {
    try {
      await apiClient.put(`/alerts/${id}/acknowledge`);
      fetchAlerts();
      RNAlert.alert("Acknowledged", "Alert marked as acknowledged.");
    } catch (e) {
      RNAlert.alert("Error", "Failed to acknowledge alert.");
    }
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
            fetchAlerts();
          }}
          tintColor="#38bdf8"
        />
      }
    >
      <Text style={styles.title}>System & Clinical Alerts</Text>

      {alertsList.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>🟢 No active alerts. All vital signs normal.</Text>
        </View>
      ) : (
        alertsList.map((item) => {
          const isCritical = item.severity === "critical";
          return (
            <View
              key={item.id}
              style={[styles.alertCard, { borderColor: isCritical ? "#ef4444" : "#f59e0b" }]}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.alertType}>{item.type}</Text>
                <View
                  style={[styles.badge, { backgroundColor: isCritical ? "#ef4444" : "#f59e0b" }]}
                >
                  <Text style={styles.badgeText}>{item.severity.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleString()}</Text>

              {item.status === "active" ? (
                <TouchableOpacity style={styles.ackBtn} onPress={() => acknowledgeAlert(item.id)}>
                  <Text style={styles.ackBtnText}>Acknowledge Alert</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.ackLabel}>✓ Acknowledged</Text>
              )}
            </View>
          );
        })
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
    marginBottom: 16,
  },
  emptyBox: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#10b981",
    fontSize: 15,
    fontWeight: "700",
  },
  alertCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  alertType: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "800",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  message: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
  },
  timeText: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 6,
  },
  ackBtn: {
    backgroundColor: "#334155",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  ackBtnText: {
    color: "#38bdf8",
    fontWeight: "700",
    fontSize: 13,
  },
  ackLabel: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
});
