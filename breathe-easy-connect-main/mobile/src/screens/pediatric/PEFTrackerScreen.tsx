import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Activity, Plus, TrendingUp, AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react-native";
import { apiClient } from "../../api/client";

export const PEFTrackerScreen: React.FC = () => {
  const [pefValue, setPefValue] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [personalBest, setPersonalBest] = useState(250);
  const [average, setAverage] = useState(230);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/pef/history");
      if (res.data) {
        setHistory(res.data.readings || []);
        if (res.data.personalBest) setPersonalBest(res.data.personalBest);
        if (res.data.average) setAverage(res.data.average);
      }
    } catch (e) {
      // offline fallback
    } finally {
      setLoading(false);
    }
  };

  const handleRecord = async () => {
    const val = Number(pefValue);
    if (!val || val <= 0 || val > 900) {
      Alert.alert("Invalid Input", "Please enter a valid PEF reading between 1 and 900 L/min.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post("/pef/reading", {
        value: val,
        note: note.trim() || undefined,
      });

      if (res.data) {
        Alert.alert(
          `${res.data.zone} Zone Recorded`,
          `${res.data.zoneDetails?.label}: ${res.data.zoneDetails?.guidance}`
        );
        setPefValue("");
        setNote("");
        fetchHistory();
      }
    } catch (e: any) {
      Alert.alert("Save Error", e.response?.data?.error || "Could not record PEF reading.");
    } finally {
      setSubmitting(false);
    }
  };

  const getZoneColor = (zone: string) => {
    if (zone === "Green") return "#10B981";
    if (zone === "Yellow") return "#F59E0B";
    return "#EF4444";
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Peak Flow Tracker (PEF)</Text>
        <Text style={styles.headerSubtitle}>Monitor airway volume and personal asthma action zones</Text>

        {/* Top Summary Stats */}
        <View style={styles.summaryRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Personal Best</Text>
            <Text style={styles.statNumber}>{personalBest} L/min</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>30-Day Average</Text>
            <Text style={styles.statNumber}>{average} L/min</Text>
          </View>
        </View>

        {/* Zone Reference Guide */}
        <View style={styles.zoneGuideCard}>
          <View style={styles.zoneRow}>
            <View style={[styles.zoneDot, { backgroundColor: "#10B981" }]} />
            <Text style={styles.zoneText}>Green: ≥80% ({Math.round(personalBest * 0.8)}+ L/min) • Well Controlled</Text>
          </View>
          <View style={styles.zoneRow}>
            <View style={[styles.zoneDot, { backgroundColor: "#F59E0B" }]} />
            <Text style={styles.zoneText}>Yellow: 50–79% ({Math.round(personalBest * 0.5)}–{Math.round(personalBest * 0.79)} L/min) • Caution</Text>
          </View>
          <View style={styles.zoneRow}>
            <View style={[styles.zoneDot, { backgroundColor: "#EF4444" }]} />
            <Text style={styles.zoneText}>Red: &lt;50% (&lt;{Math.round(personalBest * 0.5)} L/min) • Medical Alert</Text>
          </View>
        </View>

        {/* New PEF Entry Form */}
        <View style={styles.inputCard}>
          <Text style={styles.inputTitle}>Record New Blow</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 240"
              keyboardType="number-pad"
              value={pefValue}
              onChangeText={setPefValue}
            />
            <Text style={styles.unitText}>L/min</Text>
          </View>

          <TextInput
            style={styles.noteInput}
            placeholder="Add note (e.g. before morning nebulizer)..."
            value={note}
            onChangeText={setNote}
          />

          <TouchableOpacity style={styles.submitButton} onPress={handleRecord} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Plus size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.submitButtonText}>Log PEF Measurement</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* History List */}
        <Text style={styles.historySectionTitle}>Recent Readings</Text>
        {loading ? (
          <ActivityIndicator color="#0284C7" style={{ marginTop: 20 }} />
        ) : history.length === 0 ? (
          <Text style={styles.emptyText}>No PEF readings recorded yet.</Text>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View style={[styles.zoneIndicator, { backgroundColor: getZoneColor(item.zone) }]} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyVal}>{item.value} L/min</Text>
                  <Text style={[styles.historyZoneText, { color: getZoneColor(item.zone) }]}>
                    {item.zone} ({item.ratioPercent}%)
                  </Text>
                </View>
                {item.note && <Text style={styles.historyNote}>{item.note}</Text>}
                <Text style={styles.historyTime}>
                  {new Date(item.recordedAt).toLocaleDateString()} {new Date(item.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  headerSubtitle: { fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  statBox: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statLabel: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  statNumber: { fontSize: 20, fontWeight: "800", color: "#0284C7", marginTop: 4 },
  zoneGuideCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  zoneRow: { flexDirection: "row", alignItems: "center", marginVertical: 3 },
  zoneDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  zoneText: { fontSize: 11, color: "#334155", fontWeight: "500" },
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 24,
  },
  inputTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginBottom: 12 },
  inputRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  textInput: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  unitText: { marginLeft: 10, fontSize: 14, fontWeight: "600", color: "#64748B" },
  noteInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
    marginBottom: 14,
  },
  submitButton: {
    backgroundColor: "#0284C7",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
  },
  submitButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  historySectionTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 12 },
  emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 12 },
  historyCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  zoneIndicator: { width: 6, height: 48, borderRadius: 3 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyVal: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  historyZoneText: { fontSize: 12, fontWeight: "700" },
  historyNote: { fontSize: 12, color: "#64748B", marginTop: 2 },
  historyTime: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
});
