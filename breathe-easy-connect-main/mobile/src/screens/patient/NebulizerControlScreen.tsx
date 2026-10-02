import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { apiClient } from "../../api/client";
import { FluidGauge } from "../../components/FluidGauge";

export const NebulizerControlScreen = () => {
  const { user } = useAuth();
  const { nebulizerState } = useSocket();
  const [device, setDevice] = useState<any>(null);
  const [currentState, setCurrentState] = useState<
    "OFF" | "READY" | "STARTING" | "RUNNING" | "PAUSED" | "COMPLETED" | "ERROR"
  >("OFF");
  const [timerSeconds, setTimerSeconds] = useState(600); // 10 minutes default
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loadingCmd, setLoadingCmd] = useState(false);

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

  useEffect(() => {
    if (nebulizerState && nebulizerState.deviceId === device?.id) {
      setCurrentState(nebulizerState.state);
    }
  }, [nebulizerState]);

  // Timer loop when RUNNING
  useEffect(() => {
    let interval: any = null;
    if (currentState === "RUNNING") {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          if (prev >= timerSeconds) {
            setCurrentState("COMPLETED");
            return timerSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentState, timerSeconds]);

  const sendCommand = async (command: "START" | "PAUSE" | "RESUME" | "STOP") => {
    if (!device?.id) {
      Alert.alert("Error", "No assigned nebulizer device found");
      return;
    }
    setLoadingCmd(true);
    try {
      const res = await apiClient.post(`/devices/${device.id}/command`, { command });
      if (res.data?.state) {
        setCurrentState(res.data.state as any);
      }
    } catch (err: any) {
      Alert.alert(
        "Command Failed",
        err.response?.data?.error || "Failed to communicate with device",
      );
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

      {/* Main Circular Timer Display Card */}
      <View style={styles.timerCard}>
        <View style={styles.timerOuter}>
          <Text style={styles.timerDisplay}>{formatTime(timerSeconds - elapsedSeconds)}</Text>
          <Text style={styles.timerStateLabel}>STATE: {currentState}</Text>
          <Text style={styles.timerSubText}>
            Elapsed: {formatTime(elapsedSeconds)} / {formatTime(timerSeconds)}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>

        {/* State Machine Status Banner */}
        <View style={styles.statusBox}>
          <Text style={styles.statusBoxText}>
            {currentState === "STARTING"
              ? "⏳ Sending command to ESP32 relay... Awaiting hardware confirmation"
              : currentState === "RUNNING"
                ? "🟢 Nebulizer atomization active. Inhale deeply."
                : currentState === "PAUSED"
                  ? "🟡 Nebulizer session paused."
                  : currentState === "COMPLETED"
                    ? "🎉 Nebulization session completed successfully!"
                    : "⚪ Nebulizer in standby state."}
          </Text>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsRow}>
        {currentState === "OFF" || currentState === "COMPLETED" ? (
          <TouchableOpacity
            style={[styles.btn, styles.startBtn]}
            onPress={() => sendCommand("START")}
            disabled={loadingCmd}
          >
            <Text style={styles.btnText}>START SESSION</Text>
          </TouchableOpacity>
        ) : null}

        {currentState === "RUNNING" ? (
          <TouchableOpacity
            style={[styles.btn, styles.pauseBtn]}
            onPress={() => sendCommand("PAUSE")}
            disabled={loadingCmd}
          >
            <Text style={styles.btnText}>PAUSE</Text>
          </TouchableOpacity>
        ) : null}

        {currentState === "PAUSED" ? (
          <TouchableOpacity
            style={[styles.btn, styles.startBtn]}
            onPress={() => sendCommand("RESUME")}
            disabled={loadingCmd}
          >
            <Text style={styles.btnText}>RESUME</Text>
          </TouchableOpacity>
        ) : null}

        {currentState !== "OFF" && currentState !== "COMPLETED" ? (
          <TouchableOpacity
            style={[styles.btn, styles.stopBtn]}
            onPress={() => sendCommand("STOP")}
            disabled={loadingCmd}
          >
            <Text style={styles.btnText}>STOP</Text>
          </TouchableOpacity>
        ) : null}
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
  },
  screenTitle: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
  },
  deviceSubtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 20,
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
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    minWidth: 120,
    alignItems: "center",
  },
  startBtn: {
    backgroundColor: "#10b981",
  },
  pauseBtn: {
    backgroundColor: "#f59e0b",
  },
  stopBtn: {
    backgroundColor: "#ef4444",
  },
  btnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
});
