import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import * as Speech from 'expo-speech';

interface VoiceControllerProps {
  onCommandRecognized: (cmd: string) => void;
}

export const VoiceController: React.FC<VoiceControllerProps> = ({ onCommandRecognized }) => {
  const [isListening, setIsListening] = useState(false);

  const speak = (text: string) => {
    Speech.speak(text, { language: 'en-US', pitch: 1.0, rate: 0.9 });
  };

  const handleMicPress = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    speak('SmartNeb voice assistant active. Say a command such as Start nebulizer or Emergency SOS.');

    // Simulate voice detection menu or trigger
    setTimeout(() => {
      setIsListening(false);
      if (Platform.OS === 'web') {
        const userCmd = prompt('Voice Command input (e.g. "Start nebulizer", "Show my oxygen", "Emergency SOS"):');
        if (userCmd) {
          onCommandRecognized(userCmd.toLowerCase().trim());
          speak(`Recognized command: ${userCmd}`);
        }
      } else {
        Alert.alert(
          'SmartNeb Voice Commands',
          'Select a voice command to execute:',
          [
            { text: 'Start Nebulizer', onPress: () => onCommandRecognized('start nebulizer') },
            { text: 'Stop Nebulizer', onPress: () => onCommandRecognized('stop nebulizer') },
            { text: 'Show My Oxygen', onPress: () => onCommandRecognized('show my oxygen') },
            { text: 'Emergency SOS', onPress: () => onCommandRecognized('emergency sos') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isListening ? styles.listeningBtn : null]}
        onPress={handleMicPress}
      >
        <Text style={styles.btnText}>
          {isListening ? '🎙️ Listening...' : '🎙️ Voice Control'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  listeningBtn: {
    backgroundColor: '#ef4444',
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
