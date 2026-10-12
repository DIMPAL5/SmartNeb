# 📱 SmartNeb Mobile App Store Release & Publishing Guide

This document outlines the step-by-step procedure for building, verifying, and publishing the SmartNeb Mobile App to the **Google Play Console** (Android) and **Apple App Store Connect** (iOS).

---

## 1. EAS Build Commands

Make sure you are logged in to Expo (`npx eas login`).

### A. Android Build (.aab for Play Store & .apk for Preview)
```bash
cd mobile

# Preview Build (.apk for internal tester devices)
npx eas build --platform android --profile preview

# Production App Bundle (.aab for Google Play Store upload)
npx eas build --platform android --profile production
```

### B. iOS Build (.ipa for App Store Connect)
```bash
cd mobile

# Production IPA Build (Submits directly to TestFlight / App Store)
npx eas build --platform ios --profile production
```

---

## 2. Google Play Console Requirements Checklist

1. **App Bundle (.aab)**: Upload the signed `.aab` generated from `npx eas build --platform android --profile production`.
2. **App Details**:
   * **Title**: SmartNeb - Smart Respiratory & Nebulizer Therapy
   * **Short Description**: Real-time SpO2 monitoring and smart nebulizer therapy tracking.
   * **Category**: Health & Fitness / Medical
3. **Data Safety & Privacy Declarations**:
   * **Health Vitals**: Collected for monitoring (SpO2, Heart Rate). Encrypted in transit (HTTPS/TLS) and at rest.
   * **Account Deletion Link**: Point to `https://api.smartneb.health/delete-account` or in-app delete trigger.
4. **Target SDK**: Android 14 (API level 34+).

---

## 3. Apple App Store Connect Requirements Checklist

1. **App Metadata & Bundle ID**: `com.smartneb.health`
2. **Privacy InfoPlist Declarations**:
   * `NSCameraUsageDescription`: "SmartNeb requires camera access to scan device QR codes and associate smart nebulizers."
   * `NSBluetoothAlwaysUsageDescription`: "SmartNeb requires Bluetooth to discover and communicate with smart nebulizers."
3. **App Privacy Label**:
   * Data Collected: Health & Fitness Data, User Contact Info (Phone/Email).
   * Data Linked to User: Yes (for clinical monitoring).

---

## 4. Required Screenshots Checklist

Prepare high-resolution screenshots for both 6.5" / 5.5" iPhone screens and 10" Android tablets:

1. **Screen 1 — Patient Vitals Dashboard**: Live SpO2 %, Heart Rate, Battery status indicator.
2. **Screen 2 — Smart Nebulizer Remote Start/Stop**: Nebulization session timer and medication dose guidance.
3. **Screen 3 — Emergency SOS & High/Low Vitals Alert**: Live alert notification modal with clinician call button.
4. **Screen 4 — Daily Symptom & Therapy Journal**: Adherence streak and historical SpO2 charts.
