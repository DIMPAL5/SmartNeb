const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const assetsDir = path.join(__dirname, '..', 'assets');
const publicDir = path.join(__dirname, '..', '..', 'public');

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

// -------------------------------------------------------------
// SIMPLE ONE-COLOR MINIMALIST LOGO
// Brand Color: Pure Medical Cyan (#0284C7 -> R:2, G:132, B:199)
// Concept: Clean Stylized Lungs / Respiratory Inhalation Loop with Inhaled Particle
// -------------------------------------------------------------
const BRAND_R = 2;
const BRAND_G = 132;
const BRAND_B = 199;

// Distance to line segment
function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// Evaluates whether a point (nx, ny) in [-1, 1] is inside the one-color glyph
function evalGlyphDistance(nx, ny) {
  // 1. Central Inhalation Stem (Vertical trachea line)
  const stemDist = distToSegment(nx, ny, 0, -0.42, 0, -0.10);
  let minDist = stemDist - 0.055;

  // 2. Left Bronchial / Lung Contour Arc
  // Centered at (-0.26, 0.08), radius 0.28
  const leftDist = Math.hypot(nx + 0.26, ny - 0.08);
  // Only the outer-lower arc for the left lung
  if (nx < 0.05 && ny > -0.25) {
    const dLeftArc = Math.abs(leftDist - 0.28) - 0.052;
    minDist = Math.min(minDist, dLeftArc);
  }

  // 3. Right Bronchial / Lung Contour Arc
  // Centered at (0.26, 0.08), radius 0.28
  const rightDist = Math.hypot(nx - 0.26, ny - 0.08);
  if (nx > -0.05 && ny > -0.25) {
    const dRightArc = Math.abs(rightDist - 0.28) - 0.052;
    minDist = Math.min(minDist, dRightArc);
  }

  // 4. Branching Bridges from Trachea to Left & Right Lobes
  const leftBranch = distToSegment(nx, ny, 0, -0.10, -0.26, 0.08);
  const rightBranch = distToSegment(nx, ny, 0, -0.10, 0.26, 0.08);
  minDist = Math.min(minDist, leftBranch - 0.048, rightBranch - 0.048);

  // 5. Left Lung Base Accent (rounded bottom tip)
  const leftTip = Math.hypot(nx + 0.26, ny - 0.36);
  minDist = Math.min(minDist, leftTip - 0.055);

  // 6. Right Lung Base Accent (rounded bottom tip)
  const rightTip = Math.hypot(nx - 0.26, ny - 0.36);
  minDist = Math.min(minDist, rightTip - 0.055);

  // 7. Aerosol Micro-Droplet Core above Trachea (The Nebulizer Mist)
  const dropletDist = Math.hypot(nx, ny + 0.58);
  minDist = Math.min(minDist, dropletDist - 0.075);

  return minDist;
}

// Renders the single-color logo pixel
function renderPixel(x, y, w, h, mode) {
  // Normalize to [-1, 1]
  const nx = (x - w / 2) / (w / 2);
  const ny = (y - h / 2) / (h / 2);

  const dist = evalGlyphDistance(nx, ny);
  const aa = 2.0 / (w / 2); // Anti-aliasing width

  // Smooth edge step
  let coverage = 0;
  if (dist < -aa) {
    coverage = 1;
  } else if (dist < aa) {
    coverage = (aa - dist) / (2 * aa);
  }

  if (mode === 'transparent') {
    // Pure one-color glyph on transparent background (for adaptive icon foreground)
    const alpha = Math.round(coverage * 255);
    return [BRAND_R, BRAND_G, BRAND_B, alpha];
  } else if (mode === 'solid-white-bg') {
    // One-color glyph on pure white background
    const r = Math.round(BRAND_R * coverage + 255 * (1 - coverage));
    const g = Math.round(BRAND_G * coverage + 255 * (1 - coverage));
    const b = Math.round(BRAND_B * coverage + 255 * (1 - coverage));
    return [r, g, b, 255];
  } else {
    // Icon with gentle rounded border on clean white
    const squircle = Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4);
    if (squircle > 0.85) {
      return [0, 0, 0, 0]; // Transparent outer corners
    }
    const r = Math.round(BRAND_R * coverage + 255 * (1 - coverage));
    const g = Math.round(BRAND_G * coverage + 255 * (1 - coverage));
    const b = Math.round(BRAND_B * coverage + 255 * (1 - coverage));
    return [r, g, b, 255];
  }
}

console.log('Generating simple one-color SmartNeb brand assets...');

const adaptivePng = createPng(1024, 1024, (x, y, w, h) => renderPixel(x, y, w, h, 'transparent'));
const iconPng = createPng(1024, 1024, (x, y, w, h) => renderPixel(x, y, w, h, 'rounded'));
const splashPng = createPng(1024, 1024, (x, y, w, h) => renderPixel(x, y, w, h, 'solid-white-bg'));
const faviconPng = createPng(128, 128, (x, y, w, h) => renderPixel(x, y, w, h, 'transparent'));

fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptivePng);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconPng);
fs.writeFileSync(path.join(assetsDir, 'splash-icon.png'), splashPng);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), faviconPng);

// Minimalist Single-Color Vector SVG
const singleColorSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- SmartNeb Simple One-Color Logo (#0284c7) -->
  <g fill="#0284c7" stroke="#0284c7" stroke-linecap="round" stroke-linejoin="round">
    <!-- Nebulizer Mist Particle -->
    <circle cx="256" cy="106" r="22" stroke="none" />
    
    <!-- Central Inhalation Trachea -->
    <path d="M 256 148 L 256 230" stroke-width="26" fill="none" />
    
    <!-- Bronchial Bifurcation Branches -->
    <path d="M 256 230 Q 200 250 190 275" stroke-width="24" fill="none" />
    <path d="M 256 230 Q 312 250 322 275" stroke-width="24" fill="none" />
    
    <!-- Left Lung Airflow Curve -->
    <path d="M 190 275 C 150 320 160 380 200 395 C 225 405 240 375 235 345 C 230 310 205 290 190 275 Z" />
    
    <!-- Right Lung Airflow Curve -->
    <path d="M 322 275 C 362 320 352 380 312 395 C 287 405 272 375 277 345 C 282 310 307 290 322 275 Z" />
  </g>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'smartneb-logo.svg'), singleColorSvg);
console.log('✅ Simple one-color SmartNeb logo assets generated successfully!');
