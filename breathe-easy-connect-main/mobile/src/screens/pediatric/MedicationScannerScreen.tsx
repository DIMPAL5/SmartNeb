import React, { useState } from "react";
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
import { Scan, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react-native";
import { apiClient } from "../../api/client";

export const MedicationScannerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [medicationInput, setMedicationInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const sampleMedications = [
    { name: "Budesonide Respules 0.5mg", code: "8901148231011" },
    { name: "Duolin Inhalant (Levosalbutamol + Ipratropium)", code: "8901148239922" },
    { name: "Asthalin Respirator Solution (Salbutamol)", code: "8901148233344" },
    { name: "Amoxicillin 250mg Suspension (Unprescribed)", code: "8901148999999" },
  ];

  const handleVerify = async (codeOrName: string) => {
    const query = codeOrName.trim();
    if (!query) return;

    setLoading(true);
    setVerificationResult(null);

    try {
      const res = await apiClient.post("/medications/verify", {
        medicationName: query,
        scannedCode: query,
      });
      setVerificationResult(res.data);
    } catch (e: any) {
      setVerificationResult({
        matched: false,
        status: "ERROR",
        message: e.response?.data?.error || "Medication check failed. Verify network.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Medication Verification</Text>
        <Text style={styles.headerSubtitle}>
          Scan barcode or enter ampoule label to verify against prescribed Care Plan
        </Text>

        {/* Barcode Scanner Box */}
        <View style={styles.scannerBox}>
          <View style={styles.viewfinder}>
            <Scan size={52} color="#0284C7" />
            <Text style={styles.scannerPrompt}>Hold barcode or ampoule in front of camera</Text>
          </View>
        </View>

        {/* Manual Barcode / Name Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter medication name or barcode..."
            value={medicationInput}
            onChangeText={setMedicationInput}
          />
          <TouchableOpacity
            style={styles.verifyBtn}
            onPress={() => handleVerify(medicationInput)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.verifyBtnText}>Verify</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Test Chips */}
        <Text style={styles.quickLabel}>Quick Sample Scans:</Text>
        <View style={styles.chipsRow}>
          {sampleMedications.map((item) => (
            <TouchableOpacity
              key={item.code}
              style={styles.chip}
              onPress={() => {
                setMedicationInput(item.name);
                handleVerify(item.name);
              }}
            >
              <Text style={styles.chipText}>{item.name.split(" ")[0]} Respule</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Verification Result Card */}
        {verificationResult && (
          <View
            style={[
              styles.resultCard,
              verificationResult.matched ? styles.cardSuccess : styles.cardFail,
            ]}
          >
            <View style={styles.resultHeader}>
              {verificationResult.matched ? (
                <CheckCircle2 size={24} color="#10B981" />
              ) : (
                <XCircle size={24} color="#EF4444" />
              )}
              <Text
                style={[
                  styles.resultTitle,
                  { color: verificationResult.matched ? "#065F46" : "#991B1B" },
                ]}
              >
                {verificationResult.status}
              </Text>
            </View>

            <Text style={styles.resultMessage}>{verificationResult.message}</Text>

            {verificationResult.matched && (
              <View style={styles.detailsBox}>
                <Text style={styles.detailText}>
                  • Prescribed Dosage: {verificationResult.dosage}
                </Text>
                <Text style={styles.detailText}>
                  • Duration: {verificationResult.durationMinutes} Minutes
                </Text>
                <Text style={styles.detailText}>
                  • Prescribed By: {verificationResult.prescribedBy}
                </Text>

                <TouchableOpacity
                  style={styles.proceedButton}
                  onPress={() => navigation.navigate("BreatheWithBunny")}
                >
                  <Text style={styles.proceedButtonText}>Proceed to Breathing Session</Text>
                  <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  headerSubtitle: { fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 20 },
  scannerBox: {
    backgroundColor: "#0F172A",
    borderRadius: 20,
    height: 190,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  viewfinder: { alignItems: "center", padding: 20 },
  scannerPrompt: { color: "#94A3B8", fontSize: 12, marginTop: 12, fontWeight: "500" },
  inputContainer: { flexDirection: "row", marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  verifyBtn: {
    backgroundColor: "#0284C7",
    marginLeft: 10,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  verifyBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  quickLabel: { fontSize: 12, fontWeight: "600", color: "#64748B", marginBottom: 8 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  chip: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { color: "#0369A1", fontSize: 12, fontWeight: "600" },
  resultCard: { borderRadius: 16, padding: 18, marginTop: 10, borderWidth: 1 },
  cardSuccess: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  cardFail: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  resultHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  resultTitle: { fontSize: 15, fontWeight: "800", marginLeft: 8 },
  resultMessage: { fontSize: 13, color: "#334155", lineHeight: 20, marginBottom: 12 },
  detailsBox: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, marginTop: 6 },
  detailText: { fontSize: 13, color: "#1E293B", fontWeight: "500", marginVertical: 3 },
  proceedButton: {
    backgroundColor: "#10B981",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  proceedButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
