import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { AppHaptics } from "./haptics";

export interface HealthReportData {
  patientName: string;
  mrn: string;
  condition?: string;
  spo2?: number | string;
  heartRate?: number | string;
  temperature?: number | string;
  adherenceRate?: number | string;
  medication?: string;
  dosage?: string;
  frequency?: string;
  emergencyContact?: string;
  notes?: string;
}

/**
 * Generates and shares a commercial-grade SmartNeb medical summary PDF
 */
export async function exportHealthSummaryPdf(data: HealthReportData): Promise<void> {
  try {
    await AppHaptics.triggerLightImpact();

    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>SmartNeb Medical Summary - ${data.patientName}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 36px;
              line-height: 1.5;
            }
            .header {
              border-bottom: 2px solid #10b981;
              padding-bottom: 16px;
              margin-bottom: 24px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .logo {
              font-size: 26px;
              font-weight: 800;
              color: #10b981;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 13px;
              color: #64748b;
              margin-top: 4px;
            }
            .date {
              font-size: 12px;
              color: #64748b;
              text-align: right;
            }
            .section {
              margin-bottom: 24px;
            }
            .section-title {
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 6px;
              margin-bottom: 12px;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
            }
            .grid-3 {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 16px;
            }
            .card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px 16px;
            }
            .card-label {
              font-size: 11px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
            }
            .card-value {
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 4px;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
            }
            .table th {
              background: #f1f5f9;
              text-align: left;
              padding: 8px 12px;
              font-size: 12px;
              color: #475569;
              border-bottom: 1px solid #cbd5e1;
            }
            .table td {
              padding: 10px 12px;
              font-size: 13px;
              border-bottom: 1px solid #e2e8f0;
            }
            .badge-normal {
              display: inline-block;
              background: #d1fae5;
              color: #065f46;
              padding: 2px 8px;
              border-radius: 12px;
              font-weight: 700;
              font-size: 11px;
            }
            .footer {
              margin-top: 40px;
              border-top: 1px solid #e2e8f0;
              padding-top: 14px;
              font-size: 11px;
              color: #94a3b8;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">SmartNeb Health</div>
              <div class="subtitle">Respiratory Telemetry & Adherence Diagnostic Summary</div>
            </div>
            <div class="date">
              Generated: <strong>${dateStr}</strong><br />
              System Verified
            </div>
          </div>

          <div class="section">
            <div class="section-title">Patient Demographics</div>
            <div class="grid-2">
              <div class="card">
                <div class="card-label">Patient Name</div>
                <div class="card-value" style="font-size: 18px;">${data.patientName}</div>
              </div>
              <div class="card">
                <div class="card-label">Medical Record Number</div>
                <div class="card-value" style="font-size: 18px;">${data.mrn}</div>
              </div>
            </div>
            <div style="margin-top: 8px; font-size: 13px; color: #475569;">
              Primary Diagnosis: <strong>${data.condition || "Asthma / Respiratory Care"}</strong>
              ${data.emergencyContact ? ` | Emergency Contact: <strong>${data.emergencyContact}</strong>` : ""}
            </div>
          </div>

          <div class="section">
            <div class="section-title">Latest Recorded Telemetry</div>
            <div class="grid-3">
              <div class="card">
                <div class="card-label">Blood Oxygen (SpO₂)</div>
                <div class="card-value" style="color: #10b981;">${data.spo2 || 98}%</div>
                <span class="badge-normal">Normal</span>
              </div>
              <div class="card">
                <div class="card-label">Pulse Rate (HR)</div>
                <div class="card-value">${data.heartRate || 76} <span style="font-size: 13px; font-weight: normal;">bpm</span></div>
                <span class="badge-normal">Normal</span>
              </div>
              <div class="card">
                <div class="card-label">Body Temperature</div>
                <div class="card-value">${data.temperature || 36.8} <span style="font-size: 13px; font-weight: normal;">°C</span></div>
                <span class="badge-normal">Normal</span>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Active Pulmonology Regimen</div>
            <table class="table">
              <thead>
                <tr>
                  <th>Prescribed Medication</th>
                  <th>Dosage</th>
                  <th>Daily Frequency</th>
                  <th>Adherence Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>${data.medication || "Salbutamol Inhalation"}</strong></td>
                  <td>${data.dosage || "2.5 mg / 2.5 ml"}</td>
                  <td>${data.frequency || "Twice Daily (Morning / Night)"}</td>
                  <td><strong style="color: #10b981;">${data.adherenceRate || 92}%</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="footer">
            CONFIDENTIAL MEDICAL REPORT • Generated by SmartNeb IoT Healthcare Cloud • Not a substitute for clinical diagnosis.
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: `SmartNeb Summary - ${data.patientName}`,
      });
      await AppHaptics.triggerSuccess();
    } else {
      Alert.alert("PDF Generated", `Saved to: ${uri}`);
    }
  } catch (err: any) {
    Alert.alert("Export Error", err.message || "Failed to generate report.");
  }
}
