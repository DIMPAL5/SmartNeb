import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  SafeAreaView,
  Modal,
} from "react-native";
import { Star, Award, ShieldCheck, Trophy, Volume2, VolumeX, Sparkles, Heart } from "lucide-react-native";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { VoiceGuidanceService } from "../../services/VoiceGuidanceService";
import { SupportedLanguage } from "../../i18n";

type SessionState =
  | "READY"
  | "STARTING"
  | "TREATMENT_ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "DEVICE_DISCONNECTED";

export const BreatheWithBunnyScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [sessionState, setSessionState] = useState<SessionState>("READY");
  const [character, setCharacter] = useState<"bunny" | "bear" | "elephant">("bunny");
  const [stars, setStars] = useState(12);
  const [streak, setStreak] = useState(3);
  const [balloons, setBalloons] = useState(5);
  const [badges, setBadges] = useState<any[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState(600); // 10 minutes prescribed
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [isMuted, setIsMuted] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("en");
  const [showBadgesModal, setShowBadgesModal] = useState(false);

  // Animation values
  const breathAnim = useRef(new Animated.Value(1)).current;
  const balloonScale = useRef(new Animated.Value(1)).current;
  const starBounce = useRef(new Animated.Value(1)).current;

  // Load Gamification Profile
  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get("/gamification/profile");
      if (res.data?.profile) {
        setCharacter(res.data.profile.character || "bunny");
        setStars(res.data.profile.starsCount || 0);
        setStreak(res.data.profile.currentStreak || 0);
        setBalloons(res.data.profile.balloonsInflated || 0);
        setBadges(res.data.badges || []);
      }
    } catch (e) {
      // offline fallback
    }
  };

  // Breathing Animation Loop during TREATMENT_ACTIVE
  useEffect(() => {
    let timer: any;

    if (sessionState === "TREATMENT_ACTIVE") {
      const runBreathingCycle = () => {
        setBreathPhase("inhale");
        VoiceGuidanceService.speak("inhale");

        Animated.timing(breathAnim, {
          toValue: 1.4,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          setBreathPhase("hold");
          VoiceGuidanceService.speak("hold");

          setTimeout(() => {
            setBreathPhase("exhale");
            VoiceGuidanceService.speak("exhale");

            Animated.timing(breathAnim, {
              toValue: 1.0,
              duration: 4000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }).start();
          }, 1500);
        });
      };

      runBreathingCycle();
      const interval = setInterval(runBreathingCycle, 9500);

      timer = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            clearInterval(timer);
            completeTreatment();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(interval);
        clearInterval(timer);
      };
    }
  }, [sessionState]);

  const startTreatment = () => {
    setSessionState("TREATMENT_ACTIVE");
    VoiceGuidanceService.speak("start_session");
  };

  const pauseTreatment = () => {
    setSessionState("PAUSED");
    VoiceGuidanceService.stop();
  };

  const resumeTreatment = () => {
    setSessionState("TREATMENT_ACTIVE");
  };

  const completeTreatment = async () => {
    setSessionState("COMPLETED");
    VoiceGuidanceService.speak("completed");

    // Animate balloon burst & star celebration
    Animated.spring(balloonScale, { toValue: 1.5, friction: 3, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.timing(starBounce, { toValue: 1.3, duration: 250, useNativeDriver: true }),
      Animated.spring(starBounce, { toValue: 1.0, friction: 3, useNativeDriver: true }),
    ]).start();

    try {
      const res = await apiClient.post("/gamification/complete-session", {
        durationSeconds: 600 - secondsRemaining,
        adherenceRatio: 1.0,
      });
      if (res.data) {
        setStars(res.data.totalStars);
        setStreak(res.data.currentStreak);
        setBalloons(res.data.balloonsInflated);
      }
    } catch (e) {
      setStars((s) => s + 5);
      setStreak((st) => st + 1);
    }
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setSelectedLanguage(lang);
    VoiceGuidanceService.setLanguage(lang);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    VoiceGuidanceService.setMuted(next);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const characterEmoji = character === "bunny" ? "🐰" : character === "bear" ? "🐻" : "🐘";

  return (
    <SafeAreaView style={styles.container}>
      {/* Header bar with Stars & Streaks */}
      <View style={styles.topBar}>
        <View style={styles.statChip}>
          <Star color="#F59E0B" fill="#F59E0B" size={18} />
          <Animated.Text style={[styles.statText, { transform: [{ scale: starBounce }] }]}>
            {stars} Stars
          </Animated.Text>
        </View>

        <TouchableOpacity style={styles.statChip} onPress={() => setShowBadgesModal(true)}>
          <Award color="#3B82F6" size={18} />
          <Text style={styles.statText}>{streak}-Day Streak</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.audioButton} onPress={toggleMute}>
          {isMuted ? <VolumeX color="#6B7280" size={20} /> : <Volume2 color="#0284C7" size={20} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Multilingual Voice Coach Bar */}
        <View style={styles.langSelector}>
          <Text style={styles.langLabel}>Voice Coach:</Text>
          {(["en", "hi", "kn", "ta", "te", "mr"] as SupportedLanguage[]).map((l) => (
            <TouchableOpacity
              key={l}
              style={[styles.langChip, selectedLanguage === l && styles.langChipActive]}
              onPress={() => handleLanguageChange(l)}
            >
              <Text style={[styles.langText, selectedLanguage === l && styles.langTextActive]}>
                {l.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pediatric Character Centerpiece */}
        <View style={styles.characterSection}>
          <Animated.View
            style={[
              styles.breathingCircle,
              {
                transform: [{ scale: breathAnim }],
                backgroundColor:
                  breathPhase === "inhale"
                    ? "#E0F2FE"
                    : breathPhase === "hold"
                    ? "#FEF3C7"
                    : "#DCFCE7",
              },
            ]}
          >
            <Text style={styles.characterEmoji}>{characterEmoji}</Text>
          </Animated.View>

          <Text style={styles.breathingPrompt}>
            {sessionState === "TREATMENT_ACTIVE"
              ? breathPhase === "inhale"
                ? "Breathe In Deeply 🌸"
                : breathPhase === "hold"
                ? "Hold Gently ✨"
                : "Breathe Out Slowly 🍃"
              : sessionState === "COMPLETED"
              ? "Session Finished! Star Champion! 🌟"
              : "Ready to Breathe with Bunny"}
          </Text>

          <Text style={styles.timerText}>{formatTime(secondsRemaining)}</Text>
        </View>

        {/* Treatment Session Controls */}
        <View style={styles.controlSection}>
          {sessionState === "READY" && (
            <TouchableOpacity style={styles.primaryButton} onPress={startTreatment}>
              <Sparkles color="#FFFFFF" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Start Breathing Session</Text>
            </TouchableOpacity>
          )}

          {sessionState === "TREATMENT_ACTIVE" && (
            <View style={styles.rowButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={pauseTreatment}>
                <Text style={styles.secondaryButtonText}>Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.completeButton} onPress={completeTreatment}>
                <Text style={styles.completeButtonText}>Finish Session</Text>
              </TouchableOpacity>
            </View>
          )}

          {sessionState === "PAUSED" && (
            <TouchableOpacity style={styles.primaryButton} onPress={resumeTreatment}>
              <Text style={styles.primaryButtonText}>Resume Breathing</Text>
            </TouchableOpacity>
          )}

          {sessionState === "COMPLETED" && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setSessionState("READY");
                setSecondsRemaining(600);
              }}
            >
              <Text style={styles.primaryButtonText}>Start New Session</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Character Switcher (Caregiver Controlled) */}
        <View style={styles.switchSection}>
          <Text style={styles.sectionTitle}>Choose Breathing Friend</Text>
          <View style={styles.characterTabs}>
            <TouchableOpacity
              style={[styles.charTab, character === "bunny" && styles.charTabActive]}
              onPress={() => setCharacter("bunny")}
            >
              <Text style={styles.charTabText}>🐰 Bunny</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.charTab, character === "bear" && styles.charTabActive]}
              onPress={() => setCharacter("bear")}
            >
              <Text style={styles.charTabText}>🐻 Bear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.charTab, character === "elephant" && styles.charTabActive]}
              onPress={() => setCharacter("elephant")}
            >
              <Text style={styles.charTabText}>🐘 Elephant</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Milestone Badges Modal */}
      <Modal visible={showBadgesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🏆 Breathing Badges</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {badges.map((b) => (
                <View key={b.code} style={styles.badgeRow}>
                  <View style={[styles.badgeIconBox, b.unlocked && styles.badgeUnlocked]}>
                    <Trophy size={20} color={b.unlocked ? "#F59E0B" : "#9CA3AF"} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.badgeName}>{b.title}</Text>
                    <Text style={styles.badgeDesc}>{b.description}</Text>
                  </View>
                  {b.unlocked && <ShieldCheck size={18} color="#10B981" />}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowBadgesModal(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F9FF" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0F2FE",
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statText: { marginLeft: 6, fontWeight: "600", fontSize: 13, color: "#1E293B" },
  audioButton: { padding: 6 },
  content: { padding: 20, alignItems: "center" },
  langSelector: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  langLabel: { fontSize: 12, color: "#64748B", marginRight: 8, fontWeight: "500" },
  langChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 3,
  },
  langChipActive: { backgroundColor: "#0284C7" },
  langText: { fontSize: 11, fontWeight: "600", color: "#475569" },
  langTextActive: { color: "#FFFFFF" },
  characterSection: { alignItems: "center", marginVertical: 20 },
  breathingCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  characterEmoji: { fontSize: 72 },
  breathingPrompt: { fontSize: 20, fontWeight: "700", color: "#0F172A", marginTop: 24 },
  timerText: { fontSize: 32, fontWeight: "800", color: "#0284C7", marginTop: 8 },
  controlSection: { width: "100%", marginTop: 20 },
  primaryButton: {
    backgroundColor: "#0284C7",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#0284C7",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  rowButtons: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  secondaryButton: {
    backgroundColor: "#E2E8F0",
    paddingVertical: 14,
    borderRadius: 14,
    flex: 0.48,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#475569", fontSize: 15, fontWeight: "600" },
  completeButton: {
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 14,
    flex: 0.48,
    alignItems: "center",
  },
  completeButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  switchSection: { marginTop: 32, width: "100%" },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#64748B", marginBottom: 10 },
  characterTabs: { flexDirection: "row", justifyContent: "space-between" },
  charTab: {
    flex: 0.31,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  charTabActive: { borderColor: "#0284C7", backgroundColor: "#E0F2FE" },
  charTabText: { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 16 },
  badgeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderColor: "#F1F5F9" },
  badgeIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  badgeUnlocked: { backgroundColor: "#FEF3C7" },
  badgeName: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  badgeDesc: { fontSize: 12, color: "#64748B", marginTop: 2 },
  modalCloseButton: { marginTop: 16, paddingVertical: 12, backgroundColor: "#0284C7", borderRadius: 10, alignItems: "center" },
  modalCloseText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
});
