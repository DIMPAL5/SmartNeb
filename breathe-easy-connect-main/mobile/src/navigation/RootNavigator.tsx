import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';

// Auth Screens
import { LoginScreen } from '../screens/auth/LoginScreen';

// Patient Screens
import { PatientDashboardScreen } from '../screens/patient/PatientDashboardScreen';
import { NebulizerControlScreen } from '../screens/patient/NebulizerControlScreen';
import { HealthMonitoringScreen } from '../screens/patient/HealthMonitoringScreen';
import { AdherenceScreen } from '../screens/patient/AdherenceScreen';
import { AlertsScreen } from '../screens/patient/AlertsScreen';
import { AIAssistantScreen } from '../screens/patient/AIAssistantScreen';
import { ReportsScreen } from '../screens/patient/ReportsScreen';
import { ProfileScreen } from '../screens/patient/ProfileScreen';

// Doctor Screens
import { DoctorDashboardScreen } from '../screens/doctor/DoctorDashboardScreen';
import { PatientDetailScreen } from '../screens/doctor/PatientDetailScreen';

// Caregiver Screens
import { CaregiverDashboardScreen } from '../screens/caregiver/CaregiverDashboardScreen';

// Admin Screens
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';

// Super Admin Screens
import { SuperAdminDashboardScreen } from '../screens/superAdmin/SuperAdminDashboardScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/* -------------------------------------------------------------------------- */
/*                            PATIENT NAVIGATION                              */
/* -------------------------------------------------------------------------- */

function PatientTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#f8fafc',
        tabBarStyle: { backgroundColor: '#1e293b', borderTopColor: '#334155' },
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: '#94a3b8',
      }}
    >
      <Tab.Screen name="Dashboard" component={PatientDashboardScreen} options={{ title: 'Home', tabBarIcon: () => <Text>🏠</Text> }} />
      <Tab.Screen name="Nebulizer" component={NebulizerControlScreen} options={{ title: 'Nebulizer', tabBarIcon: () => <Text>💨</Text> }} />
      <Tab.Screen name="Health" component={HealthMonitoringScreen} options={{ title: 'Health', tabBarIcon: () => <Text>❤️</Text> }} />
      <Tab.Screen name="Adherence" component={AdherenceScreen} options={{ title: 'Adherence', tabBarIcon: () => <Text>📅</Text> }} />
      <Tab.Screen name="Alerts" component={AlertsScreen} options={{ title: 'Alerts', tabBarIcon: () => <Text>🔔</Text> }} />
      <Tab.Screen name="AI" component={AIAssistantScreen} options={{ title: 'AI Assistant', tabBarIcon: () => <Text>🤖</Text> }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports', tabBarIcon: () => <Text>📄</Text> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile', tabBarIcon: () => <Text>👤</Text> }} />
    </Tab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                             DOCTOR NAVIGATION                              */
/* -------------------------------------------------------------------------- */

function DoctorStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#1e293b' }, headerTintColor: '#f8fafc' }}>
      <Stack.Screen name="DoctorHome" component={DoctorDashboardScreen} options={{ title: 'Doctor Console' }} />
      <Stack.Screen name="PatientDetail" component={PatientDetailScreen} options={{ title: 'Clinical Patient Snapshot' }} />
    </Stack.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                           CAREGIVER NAVIGATION                             */
/* -------------------------------------------------------------------------- */

function CaregiverTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#f8fafc',
        tabBarStyle: { backgroundColor: '#1e293b', borderTopColor: '#334155' },
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: '#94a3b8',
      }}
    >
      <Tab.Screen name="CaregiverHome" component={CaregiverDashboardScreen} options={{ title: 'Patients', tabBarIcon: () => <Text>👥</Text> }} />
      <Tab.Screen name="Alerts" component={AlertsScreen} options={{ title: 'Alerts', tabBarIcon: () => <Text>🔔</Text> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile', tabBarIcon: () => <Text>👤</Text> }} />
    </Tab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                             ADMIN NAVIGATION                               */
/* -------------------------------------------------------------------------- */

function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#f8fafc',
        tabBarStyle: { backgroundColor: '#1e293b', borderTopColor: '#334155' },
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: '#94a3b8',
      }}
    >
      <Tab.Screen name="AdminHome" component={AdminDashboardScreen} options={{ title: 'Console', tabBarIcon: () => <Text>⚙️</Text> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile', tabBarIcon: () => <Text>👤</Text> }} />
    </Tab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                          SUPER ADMIN NAVIGATION                            */
/* -------------------------------------------------------------------------- */

function SuperAdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#f8fafc',
        tabBarStyle: { backgroundColor: '#1e293b', borderTopColor: '#334155' },
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: '#94a3b8',
      }}
    >
      <Tab.Screen name="SuperAdminHome" component={SuperAdminDashboardScreen} options={{ title: 'Audit Console', tabBarIcon: () => <Text>🛡️</Text> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile', tabBarIcon: () => <Text>👤</Text> }} />
    </Tab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                              ROOT NAVIGATOR                                */
/* -------------------------------------------------------------------------- */

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      ) : user.role === 'doctor' ? (
        <DoctorStack />
      ) : user.role === 'caregiver' ? (
        <CaregiverTabs />
      ) : user.role === 'admin' ? (
        <AdminTabs />
      ) : user.role === 'super_admin' ? (
        <SuperAdminTabs />
      ) : (
        <PatientTabs />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
