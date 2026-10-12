import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Keyboard,
} from "react-native";
import axios from "axios";
import { useAuth, AppRole } from "../../context/AuthContext";
import {
  getActiveApiUrl,
  setCustomApiUrl,
  resetCustomApiUrl,
  PRODUCTION_API_URL,
  LIVE_BACKEND_API_URL,
  RENDER_PRODUCTION_API_URL,
  RAILWAY_PRODUCTION_API_URL,
  getHealthEndpoint,
  formatApiUrl,
  isValidApiUrl,
} from "../../config";

export const LoginScreen = () => {
  const { login, register } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("patient");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Server Connection Configuration
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(getActiveApiUrl());
  const [testingServer, setTestingServer] = useState(false);
  const [serverStatusMessage, setServerStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setServerUrl(getActiveApiUrl());
  }, []);

  const handleTestAndSaveServer = async () => {
    if (!serverUrl || !serverUrl.trim()) {
      setServerStatusMessage("⚠️ Please enter a server URL.");
      return;
    }

    const cleanUrl = formatApiUrl(serverUrl);
    if (!isValidApiUrl(cleanUrl)) {
      setServerStatusMessage("❌ Invalid URL format. Include http:// or https:// with valid host.");
      return;
    }

    setTestingServer(true);
    setServerStatusMessage(null);
    const startTime = Date.now();

    try {
      // First attempt: /api/v1/health probe
      let healthEndpoint = getHealthEndpoint(cleanUrl);
      let res;
      try {
        res = await axios.get(healthEndpoint, { timeout: 6000 });
      } catch (err: any) {
        // Fallback attempt: root /health probe if /api/v1/health returned 404
        if (err.response?.status === 404) {
          const fallbackEndpoint = cleanUrl.replace(/\/api\/v1\/?$/, "/health");
          res = await axios.get(fallbackEndpoint, { timeout: 6000 });
        } else {
          throw err;
        }
      }

      const latencyMs = Date.now() - startTime;
      await setCustomApiUrl(cleanUrl);
      setServerUrl(cleanUrl);

      const status = res.data?.status || "online";
      const env = res.data?.environment ? ` (${res.data.environment})` : "";
      setServerStatusMessage(
        `✅ Connected successfully!\n• Status: ${status}${env}\n• Latency: ${latencyMs}ms\n• Saved: ${cleanUrl}`
      );
    } catch (err: any) {
      const isPlainHttp = cleanUrl.startsWith("http://");
      let hint = "";
      if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        hint = "Request timed out. Server may be down, sleeping, or firewalled.";
      } else if (!err.response) {
        hint = isPlainHttp
          ? "Network unreachable. Verify server is running and device is on same network (or uses cleartext HTTP)."
          : "Network error. Verify internet connection, DNS resolution, and SSL certificates.";
      } else {
        hint = `Server responded with HTTP ${err.response.status}.`;
      }
      setServerStatusMessage(`❌ Connection failed: ${hint}`);
    } finally {
      setTestingServer(false);
    }
  };

  const handleResetToDefaultServer = async () => {
    try {
      const defaultUrl = await resetCustomApiUrl();
      setServerUrl(defaultUrl);
      setServerStatusMessage(`🔄 Reverted to default cloud endpoint:\n${defaultUrl}`);
    } catch {
      setServerUrl(PRODUCTION_API_URL);
      setServerStatusMessage(`🔄 Reverted to cloud endpoint:\n${PRODUCTION_API_URL}`);
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!email || !password) {
      const msg = "Please enter both email address and password.";
      setErrorMessage(msg);
      Alert.alert("Required Fields Missing", msg);
      return;
    }

    if (isRegistering && !fullName) {
      const msg = "Please enter your full name to create an account.";
      setErrorMessage(msg);
      Alert.alert("Required Fields Missing", msg);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      if (isRegistering) {
        await register(email, password, fullName, role);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      let msg = "";
      if (!err.response) {
        msg = `Network connection failed.\nCould not reach server at:\n${getActiveApiUrl()}\n\nTip: Tap '⚙️ Server Connection Settings' below to test latency or select 'Live Cloud'.`;
      } else {
        msg =
          err.response?.data?.error ||
          (isRegistering ? "Registration failed. Please try again." : "Login failed. Please check credentials.");
      }
      setErrorMessage(msg);
      Alert.alert(isRegistering ? "Registration Failed" : "Sign In Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brandTitle}>SmartNeb</Text>
          <Text style={styles.brandSubtitle}>Advanced IoT Respiratory Platform</Text>
        </View>

        <View style={styles.formCard}>
          {/* Mode Switcher Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, !isRegistering && styles.tabActive]}
              onPress={() => {
                setIsRegistering(false);
                setErrorMessage("");
              }}
            >
              <Text style={[styles.tabText, !isRegistering && styles.tabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, isRegistering && styles.tabActive]}
              onPress={() => {
                setIsRegistering(true);
                setErrorMessage("");
              }}
            >
              <Text style={[styles.tabText, isRegistering && styles.tabTextActive]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {isRegistering && (
            <>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="#64748b"
                value={fullName}
                onChangeText={setFullName}
              />
            </>
          )}

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {isRegistering && (
            <>
              <Text style={styles.label}>Account Role</Text>
              <View style={styles.rolePickerRow}>
                {(["patient", "doctor", "caregiver"] as AppRole[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, role === r && styles.roleChipActive]}
                    onPress={() => setRole(r)}
                  >
                    <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRegistering ? "Create Account" : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleModeButton}
            onPress={() => {
              setIsRegistering(!isRegistering);
              setErrorMessage("");
            }}
          >
            <Text style={styles.toggleModeText}>
              {isRegistering
                ? "Already have an account? Sign In"
                : "Don't have an account? Create Account"}
            </Text>
          </TouchableOpacity>

          {/* Collapsible Server Connection Config */}
          <View style={styles.serverConfigContainer}>
            <TouchableOpacity
              style={styles.serverConfigToggle}
              onPress={() => setShowServerConfig(!showServerConfig)}
            >
              <Text style={styles.serverConfigToggleText}>
                {showServerConfig ? "Hide Server Settings ▲" : "⚙️ Server Connection Settings ▼"}
              </Text>
            </TouchableOpacity>

            {showServerConfig && (
              <View style={styles.serverConfigBox}>
                <Text style={styles.serverConfigHelp}>
                  Configure backend server URL (Cloud API or Local/Staging):
                </Text>
                <TextInput
                  style={styles.serverInput}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="https://api.smartneb.health/api/v1"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.presetRow}>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => setServerUrl(LIVE_BACKEND_API_URL)}
                  >
                    <Text style={styles.presetChipText}>Live Cloud</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => setServerUrl(RENDER_PRODUCTION_API_URL)}
                  >
                    <Text style={styles.presetChipText}>Render</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => setServerUrl(RAILWAY_PRODUCTION_API_URL)}
                  >
                    <Text style={styles.presetChipText}>Railway</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.serverButtonRow}>
                  <TouchableOpacity
                    style={[styles.testServerButton, styles.serverButtonFlex]}
                    onPress={handleTestAndSaveServer}
                    disabled={testingServer}
                  >
                    {testingServer ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.testServerButtonText}>Test & Save</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.resetServerButton, styles.serverButtonFlex]}
                    onPress={handleResetToDefaultServer}
                    disabled={testingServer}
                  >
                    <Text style={styles.resetServerButtonText}>Reset to Default</Text>
                  </TouchableOpacity>
                </View>
                {serverStatusMessage ? (
                  <View style={styles.serverStatusCard}>
                    <Text style={styles.serverStatusText}>{serverStatusMessage}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  brandTitle: {
    color: "#38bdf8",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 1,
  },
  brandSubtitle: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#334155",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#0284c7",
  },
  tabText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  label: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 14,
    color: "#f8fafc",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#334155",
  },
  rolePickerRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  roleChipActive: {
    borderColor: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  roleChipText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  roleChipTextActive: {
    color: "#38bdf8",
    fontWeight: "700",
  },
  submitButton: {
    backgroundColor: "#0284c7",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  toggleModeButton: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 6,
  },
  toggleModeText: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "600",
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    marginBottom: 12,
  },
  errorText: {
    color: "#f87171",
    fontSize: 12,
    lineHeight: 18,
  },
  serverConfigContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 14,
  },
  serverConfigToggle: {
    alignItems: "center",
    paddingVertical: 4,
  },
  serverConfigToggleText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
  },
  serverConfigBox: {
    marginTop: 10,
    backgroundColor: "#0f172a",
    padding: 12,
    borderRadius: 12,
  },
  serverConfigHelp: {
    color: "#94a3b8",
    fontSize: 11,
    marginBottom: 8,
  },
  serverInput: {
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  presetChip: {
    flex: 1,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  presetChipText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
  },
  serverButtonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  serverButtonFlex: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  testServerButton: {
    backgroundColor: "#0284c7",
  },
  testServerButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  resetServerButton: {
    backgroundColor: "#334155",
    borderWidth: 1,
    borderColor: "#475569",
  },
  resetServerButtonText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "500",
  },
  serverStatusCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderWidth: 1,
    borderColor: "#334155",
  },
  serverStatusText: {
    fontSize: 11,
    color: "#f1f5f9",
    lineHeight: 16,
  },
});
