import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme, ThemeMode } from "../../context/ThemeContext";

export const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const { theme, setThemeMode } = useTheme();
  const [voiceAlerts, setVoiceAlerts] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Profile & Settings</Text>

      {/* User Header */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarChar}>{user?.fullName ? user.fullName[0] : "P"}</Text>
        </View>
        <Text style={styles.name}>{user?.fullName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      {/* Theme Settings */}
      <Text style={styles.sectionHeader}>Appearance Theme</Text>
      <View style={styles.card}>
        <View style={styles.themeRow}>
          {(["light", "dark", "system"] as ThemeMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.themeChip, theme === mode ? styles.themeChipActive : null]}
              onPress={() => setThemeMode(mode)}
            >
              <Text
                style={[styles.themeChipText, theme === mode ? styles.themeChipTextActive : null]}
              >
                {mode.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Preferences */}
      <Text style={styles.sectionHeader}>Preferences</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Voice Alerts & Audio Chimes</Text>
          <Switch
            value={voiceAlerts}
            onValueChange={setVoiceAlerts}
            trackColor={{ true: "#0284c7" }}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Push & Email Notifications</Text>
          <Switch
            value={emailNotifs}
            onValueChange={setEmailNotifs}
            trackColor={{ true: "#0284c7" }}
          />
        </View>
      </View>

      {/* Medical Safeguard Disclaimer */}
      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerTitle}>⚠️ Medical Aid Disclaimer</Text>
        <Text style={styles.disclaimerText}>
          SmartNeb is a clinical monitoring and therapy adherence aid. It is NOT a diagnostic tool
          or life-support device. Always consult your assigned physician for medical evaluations.
        </Text>
      </View>

      {/* Logout & Account Deletion */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteBtn}
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
                    const { apiClient } = require("../../api/client");
                    await apiClient.delete("/auth/delete-account");
                    Alert.alert(
                      "Account Deleted",
                      "Your account and data have been scheduled for deletion.",
                    );
                    logout();
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
        <Text style={styles.deleteText}>Delete Account & Health Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { padding: 18 },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "900", marginBottom: 16 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#0284c7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarChar: { color: "#ffffff", fontSize: 32, fontWeight: "800" },
  name: { color: "#f8fafc", fontSize: 20, fontWeight: "800" },
  email: { color: "#94a3b8", fontSize: 13, marginTop: 2 },
  roleBadge: {
    backgroundColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  roleText: { color: "#38bdf8", fontSize: 11, fontWeight: "800" },
  sectionHeader: { color: "#cbd5e1", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  themeRow: { flexDirection: "row", gap: 8, width: "100%" },
  themeChip: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  themeChipActive: { backgroundColor: "#0284c7" },
  themeChipText: { color: "#94a3b8", fontWeight: "700", fontSize: 12 },
  themeChipTextActive: { color: "#ffffff" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingVertical: 8,
  },
  switchLabel: { color: "#f8fafc", fontSize: 14 },
  logoutBtn: {
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  logoutText: { color: "#ffffff", fontWeight: "800", fontSize: 16 },
  disclaimerCard: {
    backgroundColor: "#1e293b",
    borderColor: "#0284c7",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginVertical: 14,
  },
  disclaimerTitle: {
    color: "#38bdf8",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 4,
  },
  disclaimerText: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "#ef4444",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 24,
  },
  deleteText: {
    color: "#ef4444",
    fontWeight: "700",
    fontSize: 14,
  },
});
