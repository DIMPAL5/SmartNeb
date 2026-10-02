import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { apiClient } from '../../api/client';

export const AdminDashboardScreen = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdminData = async () => {
    try {
      const [uRes, dRes] = await Promise.all([
        apiClient.get('/admin/users'),
        apiClient.get('/devices')
      ]);
      if (uRes.data?.users) setUsers(uRes.data.users);
      if (dRes.data?.devices) setDevices(dRes.data.devices);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAdminData(); }} tintColor="#38bdf8" />}
    >
      <Text style={styles.title}>System Admin Console</Text>
      <Text style={styles.subtitle}>Platform management & IoT Device Registry</Text>

      {/* Overview Cards */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{users.length}</Text>
          <Text style={styles.kpiLab}>Registered Users</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{devices.length}</Text>
          <Text style={styles.kpiLab}>IoT Nebulizers</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>IoT Device Registry</Text>
      {devices.map((d) => (
        <View key={d.id} style={styles.devCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.devCode}>{d.deviceCode}</Text>
            <Text style={[styles.statusTag, { color: d.status === 'online' ? '#10b981' : '#f59e0b' }]}>
              {d.status.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.devMeta}>Assigned Patient: {d.patient?.fullName || 'Unassigned'}</Text>
          <Text style={styles.devMeta}>Firmware: {d.firmware} | Nebulizer State: {d.nebulizerState}</Text>
        </View>
      ))}

      <Text style={styles.sectionHeader}>User Registry</Text>
      {users.map((u) => (
        <View key={u.id} style={styles.userCard}>
          <Text style={styles.userName}>{u.fullName}</Text>
          <Text style={styles.userEmail}>{u.email}</Text>
          <Text style={styles.userRole}>Roles: {u.roles.map((r: any) => r.role).join(', ')}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 18 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },
  kpiGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  kpiCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 16, alignItems: 'center' },
  kpiVal: { color: '#38bdf8', fontSize: 28, fontWeight: '900' },
  kpiLab: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  sectionHeader: { color: '#cbd5e1', fontSize: 16, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  devCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  devCode: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  statusTag: { fontWeight: '800', fontSize: 12 },
  devMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  userCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 12, marginBottom: 8 },
  userName: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  userEmail: { color: '#94a3b8', fontSize: 12 },
  userRole: { color: '#38bdf8', fontSize: 12, marginTop: 2, fontWeight: '600' },
});
