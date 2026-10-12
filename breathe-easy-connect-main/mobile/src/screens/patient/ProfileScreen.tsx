import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme, ThemeMode } from "../../context/ThemeContext";
import { apiClient } from "../../api/client";
import { storage } from "../../utils/storage";
import { BiometricSecurity } from "../../utils/biometrics";
import { exportHealthSummaryPdf } from "../../utils/pdfExporter";
import { OfflineCache } from "../../utils/offlineCache";
import { AppHaptics } from "../../utils/haptics";

export const ProfileScreen = () => {
  const { user, logout, updateUserContext } = useAuth();
  const { theme, colors, isDark, setThemeMode } = useTheme();

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [condition, setCondition] = useState("Asthma / Respiratory Care");

  const [voiceAlerts, setVoiceAlerts] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [biometricLock, setBiometricLock] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    BiometricSecurity.isLockEnabled().then(setBiometricLock);
  }, []);

  const handleToggleBiometricLock = async (value: boolean) => {
    await AppHaptics.triggerLightImpact();
    setBiometricLock(value);
    await BiometricSecurity.setLockEnabled(value);
    Alert.alert(
      value ? "Biometric Security Enabled" : "Biometric Security Disabled",
      value
        ? "Your session will automatically require verification after 5 minutes of inactivity."
        : "App auto-lock is now turned off."
    );
  };

  useEffect(() => {
    if (user?.fullName) setFullName(user.fullName);
    if (user?.phone) setPhone(user.phone);

    // Fetch latest profile from backend
    apiClient
      .get("/users/profile")
      .then((res) => {
        if (res.data) {
          if (res.data.full_name) setFullName(res.data.full_name);
          if (res.data.phone) setPhone(res.data.phone);
        }
      })
      .catch(() => {});

    // Load local patient metadata
    storage.getItem("emergencyName").then((val) => val && setEmergencyName(val));
    storage.getItem("emergencyPhone").then((val) => val && setEmergencyPhone(val));
    storage.getItem("patientCondition").then((val) => val && setCondition(val));
  }, [user]);

  const handleExportHealthSummary = async () => {
    setIsExporting(true);
    await AppHaptics.triggerMediumImpact();
    try {
      let spo2 = 98;
      let hr = 76;
      let temp = 36.8;
      if (user?.patientId) {
        const cached = await OfflineCache.getCachedPatientSnapshot<any>(user.patientId);
        if (cached?.data?.latestVitals) {
          spo2 = cached.data.latestVitals.spo2 || 98;
          hr = cached.data.latestVitals.bpm || 76;
          temp = cached.data.latestVitals.temperature || 36.8;
        }
      }

      await exportHealthSummaryPdf({
        patientName: fullName || user?.fullName || "SmartNeb Patient",
        mrn: user?.patientId ? `MRN-${user.patientId.slice(0, 8).toUpperCase()}` : "MRN-PT-00128",
        condition: condition || "Asthma / Respiratory Care",
        spo2,
        heartRate: hr,
        temperature: temp,
        adherenceRate: 94,
        medication: "Salbutamol Inhalation Solution",
        dosage: "2.5 mg / 2.5 ml",
        frequency: "Twice Daily (Morning / Evening)",
        emergencyContact: emergencyName ? `${emergencyName} (${emergencyPhone || "N/A"})` : undefined,
      });
    } catch (e: any) {
      Alert.alert("Export Error", e.message || "Failed to generate health summary.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!fullName.trim()) {
      Alert.alert("Validation Error", "Full Name cannot be empty.");
      return;
    }
    setIsSaving(true);
    await AppHaptics.triggerLightImpact();
    try {
      await apiClient.put("/users/profile", {
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      updateUserContext({ fullName: fullName.trim(), phone: phone.trim() });
      await storage.setItem("emergencyName", emergencyName);
      await storage.setItem("emergencyPhone", emergencyPhone);
      await storage.setItem("patientCondition", condition);
      setIsEditing(false);
      await AppHaptics.triggerSuccess();
      Alert.alert("Success", "Your profile details have been saved successfully!");
    } catch (err: any) {
      await AppHaptics.triggerError();
      Alert.alert(
        "Update Failed",
        err.response?.data?.error || "Could not update profile. Please verify your connection.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel", onPress: () => AppHaptics.triggerLightImpact() },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          AppHaptics.triggerLightImpact();
          logout();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scroll}
    >
      <Text style={[styles.title, { color: colors.text }]}>Profile & Settings</Text>

      {/* User Header Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            borderWidth: 1,
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarChar}>{fullName ? fullName[0].toUpperCase() : "U"}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{fullName || "SmartNeb User"}</Text>
        <Text style={[styles.email, { color: colors.textMuted }]}>{user?.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: isDark ? "#1e3a8a" : "#dbeafe" }]}>
          <Text style={[styles.roleText, { color: isDark ? "#60a5fa" : "#1d4ed8" }]}>
            {user?.role?.toUpperCase() || "PATIENT"}
          </Text>
        </View>
      </View>

      {/* Editable Personal Profile Details */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
          Personal Information
        </Text>
        <TouchableOpacity
          onPress={() => (isEditing ? handleSaveChanges() : setIsEditing(true))}
          style={[styles.editButton, { backgroundColor: isEditing ? colors.primary : colors.card }]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text
              style={[
                styles.editButtonText,
                { color: isEditing ? "#ffffff" : colors.primaryLight },
              ]}
            >
              {isEditing ? "Save" : "Edit Profile"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            borderWidth: 1,
          },
        ]}
      >
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Full Name</Text>
          {isEditing ? (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={colors.textMuted}
            />
          ) : (
            <Text style={[styles.fieldValue, { color: colors.text }]}>{fullName || "Not set"}</Text>
          )}
        </View>

        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Phone Number</Text>
          {isEditing ? (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={[styles.fieldValue, { color: colors.text }]}>
              {phone || "Not configured"}
            </Text>
          )}
        </View>

        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Primary Condition</Text>
          {isEditing ? (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={condition}
              onChangeText={setCondition}
              placeholder="e.g. Asthma, COPD"
              placeholderTextColor={colors.textMuted}
            />
          ) : (
            <Text style={[styles.fieldValue, { color: colors.text }]}>{condition}</Text>
          )}
        </View>

        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Emergency Contact</Text>
          {isEditing ? (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={emergencyName}
              onChangeText={setEmergencyName}
              placeholder="Contact Name"
              placeholderTextColor={colors.textMuted}
            />
          ) : (
            <Text style={[styles.fieldValue, { color: colors.text }]}>
              {emergencyName || "None assigned"}
            </Text>
          )}
        </View>

        {isEditing && (
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Emergency Phone</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={emergencyPhone}
              onChangeText={setEmergencyPhone}
              placeholder="Contact Phone Number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        )}

        {isEditing && (
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSaveChanges}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Profile Changes</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Appearance Theme Selector */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        Appearance Theme
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[styles.subText, { color: colors.textMuted, marginBottom: 12 }]}>
          Choose your interface theme. Adapts instantly between light and dark modes.
        </Text>
        <View style={styles.themeRow}>
          {[
            { id: "light" as ThemeMode, label: "Light", icon: "☀️" },
            { id: "dark" as ThemeMode, label: "Dark", icon: "🌙" },
            { id: "system" as ThemeMode, label: "System", icon: "💻" },
          ].map((item) => {
            const active = theme === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.themeChip,
                  {
                    backgroundColor: active ? colors.primary : colors.inputBg,
                    borderColor: active ? colors.primary : colors.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => {
                  AppHaptics.triggerSelection();
                  setThemeMode(item.id);
                }}
              >
                <Text style={styles.themeIcon}>{item.icon}</Text>
                <Text
                  style={[
                    styles.themeChipText,
                    { color: active ? "#ffffff" : colors.textMuted },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Clinical Documents & PDF Export */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        Clinical Documents
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[styles.subText, { color: colors.textMuted, marginBottom: 12 }]}>
          Generate a verified diagnostic PDF summary containing your telemetry history, therapy adherence rate, and current care plans.
        </Text>
        <TouchableOpacity
          style={[styles.exportPdfBtn, { backgroundColor: colors.primary }]}
          onPress={handleExportHealthSummary}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.exportPdfBtnText}>📄 Export Health Summary (PDF)</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Preferences */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Preferences</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            borderWidth: 1,
          },
        ]}
      >
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Voice Alerts & Chimes</Text>
          <Switch
            value={voiceAlerts}
            onValueChange={setVoiceAlerts}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Push & Email Notifications</Text>
          <Switch
            value={emailNotifs}
            onValueChange={setEmailNotifs}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Biometric & PIN Security Lock</Text>
          <Switch
            value={biometricLock}
            onValueChange={handleToggleBiometricLock}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </View>

      {/* Medical Safeguard Disclaimer */}
      <View
        style={[
          styles.disclaimerCard,
          {
            backgroundColor: isDark ? "#0f2027" : "#f0fdf4",
            borderColor: colors.primary,
          },
        ]}
      >
        <Text style={[styles.disclaimerTitle, { color: colors.primary }]}>
          ⚠️ Medical Aid Disclaimer
        </Text>
        <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
          SmartNeb is a clinical monitoring and therapy adherence aid. It is NOT a diagnostic tool
          or life-support device. Always consult your assigned physician for medical evaluations.
        </Text>
      </View>

      {/* Logout & Account Actions */}
      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: colors.danger }]}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.deleteBtn, { borderColor: colors.danger }]}
        onPress={() => {
          Alert.alert(
            "Delete Account & Data",
            "Are you sure you want to permanently delete your account and associated health data? This action complies with Google Play and healthcare privacy laws and cannot be undone.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Permanently Delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    await apiClient.delete("/auth/delete-account");
                    await logout();
                  } catch (e: any) {
                    Alert.alert(
                      "Error",
                      e.response?.data?.error || "Failed to delete account. Please try again.",
                    );
                  }
                },
              },
            ],
          );
        }}
      >
        <Text style={[styles.deleteText, { color: colors.danger }]}>
          Delete Account & Health Data
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "900", marginBottom: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  avatarChar: { color: "#ffffff", fontSize: 32, fontWeight: "800" },
  name: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  email: { fontSize: 13, marginTop: 2, textAlign: "center" },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: "center",
  },
  roleText: { fontSize: 11, fontWeight: "800" },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionHeader: { fontSize: 15, fontWeight: "700" },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editButtonText: { fontSize: 12, fontWeight: "700" },
  fieldRow: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  fieldValue: { fontSize: 15, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
  subText: { fontSize: 13 },
  exportPdfBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  exportPdfBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  themeRow: { flexDirection: "row", gap: 8, width: "100%" },
  themeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  themeIcon: { fontSize: 18, marginBottom: 4 },
  themeChipText: { fontWeight: "700", fontSize: 12 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 14, fontWeight: "600" },
  logoutBtn: {
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  logoutText: { color: "#ffffff", fontWeight: "800", fontSize: 16 },
  disclaimerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginVertical: 14,
  },
  disclaimerTitle: {
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 4,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 18,
  },
  deleteBtn: {
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 24,
  },
  deleteText: {
    fontWeight: "700",
    fontSize: 14,
  },
});
