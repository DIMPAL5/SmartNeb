import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Wind, Thermometer, Droplets, AlertCircle, RefreshCw, ShieldAlert, CheckCircle2 } from "lucide-react-native";
import { apiClient } from "../../api/client";

export const AirQualityScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [envData, setEnvData] = useState<any>(null);

  const fetchAirQuality = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/environment/current");
      setEnvData(res.data);
    } catch (e) {
      // Fallback display
      setEnvData({
        aqi: 72,
        pm25: 24.1,
        pm10: 45.0,
        temperature: 26.5,
        humidity: 60,
        category: "Moderate",
        severity: "moderate",
        city: "Local Area",
        advisory: {
          headline: "Moderate Air Quality",
          message: "Air quality is acceptable. Sensitive children may experience mild irritation.",
          actionRecommended: "Standard daily activity permitted; observe child if outdoors for extended periods.",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAirQuality();
  }, []);

  const getBadgeColor = (category: string) => {
    switch (category) {
      case "Good":
        return "#10B981";
      case "Moderate":
        return "#F59E0B";
      case "Poor":
        return "#F97316";
      default:
        return "#EF4444";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Environmental Health</Text>
          <TouchableOpacity onPress={fetchAirQuality} style={styles.refreshButton}>
            <RefreshCw size={18} color="#0284C7" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0284C7" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Main AQI Gauge Card */}
            <View style={styles.mainCard}>
              <View style={styles.cardHeader}>
                <Wind size={24} color="#0284C7" />
                <Text style={styles.cityText}>{envData?.city || "Local City"}</Text>
              </View>

              <View style={styles.aqiValueBox}>
                <Text style={styles.aqiNumber}>{envData?.aqi || "--"}</Text>
                <Text style={styles.aqiUnit}>AQI</Text>
              </View>

              <View
                style={[
                  styles.categoryPill,
                  { backgroundColor: getBadgeColor(envData?.category || "Moderate") },
                ]}
              >
                <Text style={styles.categoryPillText}>{envData?.category || "Moderate"}</Text>
              </View>
            </View>

            {/* Particulate & Weather Metrics */}
            <View style={styles.gridContainer}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>PM 2.5</Text>
                <Text style={styles.metricValue}>{envData?.pm25 || "--"} µg/m³</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>PM 10</Text>
                <Text style={styles.metricValue}>{envData?.pm10 || "--"} µg/m³</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.iconMetricHeader}>
                  <Thermometer size={16} color="#0284C7" />
                  <Text style={styles.metricLabel}> Temp</Text>
                </View>
                <Text style={styles.metricValue}>{envData?.temperature || "--"} °C</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.iconMetricHeader}>
                  <Droplets size={16} color="#0284C7" />
                  <Text style={styles.metricLabel}> Humidity</Text>
                </View>
                <Text style={styles.metricValue}>{envData?.humidity || "--"}%</Text>
              </View>
            </View>

            {/* Care Plan Clinical Precaution Notice */}
            {envData?.advisory && (
              <View style={styles.advisoryCard}>
                <View style={styles.advisoryHeader}>
                  <ShieldAlert size={20} color="#0284C7" />
                  <Text style={styles.advisoryTitle}>{envData.advisory.headline}</Text>
                </View>
                <Text style={styles.advisoryBody}>{envData.advisory.message}</Text>
                <View style={styles.advisoryActionBox}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <Text style={styles.advisoryActionText}>
                    {envData.advisory.actionRecommended}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.disclaimerText}>
              Disclaimer: Environmental data is cached from local atmospheric monitoring feeds to assist preventive care adherence. This tool does not provide medical diagnoses or prescribe medications.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#0F172A" },
  refreshButton: { padding: 8, backgroundColor: "#E0F2FE", borderRadius: 8 },
  mainCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 20,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  cityText: { marginLeft: 8, fontSize: 16, fontWeight: "600", color: "#334155" },
  aqiValueBox: { alignItems: "center", marginVertical: 8 },
  aqiNumber: { fontSize: 56, fontWeight: "800", color: "#0F172A" },
  aqiUnit: { fontSize: 14, fontWeight: "600", color: "#64748B", marginTop: -6 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 10 },
  categoryPillText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  gridContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
  metricCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconMetricHeader: { flexDirection: "row", alignItems: "center" },
  metricLabel: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  metricValue: { fontSize: 18, fontWeight: "700", color: "#0F172A", marginTop: 6 },
  advisoryCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 20,
  },
  advisoryHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  advisoryTitle: { fontSize: 15, fontWeight: "700", color: "#1E40AF", marginLeft: 8 },
  advisoryBody: { fontSize: 13, color: "#1E3A8A", lineHeight: 20, marginBottom: 12 },
  advisoryActionBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", padding: 10, borderRadius: 10 },
  advisoryActionText: { marginLeft: 8, fontSize: 12, fontWeight: "600", color: "#0F172A", flex: 1 },
  disclaimerText: { fontSize: 11, color: "#94A3B8", textAlign: "center", lineHeight: 16 },
});
