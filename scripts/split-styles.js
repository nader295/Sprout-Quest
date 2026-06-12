// One-shot dev tool: splits `app/globals.css` into base / components / animations layers
// and rewrites globals.css to re-import them. Run manually with:
//   node scripts/split-styles.js
// It is NOT part of the build pipeline — kept here (not under app/) to avoid
// Next.js discovering it as a route/module.
const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', 'app');
const cssPath = path.join(appDir, 'globals.css');
const stylesDir = path.join(appDir, 'styles');

if (!fs.existsSync(stylesDir)) fs.mkdirSync(stylesDir, { recursive: true });

const content = fs.readFileSync(cssPath, 'utf-8');
const lines = content.split('\n');

let currentMode = 'globals'; // we'll read until :root
let base = '';
let components = '';
let animations = '';

let inBlock = false;

// Simple finite state machine line by line
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trim = line.trim();

  // If we hit @import "tailwindcss"; we skip it, we'll put it in globals.css later
  if (trim.includes('@import "tailwindcss"')) {
    continue;
  }

  // Determine mode
  if (!inBlock && trim) {
    if (trim.startsWith(':root') || trim.startsWith('.dark') || trim.startsWith('.light') || 
        trim.startsWith('@theme') || trim.startsWith('@custom-variant') || 
        trim.startsWith('@layer') || trim.includes('.amoled') || trim.includes('theme-') || trim.includes('[dir="')) {
      currentMode = 'base';
    } 
    else if (trim.startsWith('@keyframes') || trim.startsWith('.animate-') || trim.includes('shimmer') || trim.includes('aurora') || trim.includes('nebula') || trim.includes('pulse')) {
      currentMode = 'animations';
    } 
    else if (trim.startsWith('.') || trim.startsWith('*') || trim.startsWith('::') || trim.startsWith('input') || trim.startsWith('select')) {
      currentMode = 'components';
    }
  }

  // Count braces
  const openCount = (line.match(/\{/g) || []).length;
  const closeCount = (line.match(/\}/g) || []).length;
  
  if (openCount > 0) inBlock = true;
  if (closeCount > 0) inBlock = false; // assumes block doesn't nest heavily without reset

  if (currentMode === 'base') base += line + '\n';
  else if (currentMode === 'components') components += line + '\n';
  else if (currentMode === 'animations') animations += line + '\n';
  else components += line + '\n'; // fallback
}

fs.writeFileSync(path.join(stylesDir, 'base.css'), base.trim());
fs.writeFileSync(path.join(stylesDir, 'components.css'), components.trim());
fs.writeFileSync(path.join(stylesDir, 'animations.css'), animations.trim());

const newGlobals = `@import "tailwindcss";\n@import "./styles/base.css";\n@import "./styles/components.css";\n@import "./styles/animations.css";\n`;
fs.writeFileSync(cssPath, newGlobals);

console.log('Successfully written styles.');
