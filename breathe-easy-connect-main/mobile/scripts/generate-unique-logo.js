const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

function createPng(width, height, drawPixelFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const ihdrChunk = createChunk('IHDR', ihdr);

  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawPixelFn(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = calcCrc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function calcCrc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// 100% Unique SmartNeb Procedural Icon Generator
// Concept: Dark Medical Squircle + Holographic Vortex Ribbon forming 'S' & Breath Wave + Ultrasonic Nucleus
function renderLogoPixel(x, y, w, h, isSplash = false) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = (x - cx) / (w / 2); // -1 to 1
  const dy = (y - cy) / (h / 2); // -1 to 1
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background: Rounded squircle badge with deep space navy gradient
  // Squircle formula: |dx|^4 + |dy|^4 <= 0.8^4
  const squircle = Math.pow(Math.abs(dx), 3.8) + Math.pow(Math.abs(dy), 3.8);
  if (squircle > 0.85 && !isSplash) {
    return [0, 0, 0, 0]; // Transparent outside squircle
  }

  // Base background gradient: Deep medical tech slate
  let r = 11 + (dy + 1) * 8; // 11 to 27
  let g = 17 + (dy + 1) * 12; // 17 to 41
  let b = 32 + (dy + 1) * 18; // 32 to 68
  let a = 255;

  // Squircle border glow
  if (squircle > 0.80 && squircle <= 0.85 && !isSplash) {
    const edgeT = (squircle - 0.80) / 0.05;
    return [14, 165, 233, Math.floor(255 * (1 - edgeT * 0.4))]; // Cyan highlight edge
  }

  // 1. Ultrasonic Concentric Resonance Rings
  const ringDist = dist * 500;
  if (Math.abs(ringDist - 340) < 6) {
    // Outer telemetry ring
    const angle = Math.atan2(dy, dx);
    if (Math.sin(angle * 12) > -0.2) {
      r = Math.min(255, r + 40);
      g = Math.min(255, g + 140);
      b = Math.min(255, b + 210);
    }
  }

  // 2. High-Tech Dual-Lobe Aerodynamic 'S' Ribbon (Breath & Ultrasonic Flow)
  // Parametric mathematical curve for unique SmartNeb aerodynamic ribbon
  // Upper loop centered at (0.05, -0.28), lower loop at (-0.05, 0.28)
  const dUpper = Math.sqrt(Math.pow(dx - 0.08, 2) + Math.pow(dy + 0.25, 2));
  const dLower = Math.sqrt(Math.pow(dx + 0.08, 2) + Math.pow(dy - 0.25, 2));

  // Upper aerodynamic loop
  if (dUpper > 0.16 && dUpper < 0.38 && (dy < 0.05 || dx > -0.1)) {
    const intensity = 1 - Math.abs(dUpper - 0.27) / 0.11;
    if (intensity > 0) {
      r = Math.floor(r * (1 - intensity) + 14 * intensity);
      g = Math.floor(g * (1 - intensity) + 165 * intensity);
      b = Math.floor(b * (1 - intensity) + 233 * intensity);
    }
  }

  // Lower aerodynamic loop
  if (dLower > 0.16 && dLower < 0.38 && (dy > -0.05 || dx < 0.1)) {
    const intensity = 1 - Math.abs(dLower - 0.27) / 0.11;
    if (intensity > 0) {
      r = Math.floor(r * (1 - intensity) + 16 * intensity);
      g = Math.floor(g * (1 - intensity) + 185 * intensity);
      b = Math.floor(b * (1 - intensity) + 129 * intensity); // emerald teal fusion
    }
  }

  // Diagonal connecting helix bridge (completing 'S')
  const diagDist = Math.abs(dx * 1.5 + dy) / Math.sqrt(1.5 * 1.5 + 1);
  if (diagDist < 0.09 && Math.abs(dx) < 0.32 && Math.abs(dy) < 0.32) {
    const intensity = 1 - diagDist / 0.09;
    r = Math.floor(r * (1 - intensity) + 56 * intensity);
    g = Math.floor(g * (1 - intensity) + 189 * intensity);
    b = Math.floor(b * (1 - intensity) + 248 * intensity);
  }

  // 3. Central Ultrasonic Mist Droplet Core (Center Glowing Pulse)
  const coreDist = Math.sqrt(dx * dx + dy * dy);
  if (coreDist < 0.12) {
    const coreGlow = 1 - coreDist / 0.12;
    r = Math.min(255, Math.floor(r + 240 * coreGlow));
    g = Math.min(255, Math.floor(g + 250 * coreGlow));
    b = Math.min(255, Math.floor(b + 255 * coreGlow));
  }

  // 4. Integrated Medical Pulse ECG Accent across horizontal midline
  if (Math.abs(dy - 0.0) < 0.015 && Math.abs(dx) > 0.38 && Math.abs(dx) < 0.65) {
    r = 255; g = 255; b = 255;
  }

  return [r, g, b, a];
}

console.log('Generating custom, 100% unique SmartNeb brand assets...');

const iconPng = createPng(1024, 1024, (x, y, w, h) => renderLogoPixel(x, y, w, h, false));
const splashPng = createPng(1024, 1024, (x, y, w, h) => renderLogoPixel(x, y, w, h, true));
const adaptivePng = createPng(1024, 1024, (x, y, w, h) => renderLogoPixel(x, y, w, h, false));
const faviconPng = createPng(128, 128, (x, y, w, h) => renderLogoPixel(x, y, w, h, false));

fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconPng);
fs.writeFileSync(path.join(assetsDir, 'splash-icon.png'), splashPng);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptivePng);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), faviconPng);

// Also generate official vector SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1120" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="nebulaS" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect width="512" height="512" rx="120" fill="url(#bgGrad)" stroke="#38bdf8" stroke-width="3" stroke-opacity="0.4"/>
  <circle cx="256" cy="256" r="190" fill="none" stroke="#38bdf8" stroke-width="4" stroke-opacity="0.25" stroke-dasharray="24 12 8 12" />

  <!-- Unique Aerodynamic 'S' Ultrasonic Vortex Flow -->
  <path d="M 330 160 C 270 120 180 140 180 210 C 180 280 332 240 332 310 C 332 380 230 400 170 350" 
        fill="none" stroke="url(#nebulaS)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>

  <!-- Core Droplet Particle -->
  <circle cx="256" cy="256" r="16" fill="#ffffff" filter="url(#glow)" />
  <circle cx="256" cy="256" r="8" fill="#38bdf8" />

  <!-- Breath Waveform Bridge -->
  <path d="M 120 256 L 165 256 M 347 256 L 392 256" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
</svg>`;

fs.writeFileSync(path.join(__dirname, '..', '..', 'public', 'smartneb-logo.svg'), svgContent);

console.log('✅ Unique SmartNeb logo assets generated successfully!');
