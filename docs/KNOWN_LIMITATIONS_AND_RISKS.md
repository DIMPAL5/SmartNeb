# Known Limitations, Safety Boundaries & Regulatory Risk Analysis

**Product:** SmartNeb Autonomous Pediatric Smart Nebulizer & Connected Platform  
**Document Type:** Engineering & Risk Governance Assessment  
**Classification:** Confidential — Internal Risk Register  
**Revision:** 2026.1  

---

## 1. Physical Hardware & Firmware Edge-Case Risks

### 1.1 Firmware Wi-Fi Reconnection & AP Deauthentication
- **Risk:** When home Wi-Fi access points reboot, change 2.4 GHz channels, or experience signal drops, the ESP32 standard Wi-Fi station library can hang in `WIFI_DISCONNECTED` or loop in `SYSTEM_EVENT_STA_DISCONNECTED`.
- **Engineering Mitigation:** The firmware must utilize an automated FreeRTOS hardware watchdog (WDT) and an exponential backoff reconnect task. If reconnection fails after 180 seconds, the device must fail-safe into a standalone physical mode.
- **Residual Risk:** During an active Wi-Fi outage, real-time SpO2 and pulse telemetry cannot reach the mobile app or clinician dashboard.

### 1.2 Device Offline During Remote Command Dispatch
- **Risk:** A caregiver or clinician attempts to trigger or halt a nebulizer treatment remotely while the device is in a transient network black hole.
- **Mitigation Implemented:** The backend's command engine explicitly rejects dispatch with `409 Conflict ("Device offline")` instead of silently queuing stale commands. Commands carry a 30-second TTL (Time to Live) and an `idempotencyKey` to prevent double-activation upon reconnect.
- **Residual Safety Constraint:** **Never rely on cloud commands for patient safety.** The physical hardware MUST feature a hardwired tactile push-button directly wired to the piezoelectric nebulizer driver circuit that immediately cuts power regardless of MCU or Wi-Fi state.

### 1.3 Network Latency During Nebulizer "Stop" Command
- **Risk:** Cellular or Wi-Fi jitter can introduce 500 ms to 10 seconds of round-trip latency for an in-app "Stop" command.
- **Safety Directive:** In medical device engineering, software-over-the-air can never serve as a primary emergency stop. The parent/caregiver must always be physically present during pediatric nebulization.

---

## 2. Sensor Accuracy & Clinical Validation Gaps

### 2.1 Low-Cost Optical Sensors vs. Clinical Grade Oximetry
- **Risk:** The project utilizes commercial optical sensors (e.g., MAX30102 / MAX30100). These sensors:
  - Are susceptible to ambient light interference (fluorescent lights, direct sunlight).
  - Produce severe motion artifacts when a restless or crying child moves their hand.
  - Do not possess calibration curves validated across diverse skin pigmentation levels.
- **Clinical Reality:** These readings **cannot** be used for clinical diagnosis of hypoxemia. They are trend indicators only.
- **Required Action:** The hardware requires formal clinical benchmarking against reference pulse oximeters (e.g., Masimo SET or Nellcor) across pediatric cohorts before any diagnostic claims can be legally asserted.

### 2.2 Nebulizer Particle Size (MMAD) & Flow Rate Certification
- **Risk:** Therapeutic aerosol delivery requires a Mass Median Aerodynamic Diameter (MMAD) between 1 and 5 microns to deposit medication into pediatric lower airways (bronchioles and alveoli). Larger droplets deposit in the oropharynx, reducing efficacy.
- **Engineering Limitation:** Mesh erosion, liquid viscosity differences (e.g., Budesonide vs. Salbutamol vs. hypertonic saline), and piezoelectric voltage fluctuations alter droplet size.
- **Mitigation:** The device requires laboratory laser diffraction aerosol characterization (e.g., via Malvern Spraytec) prior to medical device classification.

---

## 3. Regulatory & Legal Compliance Risks

### 3.1 Medical Device Classification (CDSCO - India)
- **Status:** **NOT YET MEDICALLY CERTIFIED.**
- **Regulatory Framework:** Under India's Medical Devices Rules (MDR 2017) enforced by the Central Drugs Standard Control Organisation (CDSCO):
  - Nebulizers are regulated as **Class B (Low-to-Moderate Risk) Medical Devices**.
  - Software that analyzes vitals and controls dosage is classified as **Software as a Medical Device (SaMD)**.
- **Exposure:** Manufacturing or commercially distributing a medical device in India without a CDSCO MD-5 (manufacturing license) or MD-15 (import license) carries criminal penalties under the Drugs and Cosmetics Act.
- **Required Strategy:** Launch the mobile app and device strictly under the definition of an **"Educational and Care-Tracking Aid"** until formal CDSCO Class B certification is audited and granted.

### 3.2 US FDA & EU CE-MDR Position
- **US FDA:** A smart nebulizer is regulated under 21 CFR 868.5630 (Nebulizer, Class II, requires 510(k) premarket notification). Software controlling drug delivery cannot qualify for FDA enforcement discretion.
- **EU MDR (2017/745):** Falls under Rule 11 of Annex VIII (software intended to monitor physiological processes or provide information for therapeutic decisions), requiring a Class IIa or IIb Notified Body audit.

### 3.3 India Digital Personal Data Protection Act (DPDP 2023)
- **Special Scrutiny on Pediatric Data (Section 9):** Processing personal data of minors (under 18 years of age) requires:
  - Verifiable consent of the parent or lawful guardian.
  - Absolute prohibition on behavioral monitoring, tracking, or targeted advertising directed at children.
- **Mitigation Implemented:** Schema and API endpoints enforce `isMinor: true` and record timestamped `guardianConsentAt`.
- **Legal Exposure Outside Software:** The operator must draft a formal Data Processing Agreement (DPA) with each participating hospital and maintain an offline register of Data Principals.

---

## 4. Cloud Infrastructure & Multi-Tenant Operating Risks

### 4.1 Single Broker Bottleneck
- **Risk:** Deploying a single-node EMQX or Mosquitto MQTT broker on a single VPS creates a single point of failure (SPOF). If the broker process crashes, all real-time device updates halt.
- **Operational Recommendation:** In high-traffic production, transition to an EMQX 3-node Raft cluster or AWS IoT Core with managed high availability.

### 4.2 Database Connection Pool Exhaustion
- **Risk:** High concurrency during peak clinic hours (hundreds of active Socket.IO connections and concurrent patient vitals writes) can exhaust the MySQL connection pool.
- **Mitigation:** Prisma connection pooling is set with conservative connection limits and statement timeouts. Read-heavy analytics (historical charts) should be routed to a read-replica in phase 2.
