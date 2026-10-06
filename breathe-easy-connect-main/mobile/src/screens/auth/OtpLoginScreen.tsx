import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Phone, Lock, MessageSquare, ArrowLeft, CheckCircle } from "lucide-react-native";
import { apiClient } from "../../api/client";
import { storage } from "../../utils/storage";
import { useAuth } from "../../context/AuthContext";

export const OtpLoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async () => {
    if (!phone || phone.trim().length < 10) {
      Alert.alert("Invalid Phone", "Please enter a valid phone number with country code (e.g. +919876543210).");
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post("/auth/otp/send", {
        phone: phone.trim(),
        channel,
      });

      if (res.data?.success) {
        setStep("otp");
        setCooldown(res.data.cooldownSeconds || 60);
        Alert.alert("OTP Sent", `Verification code dispatched via ${channel.toUpperCase()}.`);
      }
    } catch (e: any) {
      Alert.alert("Request Failed", e.response?.data?.error || "Could not send OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      Alert.alert("Code Required", "Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post("/auth/otp/verify", {
        phone: phone.trim(),
        code: otpCode.trim(),
      });

      if (res.data?.accessToken) {
        // Store tokens
        await storage.setItem("accessToken", res.data.accessToken);
        if (res.data.refreshToken) {
          await storage.setItem("refreshToken", res.data.refreshToken);
        }
        Alert.alert("Verified ✓", "Successfully authenticated with SmartNeb.");
        // Re-authenticate state
        navigation.navigate("Login");
      } else {
        Alert.alert("Verified ✓", res.data.message || "Phone number verified.");
      }
    } catch (e: any) {
      Alert.alert("Verification Failed", e.response?.data?.error || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Phone OTP Sign In</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Secure Pediatric Access</Text>
          <Text style={styles.subtitle}>
            Authenticate your caregiver or patient profile via instantaneous SMS or WhatsApp OTP.
          </Text>

          {step === "phone" ? (
            <>
              {/* Channel Selector */}
              <View style={styles.channelRow}>
                <TouchableOpacity
                  style={[styles.channelTab, channel === "sms" && styles.channelTabActive]}
                  onPress={() => setChannel("sms")}
                >
                  <MessageSquare size={16} color={channel === "sms" ? "#0284C7" : "#64748B"} />
                  <Text style={[styles.channelText, channel === "sms" && styles.channelTextActive]}>
                    SMS OTP
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.channelTab, channel === "whatsapp" && styles.channelTabActive]}
                  onPress={() => setChannel("whatsapp")}
                >
                  <Phone size={16} color={channel === "whatsapp" ? "#10B981" : "#64748B"} />
                  <Text style={[styles.channelText, channel === "whatsapp" && styles.channelTextActive]}>
                    WhatsApp OTP
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Phone Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="+91 98765 43210"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleSendOtp} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Verification Code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.otpNotice}>
                <Text style={styles.otpNoticeText}>
                  Code sent to {phone}. Please enter the 6-digit code below:
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>6-Digit OTP Code</Text>
                <TextInput
                  style={[styles.textInput, styles.otpInput]}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOtp} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
                )}
              </TouchableOpacity>

              <View style={styles.resendRow}>
                {cooldown > 0 ? (
                  <Text style={styles.cooldownText}>Resend code in {cooldown}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleSendOtp}>
                    <Text style={styles.resendLink}>Resend OTP Code</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.changePhoneBtn} onPress={() => setStep("phone")}>
                <Text style={styles.changePhoneText}>Change phone number</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.emailLoginBtn} onPress={() => navigation.navigate("Login")}>
            <Text style={styles.emailLoginText}>Or sign in with Email & Password</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  content: { padding: 24, flex: 1, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", color: "#0F172A" },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 6, marginBottom: 24, lineHeight: 18 },
  channelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  channelTab: {
    flex: 0.48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  channelTabActive: { borderColor: "#0284C7", backgroundColor: "#E0F2FE" },
  channelText: { marginLeft: 8, fontSize: 13, fontWeight: "600", color: "#64748B" },
  channelTextActive: { color: "#0284C7" },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 8 },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#0F172A",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  otpInput: { letterSpacing: 8, textAlign: "center", fontSize: 24, fontWeight: "800" },
  primaryButton: {
    backgroundColor: "#0284C7",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  otpNotice: { backgroundColor: "#EFF6FF", padding: 12, borderRadius: 10, marginBottom: 16 },
  otpNoticeText: { fontSize: 12, color: "#1E40AF" },
  resendRow: { alignItems: "center", marginTop: 16 },
  cooldownText: { fontSize: 13, color: "#94A3B8" },
  resendLink: { fontSize: 13, color: "#0284C7", fontWeight: "700" },
  changePhoneBtn: { alignItems: "center", marginTop: 12 },
  changePhoneText: { fontSize: 12, color: "#64748B" },
  emailLoginBtn: { alignItems: "center", marginTop: 30 },
  emailLoginText: { fontSize: 13, color: "#0284C7", fontWeight: "600" },
});
