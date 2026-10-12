import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface OfflineBannerProps {
  isOffline: boolean;
  lastSynced?: string;
  lastSyncedTime?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOffline, lastSynced, lastSyncedTime }) => {
  if (!isOffline) return null;
  const syncTime = lastSynced || lastSyncedTime;

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.contentRow}>
        <Text style={styles.icon}>⚡</Text>
        <Text style={styles.bannerText}>
          Offline Mode — Displaying Cached Vitals
          {syncTime ? ` (Synced: ${syncTime})` : ""}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "#f59e0b",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  icon: {
    fontSize: 13,
  },
  bannerText: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "700",
  },
});
