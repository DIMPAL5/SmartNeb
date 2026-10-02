# Breathe Easy Connect

SMARTNEBU — ADVANCED IoT RESPIRATORY THERAPY PLATFORM
Build a complete, production-quality, professional healthcare IoT web application called SmartNeb.
SmartNeb is an IoT-powered smart nebulizer and respiratory therapy monitoring platform connected to an ESP32, MQTT/IoT cloud infrastructure, MySQL database, and a modern web application.
This is NOT a simple dashboard.
It must be a complete interconnected platform covering:
Real-time health monitoring
Smart nebulizer control
ESP32 device monitoring
MQTT/cloud telemetry
Patient management
Doctor management
Caregiver support
Medication/care plans
Medication adherence
Emergency SOS
Threshold alerts
Notifications
Battery/device monitoring
Clinical reports
Analytics
Voice control
Gemini AI assistant
Multi-patient management
Secure role-based access control
Device management
Audit logging
The final product should look and feel like a premium healthcare IoT SaaS platform, not a generic hospital website or basic CRUD application.

1. CORE PRODUCT WORKFLOW
   The central product workflow is:
   SENSE → CONNECT → MONITOR → ANALYZE → ALERT → TREAT → TRACK → REPORT
   Physical/IoT architecture:
   Sensors
   ↓
   ESP32
   ↓
   MQTT
   ↓
   IoT Cloud / ThingsBoard
   ↓
   Backend API
   ↓
   MySQL
   ↓
   React Web Application

The application must have a single source of truth for users, patients, devices, care plans, telemetry, sessions, alerts, adherence, reports, and audit records.
Do NOT create disconnected dashboards with hard-coded data.
All roles must work with shared database entities and relationships. 2. TECHNOLOGY STACK
Use this technology stack.
Frontend
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
Lucide React
Framer Motion
Chart.js or Recharts
React Router
TanStack Query
React Hook Form
Zod
Backend
Use:
Node.js
Express.js
TypeScript
Prisma ORM
Database
Use:
MySQL
IMPORTANT:
Do NOT use Supabase.
Do NOT use PostgreSQL.
Do NOT replace MySQL with another database.
All persistent application data must be stored in MySQL.
Use Prisma ORM for:
Schema
Migrations
Queries
Relationships
Validation support
Real-Time Communication
Use:
MQTT for IoT telemetry
WebSockets / Socket.IO for browser real-time events
Authentication
Use secure backend authentication with:
JWT access tokens
Refresh tokens
Secure password hashing
bcrypt/argon2
Protected routes
Role-based authorization
Never store plain-text passwords.
AI
Use Gemini through a secure backend endpoint:
/api/v1/ai/ask
Never expose Gemini API keys in frontend code. 3. ARCHITECTURE
Use a clean separation:
Frontend
React + TypeScript
↓
REST API / WebSocket
↓
Node.js + Express
↓
Service Layer
↓
Prisma ORM
↓
MySQL

IoT:
ESP32
↓
MQTT
↓
IoT Cloud / MQTT Broker
↓
Node.js MQTT Service
↓
Telemetry Service
↓
MySQL
↓
WebSocket
↓
React

AI:
User
↓
React AI Chat
↓
/api/v1/ai/ask
↓
Authentication
↓
RBAC permission check
↓
Authorized MySQL data
↓
Gemini
↓
Response

4. ROLE SYSTEM
   Create exactly these roles:
   PATIENT
   DOCTOR
   CAREGIVER
   ADMIN
   SUPER_ADMIN
   Every role must have:
   Separate navigation
   Separate dashboard
   Separate permissions
   Separate accessible resources
   Shared underlying database relationships
   Do NOT simply hide buttons in React.
   Authorization must be enforced in the backend.
5. ROLE RELATIONSHIP
   The system must work like this:
   SUPER ADMIN
   ↓
   ADMIN
   ↓
   ┌───┴──────────────┐
   ↓ ↓
   DOCTOR CAREGIVER
   ↓ ↓
   └────────┬─────────┘
   ↓
   PATIENT
   ↓
   DEVICE
   ↓
   ESP32
   ↓
   MQTT
   ↓
   CLOUD

Admin assigns:
Patient → Doctor
Patient → Caregiver
Patient → Device

Doctor creates:
Patient → Care Plan

Patient performs:
Care Plan → Nebulization Session

ESP32 generates:
Session + Health Telemetry + Battery Telemetry

Platform generates:
Adherence + Alerts + Reports

Doctor/caregiver receive authorized information. 6. COMPLETE ROLE FEATURE MATRIX
PATIENT
Can:
View own dashboard
View own health data
View own device
Control own nebulizer
Start session
Stop session
Pause/resume session
View care plan
View medication
View dosage
View adherence
View health history
View alerts
Trigger SOS
Receive SOS/alerts
Generate own reports
Export own data
Use voice commands
Use AI assistant on own data
Manage own profile
Manage own preferences
Change theme
Enable/disable voice alerts
Cannot:
View other patients
Edit doctor prescriptions
Edit clinical notes
Manage users
Manage devices globally
Manage system settings 7. DOCTOR
Can:
View doctor dashboard
View assigned patients
View assigned patient live vitals
View assigned patient history
View assigned patient devices
View nebulization sessions
View adherence
Create care plans
Edit care plans
Publish care plans
Pause/end care plans
Add clinical notes
Review alerts
Receive SOS
Acknowledge alerts
Generate patient reports
Export assigned patient data
View analytics
Use AI for assigned patients
Manage own profile/settings
Cannot:
Manage global users
Register devices globally
Assign unrelated patients
Modify system configuration
Directly control patient nebulizer unless explicitly authorized by a future controlled workflow 8. CAREGIVER
Can:
View caregiver dashboard
View assigned patients
View live patient vitals
View nebulizer status
View session history
View adherence
Receive alerts
Receive SOS
View basic reports
Export permitted reports
Use AI on assigned patient information
Manage own profile/settings
Cannot:
Create prescriptions
Modify care plans
Edit clinical notes
Manage users
Register devices
Assign patients
Modify system settings 9. ADMIN
Can:
View admin dashboard
Manage users
Create users
Edit users
Disable users
Assign roles
Manage patients
Manage doctors
Manage caregivers
Register devices
Assign devices
Unassign devices
Assign doctor → patient
Assign caregiver → patient
View system alerts
View system statistics
Monitor devices
View system health
View audit logs
Manage limited system settings
Admin does NOT make clinical decisions. 10. SUPER ADMIN
Can:
Manage administrators
Manage global users
Manage roles
Manage permissions
Manage platform configuration
View global analytics
View all devices
View all system activity
View all audit logs
Configure global settings 11. AUTHENTICATION
Create:
Login
Register
Email verification
Forgot password
Reset password
Logout
Session management
JWT authentication
Refresh token handling
After login:
PATIENT → /patient/dashboard
DOCTOR → /doctor/dashboard
CAREGIVER → /caregiver/dashboard
ADMIN → /admin/dashboard
SUPER_ADMIN → /super-admin/dashboard

12. PATIENT PORTAL
    Patient navigation:
    Dashboard
    My Nebulizer
    Health Monitoring
    Nebulization
    Adherence
    Health History
    Alerts
    Reports
    AI Assistant
    Profile
    Settings

13. PATIENT DASHBOARD
    Create a premium command-center dashboard.
    Header:
    "Good Evening, [Patient Name]"
    Subtitle:
    "Your health and nebulizer status"
    Display live cards:
    Heart Rate
    BPM
    Normal/warning/critical
    Trend
    Last update
    SpO₂
    Percentage
    Status
    Trend
    Last update
    Body Temperature
    °C
    Status
    Trend
    Battery
    %
    Status
    Trend
    Environmental section:
    Ambient temperature
    Humidity
    AQI
    Air quality status
    Device card:
    Device ID
    Online/offline
    Last update
    MQTT connection
    Cloud connection
    Nebulizer card:
    Status
    Medication
    Prescribed duration
    Session progress
    Start/stop control
14. LIVE HEALTH MONITORING
    Display real-time:
    BPM
    SpO₂
    Body temperature
    Use WebSocket updates where possible.
    Do not require page refreshes.
    Display:
    Last updated
    Connection status
    Data freshness
    If data becomes stale, show:
    "Last updated 32 seconds ago"
    and then:
    "Data connection interrupted"
15. ENVIRONMENTAL TELEMETRY
    Display:
    Ambient temperature
    Room humidity
    AQI
    Air quality classification
    Support future real sensors.
    If currently simulated:
    Mark as simulated in development mode
    Keep the database schema ready for real telemetry
16. NEBULIZER CONTROL
    Create a premium interactive control interface.
    States:
    OFF
    READY
    RUNNING
    PAUSED
    COMPLETED
    ERROR
    Controls:
    Start
    Pause
    Resume
    Stop
    Use:
    Animated SVG timer ring
    Countdown
    Elapsed duration
    Prescribed duration
    Progress indicator
    When session completes:
    Play completion chime
    Show completion animation
    Store session
    Update adherence
    Notify patient
    Hardware state must eventually come from actual ESP32/relay state.
    Do not pretend the device changed if the backend has not confirmed it.
17. DOSAGE / MEDICATION
    Display:
    Medication name
    Dosage
    Duration
    Frequency
    Instructions
    Start date
    End date
    The care plan is primarily doctor-controlled.
18. FLUID CHAMBER / REFILL
    Create:
    Fluid level doughnut gauge
    Current level
    Consumption
    Estimated remaining
    Low fluid warning
    Manual refill
    Refill history
19. BATTERY / POWER TELEMETRY
    Display:
    Battery percentage
    Voltage
    Current
    Power
    Cell temperature
    Create:
    Interactive doughnut gauge
    Battery status
    Charging state if available
    Low battery warning
    Critical battery warning
    High temperature warning
20. REAL-TIME CHARTS
    Create interactive Chart.js/Recharts graphs.
    Graphs:
    BPM
    SpO₂
    Temperature
    BPM vs SpO₂
    Humidity
    Ambient temperature
    AQI
    Battery percentage
    Voltage
    Current
    Time filters:
    5 minutes
    15 minutes
    1 hour
    6 hours
    24 hours
    7 days
    30 days
    Custom
    Features:
    Zoom
    Tooltip
    Legend
    Dataset toggling
    Fullscreen
    Export PNG
21. ADHERENCE
    Create:
    Adherence percentage
    Prescribed sessions
    Completed sessions
    Missed sessions
    Partial sessions
    Monthly calendar
    Weekly summary
    Monthly summary
    Session history
    Every nebulizer session must create an adherence record.
    Store:
    Start time
    End time
    Duration
    Medication
    Dosage
    Prescribed duration
    Completion status
22. ALERT ENGINE
    Monitor:
    SpO₂
    BPM
    Temperature
    Battery
    Battery temperature
    Fluid level
    Device connection
    Missed session
    Alert levels:
    Critical
    Warning
    Information
    Resolved
    Alert fields:
    ID
    Patient
    Device
    Type
    Severity
    Current value
    Threshold
    Message
    Created time
    Acknowledged time
    Resolved time
    Acknowledged by
    Resolved by
23. SPO₂ ALERT
    Retain the existing behavior:
    When SpO₂ goes below the configured threshold:
    Create alert
    Play audio chime
    Optional Web Speech voice alert
    Show visual alert
    Store alert
    Notify authorized doctor/caregiver
    Show patient warning
    Use a configurable threshold.
    Do not hard-code medical diagnosis.
24. EMERGENCY SOS
    Support:
    Manual SOS
    Voice SOS
    API-triggered SOS
    Use WebSocket/Socket.IO.
    Flow:
    Patient
    ↓
    SOS
    ↓
    Backend
    ↓
    Authorized Doctor + Caregiver

Show:
Patient
Current vitals
Device
Time
Emergency state
Actions:
Acknowledge
Resolve
Record full SOS history. 25. VOICE CONTROL
Use Web Speech API.
Patient:
"Start nebulizer"
"Stop nebulizer"
"Pause nebulizer"
"Show my oxygen"
"Show my heart rate"
"Emergency SOS"
Doctor:
"Show my patients"
"Show critical alerts"
"Show Kalpak's adherence"
Caregiver:
"Show patient status"
"Show alerts"
All commands must pass authorization checks. 26. MULTI-PATIENT MANAGEMENT
Do not hard-code patients.
Create database-driven patients.
Seed development data:
Dimpal D.
Kalpak H S
Chandana G O
Each patient has:
Patient ID
Profile
Doctor assignment
Caregiver assignment
Device
Health data
Care plan
Sessions
Adherence
Alerts
Reports 27. DOCTOR PORTAL
Navigation:
Dashboard
My Patients
Live Monitoring
Care Plans
Analytics
Adherence
Alerts
Clinical Notes
Reports
AI Assistant
Profile
Settings

Dashboard statistics:
Total patients
Online patients
Active sessions
Critical alerts
Poor adherence
Patient cards/table:
Patient
SpO₂
BPM
Temperature
Device
Battery
Nebulizer
Adherence
Status 28. DOCTOR PATIENT PROFILE
Tabs:
Overview
Live Vitals
Nebulization
Health History
Adherence
Care Plan
Alerts
Reports
Clinical Notes 29. DOCTOR CARE PLANS
Doctor can:
Create
Edit
Publish
Pause
End
Fields:
Medication
Dosage
Duration
Frequency
Start date
End date
Instructions
When published:
Doctor
↓
Care Plan
↓
Patient Notification
↓
Patient Dashboard
↓
Nebulization Schedule

30. CLINICAL NOTES
    Doctor can create private notes.
    Store:
    Patient
    Doctor
    Note
    Timestamp
    Updated timestamp
    Do not expose doctor notes to unauthorized caregivers/patients.
31. DOCTOR ANALYTICS
    Show:
    SpO₂ trends
    BPM trends
    Temperature trends
    Adherence trends
    Session duration
    Alert frequency
    Patient comparisons
    Only allow doctors to analyze patients assigned to them.
32. CAREGIVER PORTAL
    Navigation:
    Dashboard
    My Patients
    Live Monitoring
    Sessions
    Adherence
    Alerts
    Reports
    AI Assistant
    Profile
    Settings

Show assigned patients only.
Features:
Live vitals
Device status
Nebulizer status
Sessions
Adherence
Alerts
SOS
Reports 33. ADMIN PORTAL
Navigation:
Dashboard
Users
Patients
Doctors
Caregivers
Devices
Assignments
Alerts
System Monitoring
Audit Logs
Settings

34. ADMIN USER MANAGEMENT
    Create:
    User table
    Search
    Filters
    Role filter
    Status filter
    Actions:
    Create
    Edit
    Disable
    Enable
    Assign role
    Reset access
35. ADMIN DEVICE MANAGEMENT
    Create device registry.
    Device fields:
    Device ID
    Patient
    Status
    Battery
    Last communication
    MQTT status
    Firmware
    Registration date
    Actions:
    Register
    Assign
    Unassign
    Disable
    View telemetry
    View device logs
36. ADMIN ASSIGNMENTS
    Admin can manage:
    Patient → Doctor
    Patient → Caregiver
    Patient → Device

Do not hard-code these relationships. 37. SUPER ADMIN
Navigation:
Dashboard
Administrators
Users
Roles
Permissions
Devices
Global Analytics
Audit Logs
Platform Settings

Super Admin controls global platform configuration. 38. REPORTING
Create professional report generation.
Clinical PDF must contain:
Patient information
Doctor
Care plan
Medication
Vitals
Trends
Nebulization sessions
Adherence
Alerts
Device information
Date range
Support:
PDF
CSV
PNG 39. NOTIFICATION CENTER
Global notification system.
Types:
Care plan published
Care plan updated
Session reminder
Session completed
Low battery
Health alert
SOS
Device offline
Adherence reminder
Refill reminder
Notifications must be role-aware. 40. GEMINI AI MEDICAL ASSISTANT
Retain the existing API:
/api/v1/ai/ask
Build a professional conversational interface.
Patient examples:
"Summarize my vitals today."
"How was my nebulization adherence?"
"Show my SpO₂ trend."
Doctor examples:
"Summarize Kalpak's last 7 days."
"Which assigned patients had low SpO₂ alerts?"
"Which patients have poor adherence?"
Caregiver:
"How is Kalpak doing?"
"Did Kalpak complete today's sessions?"
Admin:
"How many devices are offline?"
"How many active patients are there?"
The AI must only access data permitted by the user's role and relationships.
Never allow AI to bypass RBAC.
The AI is an informational assistant and must not present itself as a replacement for professional medical judgment. 41. PROFILE
All roles:
Avatar upload
Display name
Email
Phone
Password
Notification preferences
Voice settings
Theme settings 42. THEME
Implement:
Light
Dark
System
Persist preference.
Charts and all components must support both themes. 43. AUDIT LOGS
Track:
Login
Logout
User changes
Role changes
Care plan creation
Care plan updates
Device assignment
Device removal
Session start
Session stop
Alert acknowledgement
SOS
Report generation
Admin actions
Show:
Actor
Action
Target
Timestamp 44. MYSQL DATABASE DESIGN
Use MySQL with Prisma.
Create proper relational tables/models:
User
Role
Permission
Profile

Patient
Doctor
Caregiver

DoctorPatientAssignment
CaregiverPatientAssignment

Device
PatientDevice

HealthTelemetry
EnvironmentalTelemetry
BatteryTelemetry

NebulizationSession

Medication
CarePlan

AdherenceRecord

Alert
SOSEvent
Notification

ClinicalNote

Report

AIConversation
AIMessage

AuditLog

Use proper:
Primary keys
Foreign keys
Unique constraints
Indexes
Timestamps
Soft delete where appropriate
Referential integrity
Add indexes for frequently queried fields such as:
patient_id
device_id
timestamp
doctor_id
caregiver_id
alert status
session date
Telemetry tables should be designed for high-volume writes. 45. API STRUCTURE
Create clean REST endpoints.
Example:
/api/v1/auth
/api/v1/users
/api/v1/patients
/api/v1/doctors
/api/v1/caregivers
/api/v1/devices
/api/v1/telemetry
/api/v1/nebulization
/api/v1/care-plans
/api/v1/adherence
/api/v1/alerts
/api/v1/sos
/api/v1/notifications
/api/v1/reports
/api/v1/clinical-notes
/api/v1/ai
/api/v1/admin

Every endpoint must verify:
Authentication
Role
Resource ownership/assignment
Permission 46. REAL-TIME MQTT
Create a backend MQTT service.
The service should be structured to receive telemetry such as:
bpm
spo2
bodyTemperature
ambientTemperature
humidity
aqi
batteryPercentage
batteryVoltage
batteryCurrent
batteryPower
batteryTemperature
fluidLevel
nebulizerState

Store telemetry in MySQL.
Broadcast relevant updates to authorized frontend clients through WebSocket/Socket.IO.
Do not send one patient's private telemetry to another patient's browser. 47. DEVICE CONTROL
Nebulizer commands should use a proper command flow:
Frontend
↓
Backend API
↓
Authorization
↓
Device Command
↓
MQTT
↓
ESP32
↓
Relay
↓
Device State
↓
ESP32 publishes confirmation
↓
Backend
↓
Frontend

Do not assume that clicking "Start" means the physical device successfully started.
The UI should distinguish:
Command sent
Starting
Running
Failed
Stopped 48. ERROR HANDLING
Every page must have:
Loading skeleton
Empty state
Error state
Retry
Offline state
Stale data indication
Use toast notifications for actions.
Never show blank screens. 49. DEVELOPMENT / DEMO MODE
Create realistic seed data for development.
Seed:
Users:
3 Patients
2 Doctors
2 Caregivers
1 Admin
1 Super Admin
Patients:
Dimpal D.
Kalpak H S
Chandana G O
Devices:
NEB-001
NEB-002
NEB-003
Generate realistic:
Telemetry
Sessions
Alerts
Care plans
Adherence
Notifications
Do not hard-code this information into React components.
Use MySQL seed data. 50. UI DESIGN SYSTEM
Create reusable components:
HealthCard
VitalCard
BatteryGauge
DeviceStatus
NebulizerControl
SessionTimer
SpO2Chart
BPMChart
TemperatureChart
AlertCard
AlertBanner
PatientCard
PatientSelector
CarePlanCard
AdherenceCalendar
SessionTable
ReportCard
NotificationPanel
AIChat
VoiceControl
DataTable
StatusBadge
MetricCard
EmptyState
ErrorState
LoadingSkeleton

51. ANIMATION
    Use Framer Motion selectively.
    Animate:
    Page transitions
    Card appearance
    Vital updates
    Timer progress
    Nebulizer state
    Alerts
    Notifications
    Modals
    Avoid excessive animation.
    Animations must feel premium and purposeful.
52. ACCESSIBILITY
    Implement:
    Keyboard navigation
    Focus states
    ARIA labels
    Accessible dialogs
    Accessible forms
    Sufficient contrast
    Large touch targets
    Screen-reader-friendly status messages
    Never rely only on color.
53. SECURITY REQUIREMENTS
    Implement:
    Secure authentication
    Password hashing
    JWT
    Refresh tokens
    Backend RBAC
    Resource-level authorization
    Input validation
    Zod validation
    SQL injection protection through Prisma
    CORS configuration
    Secure environment variables
    Rate limiting for sensitive APIs
    API validation
    Audit logs
    Never expose:
    Database credentials
    JWT secrets
    Gemini API key
    MQTT credentials
    in frontend code.
54. FINAL SIDEBARS
    PATIENT
    Dashboard
    My Nebulizer
    Health Monitoring
    Nebulization
    Adherence
    Health History
    Alerts
    Reports
    AI Assistant
    Profile
    Settings

DOCTOR
Dashboard
My Patients
Live Monitoring
Care Plans
Analytics
Adherence
Alerts
Clinical Notes
Reports
AI Assistant
Profile
Settings

CAREGIVER
Dashboard
My Patients
Live Monitoring
Sessions
Adherence
Alerts
Reports
AI Assistant
Profile
Settings

ADMIN
Dashboard
Users
Patients
Doctors
Caregivers
Devices
Assignments
Alerts
System Monitoring
Audit Logs
Settings

SUPER ADMIN
Dashboard
Administrators
Users
Roles
Permissions
Devices
Global Analytics
Audit Logs
Platform Settings

55. ROLE FEATURE MATRIX
    Implement this exact permission model:
    FeaturePatientDoctorCaregiverAdminSuper AdminOwn DashboardYESYESYESYESYESOwn Health DataYESNONOLIMITEDALLLive Patient VitalsOwnAssignedAssignedSystemAllNebulizer ControlYESNONONONOStart/Stop SessionYESNONONONOMedication ViewYESYESVIEWNONOCreate Care PlanNOYESNONONOEdit Care PlanNOYESNONONOClinical NotesNOYESNONONOHealth HistoryOwnAssignedAssignedLimitedAllAnalyticsOwnAssignedLimitedSystemGlobalAdherenceOwnAssignedAssignedSystemGlobalAlertsOwnAssignedAssignedSystemGlobalTrigger SOSYESNONONONOReceive SOSNOYESYESOptionalOptionalReportsOwnAssignedAssignedSystemGlobalAIOwnAssignedAssignedSystemGlobalVoice ControlYESLimitedLimitedNONOUser ManagementNONONOYESYESDevice RegistrationNONONOYESYESDevice AssignmentNONONOYESYESPatient AssignmentNONONOYESYESRole ManagementNONONOLimitedYESPermission ManagementNONONONOYESAudit LogsOwnRelevantOwnSystemGlobal
56. DEVELOPMENT PHASES
    Do not attempt to create a fragile implementation by putting everything into one component.
    Build systematically.
    Phase 1
    Authentication
    Database
    MySQL
    Prisma
    RBAC
    User profiles
    Phase 2
    Patient/Doctor/Caregiver relationships
    Device relationships
    Admin management
    Phase 3
    IoT telemetry architecture
    MQTT
    WebSockets
    Device status
    Phase 4
    Patient dashboard
    Live vitals
    Nebulizer
    Battery
    Environment
    Phase 5
    Sessions
    Adherence
    Care plans
    Medication
    Phase 6
    Doctor portal
    Patient management
    Analytics
    Clinical notes
    Phase 7
    Caregiver portal
    Alerts
    SOS
    Notifications
    Phase 8
    Admin portal
    Device management
    User management
    Assignments
    Audit logs
    Phase 9
    Reports
    PDF
    CSV
    PNG
    Phase 10
    Voice control
    Phase 11
    Gemini AI
    Phase 12
    Performance
    Security
    Accessibility
    Responsive polish
57. IMPORTANT IMPLEMENTATION RULES
    DO NOT:
    Use Supabase
    Use PostgreSQL
    Replace MySQL
    Hard-code patients
    Hard-code role permissions
    Put database credentials in frontend
    Put Gemini credentials in frontend
    Use frontend-only authorization
    Create disconnected dashboards
    Fake successful hardware commands
    Allow AI to bypass permissions
    Remove existing features
    DO:
    Use MySQL
    Use Prisma
    Use Node.js + Express
    Use React + TypeScript
    Use proper relational models
    Use backend RBAC
    Use resource-level authorization
    Use MQTT for IoT
    Use WebSockets for real-time UI
    Use reusable components
    Use realistic seed data
    Keep the architecture production-ready
    Keep the existing /api/v1/ai/ask concept
    Preserve real-time health monitoring
    Preserve nebulizer relay control
    Preserve dosage/refill tracking
    Preserve adherence
    Preserve SOS
    Preserve voice control
    Preserve reports and exports
    Preserve dark/light mode
58. FINAL PRODUCT EXPERIENCE
    The finished platform should demonstrate this complete real-world workflow:
    ADMIN
    ↓
    Creates patient
    ↓
    Creates doctor
    ↓
    Creates caregiver
    ↓
    Registers ESP32 device
    ↓
    Assigns device to patient
    ↓
    Assigns doctor
    ↓
    Assigns caregiver
    ↓
    DOCTOR
    ↓
    Creates care plan
    ↓
    PATIENT
    ↓
    Receives care plan
    ↓
    Starts nebulization
    ↓
    ESP32
    ↓
    Collects health/device telemetry
    ↓
    MQTT
    ↓
    IoT Cloud
    ↓
    Backend
    ↓
    MySQL
    ↓
    Real-time WebSocket
    ↓
    PATIENT / DOCTOR / CAREGIVER
    ↓
    Monitoring + Analytics
    ↓
    Threshold engine
    ↓
    Alerts / SOS
    ↓
    Adherence
    ↓
    Reports
    ↓
    Gemini AI

The final application must look and feel like a professional, advanced IoT healthcare SaaS platform suitable for a serious engineering project demonstration.
The primary product story is:
Smart sensing → Real-time connectivity → Respiratory therapy → Patient monitoring → Doctor supervision → Caregiver support → Automated adherence → Emergency response → Analytics → AI-assisted insights.
Build the application with clean architecture, strong security, professional UI/UX, responsive layouts, real-time data support, and scalable MySQL database design.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e177d8e6-70e1-4add-b510-428e671931cf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
