# SmartNeb — Physical Mobile App Publishing & Deployment Guide

This guide details the complete process to build, test on physical devices, and publish the **SmartNeb** mobile app to the **Google Play Store (Android)** and **Apple App Store (iOS)**.

---

## Table of Contents
1. [Prerequisites & Account Setup](#1-prerequisites--account-setup)
2. [Route A: Immediate Physical Device Testing (No Store Required)](#2-route-a-immediate-physical-device-testing-no-store-required)
3. [Route B: Google Play Store Release (Android AAB)](#3-route-b-google-play-store-release-android-aab)
4. [Route C: Apple App Store Release (iOS IPA / TestFlight)](#4-route-c-apple-app-store-release-ios-ipa--testflight)
5. [Configuring Physical Device Backend Connectivity](#5-configuring-physical-device-backend-connectivity)
6. [App Store Compliance & Medical App Regulations](#6-app-store-compliance--medical-app-regulations)
7. [Automated CI/CD Workflow](#7-automated-cicd-workflow)

---

## 1. Prerequisites & Account Setup

### Required Tools
Install the Expo Application Services (EAS) CLI globally:
```bash
npm install -g eas-cli
```

Verify your installation:
```bash
eas --version
```

### Expo Developer Account
Create a free account at [expo.dev](https://expo.dev) if you haven't already. Log in from your terminal:
```bash
eas login
```

Verify the login status:
```bash
eas whoami
```

---

## 2. Route A: Immediate Physical Device Testing (No Store Required)

To install SmartNeb immediately on any real Android smartphone without going through Google review or waiting for testing periods:

### Step 1: Set Your Backend IP
On a physical device, `http://localhost:5000` will **not** work. Set your computer's local Wi-Fi IP address or live server domain in `mobile/.env`:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.X:5000/api/v1
```
*(Replace `192.168.1.X` with your machine's local IPv4 from `ipconfig`)*

### Step 2: Build the Standalone APK
Navigate to the mobile directory and trigger the preview build:
```bash
cd breathe-easy-connect-main/mobile
eas build --platform android --profile preview
```

### Step 3: Install on Device
1. Once the build finishes on Expo servers, EAS outputs a QR code and a direct download URL.
2. Scan the QR code or open the link on your Android phone.
3. Download the `.apk` file.
4. When prompted by Android, tap **"Install from unknown sources / Allow this source"**.
5. Tap **Install** and open **SmartNeb**.

---

## 3. Route B: Google Play Store Release (Android AAB)

### 3.1 Developer Account & Verification (2024–2026 Policies)
1. **Sign Up**: Register at [Google Play Console](https://play.google.com/console) ($25 USD one-time registration fee).
2. **Identity Verification**:
   - Government-issued photo ID (Passport, National ID, Driver's License).
   - Proof of physical address (Utility bill, bank statement within 60–90 days).
   - Phone and email verification.
3. **Mandatory 20-Tester Closed Testing (Personal Accounts)**:
   - For accounts created after November 13, 2023, Google requires **at least 20 testers** enrolled in a closed test track for **14 consecutive days**.
   - Testers must actively opt in and keep the app installed.
   - After 14 days, the **"Apply for Production"** button is unlocked in the Play Console.

### 3.2 Build the Production App Bundle (.aab)
Google Play requires an Android App Bundle (`.aab`):
```bash
cd breathe-easy-connect-main/mobile
eas build --platform android --profile production
```
*Note: On your first build, EAS will automatically generate and securely manage your Android Keystore on Expo Cloud.*

### 3.3 Google Play Console Submission
1. Go to **Google Play Console** -> **Create App**.
   - **App Name**: `SmartNeb`
   - **Default Language**: English (United States)
   - **App or Game**: App
   - **Free or Paid**: Free
2. Upload the downloaded `.aab` file to **Production** (or **Closed Testing**).
3. **App Content Declarations**:
   - **Health Apps**: Declare as *Health Tracking & Connected Medical Device Accessory*. Provide the clinical adherence disclaimer.
   - **Data Safety**: Declare Health info (vitals, sessions), Personal info (Email, Phone), Device Identifiers (Push tokens), Location (Bluetooth discovery). Confirm all data is encrypted in transit (TLS/HTTPS).
   - **Account Deletion**: Enter the mandatory web deletion URL: `https://your-domain.com/delete-account` (already implemented in the web portal).
   - **Privacy Policy**: Enter `https://your-domain.com/privacy`.
4. Submit for review!

---

## 4. Route C: Apple App Store Release (iOS IPA / TestFlight)

### 4.1 Apple Developer Account
1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99 USD / year).
2. Create an App ID in [Apple Developer Portal](https://developer.apple.com/account/) matching the bundle identifier `health.smartneb.app`.

### 4.2 Build for iOS
Run the production build:
```bash
cd breathe-easy-connect-main/mobile
eas build --platform ios --profile production
```
EAS will prompt you to log into your Apple Developer account to generate:
- Distribution Certificate
- Provisioning Profile
- Push Notification APNs Key

### 4.3 Submit to TestFlight & App Store
Submit the build directly from the CLI:
```bash
eas submit --platform ios
```
1. Open [App Store Connect](https://appstoreconnect.apple.com).
2. In **TestFlight**, add internal and external testers to test on physical iPhones.
3. Complete **App Store Information**, screenshots, privacy nutrition labels, and medical disclaimers (Guideline 1.4.1/1.4.5).
4. Click **Submit for Review**.

---

## 5. Configuring Physical Device Backend Connectivity

| Environment | Backend API URL | Configuration Location |
| :--- | :--- | :--- |
| **Local Device Wi-Fi** | `http://192.168.1.X:5000/api/v1` | `mobile/.env` or `eas.json` (Preview profile) |
| **Cloudflare Tunnel / ngrok** | `https://xxxx.ngrok-free.app/api/v1` | `mobile/.env` (Great for remote testing without port-forwarding) |
| **Production Cloud** | `https://api.smartneb.health/api/v1` | `mobile/.env` or `eas.json` (Production profile) |

---

## 6. App Store Compliance & Medical App Regulations

### Medical & Health Disclaimers
Both Google Play and Apple App Store strictly regulate health applications. The app and store descriptions must include:
> **Disclaimer**: *SmartNeb is an intelligent adherence tracking and pediatric respiratory monitoring companion intended to assist caregivers in tracking nebulizer sessions and vital signs. SmartNeb is not an autonomous diagnostic medical device and does not provide clinical diagnoses or replace professional medical consultation.*

### Account Deletion
Mandatory for both stores:
- **In-App**: Accessible via Caregiver Settings -> Delete Account.
- **Web URL**: Provide `https://<YOUR_DOMAIN>/delete-account` in the Store Data Safety forms.

### System Permissions Declared in `app.json`:
- `NSBluetoothAlwaysUsageDescription` / `BLUETOOTH_CONNECT`: Pair and communicate with SmartNeb ESP32 hardware.
- `NSCameraUsageDescription` / `CAMERA`: Scan medication barcodes and ampoules.
- `NSMicrophoneUsageDescription` / `RECORD_AUDIO`: Telehealth consultations.
- `POST_NOTIFICATIONS`: Critical SpO2 and treatment adherence alerts.
