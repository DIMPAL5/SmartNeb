import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Activity, User, ArrowLeft } from "lucide-react-native";
import { useSocket } from "../../context/SocketContext";

export const TelehealthScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { latestVitalsUpdate, nebulizerState } = useSocket();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Fallback / Live vitals overlay
  const spo2 = latestVitalsUpdate?.spo2 || 96;
  const bpm = latestVitalsUpdate?.bpm || 88;
  const temp = latestVitalsUpdate?.bodyTemperature || 36.6;

  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleEndCall = () => {
    Alert.alert("End Call", "Are you sure you want to conclude the consultation?", [
      { text: "Cancel", style: "cancel" },
      { text: "End Call", style: "destructive", onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar with Doctor Info & Call Timer */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.doctorName}>Dr. Ananya Rao (Pediatric Pulmonology)</Text>
          <Text style={styles.timerText}>{formatDuration(callDuration)} • WebRTC Encrypted</Text>
        </View>
      </View>

      {/* Main Video View Area */}
      <View style={styles.videoArea}>
        <View style={styles.doctorPlaceholder}>
          <User size={64} color="#64748B" />
          <Text style={styles.placeholderText}>Consultation Room Active</Text>
          <Text style={styles.placeholderSub}>Live video stream established</Text>
        </View>

        {/* Self View (Picture-in-Picture) */}
        <View style={styles.pipView}>
          <Text style={styles.pipText}>Child / Mask View</Text>
        </View>

        {/* Real-Time Live Vitals Overlay */}
        <View style={styles.vitalsOverlay}>
          <View style={styles.overlayHeader}>
            <Activity size={16} color="#0284C7" />
            <Text style={styles.overlayTitle}>Live Patient Telemetry</Text>
          </View>
          <View style={styles.telemetryRow}>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>SpO2</Text>
              <Text style={[styles.telemVal, { color: spo2 < 90 ? "#EF4444" : "#10B981" }]}>
                {spo2}%
              </Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>BPM</Text>
              <Text style={styles.telemVal}>{bpm}</Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Nebulizer</Text>
              <Text style={[styles.telemVal, { color: nebulizerState ? "#0284C7" : "#64748B" }]}>
                {nebulizerState || "OFF"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Call Controls Bar */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={() => setIsMuted(!isMuted)}
        >
          {isMuted ? <MicOff size={22} color="#FFFFFF" /> : <Mic size={22} color="#FFFFFF" />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isVideoOff && styles.controlBtnActive]}
          onPress={() => setIsVideoOff(!isVideoOff)}
        >
          {isVideoOff ? <VideoOff size={22} color="#FFFFFF" /> : <Video size={22} color="#FFFFFF" />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
          <PhoneOff size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
  },
  backBtn: { padding: 6, marginRight: 10 },
  doctorName: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  timerText: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  videoArea: { flex: 1, position: "relative", justifyContent: "center", alignItems: "center" },
  doctorPlaceholder: { alignItems: "center" },
  placeholderText: { color: "#E2E8F0", fontSize: 16, fontWeight: "700", marginTop: 12 },
  placeholderSub: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  pipView: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 100,
    height: 140,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    borderWidth: 2,
    borderColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  pipText: { color: "#94A3B8", fontSize: 10, textAlign: "center" },
  vitalsOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  overlayHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  overlayTitle: { color: "#E2E8F0", fontSize: 12, fontWeight: "700", marginLeft: 6 },
  telemetryRow: { flexDirection: "row", justifyContent: "space-between" },
  telemItem: { alignItems: "center", width: "30%" },
  telemLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "600" },
  telemVal: { fontSize: 18, fontWeight: "800", color: "#FFFFFF", marginTop: 2 },
  controlsBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#1E293B",
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 12,
  },
  controlBtnActive: { backgroundColor: "#EF4444" },
  endCallBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 12,
  },
});
