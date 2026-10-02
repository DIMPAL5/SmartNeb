import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Client-side export helpers for SmartNeb clinical reports (CSV + PDF). */

export type SmartNebReport = {
  generatedAt: string;
  rangeDays: number;
  patient: any;
  device: any;
  carePlan: any;
  sessions: any[];
  adherence: any[];
  adherenceSummary?: {
    scheduled: number;
    completed: number;
    partial: number;
    missed: number;
  };
  alerts: any[];
  sos?: any[];
  refills?: any[];
  series?: { health: any[]; environment: any[]; battery: any[] };
  vitals: Record<string, number | null>;
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function section(title: string, headers: string[], rows: unknown[][]): string {
  return [
    `# ${title}`,
    headers.join(","),
    ...rows.map((r) => r.map(esc).join(",")),
    "",
  ].join("\n");
}

export function reportSlug(report: SmartNebReport, ext: string) {
  const name = String(report.patient?.full_name ?? "patient").replace(/\W+/g, "-").toLowerCase();
  return `smartneb-${name}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

export function exportReportCSV(report: SmartNebReport) {
  const s = report.series ?? { health: [], environment: [], battery: [] };
  const parts = [
    section(
      "Patient summary",
      ["field", "value"],
      [
        ["Patient", report.patient?.full_name],
        ["MRN", report.patient?.mrn],
        ["Condition", report.patient?.condition],
        ["Range (days)", report.rangeDays],
        ["Generated", new Date(report.generatedAt).toLocaleString()],
        ["Device", report.device?.device_code ?? "none"],
        ["Device status", report.device?.status ?? "n/a"],
        ["Avg BPM", report.vitals["avgBpm"]],
        ["Max BPM", report.vitals["maxBpm"]],
        ["Avg SpO2", report.vitals["avgSpo2"]],
        ["Min SpO2", report.vitals["minSpo2"]],
        ["Avg body temp", report.vitals["avgTemp"]],
        ["Max body temp", report.vitals["maxTemp"]],
      ],
    ),
    section(
      "Vitals history",
      ["recorded_at", "bpm", "spo2", "body_temperature"],
      s.health.map((h) => [h.recorded_at, h.bpm, h.spo2, h.body_temperature]),
    ),
    section(
      "Environment history",
      ["recorded_at", "ambient_temperature", "humidity", "aqi"],
      s.environment.map((e) => [e.recorded_at, e.ambient_temperature, e.humidity, e.aqi]),
    ),
    section(
      "Battery history",
      ["recorded_at", "percentage", "voltage", "current", "cell_temperature", "charging"],
      s.battery.map((b) => [
        b.recorded_at,
        b.percentage,
        b.voltage,
        b.current,
        b.cell_temperature,
        b.charging,
      ]),
    ),
    section(
      "Nebulization sessions",
      ["started_at", "status", "medication", "dosage", "elapsed_seconds", "prescribed_seconds"],
      report.sessions.map((x) => [
        x.started_at,
        x.status,
        x.medication,
        x.dosage,
        x.elapsed_seconds,
        x.prescribed_seconds,
      ]),
    ),
    section(
      "Adherence",
      ["scheduled_for", "status", "completion_ratio"],
      report.adherence.map((a) => [a.scheduled_for, a.status, a.completion_ratio]),
    ),
    section(
      "Alerts",
      ["created_at", "type", "severity", "status", "value", "threshold", "message"],
      report.alerts.map((a) => [
        a.created_at,
        a.type,
        a.severity,
        a.status,
        a.value,
        a.threshold,
        a.message,
      ]),
    ),
    section(
      "Emergency SOS",
      ["created_at", "source", "status", "acknowledged_at", "resolved_at"],
      (report.sos ?? []).map((e) => [
        e.created_at,
        e.source,
        e.status,
        e.acknowledged_at,
        e.resolved_at,
      ]),
    ),
  ];
  download(new Blob([parts.join("\n")], { type: "text/csv;charset=utf-8" }), reportSlug(report, "csv"));
}

export function exportReportPDF(report: SmartNebReport) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  let y = 48;

  doc.setFontSize(18);
  doc.text("SmartNeb clinical summary", marginX, y);
  y += 20;
  doc.setFontSize(10);
  doc.text(
    `${report.patient?.full_name ?? "Patient"} · MRN ${report.patient?.mrn ?? "--"} · last ${report.rangeDays} days`,
    marginX,
    y,
  );
  y += 14;
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString()}`, marginX, y);
  y += 10;

  const table = (title: string, head: string[], body: unknown[][]) => {
    autoTable(doc, {
      startY: y + 16,
      head: [head],
      body: body.length ? (body as any) : [head.map(() => "--")],
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [13, 110, 130] },
      didDrawPage: () => {
        doc.setFontSize(9);
        doc.text(title, marginX, (doc as any).lastAutoTable?.startY ? y + 8 : y + 8);
      },
    });
    y = (doc as any).lastAutoTable.finalY;
  };

  table("Vitals summary", ["Metric", "Value"], [
    ["Samples", report.vitals["samples"]],
    ["Average heart rate (bpm)", report.vitals["avgBpm"]],
    ["Peak heart rate (bpm)", report.vitals["maxBpm"]],
    ["Average SpO₂ (%)", report.vitals["avgSpo2"]],
    ["Lowest SpO₂ (%)", report.vitals["minSpo2"]],
    ["Average body temp (°C)", report.vitals["avgTemp"]],
    ["Peak body temp (°C)", report.vitals["maxTemp"]],
  ]);

  const plan = report.carePlan;
  table("Care plan", ["Medication", "Dosage", "Duration", "Per day", "Status"], plan ? [[
    plan.medication,
    plan.dosage,
    `${plan.duration_minutes} min`,
    plan.frequency_per_day,
    plan.status,
  ]] : []);

  const ad = report.adherenceSummary;
  table("Adherence", ["Scheduled", "Completed", "Partial", "Missed"], ad ? [[
    ad.scheduled,
    ad.completed,
    ad.partial,
    ad.missed,
  ]] : []);

  table(
    "Nebulization sessions",
    ["Started", "Status", "Medication", "Minutes"],
    report.sessions.slice(0, 40).map((s) => [
      new Date(s.started_at).toLocaleString(),
      s.status,
      s.medication ?? "--",
      Math.round((s.elapsed_seconds ?? 0) / 60),
    ]),
  );

  table(
    "Alerts",
    ["Time", "Severity", "Type", "Message"],
    report.alerts.slice(0, 40).map((a) => [
      new Date(a.created_at).toLocaleString(),
      a.severity,
      a.type,
      a.message,
    ]),
  );

  table(
    "Emergency SOS",
    ["Time", "Source", "Status"],
    (report.sos ?? []).slice(0, 20).map((e) => [
      new Date(e.created_at).toLocaleString(),
      e.source,
      e.status,
    ]),
  );

  doc.setFontSize(8);
  doc.text(
    "SmartNeb generated summary. Clinical decisions remain the responsibility of the treating clinician.",
    marginX,
    doc.internal.pageSize.getHeight() - 24,
  );

  doc.save(reportSlug(report, "pdf"));
}
