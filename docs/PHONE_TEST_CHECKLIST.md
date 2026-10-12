# Mobile App Physical Phone Testing Checklist & Guide

**Target Audience:** Mobile App Quality Assurance & Operator  
**App Profile:** SmartNeb Pediatric Nebulizer Mobile Client  
**Required Environment:** Mobile phone connected to the same local 2.4/5GHz Wi-Fi network as the developer laptop.

---

## 1. Development LAN Setup Instructions `[YOU MUST DO THIS]`

1. **Find Laptop LAN IP Address:**
   - Open PowerShell on your laptop and run `ipconfig`.
   - Record your IPv4 address (e.g., `192.168.1.50`).
2. **Configure Mobile App API Endpoint:**
   - Create or edit `mobile/.env.development`:
     ```ini
     EXPO_PUBLIC_DEV_API_URL="http://192.168.1.50:5000/api/v1"
     ```
3. **Start Development API Server:**
   - In `backend/`: ensure `.env` contains `HOST=0.0.0.0` and run `npm start`.
4. **Launch Expo Mobile App:**
   - In `mobile/`: run `npx expo start`.
   - Scan the QR code using Expo Go (Android/iOS) or install the development build (`npx expo run:android`).

---

## 2. Interactive Phone Test Scenarios & Manual Checklist

| Scenario # | Action / Step | Operator Manual Instructions `[YOU MUST DO THIS]` | Expected Result in Mobile UI | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TEST-01** | **User Registration (Sign Up)** | 1. Open app -> Click "Sign Up".<br>2. Fill Name: `Pooja Sharma`, Email: `pooja.sharma@example.com`, Password: `StrongPass123!`.<br>3. Input valid hospital invite code (or register as standalone caregiver).<br>4. Tap "Create Account". | App displays consent screen, saves token, and navigates to the Patient Dashboard. | `[ ] UNTESTED` |
| **TEST-02** | **User Login** | 1. Log out if logged in.<br>2. Enter `pooja.sharma@example.com` and `StrongPass123!`.<br>3. Tap "Log In". | Authenticates cleanly, stores JWT securely in SecureStore, and lands on home screen. | `[ ] UNTESTED` |
| **TEST-03** | **Token Refresh (Expired Token Recovery)** | 1. In `backend/.env`, set `JWT_ACCESS_EXPIRES_IN="10s"`.<br>2. Restart backend (`npm start`).<br>3. Log in on mobile.<br>4. Wait 15 seconds.<br>5. Pull down to refresh patient vitals list. | Mobile Axios interceptor receives 401, silently issues `POST /auth/refresh`, updates access token, and completes request without logging out. | `[ ] UNTESTED` |
| **TEST-04** | **Device Offline Banner** | 1. Power off the hardware device or disconnect its MQTT broker connection.<br>2. Open Patient Dashboard. | Dashboard displays top alert banner: **"Device Offline · Telemetry Stale"**. Manual start nebulizer button turns disabled/grey. | `[ ] UNTESTED` |
| **TEST-05** | **Nebulizer Start / Stop Commands** | 1. With device online, tap **"Start Nebulization"**.<br>2. Select duration: 10 mins, flow: 80%.<br>3. Tap **"Confirm & Dispatch"**.<br>4. Tap **"Stop Treatment"** after 30 seconds. | App shows status `STARTING` -> `RUNNING`. Live timer counts down. Tapping Stop transitions status to `STOPPED`. | `[ ] UNTESTED` |
| **TEST-06** | **SOS Emergency Alert Broadcast** | 1. On Dashboard, press and hold red **"SOS Emergency"** button for 3 seconds.<br>2. Tap "Confirm SOS Signal". | App issues `POST /api/v1/sos/trigger`, plays audible distress alert, and notifies assigned clinician console. | `[ ] UNTESTED` |
| **TEST-07** | **User Logout** | 1. Tap Profile Settings icon.<br>2. Tap "Log Out" -> Confirm. | Access and refresh tokens are expunged from SecureStore; user returns to login screen. | `[ ] UNTESTED` |
| **TEST-08** | **In-App Account Deletion** | 1. Open Profile Settings -> Scroll to Danger Zone.<br>2. Tap "Delete Account & Data".<br>3. Type `DELETE` to confirm. | App issues `DELETE /api/v1/auth/delete-account`, purges local cache, and redirects to login screen. | `[ ] UNTESTED` |

---

## 3. How to Verify Token Refresh Expiration in Development

To verify token refresh handling without waiting 7 days:
1. Open `backend/server.js`.
2. Locate `generateTokens` function:
   ```javascript
   const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
   ```
3. Set `JWT_EXPIRES_IN=10s` in `backend/.env`.
4. Perform an action after 10 seconds. Check mobile terminal logs (`console.log`) to observe silent token refresh interception.
