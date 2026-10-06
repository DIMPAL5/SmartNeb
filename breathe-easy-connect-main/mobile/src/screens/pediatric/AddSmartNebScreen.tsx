import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Bluetooth, Wifi, CheckCircle2, ArrowRight, RefreshCw, Signal, Lock } from "lucide-react-native";
import { BLEService, DiscoveredSmartNebDevice } from "../../services/BLEService";

export const AddSmartNebScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<DiscoveredSmartNebDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredSmartNebDevice | null>(null);

  // Wi-Fi modal state
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [ssid, setSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [isPaired, setIsPaired] = useState(false);

  const startScan = async () => {
    setScanning(true);
    setDevices([]);
    try {
      const found = await BLEService.scanForDevices();
      setDevices(found);
    } catch (e) {
      Alert.alert("Scan Error", "Please ensure Bluetooth permissions and adapter are enabled.");
    } finally {
      setScanning(false);
    }
  };

  const handleSelectDevice = (dev: DiscoveredSmartNebDevice) => {
    setSelectedDevice(dev);
    setShowWifiModal(true);
  };

  const handleProvisionWifi = async () => {
    if (!ssid.trim() || !wifiPassword.trim()) {
      Alert.alert("Input Required", "Please enter your home Wi-Fi SSID and Password.");
      return;
    }

    setProvisioning(true);
    try {
      const result = await BLEService.provisionWifiAndPair({
        deviceCode: selectedDevice!.deviceCode,
        ssid: ssid.trim(),
        password: wifiPassword.trim(),
      });

      if (result.success) {
        setIsPaired(true);
        setShowWifiModal(false);
      }
    } catch (e: any) {
      Alert.alert("Pairing Failed", e.message || "Could not complete BLE Wi-Fi provisioning.");
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Add SmartNeb Device</Text>
        <Text style={styles.headerSubtitle}>
          Pair your portable mesh nebulizer via Bluetooth Low Energy and configure home Wi-Fi.
        </Text>

        {/* Scan Action */}
        <TouchableOpacity style={styles.scanButton} onPress={startScan} disabled={scanning}>
          {scanning ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Bluetooth size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.scanButtonText}>Scan for Nearby Devices</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Success Card */}
        {isPaired && (
          <View style={styles.successCard}>
            <CheckCircle2 size={36} color="#10B981" />
            <Text style={styles.successTitle}>SmartNeb Connected ✓</Text>
            <Text style={styles.successSub}>
              Device {selectedDevice?.deviceCode} is now paired with your care account and transmitting vitals.
            </Text>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => navigation.navigate("NebulizerControl")}
            >
              <Text style={styles.doneBtnText}>Go to Nebulizer Controls</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Device Discovery List */}
        {!isPaired && (
          <View style={styles.listSection}>
            <Text style={styles.sectionHeader}>Discovered Devices ({devices.length})</Text>

            {devices.length === 0 && !scanning && (
              <View style={styles.emptyBox}>
                <Bluetooth size={36} color="#CBD5E1" />
                <Text style={styles.emptyText}>No devices detected yet. Turn on SmartNeb and tap Scan.</Text>
              </View>
            )}

            {devices.map((dev) => (
              <TouchableOpacity
                key={dev.id}
                style={styles.deviceCard}
                onPress={() => handleSelectDevice(dev)}
              >
                <View style={styles.deviceIcon}>
                  <Bluetooth size={22} color="#0284C7" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.deviceName}>{dev.name}</Text>
                  <Text style={styles.deviceCode}>Hardware ID: {dev.deviceCode}</Text>
                  <View style={styles.rssiRow}>
                    <Signal size={12} color="#10B981" />
                    <Text style={styles.rssiText}>Signal: {dev.rssi} dBm (Firmware v{dev.firmwareVersion})</Text>
                  </View>
                </View>
                <ArrowRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Wi-Fi Credential Provisioning Modal */}
      <Modal visible={showWifiModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Wifi size={24} color="#0284C7" />
              <Text style={styles.modalTitle}>Provision Wi-Fi</Text>
            </View>
            <Text style={styles.modalSub}>
              Configure 2.4GHz Wi-Fi network credentials for {selectedDevice?.deviceCode}.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Wi-Fi Network Name (SSID)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Home_WiFi_2.4G"
                value={ssid}
                onChangeText={setSsid}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Wi-Fi Password</Text>
              <TextInput
                style={styles.textInput}
                placeholder="••••••••••••"
                secureTextEntry
                value={wifiPassword}
                onChangeText={setWifiPassword}
              />
            </View>

            <View style={styles.securityNote}>
              <Lock size={14} color="#0284C7" />
              <Text style={styles.securityText}>Credentials are securely sent via BLE and never stored in plain text.</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowWifiModal(false)}
                disabled={provisioning}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pairBtn}
                onPress={handleProvisionWifi}
                disabled={provisioning}
              >
                {provisioning ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.pairBtnText}>Connect SmartNeb</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  headerSubtitle: { fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 20 },
  scanButton: {
    backgroundColor: "#0284C7",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  scanButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  listSection: { marginTop: 10 },
  sectionHeader: { fontSize: 14, fontWeight: "700", color: "#64748B", marginBottom: 12 },
  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "#94A3B8", fontSize: 13, marginTop: 10, textAlign: "center" },
  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  deviceIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E0F2FE", justifyContent: "center", alignItems: "center" },
  deviceName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  deviceCode: { fontSize: 12, color: "#64748B", marginTop: 2 },
  rssiRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  rssiText: { fontSize: 11, color: "#10B981", marginLeft: 4, fontWeight: "600" },
  successCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  successTitle: { fontSize: 20, fontWeight: "800", color: "#065F46", marginTop: 12 },
  successSub: { fontSize: 13, color: "#047857", textAlign: "center", marginTop: 6, lineHeight: 18 },
  doneBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  doneBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginLeft: 8 },
  modalSub: { fontSize: 12, color: "#64748B", marginBottom: 16 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: "#334155", marginBottom: 6 },
  textInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  securityNote: { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  securityText: { fontSize: 11, color: "#0284C7", marginLeft: 6, flex: 1 },
  modalButtons: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  cancelBtn: { flex: 0.48, paddingVertical: 12, borderRadius: 10, backgroundColor: "#E2E8F0", alignItems: "center" },
  cancelBtnText: { color: "#475569", fontWeight: "600", fontSize: 14 },
  pairBtn: { flex: 0.48, paddingVertical: 12, borderRadius: 10, backgroundColor: "#0284C7", alignItems: "center" },
  pairBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
