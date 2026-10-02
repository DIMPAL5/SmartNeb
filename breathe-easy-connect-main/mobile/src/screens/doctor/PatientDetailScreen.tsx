import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { apiClient } from "../../api/client";
import { VitalsCard } from "../../components/VitalsCard";

export const PatientDetailScreen = ({ route }: any) => {
  const patient = route.params?.patient || {};
  const [snapshot, setSnapshot] = useState<any>(null);
  const [noteText, setNoteText] = useState("");

  const fetchSnapshot = async () => {
    try {
      const res = await apiClient.get(`/patients/${patient.id}/snapshot`);
      if (res.data?.snapshot) {
        setSnapshot(res.data.snapshot);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSnapshot();
  }, [patient.id]);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      await apiClient.post("/clinical-notes", {
        patientId: patient.id,
        note: noteText,
      });
      setNoteText("");
      Alert.alert("Saved", "Clinical note saved securely.");
    } catch (e) {
      Alert.alert("Error", "Failed to save note.");
    }
  };

  const latest = snapshot?.latestVitals || {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.patientName}>{patient.fullName}</Text>
      <Text style={styles.mrn}>
        MRN: {patient.mrn} | Condition: {patient.condition}
      </Text>

      {/* Live Vitals Snapshot */}
      <Text style={styles.sectionHeader}>Live Clinical Telemetry</Text>
      <VitalsCard
        label="Blood Oxygen (SpO2)"
        value={latest.spo2 ? `${latest.spo2}%` : "98%"}
        unit="SpO2"
        status={latest.spo2 && latest.spo2 < 92 ? "critical" : "normal"}
      />
      <VitalsCard label="Heart Rate" value={latest.bpm || "76"} unit="BPM" status="normal" />

      {/* Private Clinical Notes Editor */}
      <Text style={styles.sectionHeader}>Doctor Private Clinical Notes</Text>
      <View style={styles.noteCard}>
        <TextInput
          style={styles.noteInput}
          placeholder="Enter private clinical observations..."
          placeholderTextColor="#64748b"
          multiline
          numberOfLines={4}
          value={noteText}
          onChangeText={setNoteText}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={handleAddNote}>
          <Text style={styles.saveBtnText}>Save Private Note</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { padding: 18 },
  patientName: { color: "#f8fafc", fontSize: 24, fontWeight: "900" },
  mrn: { color: "#38bdf8", fontSize: 13, marginBottom: 16 },
  sectionHeader: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 10,
  },
  noteCard: { backgroundColor: "#1e293b", borderRadius: 16, padding: 14 },
  noteInput: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    color: "#f8fafc",
    minHeight: 90,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: "#0284c7",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
});
