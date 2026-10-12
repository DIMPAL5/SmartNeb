import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  TouchableWithoutFeedback,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme, ThemeMode } from "../context/ThemeContext";
import { useSidebar } from "../context/SidebarContext";
import { AppHaptics } from "../utils/haptics";

interface AppSidebarProps {
  navigationRef: any;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ navigationRef }) => {
  const { user, logout } = useAuth();
  const { theme, colors, isDark, setThemeMode } = useTheme();
  const { isOpen, closeSidebar } = useSidebar();

  if (!isOpen) return null;

  const navigateTo = (screenName: string) => {
    AppHaptics.triggerSelection();
    closeSidebar();
    if (navigationRef?.isReady?.()) {
      navigationRef.navigate(screenName);
    }
  };

  const patientNavItems = [
    { name: "Dashboard", label: "Dashboard", icon: "🏠" },
    { name: "Nebulizer", label: "My Nebulizer", icon: "💨" },
    { name: "Health", label: "Health Monitoring", icon: "❤️" },
    { name: "Adherence", label: "Adherence", icon: "📅" },
    { name: "Alerts", label: "Alerts", icon: "🔔" },
    { name: "AI", label: "AI Assistant", icon: "🤖" },
    { name: "Telehealth", label: "Telehealth & Calls", icon: "📹" },
    { name: "Reports", label: "Clinical Reports", icon: "📄" },
    { name: "Profile", label: "Profile & Settings", icon: "👤" },
  ];

  const doctorNavItems = [
    { name: "Dashboard", label: "Clinical Dashboard", icon: "🩺" },
    { name: "Telehealth", label: "Telehealth & Calls", icon: "📹" },
    { name: "Alerts", label: "Patient Alerts", icon: "🔔" },
    { name: "Reports", label: "Clinical Reports", icon: "📄" },
    { name: "Profile", label: "Doctor Profile", icon: "👤" },
  ];

  const caregiverNavItems = [
    { name: "CaregiverHome", label: "Assigned Patients", icon: "🤝" },
    { name: "Alerts", label: "Patient Alerts", icon: "🔔" },
    { name: "Profile", label: "Caregiver Profile", icon: "👤" },
  ];

  const navItems =
    user?.role === "doctor"
      ? doctorNavItems
      : user?.role === "caregiver"
        ? caregiverNavItems
        : patientNavItems;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={closeSidebar}>
      <View style={styles.overlay}>
        {/* Backdrop click to close */}
        <TouchableWithoutFeedback onPress={closeSidebar}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Sliding Left Bar Drawer */}
        <SafeAreaView
          style={[
            styles.drawer,
            {
              backgroundColor: colors.sidebarBg,
              borderRightColor: colors.sidebarBorder,
            },
          ]}
        >
          {/* Brand Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.brandRow}>
              <Text style={styles.brandText}>SmartNeb</Text>
            </View>
            <TouchableOpacity
              onPress={closeSidebar}
              style={[styles.closeBtn, { backgroundColor: colors.inputBg }]}
            >
              <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* User Profile Card */}
          <View
            style={[
              styles.userCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarChar}>
                {user?.fullName ? user.fullName[0].toUpperCase() : "U"}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {user?.fullName || "User"}
              </Text>
              <Text style={[styles.userRole, { color: colors.primary }]}>
                {user?.role?.toUpperCase() || "PATIENT"}
              </Text>
            </View>
          </View>

          {/* Navigation Items (Matching Website) */}
          <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>NAVIGATION</Text>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.name}
                style={[styles.navItem, { borderBottomColor: colors.border }]}
                onPress={() => navigateTo(item.name)}
              >
                <Text style={styles.navIcon}>{item.icon}</Text>
                <Text style={[styles.navLabel, { color: colors.text }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Left Bar Theme Switcher & Actions */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Text style={[styles.themeLabel, { color: colors.textMuted }]}>THEME</Text>
            <View
              style={[
                styles.themeRow,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                },
              ]}
            >
              {[
                { id: "light" as ThemeMode, icon: "☀️", title: "Light" },
                { id: "dark" as ThemeMode, icon: "🌙", title: "Dark" },
                { id: "system" as ThemeMode, icon: "💻", title: "System" },
              ].map((opt) => {
                const isActive = theme === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.themeBtn,
                      isActive && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                    onPress={() => {
                      AppHaptics.triggerLightImpact();
                      setThemeMode(opt.id);
                    }}
                  >
                    <Text style={styles.themeBtnIcon}>{opt.icon}</Text>
                    <Text
                      style={[
                        styles.themeBtnText,
                        { color: isActive ? "#ffffff" : colors.textMuted },
                      ]}
                    >
                      {opt.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity
              style={[styles.signOutBtn, { backgroundColor: colors.danger }]}
              onPress={() => {
                AppHaptics.triggerLightImpact();
                closeSidebar();
                logout();
              }}
            >
              <Text style={styles.signOutText}>🚪 Sign Out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  drawer: {
    width: "78%",
    maxWidth: 320,
    height: "100%",
    borderRightWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    zIndex: 10,
    elevation: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#16a34a", // SmartNeb green
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarChar: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
  },
  userRole: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  navScroll: {
    flex: 1,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navIcon: {
    fontSize: 18,
    width: 26,
    textAlign: "center",
  },
  navLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
  themeLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  themeRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  themeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  themeBtnIcon: {
    fontSize: 14,
  },
  themeBtnText: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  signOutBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  signOutText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
