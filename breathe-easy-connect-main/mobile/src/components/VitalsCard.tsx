import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface VitalsCardProps {
  label: string;
  value: string | number;
  unit: string;
  status?: 'normal' | 'warning' | 'critical';
  subtext?: string;
  iconName?: string;
}

export const VitalsCard: React.FC<VitalsCardProps> = ({
  label,
  value,
  unit,
  status = 'normal',
  subtext
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'critical':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'normal':
      default:
        return '#10b981';
    }
  };

  return (
    <View style={[styles.card, { borderColor: getStatusColor() }]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.badge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value ?? '--'}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '800',
  },
  unit: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  subtext: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 6,
  },
});
