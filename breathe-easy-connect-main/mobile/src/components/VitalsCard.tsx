import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

export type VitalType = "spo2" | "bpm" | "temp" | "custom";
export type VitalHealthStatus = "normal" | "warning" | "critical";

interface VitalsCardProps {
  label: string;
  value: string | number | null | undefined;
  unit: string;
  type?: VitalType;
  status?: VitalHealthStatus;
  subtext?: string;
  trend?: string;
}

/**
 * Determine medical zone based on clinical thresholds
 */
export function calculateVitalStatus(type: VitalType, val: number | null | undefined): VitalHealthStatus {
  if (val == null || isNaN(val)) return "normal";

  if (type === "spo2") {
    if (val >= 95) return "normal";
    if (val >= 90) return "warning";
    return "critical";
  }

  if (type === "bpm") {
    if (val >= 60 && val <= 100) return "normal";
    if ((val >= 50 && val < 60) || (val > 100 && val <= 120)) return "warning";
    return "critical";
  }

  if (type === "temp") {
    if (val >= 36.1 && val <= 37.5) return "normal";
    if (val > 37.5 && val <= 38.3) return "warning";
    return "critical";
  }

  return "normal";
}

export const VitalsCard: React.FC<VitalsCardProps> = ({
  label,
  value,
  unit,
  type = "custom",
  status: explicitStatus,
  subtext,
  trend,
}) => {
  const numericVal = typeof value === "number" ? value : Number(value);
  const status: VitalHealthStatus =
    explicitStatus || calculateVitalStatus(type, isNaN(numericVal) ? null : numericVal);

  // Pulsing animation for Critical / Red alert state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (status === "critical") {
      const animation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.25,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1.0,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0.2,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.8,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
      opacityAnim.setValue(0.8);
    }
  }, [status]);

  const getColorConfig = () => {
    switch (status) {
      case "critical":
        return {
          primary: "#ef4444",
          badgeBg: "rgba(239, 68, 68, 0.2)",
          cardBorder: "#ef4444",
          label: "CRITICAL",
          hint: type === "spo2" ? "Below safe limit (<90%)" : type === "bpm" ? "Arrhythmia hazard" : "Fever breach",
        };
      case "warning":
        return {
          primary: "#f59e0b",
          badgeBg: "rgba(245, 158, 11, 0.2)",
          cardBorder: "#f59e0b",
          label: "CAUTION",
          hint: type === "spo2" ? "Borderline zone (90-94%)" : type === "bpm" ? "Elevated / Low" : "Mild elevation",
        };
      case "normal":
      default:
        return {
          primary: "#10b981",
          badgeBg: "rgba(16, 185, 129, 0.15)",
          cardBorder: "#334155",
          label: "NORMAL",
          hint: type === "spo2" ? "Optimal ≥95%" : type === "bpm" ? "Target 60-100" : "Normal 36.5-37.5°C",
        };
    }
  };

  const colors = getColorConfig();

  return (
    <View style={[styles.card, { borderColor: colors.cardBorder }]}>
      <View style={styles.header}>
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
          {trend ? <Text style={styles.trendText}>{trend}</Text> : null}
        </View>

        <View style={styles.badgeWrapper}>
          {status === "critical" && (
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  borderColor: colors.primary,
                  transform: [{ scale: pulseAnim }],
                  opacity: opacityAnim,
                },
              ]}
            />
          )}
          <View style={[styles.badge, { backgroundColor: colors.badgeBg }]}>
            <View style={[styles.badgeDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>{colors.label}</Text>
          </View>
        </View>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, status === "critical" && { color: "#f87171" }]}>
          {value != null && value !== "" ? value : "--"}
        </Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.hintText}>{colors.hint}</Text>
        {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
      </View>

      {/* Visual Threshold Bar */}
      <View style={styles.thresholdTrack}>
        <View
          style={[
            styles.thresholdFill,
            {
              backgroundColor: colors.primary,
              width:
                status === "critical"
                  ? "100%"
                  : status === "warning"
                  ? "70%"
                  : "40%",
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  trendText: {
    color: "#64748b",
    fontSize: 12,
  },
  badgeWrapper: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: "115%",
    height: "140%",
    borderRadius: 14,
    borderWidth: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 2,
  },
  value: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  unit: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  hintText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "500",
  },
  subtext: {
    color: "#64748b",
    fontSize: 11,
  },
  thresholdTrack: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 2,
    marginTop: 10,
    overflow: "hidden",
  },
  thresholdFill: {
    height: "100%",
    borderRadius: 2,
  },
});
