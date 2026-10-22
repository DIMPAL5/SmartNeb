import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getActiveApiUrl } from "../api/client";
import {
  subscribeFirebaseTelemetry,
  setFirebaseRelay,
  FirebaseTelemetryData,
} from "../utils/firebaseTelemetry";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  latestVitalsUpdate: any;
  emergencyAlert: any;
  nebulizerState: any;
  setNebulizerRelay: (on: boolean) => Promise<boolean>;
}

const SocketContext = createContext<SocketContextType>({} as SocketContextType);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestVitalsUpdate, setLatestVitalsUpdate] = useState<any>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<any>(null);
  const [nebulizerState, setNebulizerState] = useState<any>(null);

  // 1. Direct Firebase Realtime Database live stream for ESP32 hardware
  useEffect(() => {
    const unsubscribeFirebase = subscribeFirebaseTelemetry((telemetry: FirebaseTelemetryData) => {
      setLatestVitalsUpdate((prev: any) => ({
        source: "firebase_rtdb",
        telemetry: {
          spo2: telemetry.spo2 !== null ? telemetry.spo2 : prev?.telemetry?.spo2,
          bpm: telemetry.bpm !== null ? telemetry.bpm : prev?.telemetry?.bpm,
          temperature:
            telemetry.bodyTemperature || telemetry.ambientTemperature || prev?.telemetry?.temperature,
          ambientTemperature: telemetry.ambientTemperature,
          battery: telemetry.battery,
          nebulizer: telemetry.nebulizer,
          finger: telemetry.finger,
          lastUpdated: telemetry.lastUpdated,
        },
      }));

      setNebulizerState({
        source: "firebase_rtdb",
        state: telemetry.nebulizer.relay ? "RUNNING" : "OFF",
        relay: telemetry.nebulizer.relay,
      });
    }, "Patient1", 3000);

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
      setNebulizerState(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user?.patientId]);

  const handleSetRelay = async (on: boolean): Promise<boolean> => {
    return await setFirebaseRelay(on, "Patient1");
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
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
