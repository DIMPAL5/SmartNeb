/**
 * VoiceGuidanceService
 * Multilingual pediatric voice coach powered by expo-speech.
 * Speaks breathing prompts, encouragement, and alerts in child's selected language.
 */

import * as Speech from "expo-speech";
import { SupportedLanguage, getTranslation } from "../i18n";

const LANGUAGE_VOICE_CODES: Record<SupportedLanguage, string> = {
  en: "en-US",
  hi: "hi-IN",
  kn: "kn-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
};

export class VoiceGuidanceService {
  private static currentLanguage: SupportedLanguage = "en";
  private static isMuted: boolean = false;

  static setLanguage(lang: SupportedLanguage) {
    this.currentLanguage = lang;
  }

  static getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  static setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      Speech.stop();
    }
  }

  static getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Speak a localized prompt key
   */
  static speak(key: string, customText?: string) {
    if (this.isMuted) return;

    const textToSpeak = customText || getTranslation(key, this.currentLanguage);
    const languageCode = LANGUAGE_VOICE_CODES[this.currentLanguage] || "en-US";

    try {
      Speech.stop();
      Speech.speak(textToSpeak, {
        language: languageCode,
        pitch: 1.15, // Friendly, warm tone for pediatric comfort
        rate: 0.9,   // Gentle, steady pacing
      });
    } catch (err) {
      console.warn("Speech error:", err);
    }
  }

  static stop() {
    try {
      Speech.stop();
    } catch (err) {
      // ignore
    }
  }
}
