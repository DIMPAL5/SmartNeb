# Cloud Infrastructure Cost Estimates & Hosting Architecture

**Review Date:** October 2026  
**Pricing Basis:** Current published provider tariffs (AWS, Hetzner, DigitalOcean, Twilio, Cloudflare)  
**Currency:** USD ($) / INR (₹) converted at ~₹85/$1  

---

## 1. Usage Tier Definitions

- **Tier 1: Low Usage Pilot**
  - 1 Hospital / Clinic
  - 15 Active Hardware Devices
  - 150 Registered Patients
  - ~30 Treatment Sessions / Day
  - ~100,000 MQTT telemetry messages / month
- **Tier 2: Medium Usage Multi-Hospital Production**
  - 12 Hospitals
  - 300 Active Hardware Devices
  - 5,000 Registered Patients
  - ~1,200 Treatment Sessions / Day
  - ~5,000,000 MQTT telemetry messages / month

---

## 2. Comprehensive Cost Estimate Comparison Table

| Infrastructure Component | Provider & Tier Recommendation | Low Usage (Pilot) Monthly Cost | Medium Usage Monthly Cost | Pricing Verification Status |
| :--- | :--- | :---: | :---: | :--- |
| **Backend API Host** | Hetzner Cloud (CPX21: 2 vCPU, 4GB RAM) vs AWS EC2 (t4g.small) | **$8.00 / mo** (Hetzner) | **$24.00 / mo** (DigitalOcean 4GB Droplet or Hetzner CPX31) | **VERIFIED** (Hetzner €7.05/mo; DO $24/mo) |
| **Managed MySQL Database** | DigitalOcean Managed MySQL (1GB RAM) vs AWS RDS MySQL (db.t4g.micro) | **$15.00 / mo** (DO Managed) or **$0** (co-hosted on VPS in pilot) | **$60.00 / mo** (DO Managed 4GB HA or AWS RDS db.t3.small with daily snapshots) | **VERIFIED** (DigitalOcean Managed DB starts at $15/mo) |
| **MQTT Broker** | Self-hosted EMQX on VPS vs EMQX Cloud Serverless | **$0.00 / mo** (Co-hosted on VPS) or **$5.00 / mo** (EMQX Serverless) | **$25.00 / mo** (EMQX Dedicated or $0 if containerized on VPS cluster) | **VERIFIED** (EMQX Cloud free tier covers 1M messages/mo; $0.15/GB above) |
| **Push Notifications** | Firebase Cloud Messaging (FCM) + Apple APNs | **$0.00 / mo** (100% Free Unlimited) | **$0.00 / mo** (100% Free Unlimited) | **VERIFIED** (Google FCM has no monthly charge for push delivery) |
| **Email Service (Transactional)** | Resend / SendGrid / Amazon SES | **$0.00 / mo** (Resend free tier: 3,000 emails/mo) | **$5.00 / mo** (AWS SES: $0.10 per 1,000 emails) | **VERIFIED** (Resend 3k free; AWS SES $0.10/1k) |
| **SMS OTP Verification** | Twilio (Global) / MSG91 (India) | **$4.00 / mo** (MSG91 ₹0.22/SMS for 1,500 OTPs) | **$35.00 / mo** (MSG91 ~12,000 OTPs) | **ESTIMATED** (Based on 2 OTPs per login/signup) |
| **Cloud Storage (Backups/PDFs)** | Cloudflare R2 (Zero egress fees) | **$0.00 / mo** (First 10 GB free) | **$1.50 / mo** (~100 GB storage + backups) | **VERIFIED** ($0.015/GB-month, 0 egress fee) |
| **Public Domain & DNS** | Cloudflare Registrar (.health / .com / .org) | **$1.25 / mo** ($15 / year) | **$1.25 / mo** ($15 / year) | **VERIFIED** |
| **Error Monitoring** | Sentry Developer Plan | **$0.00 / mo** (Free up to 5,000 events/mo) | **$26.00 / mo** (Team Plan up to 50,000 errors) | **VERIFIED** (Sentry published pricing) |
| **TOTAL ESTIMATED MONTHLY** | — | **~$28.25 / month** (₹2,400 / mo) | **~$177.75 / month** (₹15,100 / mo) | — |

---

## 3. High-Value Cost Optimization Strategies

1. **Phase 1 Pilot Co-Location:**
   During initial hospital closed testing (Tier 1), run Nginx, Node.js API, EMQX MQTT Broker, and MySQL within isolated Docker containers on a single 4 GB RAM VPS ($8–$12/month). This cuts pilot infrastructure costs to **under $20/month total**.
2. **Cloudflare Free Tier:**
   Cloudflare DNS, SSL termination, DDoS mitigation, and WebSocket proxying are 100% free with unlimited bandwidth.
3. **SMS vs. WhatsApp/Email Verification in India:**
   In India, DLT (Distributed Ledger Technology) registration for SMS headers requires telecom approvals and per-SMS telecom scrubbing fees. Using WhatsApp Business API or Email magic links for verification reduces pilot onboarding friction to zero cost.
