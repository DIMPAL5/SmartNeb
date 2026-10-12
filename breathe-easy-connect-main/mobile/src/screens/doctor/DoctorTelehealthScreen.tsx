import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

interface ChatMessage {
  id: string;
  sender: "doctor" | "patient" | "system";
  text: string;
  timestamp: string;
}

export const DoctorTelehealthScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();

  const [selectedPatient, setSelectedPatient] = useState<{ name: string; mrn: string; spo2: number; hr: number }>({
    name: "Dimpal D.",
    mrn: "MRN-1001",
    spo2: 98,
    hr: 76,
  });

  const [inCall, setInCall] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      sender: "system",
      text: "Telehealth clinical channel secured. Patient Dimpal D. connected.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
    {
      id: "pat-1",
      sender: "patient",
      text: "Good morning Doctor. I completed my 10-minute prescribed morning session.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: "doctor",
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, msg]);
    setInputText("");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Patient Vitals Header */}
      <View style={[styles.patientHeader, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
        <View>
          <Text style={[styles.patientName, { color: colors.text }]}>{selectedPatient.name}</Text>
          <Text style={[styles.patientMrn, { color: colors.textSecondary }]}>{selectedPatient.mrn} • Asthma</Text>
        </View>
        <View style={styles.vitalsPillRow}>
          <View style={styles.vitalPill}>
            <Text style={styles.vitalPillLabel}>SpO₂</Text>
            <Text style={styles.vitalPillValue}>{selectedPatient.spo2}%</Text>
          </View>
          <View style={styles.vitalPill}>
            <Text style={styles.vitalPillLabel}>HR</Text>
            <Text style={styles.vitalPillValue}>{selectedPatient.hr} bpm</Text>
          </View>
        </View>
      </View>

      {/* Video Call Box */}
      <View style={[styles.videoContainer, { backgroundColor: inCall ? "#090d16" : colors.card, borderColor: colors.cardBorder }]}>
        {inCall ? (
          <View style={styles.activeCallFrame}>
            <Text style={styles.videoActiveText}>📹 WebRTC Consultation Active (1080p Encrypted)</Text>
            <TouchableOpacity onPress={() => setInCall(false)} style={styles.endCallBtn}>
              <Text style={styles.endCallBtnText}>End Consultation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.idleCallFrame}>
            <Text style={[styles.idleCallTitle, { color: colors.text }]}>Live Telehealth Ready</Text>
            <TouchableOpacity onPress={() => setInCall(true)} style={styles.startCallBtn}>
              <Text style={styles.startCallBtnText}>Launch Video Call</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Messages */}
      <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
        {messages.map((m) => {
          if (m.sender === "system") {
            return (
              <View key={m.id} style={styles.sysMsg}>
                <Text style={styles.sysMsgText}>{m.text}</Text>
              </View>
            );
          }
          const isDoc = m.sender === "doctor";
          return (
            <View
              key={m.id}
              style={[
                styles.bubble,
                isDoc
                  ? [styles.docBubble, { backgroundColor: "#0284c7" }]
                  : [styles.patBubble, { backgroundColor: colors.card, borderColor: colors.cardBorder }],
              ]}
            >
              <Text style={[styles.bubbleAuthor, { color: isDoc ? "#e0f2fe" : "#10b981" }]}>
                {isDoc ? "You (Dr. Aris Thorne)" : "Patient"} • {m.timestamp}
              </Text>
              <Text style={[styles.bubbleContent, { color: isDoc ? "#ffffff" : colors.text }]}>
                {m.text}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
          placeholder="Send clinical note / message..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  patientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
  },
  patientName: { fontSize: 16, fontWeight: "700" },
  patientMrn: { fontSize: 12, marginTop: 2 },
  vitalsPillRow: { flexDirection: "row", gap: 8 },
  vitalPill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  vitalPillLabel: { fontSize: 10, color: "#10b981", fontWeight: "700" },
  vitalPillValue: { fontSize: 12, color: "#10b981", fontWeight: "800" },
  videoContainer: {
    margin: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  activeCallFrame: {
    padding: 16,
    alignItems: "center",
    gap: 12,
  },
  videoActiveText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  endCallBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  endCallBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },
  idleCallFrame: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  idleCallTitle: { fontSize: 14, fontWeight: "600" },
  startCallBtn: {
    backgroundColor: "#0284c7",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  startCallBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },
  chatScroll: { flex: 1 },
  chatContent: { padding: 14, gap: 10 },
  sysMsg: {
    alignSelf: "center",
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  sysMsgText: { color: "#94a3b8", fontSize: 11 },
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  docBubble: { alignSelf: "flex-end", borderColor: "#0369a1" },
  patBubble: { alignSelf: "flex-start" },
  bubbleAuthor: { fontSize: 10, fontWeight: "700", marginBottom: 3 },
  bubbleContent: { fontSize: 14, lineHeight: 19 },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  sendBtn: {
    backgroundColor: "#0284c7",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  sendBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
});
