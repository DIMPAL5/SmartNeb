import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { apiClient } from "../../api/client";
import { FluidGauge } from "../../components/FluidGauge";
import { AppHaptics } from "../../utils/haptics";

export const NebulizerControlScreen = () => {
  const { user } = useAuth();
  const { nebulizerState, setNebulizerRelay, setNebulizerMode } = useSocket();
  const [device, setDevice] = useState<any>(null);
  const [currentState, setCurrentState] = useState<
    "OFF" | "READY" | "STARTING" | "RUNNING" | "PAUSED" | "COMPLETED" | "ERROR"
  >("OFF");
  const [controlMode, setControlMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [timerSeconds, setTimerSeconds] = useState(600); // 10 minutes default
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loadingCmd, setLoadingCmd] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const fetchDevice = async () => {
    try {
      const res = await apiClient.get("/devices");
      if (res.data?.devices?.length > 0) {
        const myDev =
          res.data.devices.find((d: any) => d.patientId === user?.patientId) || res.data.devices[0];
        setDevice(myDev);
        if (myDev.nebulizerState) {
          setCurrentState(myDev.nebulizerState as any);
        }
      }
    } catch (e) {
      console.error("Fetch Devices Error:", e);
    }
  };

  useEffect(() => {
    fetchDevice();
  }, []);

  // Sync state continuously from Firebase Realtime Database
  useEffect(() => {
    if (nebulizerState) {
      if (nebulizerState.mode) {
        setControlMode(nebulizerState.mode);
      }
      if (nebulizerState.state) {
        setCurrentState(nebulizerState.state as any);
      }
    }
  }, [nebulizerState]);

  // Timer loop when RUNNING in AUTO mode
  useEffect(() => {
    let interval: any = null;
    if (currentState === "RUNNING") {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          if (controlMode === "AUTO" && prev >= timerSeconds) {
            handleForceStop();
            setCurrentState("COMPLETED");
            return timerSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentState, timerSeconds, controlMode]);

  // Physical Relay state confirmed by ESP32 / Firebase
  const isRelayOn =
    nebulizerState?.actualRelay ??
    nebulizerState?.relay ??
    (currentState === "RUNNING");

  /**
   * FORCE START — Manual Override:
   * Has highest priority. Writes Relay = true and Mode = "MANUAL"
   * to Firebase and triggers backend API.
   */
  const handleForceStart = async () => {
    await AppHaptics.triggerHeavyImpact();
    setLoadingCmd(true);
    setStatusMessage("⚡ Sending FORCE START command to ESP32 relay...");

    try {
      // 1. Direct Firebase write with MANUAL override
      await setNebulizerRelay(true, "MANUAL");

      // 2. Also notify backend API (non-blocking)
      if (device?.id) {
        apiClient.post(`/devices/${device.id}/command`, { command: "START", mode: "MANUAL" }).catch(() => null);
      }
      apiClient.post("/nebulizer/force-start", { node: "Patient1" }).catch(() => null);

      setCurrentState("RUNNING");
      setControlMode("MANUAL");
      setStatusMessage("🟢 Force Start active — Nebulizer mesh running in Manual Override.");
      await AppHaptics.triggerSuccess();
    } catch (err: any) {
      await AppHaptics.triggerError();
      Alert.alert("Force Start Error", err.message || "Failed to deliver manual start command.");
      setStatusMessage("❌ Failed to actuate relay.");
    } finally {
      setLoadingCmd(false);
    }
  };

  /**
   * FORCE STOP — Immediate Emergency / Manual Cutoff:
   * Always turns Relay OFF immediately regardless of timers or auto schedules.
   */
  const handleForceStop = async () => {
    await AppHaptics.triggerHeavyImpact();
    setLoadingCmd(true);
    setStatusMessage("🛑 Sending FORCE STOP command to ESP32 relay...");

    try {
      // 1. Direct Firebase write with immediate relay shut-off
      await setNebulizerRelay(false, "MANUAL");

      // 2. Also notify backend API (non-blocking)
      if (device?.id) {
        apiClient.post(`/devices/${device.id}/command`, { command: "STOP", mode: "MANUAL" }).catch(() => null);
      }
      apiClient.post("/nebulizer/force-stop", { node: "Patient1" }).catch(() => null);

      setCurrentState("OFF");
      setStatusMessage("⚪ Force Stop confirmed — Nebulizer mesh turned OFF.");
      await AppHaptics.triggerSuccess();
    } catch (err: any) {
      await AppHaptics.triggerError();
      Alert.alert("Force Stop Error", err.message || "Failed to deliver stop command.");
      setStatusMessage("❌ Failed to turn off relay.");
    } finally {
      setLoadingCmd(false);
    }
  };

  /**
   * Toggle between AUTO and MANUAL control modes
   */
  const handleToggleMode = async (mode: "AUTO" | "MANUAL") => {
    await AppHaptics.triggerSelection();
    setControlMode(mode);
    setLoadingCmd(true);
    try {
      await setNebulizerMode(mode);
      apiClient.post("/nebulizer/mode", { mode, node: "Patient1" }).catch(() => null);
      setStatusMessage(
        mode === "MANUAL"
          ? "⚡ Switched to Manual Override. Auto-schedules disabled."
          : "🤖 Switched to Auto Mode. Nebulizer follows therapy schedules."
      );
    } catch (err) {
      console.warn("Failed to switch mode:", err);
    } finally {
      setLoadingCmd(false);
    }
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPct = Math.min((elapsedSeconds / timerSeconds) * 100, 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.screenTitle}>Smart Nebulizer Control</Text>
      <Text style={styles.deviceSubtitle}>
        Device ID: {device?.deviceCode || "NEB-001"} | Status: {device?.status || "online"}
      </Text>

      {/* Hardware Relay Real-time Confirmation Badge */}
      <View style={[styles.relayStatusCard, isRelayOn ? styles.relayCardActive : styles.relayCardInactive]}>
        <View style={[styles.statusDot, { backgroundColor: isRelayOn ? "#10b981" : "#64748b" }]} />
        <View style={styles.relayStatusTextCol}>
          <Text style={styles.relayStatusTitle}>
            PHYSICAL RELAY: {isRelayOn ? "ACTIVE (MESH RUNNING)" : "INACTIVE (OFF)"}
          </Text>
          <Text style={styles.relayStatusSub}>
            Live hardware feedback via Firebase Realtime Database (Patient1)
          </Text>
        </View>
      </View>

      {/* Mode Selector (Auto vs Manual Override) */}
      <View style={styles.modeSelectorCard}>
        <Text style={styles.modeLabel}>CONTROL MODE</Text>
        <View style={styles.modeToggleRow}>
          <TouchableOpacity
            style={[styles.modeBtn, controlMode === "AUTO" && styles.modeBtnActiveAuto]}
            onPress={() => handleToggleMode("AUTO")}
            disabled={loadingCmd}
          >
            <Text style={[styles.modeBtnText, controlMode === "AUTO" && styles.modeBtnTextActive]}>
              🤖 AUTO (SCHEDULED)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeBtn, controlMode === "MANUAL" && styles.modeBtnActiveManual]}
            onPress={() => handleToggleMode("MANUAL")}
            disabled={loadingCmd}
          >
            <Text style={[styles.modeBtnText, controlMode === "MANUAL" && styles.modeBtnTextActive]}>
              ⚡ MANUAL OVERRIDE
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Timer / Telemetry Display Card */}
      <View style={styles.timerCard}>
        <View style={[styles.timerOuter, isRelayOn && { borderColor: "#10b981" }]}>
          <Text style={styles.timerDisplay}>{formatTime(timerSeconds - elapsedSeconds)}</Text>
          <Text style={[styles.timerStateLabel, isRelayOn && { color: "#10b981" }]}>
            {isRelayOn ? "RELAY ON" : "STANDBY"} • {controlMode}
          </Text>
          <Text style={styles.timerSubText}>
            Elapsed: {formatTime(elapsedSeconds)} / {formatTime(timerSeconds)}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPct}%`, backgroundColor: isRelayOn ? "#10b981" : "#38bdf8" },
            ]}
          />
        </View>

        {/* Status Message Box */}
        <View style={styles.statusBox}>
          <Text style={styles.statusBoxText}>
            {statusMessage ||
              (isRelayOn
                ? "🟢 Nebulizer atomization active. Inhale deeply."
                : "⚪ Nebulizer in standby state. Ready for operation.")}
          </Text>
        </View>
      </View>

      {/* Manual Override Action Buttons */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.btn, styles.forceStartBtn, loadingCmd && styles.btnDisabled]}
          onPress={handleForceStart}
          disabled={loadingCmd}
          activeOpacity={0.8}
        >
          {loadingCmd ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.btnText}>⚡ FORCE START</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.forceStopBtn, loadingCmd && styles.btnDisabled]}
          onPress={handleForceStop}
          disabled={loadingCmd}
          activeOpacity={0.8}
        >
          {loadingCmd ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.btnText}>🛑 FORCE STOP</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Fluid Chamber Gauge */}
      <FluidGauge level={device?.fluidLevel || 85} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  screenTitle: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
  },
  deviceSubtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 16,
  },
  relayStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 16,
    gap: 12,
  },
  relayCardActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "#10b981",
  },
  relayCardInactive: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  relayStatusTextCol: {
    flex: 1,
  },
  relayStatusTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  relayStatusSub: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  modeSelectorCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  modeLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  modeToggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
  },
  modeBtnActiveAuto: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    borderColor: "#38bdf8",
  },
  modeBtnActiveManual: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderColor: "#f59e0b",
  },
  modeBtnText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
  },
  modeBtnTextActive: {
    color: "#ffffff",
  },
  timerCard: {
    backgroundColor: "#1e293b",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  timerOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 6,
    borderColor: "#38bdf8",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
    marginVertical: 10,
  },
  timerDisplay: {
    color: "#f8fafc",
    fontSize: 38,
    fontWeight: "900",
  },
  timerStateLabel: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  timerSubText: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 4,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    backgroundColor: "#334155",
    borderRadius: 4,
    marginVertical: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#38bdf8",
  },
  statusBox: {
    backgroundColor: "#0f172a",
    padding: 12,
    borderRadius: 12,
    width: "100%",
  },
  statusBoxText: {
    color: "#cbd5e1",
    fontSize: 13,
    textAlign: "center",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 20,
  },
  btn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  forceStartBtn: {
    backgroundColor: "#10b981",
  },
  forceStopBtn: {
    backgroundColor: "#ef4444",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
