import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

export const AIAssistantScreen = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Hello ${user?.fullName || 'there'}! I am SmartNeb AI Assistant. How can I help you analyze your respiratory health or nebulizer sessions today?`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: query };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await apiClient.post('/ai/ask', {
        question: query,
        targetPatientId: user?.patientId
      });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: res.data?.answer || 'SmartNeb AI processed your request.'
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Sorry, I am temporarily unable to reach the AI server. Please try again shortly.'
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>SmartNeb AI Assistant</Text>
        <Text style={styles.disclaimer}>Informational assistant • Not a substitute for clinical advice</Text>
      </View>

      <ScrollView style={styles.chatArea} contentContainerStyle={styles.chatScroll}>
        {messages.map((m) => (
          <View
            key={m.id}
            style={[
              styles.bubble,
              m.sender === 'user' ? styles.userBubble : styles.aiBubble
            ]}
          >
            <Text style={styles.senderLabel}>{m.sender === 'user' ? 'You' : 'SmartNeb AI'}</Text>
            <Text style={styles.bubbleText}>{m.text}</Text>
          </View>
        ))}
        {loading ? (
          <View style={[styles.bubble, styles.aiBubble]}>
            <ActivityIndicator color="#38bdf8" />
          </View>
        ) : null}
      </ScrollView>

      {/* Suggested Prompts */}
      <View style={styles.promptRow}>
        <TouchableOpacity style={styles.promptChip} onPress={() => sendMessage('Summarize my vitals today.')}>
          <Text style={styles.chipText}>Summarize Vitals</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.promptChip} onPress={() => sendMessage('How was my nebulization adherence?')}>
          <Text style={styles.chipText}>Check Adherence</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.promptChip} onPress={() => sendMessage('Show my SpO2 trend.')}>
          <Text style={styles.chipText}>SpO2 Trend</Text>
        </TouchableOpacity>
      </View>

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask AI about vitals, adherence..."
          placeholderTextColor="#64748b"
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage()}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 18,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
  },
  disclaimer: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  chatArea: {
    flex: 1,
  },
  chatScroll: {
    padding: 16,
  },
  bubble: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: '#0284c7',
    alignSelf: 'flex-end',
  },
  aiBubble: {
    backgroundColor: '#1e293b',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#334155',
  },
  senderLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  bubbleText: {
    color: '#f8fafc',
    fontSize: 14,
    lineHeight: 20,
  },
  promptRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  promptChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 10,
  },
  sendText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
