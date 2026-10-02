import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface FluidGaugeProps {
  level: number; // 0 to 100
  capacityMl?: number;
}

export const FluidGauge: React.FC<FluidGaugeProps> = ({ level = 85, capacityMl = 10 }) => {
  const isLow = level < 20;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Fluid Chamber</Text>
        <Text style={[styles.percentage, { color: isLow ? '#ef4444' : '#38bdf8' }]}>
          {Math.round(level)}%
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(Math.max(level, 0), 100)}%`,
              backgroundColor: isLow ? '#ef4444' : '#0284c7',
            },
          ]}
        />
      </View>
      <View style={styles.footerRow}>
        <Text style={styles.subtext}>Est. Remaining: {((level / 100) * capacityMl).toFixed(1)} ml / {capacityMl} ml</Text>
        {isLow ? <Text style={styles.warning}>Low Fluid Warning!</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  percentage: {
    fontSize: 18,
    fontWeight: '800',
  },
  track: {
    height: 14,
    backgroundColor: '#334155',
    borderRadius: 7,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 7,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  subtext: {
    color: '#94a3b8',
    fontSize: 12,
  },
  warning: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
});
