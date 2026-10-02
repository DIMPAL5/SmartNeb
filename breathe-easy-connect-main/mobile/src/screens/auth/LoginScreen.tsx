import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

export const LoginScreen = ({ navigation }: any) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage('Please enter email and password');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      await login(email, password);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brandTitle}>SmartNeb</Text>
          <Text style={styles.brandSubtitle}>Advanced IoT Respiratory Platform</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sign In</Text>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="user@example.com"
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

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandTitle: {
    color: '#38bdf8',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 18,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    color: '#f8fafc',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  loginButton: {
    backgroundColor: '#0284c7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 10,
  },
  demoTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  demoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  demoChipText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
});
