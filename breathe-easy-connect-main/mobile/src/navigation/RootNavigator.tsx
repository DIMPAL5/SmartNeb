import React from "react";
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSidebar } from "../context/SidebarContext";
import { AppSidebar } from "../components/AppSidebar";
import { AppHaptics } from "../utils/haptics";

// Auth Screens
import { LoginScreen } from "../screens/auth/LoginScreen";

// Patient Screens
import { PatientDashboardScreen } from "../screens/patient/PatientDashboardScreen";
import { NebulizerControlScreen } from "../screens/patient/NebulizerControlScreen";
import { HealthMonitoringScreen } from "../screens/patient/HealthMonitoringScreen";
import { AdherenceScreen } from "../screens/patient/AdherenceScreen";
import { AlertsScreen } from "../screens/patient/AlertsScreen";
import { AIAssistantScreen } from "../screens/patient/AIAssistantScreen";
import { ReportsScreen } from "../screens/patient/ReportsScreen";
import { ProfileScreen } from "../screens/patient/ProfileScreen";
import { TelehealthScreen } from "../screens/patient/TelehealthScreen";

// Doctor Screens
import { DoctorDashboardScreen } from "../screens/doctor/DoctorDashboardScreen";
import { PatientDetailScreen } from "../screens/doctor/PatientDetailScreen";
import { DoctorTelehealthScreen } from "../screens/doctor/DoctorTelehealthScreen";

// Caregiver Screens
import { CaregiverDashboardScreen } from "../screens/caregiver/CaregiverDashboardScreen";

// Admin Screens
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";

// Super Admin Screens
import { SuperAdminDashboardScreen } from "../screens/superAdmin/SuperAdminDashboardScreen";

export const navigationRef = createNavigationContainerRef<any>();

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/* -------------------------------------------------------------------------- */
/*                               HEADER MENU ICON                             */
/* -------------------------------------------------------------------------- */

const MenuButton = () => {
  const { openSidebar } = useSidebar();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={openSidebar}
      style={styles.menuBtn}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={[styles.menuBtnText, { color: colors.headerText }]}>☰</Text>
    </TouchableOpacity>
  );
};

/* -------------------------------------------------------------------------- */
/*                            PATIENT NAVIGATION                              */
/* -------------------------------------------------------------------------- */

function PatientTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => {
          AppHaptics.triggerSelection();
        },
      }}
      screenOptions={{
        headerLeft: () => <MenuButton />,
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        tabBarStyle: { backgroundColor: colors.tabBarBg, borderTopColor: colors.tabBarBorder },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={PatientDashboardScreen}
        options={{ title: "Home", tabBarIcon: () => <Text>🏠</Text> }}
      />
      <Tab.Screen
        name="Nebulizer"
        component={NebulizerControlScreen}
        options={{ title: "Nebulizer", tabBarIcon: () => <Text>💨</Text> }}
      />
      <Tab.Screen
        name="Health"
        component={HealthMonitoringScreen}
        options={{ title: "Health", tabBarIcon: () => <Text>❤️</Text> }}
      />
      <Tab.Screen
        name="Adherence"
        component={AdherenceScreen}
        options={{ title: "Adherence", tabBarIcon: () => <Text>📅</Text> }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{ title: "Alerts", tabBarIcon: () => <Text>🔔</Text> }}
      />
      <Tab.Screen
        name="AI"
        component={AIAssistantScreen}
        options={{ title: "AI Assistant", tabBarIcon: () => <Text>🤖</Text> }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: "Reports", tabBarIcon: () => <Text>📄</Text> }}
      />
      <Tab.Screen
        name="Telehealth"
        component={TelehealthScreen}
        options={{ title: "Telehealth", tabBarIcon: () => <Text>📹</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile", tabBarIcon: () => <Text>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                             DOCTOR NAVIGATION                              */
/* -------------------------------------------------------------------------- */

function DoctorStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
      }}
    >
      <Stack.Screen
        name="DoctorHome"
        component={DoctorDashboardScreen}
        options={{
          title: "Doctor Console",
          headerLeft: () => <MenuButton />,
        }}
      />
      <Stack.Screen
        name="PatientDetail"
        component={PatientDetailScreen}
        options={{ title: "Clinical Patient Snapshot" }}
      />
    </Stack.Navigator>
  );
}

function DoctorTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => {
          AppHaptics.triggerSelection();
        },
      }}
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        tabBarStyle: { backgroundColor: colors.tabBarBg, borderTopColor: colors.tabBarBorder },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DoctorStack}
        options={{
          headerShown: false,
          title: "Patients",
          tabBarIcon: () => <Text>👥</Text>,
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          title: "Alerts",
          headerLeft: () => <MenuButton />,
          tabBarIcon: () => <Text>🔔</Text>,
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          title: "Reports",
          headerLeft: () => <MenuButton />,
          tabBarIcon: () => <Text>📄</Text>,
        }}
      />
      <Tab.Screen
        name="Telehealth"
        component={DoctorTelehealthScreen}
        options={{
          title: "Telehealth",
          headerLeft: () => <MenuButton />,
          tabBarIcon: () => <Text>📹</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          headerLeft: () => <MenuButton />,
          tabBarIcon: () => <Text>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                           CAREGIVER NAVIGATION                             */
/* -------------------------------------------------------------------------- */

function CaregiverTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => {
          AppHaptics.triggerSelection();
        },
      }}
      screenOptions={{
        headerLeft: () => <MenuButton />,
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        tabBarStyle: { backgroundColor: colors.tabBarBg, borderTopColor: colors.tabBarBorder },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
      }}
    >
      <Tab.Screen
        name="CaregiverHome"
        component={CaregiverDashboardScreen}
        options={{ title: "Patients", tabBarIcon: () => <Text>👥</Text> }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{ title: "Alerts", tabBarIcon: () => <Text>🔔</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile", tabBarIcon: () => <Text>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                             ADMIN NAVIGATION                               */
/* -------------------------------------------------------------------------- */

function AdminTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => {
          AppHaptics.triggerSelection();
        },
      }}
      screenOptions={{
        headerLeft: () => <MenuButton />,
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        tabBarStyle: { backgroundColor: colors.tabBarBg, borderTopColor: colors.tabBarBorder },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
      }}
    >
      <Tab.Screen
        name="AdminHome"
        component={AdminDashboardScreen}
        options={{ title: "Console", tabBarIcon: () => <Text>⚙️</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile", tabBarIcon: () => <Text>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                          SUPER ADMIN NAVIGATION                            */
/* -------------------------------------------------------------------------- */

function SuperAdminTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => {
          AppHaptics.triggerSelection();
        },
      }}
      screenOptions={{
        headerLeft: () => <MenuButton />,
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        tabBarStyle: { backgroundColor: colors.tabBarBg, borderTopColor: colors.tabBarBorder },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
      }}
    >
      <Tab.Screen
        name="SuperAdminHome"
        component={SuperAdminDashboardScreen}
        options={{ title: "Audit Console", tabBarIcon: () => <Text>🛡️</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile", tabBarIcon: () => <Text>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                              ROOT NAVIGATOR                                */
/* -------------------------------------------------------------------------- */

export function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NavigationContainer ref={navigationRef}>
        {!user ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        ) : user.role === "doctor" ? (
          <DoctorTabs />
        ) : user.role === "caregiver" ? (
          <CaregiverTabs />
        ) : user.role === "admin" ? (
          <AdminTabs />
        ) : user.role === "super_admin" ? (
          <SuperAdminTabs />
        ) : (
          <PatientTabs />
        )}
      </NavigationContainer>
      <AppSidebar navigationRef={navigationRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  menuBtn: {
    marginLeft: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  menuBtnText: {
    fontSize: 22,
    fontWeight: "700",
  },
});
