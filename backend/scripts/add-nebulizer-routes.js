const fs = require('fs');
const path = require('path');

const serverPaths = [
  path.join(__dirname, '..', 'server.js'),
  path.join(__dirname, '..', '..', 'breathe-easy-connect-main', 'backend', 'server.js')
];

const addition = `// Manual Override: Force Start Nebulizer
app.post("/api/v1/nebulizer/force-start", async (req, res) => {
  const node = req.body?.node || "Patient1";
  try {
    const result = await firebaseSyncService.setRelay(node, true, "MANUAL");
    io.emit("nebulizer_state_update", {
      source: "manual_override",
      node,
      state: "RUNNING",
      relay: true,
      actualRelay: true,
      mode: "MANUAL",
      manualOverride: true,
    });
    res.status(200).json({ status: "success", command: "FORCE_START", ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Override: Force Stop Nebulizer (Emergency Cutoff)
app.post("/api/v1/nebulizer/force-stop", async (req, res) => {
  const node = req.body?.node || "Patient1";
  try {
    const result = await firebaseSyncService.setRelay(node, false, "MANUAL");
    io.emit("nebulizer_state_update", {
      source: "manual_override",
      node,
      state: "OFF",
      relay: false,
      actualRelay: false,
      mode: "MANUAL",
      manualOverride: true,
    });
    res.status(200).json({ status: "success", command: "FORCE_STOP", ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle Nebulizer Mode (AUTO vs MANUAL)
app.post("/api/v1/nebulizer/mode", async (req, res) => {
  const node = req.body?.node || "Patient1";
  const mode = req.body?.mode === "MANUAL" ? "MANUAL" : "AUTO";
  try {
    const result = await firebaseSyncService.setMode(node, mode);
    io.emit("nebulizer_state_update", {
      source: "mode_change",
      node,
      mode,
      manualOverride: mode === "MANUAL",
    });
    res.status(200).json({ status: "success", mode, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                                 TELEMETRY                                  */`;

serverPaths.forEach(sp => {
  if (fs.existsSync(sp)) {
    let content = fs.readFileSync(sp, 'utf8');
    if (!content.includes('/api/v1/nebulizer/force-start')) {
      content = content.replace(
        /\/\*\s*-+\s*\*\/\r?\n\/\*\s*TELEMETRY\s*\*\//,
        addition
      );
      fs.writeFileSync(sp, content, 'utf8');
      console.log('Updated ' + sp);
    } else {
      console.log('Already updated ' + sp);
    }
  }
});
