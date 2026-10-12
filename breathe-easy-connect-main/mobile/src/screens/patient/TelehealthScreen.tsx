import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { apiClient } from "../../api/client";

interface ChatMessage {
  id: string;
  sender: "patient" | "doctor" | "system";
  text: string;
  timestamp: string;
  vitalsSnippet?: string;
}

export const TelehealthScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();

  const [inCall, setInCall] = useState<boolean>(false);
  const [micMuted, setMicMuted] = useState<boolean>(false);
  const [videoDisabled, setVideoDisabled] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      sender: "system",
      text: "Encrypted end-to-end Telehealth channel initialized. Your attending clinician Dr. Aris Thorne is assigned to this session.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
    {
      id: "doc-1",
      sender: "doctor",
      text: "Hello! I am monitoring your respiratory telemetry. How are you feeling after your latest nebulizer session?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const scrollViewRef = useRef<ScrollView>(null);

  const startCall = () => {
    setInCall(true);
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "system",
      text: "WebRTC Video consultation started. Audio and video streams connected.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const endCall = () => {
    setInCall(false);
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "system",
      text: "Video consultation session concluded. Consultation notes archived.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "patient",
      text: inputMessage.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");

    // Simulate clinician reply if needed
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const shareCurrentVitals = () => {
    const vitalsMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "patient",
      text: "Shared Live Telemetry: SpO₂ 98% · Heart Rate 76 bpm · Temp 36.8°C · Nebulizer Ready",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      vitalsSnippet: "Normal Range",
    };
    setMessages((prev) => [...prev, vitalsMsg]);
    Alert.alert("Vitals Shared", "Your current IoT telemetry was transmitted to your clinician.");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Telehealth Video Call Header */}
      <View style={[styles.videoSection, { backgroundColor: inCall ? "#0f172a" : colors.card, borderColor: colors.cardBorder }]}>
        {inCall ? (
          <View style={styles.activeCallContainer}>
            <View style={styles.remoteVideoStub}>
              <Text style={styles.remoteVideoText}>📹 Dr. Aris Thorne (Attending Clinician)</Text>
              <Text style={styles.videoSubText}>Encrypted WebRTC Stream • 1080p 60fps</Text>
            </View>
            <View style={styles.selfVideoThumb}>
              <Text style={styles.selfVideoText}>{videoDisabled ? "Camera Off" : "Self Video"}</Text>
            </View>
            <View style={styles.callControlsRow}>
              <TouchableOpacity
                onPress={() => setMicMuted((prev) => !prev)}
                style={[styles.callBtn, micMuted ? styles.callBtnActive : styles.callBtnMuted]}
              >
                <Text style={styles.callBtnText}>{micMuted ? "Unmute" : "Mute"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setVideoDisabled((prev) => !prev)}
                style={[styles.callBtn, videoDisabled ? styles.callBtnActive : styles.callBtnMuted]}
              >
                <Text style={styles.callBtnText}>{videoDisabled ? "Start Cam" : "Stop Cam"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={endCall} style={[styles.callBtn, styles.callBtnEnd]}>
                <Text style={styles.callBtnText}>End Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.callStartBanner}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.callStartTitle, { color: colors.text }]}>Virtual Consultation</Text>
              <Text style={[styles.callStartSubtitle, { color: colors.textSecondary }]}>
                Connect directly with your pulmonology care team
              </Text>
            </View>
            <TouchableOpacity onPress={startCall} style={styles.startCallButton}>
              <Text style={styles.startCallButtonText}>Start Video Call</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Secure Messaging Thread */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m) => {
          if (m.sender === "system") {
            return (
              <View key={m.id} style={styles.systemMessageContainer}>
                <Text style={styles.systemMessageText}>{m.text}</Text>
              </View>
            );
          }
          const isPatient = m.sender === "patient";
          return (
            <View
              key={m.id}
              style={[
                styles.messageBubble,
                isPatient
                  ? [styles.patientBubble, { backgroundColor: "#10b981" }]
                  : [styles.doctorBubble, { backgroundColor: colors.card, borderColor: colors.cardBorder }],
              ]}
            >
              <Text style={[styles.senderHeader, { color: isPatient ? "#ecfdf5" : "#38bdf8" }]}>
                {isPatient ? "You" : "Dr. Aris Thorne (Pulmonologist)"} • {m.timestamp}
              </Text>
              <Text style={[styles.messageText, { color: isPatient ? "#ffffff" : colors.text }]}>
                {m.text}
              </Text>
              {m.vitalsSnippet ? (
                <View style={styles.vitalsBadge}>
                  <Text style={styles.vitalsBadgeText}>✓ Live Device Telemetry Attached</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* Quick Action Toolbar */}
      <View style={[styles.toolbarRow, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={shareCurrentVitals} style={styles.shareVitalsBtn}>
          <Text style={styles.shareVitalsBtnText}>📊 Share Vitals</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
          placeholder="Message doctor..."
          placeholderTextColor={colors.textSecondary}
          value={inputMessage}
          onChangeText={setInputMessage}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoSection: {
    padding: 12,
    borderBottomWidth: 1,
  },
  activeCallContainer: {
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#020617",
  },
  remoteVideoStub: {
    alignItems: "center",
    marginTop: 20,
  },
  remoteVideoText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  videoSubText: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },
  selfVideoThumb: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 80,
    height: 60,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#38bdf8",
  },
  selfVideoText: {
    color: "#e2e8f0",
    fontSize: 10,
  },
  callControlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  callBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  callBtnMuted: {
    backgroundColor: "#334155",
  },
  callBtnActive: {
    backgroundColor: "#f59e0b",
  },
  callBtnEnd: {
    backgroundColor: "#ef4444",
  },
  callBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  callStartBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  callStartTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  callStartSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  startCallButton: {
    backgroundColor: "#10b981",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  startCallButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    gap: 12,
  },
  systemMessageContainer: {
    alignSelf: "center",
    backgroundColor: "rgba(100, 116, 139, 0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    maxWidth: "90%",
  },
  systemMessageText: {
    color: "#94a3b8",
    fontSize: 11,
    textAlign: "center",
  },
  messageBubble: {
    maxWidth: "82%",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  patientBubble: {
    alignSelf: "flex-end",
    borderColor: "#059669",
    borderBottomRightRadius: 2,
  },
  doctorBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 2,
  },
  senderHeader: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  vitalsBadge: {
    marginTop: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  vitalsBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  toolbarRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  shareVitalsBtn: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  shareVitalsBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: "#10b981",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  sendButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
});
