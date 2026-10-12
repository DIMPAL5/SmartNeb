const { toQR } = require('../../mobile/node_modules/toqr');
const fs = require('fs');
const path = require('path');

const os = require('os');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();
const expoUrl = `exp://${localIp}:8081`;
console.log(`Generating QR code for: ${expoUrl}`);
const grid = toQR(expoUrl);
const size = Math.sqrt(grid.length);

// 1. ASCII output for terminal/markdown
let border = '██'.repeat(size + 2);
let ascii = border + '\n';
for (let y = 0; y < size; y++) {
  let row = '██';
  for (let x = 0; x < size; x++) {
    row += grid[y * size + x] === 1 ? '  ' : '██'; // Inverted for white background or dark terminal
  }
  row += '██';
  ascii += row + '\n';
}
ascii += border;

console.log('=== ASCII QR CODE ===');
console.log(ascii);

// 2. SVG File generation
const cellSize = 10;
const margin = 20;
const svgSize = size * cellSize + margin * 2;
let svgPaths = '';

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    if (grid[y * size + x] === 1) {
      const px = margin + x * cellSize;
      const py = margin + y * cellSize;
      svgPaths += `<rect x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" fill="#000000"/>`;
    }
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="300" height="300">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${svgPaths}
</svg>`;

const outputPath = path.join(__dirname, '../../qr-code.svg');
fs.writeFileSync(outputPath, svg);
console.log(`\nSVG QR code saved to: ${outputPath}`);
