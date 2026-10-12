const fs = require('fs');
const content = fs.readFileSync('backend/server.js', 'utf8');
const routes = [];
const re = /app\.(get|post|put|delete|patch)\(["']([^"']+)["']/g;
let m;
while ((m = re.exec(content)) !== null) {
  routes.push(m[1].toUpperCase() + ' ' + m[2]);
}
console.log(routes.filter(r => r.includes('/api/v1/')).join('\n'));
