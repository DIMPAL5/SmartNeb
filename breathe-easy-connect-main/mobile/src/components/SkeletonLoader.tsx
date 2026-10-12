import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, DimensionValue } from "react-native";

export const SkeletonLine: React.FC<{
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: any;
}> = ({ width = "100%", height = 16, borderRadius = 8, style }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCard: React.FC<{ height?: number }> = ({ height = 110 }) => {
  return (
    <View style={[styles.cardContainer, { height }]}>
      <View style={styles.cardHeader}>
        <SkeletonLine width="40%" height={14} />
        <SkeletonLine width="20%" height={18} borderRadius={10} />
      </View>
      <SkeletonLine width="35%" height={32} style={{ marginTop: 10 }} />
      <SkeletonLine width="65%" height={10} style={{ marginTop: 12 }} />
    </View>
  );
};

export const SkeletonVitalsGrid: React.FC = () => {
  return (
    <View style={styles.gridContainer}>
      <SkeletonCard height={115} />
      <SkeletonCard height={115} />
      <SkeletonCard height={115} />
    </View>
  );
};

export const SkeletonRosterItem: React.FC = () => {
  return (
    <View style={styles.rosterContainer}>
      <View style={styles.avatarRow}>
        <SkeletonLine width={44} height={44} borderRadius={22} />
        <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
          <SkeletonLine width="60%" height={16} />
          <SkeletonLine width="40%" height={12} />
        </View>
        <SkeletonLine width="20%" height={20} borderRadius={8} />
      </View>
      <View style={styles.statsRow}>
        <SkeletonLine width="30%" height={14} />
        <SkeletonLine width="30%" height={14} />
        <SkeletonLine width="25%" height={14} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: "rgba(148, 163, 184, 0.25)",
  },
  cardContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.5)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gridContainer: {
    gap: 8,
    marginVertical: 4,
  },
  rosterContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 14,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.5)",
    gap: 12,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(51, 65, 85, 0.4)",
  },
});
