import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getActiveApiUrl } from "../api/client";
import {
  subscribeFirebaseTelemetry,
  setFirebaseRelay,
  setFirebaseMode,
  FirebaseTelemetryData,
} from "../utils/firebaseTelemetry";

export interface NebulizerControlState {
  source: string;
  state: "OFF" | "RUNNING" | "STARTING" | "PAUSED" | "COMPLETED";
  relay: boolean;
  actualRelay: boolean;
  mode: "AUTO" | "MANUAL";
  manualOverride: boolean;
  deviceId?: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  latestVitalsUpdate: any;
  emergencyAlert: any;
  nebulizerState: NebulizerControlState | null;
  setNebulizerRelay: (on: boolean, mode?: "AUTO" | "MANUAL") => Promise<boolean>;
  setNebulizerMode: (mode: "AUTO" | "MANUAL") => Promise<boolean>;
}

const SocketContext = createContext<SocketContextType>({} as SocketContextType);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestVitalsUpdate, setLatestVitalsUpdate] = useState<any>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<any>(null);
  const [nebulizerState, setNebulizerState] = useState<NebulizerControlState | null>(null);

  // 1. Direct Firebase Realtime Database live stream for ESP32 hardware
  useEffect(() => {
    const unsubscribeFirebase = subscribeFirebaseTelemetry((telemetry: FirebaseTelemetryData) => {
      setLatestVitalsUpdate((prev: any) => ({
        source: "firebase_rtdb",
        telemetry: {
          spo2: telemetry.spo2 !== null ? telemetry.spo2 : prev?.telemetry?.spo2,
          bpm: telemetry.bpm !== null ? telemetry.bpm : prev?.telemetry?.bpm,
          bodyTemperature: telemetry.bodyTemperature,
          temperature: telemetry.temperature,
          ambientTemperature: telemetry.ambientTemperature,
          battery: telemetry.battery,
          nebulizer: telemetry.nebulizer,
          finger: telemetry.finger,
          lastUpdated: telemetry.lastUpdated,
          online: telemetry.online,
        },
      }));

      setNebulizerState((prev) => ({
        source: "firebase_rtdb",
        state: telemetry.nebulizer.relay ? "RUNNING" : "OFF",
        relay: telemetry.nebulizer.relay,
        actualRelay: telemetry.nebulizer.actualRelay,
        mode: telemetry.nebulizer.mode,
        manualOverride: telemetry.nebulizer.manualOverride,
        deviceId: prev?.deviceId,
      }));
    }, "Patient1", 2500);

    return () => unsubscribeFirebase();
  }, []);

  // 2. WebSocket / Socket.IO connection for backend events
  useEffect(() => {
    const socketHost = getActiveApiUrl().replace(/\/api\/v1\/?$/, "");
    const newSocket = io(socketHost, {
      transports: ["websocket"],
      autoConnect: true,
    });

    newSocket.on("connect", () => {
      console.log("⚡ Mobile Socket connected:", newSocket.id);
      setIsConnected(true);
      if (user?.patientId) {
        newSocket.emit("join_patient_room", user.patientId);
      }
    });

    newSocket.on("disconnect", () => {
      console.log("🔌 Mobile Socket disconnected");
      setIsConnected(false);
    });

    newSocket.on("vitals_update", (data) => {
      setLatestVitalsUpdate(data);
    });

    newSocket.on("emergency_broadcast", (data) => {
      setEmergencyAlert(data);
    });

    newSocket.on("nebulizer_state_update", (data) => {
      setNebulizerState((prev) => ({
        ...prev,
        ...data,
        state: data.state || (data.relay ? "RUNNING" : "OFF"),
        relay: data.relay !== undefined ? data.relay : data.state === "RUNNING",
      }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user?.patientId]);

  const handleSetRelay = async (on: boolean, mode: "AUTO" | "MANUAL" = "MANUAL"): Promise<boolean> => {
    const success = await setFirebaseRelay(on, "Patient1", mode);
    if (success) {
      setNebulizerState((prev) => ({
        source: "manual_override",
        state: on ? "RUNNING" : "OFF",
        relay: on,
        actualRelay: on,
        mode: mode,
        manualOverride: mode === "MANUAL",
        deviceId: prev?.deviceId,
      }));
    }
    return success;
  };

  const handleSetMode = async (mode: "AUTO" | "MANUAL"): Promise<boolean> => {
    const success = await setFirebaseMode(mode, "Patient1");
    if (success) {
      setNebulizerState((prev: any) => ({
        ...prev,
        mode,
        manualOverride: mode === "MANUAL",
      }));
    }
    return success;
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        latestVitalsUpdate,
        emergencyAlert,
        nebulizerState,
        setNebulizerRelay: handleSetRelay,
        setNebulizerMode: handleSetMode,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
