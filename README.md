# 🫁 SmartNeb — Connected Smart Nebulizer & IoT Respiratory Healthcare Platform

[![Build Status](https://img.shields.io/badge/Build-Production%20v2.0.6-brightgreen.svg)](#)
[![Hardware](https://img.shields.io/badge/Hardware-ESP32%20%7C%20MAX30102%20%7C%20BMS-blue.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20Prisma-orange.svg)](#)
[![Mobile](https://img.shields.io/badge/Mobile-React%20Native%20%7C%20Expo-61DAFB.svg)](#)
[![Cloud](https://img.shields.io/badge/Cloud-Render%20Live-success.svg)](#)

> **SmartNeb** transforms traditional nebulizer therapy into an intelligent, connected medical platform. It combines a **custom-engineered smart nebulizer built from scratch**, an onboard **Battery Management System (BMS)**, **continuous biometric pulse oximetry (SpO2 & Heart Rate)**, and a **cloud-synchronized mobile and web platform** with real-time clinical monitoring, automated emergency alerts, and an AI pulmonology assistant.

---

## 📑 Table of Contents
- [System Architecture](#-system-architecture)
- [Hardware Engineering (Built From Scratch)](#-hardware-engineering-built-from-scratch)
  - [1. Custom Nebulizer Mechanism](#1-custom-nebulizer-mechanism)
  - [2. Intelligent Battery Management System (BMS)](#2-intelligent-battery-management-system-bms)
  - [3. Integrated Health & Biometric Sensors](#3-integrated-health--biometric-sensors)
  - [4. Complete Circuit Pinout & Wiring Table](#4-complete-circuit-pinout--wiring-table)
  - [5. Patient Safety & Hardware Fail-Safes](#5-patient-safety--hardware-fail-safes)
- [Software & Cloud Architecture](#-software--cloud-architecture)
  - [SmartNeb Mobile App (Android / iOS)](#smartneb-mobile-app)
  - [Doctor Clinical Command Center (Web)](#doctor-clinical-command-center-web)
  - [Cloud Backend, Telemetry Broker & AI Engine](#cloud-backend-telemetry-broker--ai-engine)
- [Data Storage & Security](#-data-storage--security)
- [Quick Start & Setup Instructions](#-quick-start--setup-instructions)
  - [Firmware Flashing (ESP32)](#1-firmware-flashing-esp32)
  - [Backend Server Setup](#2-backend-server-setup)
  - [Mobile App Installation (Direct APK)](#3-mobile-app-installation-direct-apk)
- [Default Demo Credentials](#-default-demo-credentials)
- [License & Authors](#-license--authors)

---

## 🏗️ System Architecture

```mermaid
flowchart LR
    subgraph Hardware ["🔌 Physical IoT Device (Built from Scratch)"]
        Sensors["MAX30102 Sensor (SpO2 & HR)"]
        BMS["3.7V Li-ion + TP4056 BMS Circuit"]
        Relay["Ultrasonic Micro-Mesh Nebulizer Core"]
        ESP["ESP32 Microcontroller"]
        Sensors --> ESP
        BMS --> ESP
        ESP --> Relay
    end

    subgraph Cloud ["☁️ Cloud & Real-time Layer (Render)"]
        MQTT["MQTT Telemetry Broker"]
        API["Node.js / Express REST API"]
        DB[(Cloud Managed Database)]
        Gemini["Google Gemini AI Engine"]
        ESP -- "MQTTS / WebSockets" --> MQTT
        MQTT --> API
        API <--> DB
        API <--> Gemini
    end

    subgraph Clients ["📱 Multi-Role Applications"]
        Mobile["SmartNeb Mobile App (Patient & Caregiver)"]
        WebPortal["Doctor & Admin Clinical Portal"]
        API <--> Mobile
        API <--> WebPortal
    end
