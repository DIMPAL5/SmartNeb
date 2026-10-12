# SmartNeb Mobile Push Notifications & FCM/APNs Setup Guide

This document outlines how SmartNeb configures, registers, and handles push notifications for emergency SOS alerts, vital telemetry warnings, and treatment reminders.

---

## 1. Firebase Cloud Messaging (FCM for Android)

### Step 1: Firebase Project Setup
1. Go to the [Firebase Console](https://console.firebase.google.com/) and select your project.
2. Register your Android app package: `health.smartneb.app`.
3. Download `google-services.json` and place it in `mobile/google-services.json`.

### Step 2: Configure Expo Credentials
1. Run Expo Application Services (EAS) CLI:
   ```bash
   eas credentials -p android
   ```
2. Upload the Service Account JSON key from Firebase Console -> Project Settings -> Service Accounts.

---

## 2. Apple Push Notification Service (APNs for iOS)

### Step 1: Apple Developer Portal
1. In the [Apple Developer Portal](https://developer.apple.com/), create an **APNs Key** (`.p8`).
2. Record the **Key ID** and **Team ID**.

### Step 2: Configure EAS Credentials for iOS
1. Run EAS CLI:
   ```bash
   eas credentials -p ios
   ```
2. Upload the `.p8` key and provide the Key ID and Team ID.

---

## 3. Expo Background Notifications Architecture

When the mobile app is **backgrounded or closed**:
1. Expo Notifications (`expo-notifications`) intercepts high-priority FCM/APNs messages.
2. The notification handler in `mobile/App.tsx` routes emergency alerts (`type: "LOW_SPO2"` or `type: "SOS_EMERGENCY"`) to high-priority system channels with custom alert sounds and vibration patterns.
3. Tapping the notification automatically launches the SmartNeb app and navigates to the Emergency Alert details screen.
