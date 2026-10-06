import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Smartphone, RotateCw, ExternalLink, ArrowLeft, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/mobile")({
  head: () => ({
    meta: [
      { title: "Mobile Device Simulator — SmartNeb" },
      { name: "description", content: "Interactive mobile layout simulator for SmartNeb." },
    ],
  }),
  component: MobileSimulatorPage,
});

const PRESET_ROUTES = [
  { label: "Home", path: "/" },
  { label: "Sign In", path: "/auth" },
  { label: "Patient Dashboard", path: "/patient/dashboard" },
  { label: "Nebulizer Control", path: "/patient/nebulizer" },
  { label: "Vitals Monitoring", path: "/patient/monitoring" },
  { label: "Doctor Console", path: "/doctor/dashboard" },
  { label: "Alerts & SOS", path: "/patient/alerts" },
];

const DEVICES = [
  { name: "iPhone 15 Pro", width: 393, height: 852, borderRadius: "50px" },
  { name: "Pixel 8", width: 412, height: 892, borderRadius: "44px" },
  { name: "Compact Phone", width: 360, height: 780, borderRadius: "36px" },
];

function MobileSimulatorPage() {
  const [currentPath, setCurrentPath] = useState("/");
  const [selectedDevice, setSelectedDevice] = useState(DEVICES[0]);
  const [isRotated, setIsRotated] = useState(false);

  const width = isRotated ? selectedDevice.height : selectedDevice.width;
  const height = isRotated ? selectedDevice.width : selectedDevice.height;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Controls Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-display text-base font-bold text-sky-400">
            <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500 text-slate-950">
              <Wind className="size-4" />
            </span>
            SmartNeb
          </Link>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
            Mobile Simulator
          </span>
        </div>

        {/* Route Quick Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {PRESET_ROUTES.map((r) => (
            <button
              key={r.path}
              onClick={() => setCurrentPath(r.path)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                currentPath === r.path
                  ? "bg-sky-500 text-slate-950 font-semibold shadow-sm shadow-sky-500/20"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Device Controls */}
        <div className="flex items-center gap-2">
          <select
            value={selectedDevice.name}
            onChange={(e) => {
              const dev = DEVICES.find((d) => d.name === e.target.value);
              if (dev) setSelectedDevice(dev);
            }}
            className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 outline-none focus:border-sky-500"
          >
            {DEVICES.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name} ({d.width}×{d.height})
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="outline"
            className="border-slate-700 text-slate-300 h-8 px-2.5"
            onClick={() => setIsRotated(!isRotated)}
            title="Rotate Orientation"
          >
            <RotateCw className="size-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-slate-300 h-8 px-2.5"
            asChild
          >
            <a href={currentPath} target="_blank" rel="noopener noreferrer" title="Open Fullscreen in New Tab">
              <ExternalLink className="size-3.5 mr-1.5" />
              Direct URL
            </a>
          </Button>
        </div>
      </header>

      {/* Simulator Workspace */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto">
        <div className="relative shadow-2xl transition-all duration-300 ease-out" style={{ width: `${width}px`, height: `${height}px` }}>
          {/* Phone Hardware Chassis */}
          <div
            className="absolute inset-0 bg-slate-900 border-[10px] border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden ring-1 ring-slate-700/50"
            style={{ borderRadius: selectedDevice.borderRadius }}
          >
            {/* Phone Speaker Notch / Dynamic Island */}
            {!isRotated && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-950 rounded-full z-30 flex items-center justify-end pr-3">
                <div className="size-2.5 rounded-full bg-slate-900 border border-slate-800" />
              </div>
            )}

            {/* Simulated Mobile Status Bar */}
            <div className="h-9 bg-slate-950/80 backdrop-blur text-slate-400 text-[11px] font-medium flex items-center justify-between px-6 pt-1 select-none z-20 shrink-0">
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>

            {/* Embedded Responsive Viewport */}
            <iframe
              key={`${currentPath}-${selectedDevice.name}-${isRotated}`}
              src={currentPath}
              title="Mobile Preview Frame"
              className="flex-1 w-full h-full border-0 bg-background"
            />

            {/* Bottom Home Indicator Bar */}
            <div className="h-5 bg-slate-950 flex items-center justify-center select-none z-20 shrink-0">
              <div className="w-32 h-1 bg-slate-600 rounded-full" />
            </div>
          </div>
        </div>

        {/* Helper Tip */}
        <p className="mt-4 text-xs text-slate-400 flex items-center gap-1.5">
          <Smartphone className="size-3.5 text-sky-400" />
          <span>Tip: You can also press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-300 font-mono text-[10px]">F12</kbd> then <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-300 font-mono text-[10px]">Ctrl + Shift + M</kbd> to inspect in browser device mode.</span>
        </p>
      </main>
    </div>
  );
}
