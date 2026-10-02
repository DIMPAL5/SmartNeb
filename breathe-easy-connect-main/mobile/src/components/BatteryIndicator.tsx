import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface BatteryProps {
  percentage: number;
  charging?: boolean;
  voltage?: number;
  temperature?: number;
}

export const BatteryIndicator: React.FC<BatteryProps> = ({
  percentage = 88,
  charging = false,
  voltage = 4.1,
  temperature = 28.5,
}) => {
  const isCritical = percentage <= 15;
  const isWarning = percentage <= 30 && percentage > 15;

  const getColor = () => {
    if (isCritical) return "#ef4444";
    if (isWarning) return "#f59e0b";
    return "#10b981";
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Battery & Power</Text>
        <Text style={[styles.percent, { color: getColor() }]}>
          {charging ? "⚡ " : ""}
          {Math.round(percentage)}%
        </Text>
      </View>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: getColor() }]} />
      </View>
      <View style={styles.detailsRow}>
        <Text style={styles.detail}>Voltage: {voltage.toFixed(1)}V</Text>
        <Text style={styles.detail}>Temp: {temperature.toFixed(1)}°C</Text>
        <Text style={styles.detail}>State: {charging ? "Charging" : "Discharging"}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  percent: {
    fontSize: 18,
    fontWeight: "800",
  },
  barBackground: {
    height: 10,
    backgroundColor: "#334155",
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  detail: {
    color: "#94a3b8",
    fontSize: 12,
  },
});
