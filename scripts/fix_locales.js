const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../lib/i18n/translations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

let fixed = 0;
for(const file of files) {
  if (file === 'en.ts') continue;
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');
  
  // Find "profile.deleteConfirmPlaceholder": "...", which ends with \",
  // which means it is unterminated.
  const regex = /\"profile\.deleteConfirmPlaceholder\":\s*\"[^\"]*\\\\\",/g;
  
  // Wait, let's just match any line that has profile.deleteConfirmPlaceholder and ends with \",
  const brokenLineRegex = /\"profile\.deleteConfirmPlaceholder\":(.*)\\\",/g;
  
  // Or simpler, just replace the entire line for profile.deleteConfirmPlaceholder if it looks broken
  const lines = content.split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('"profile.deleteConfirmPlaceholder"')) {
      if (!lines[i].match(/\",$/) && lines[i].trim().endsWith(',"')) {
          // just catching whatever weirdness
      }
      // Let's just forcibly reset it to the english one if it contains an unterminated escape
      if (lines[i].endsWith('\\",') || lines[i].includes('प्रकार \\",') || !lines[i].trim().endsWith('",') && !lines[i].trim().endsWith('`,')) {
        lines[i] = '  "profile.deleteConfirmPlaceholder": "Type \\"DELETE\\" to confirm",';
        changed = true;
      }
    }
  }
  
  if (changed) {
    fs.writeFileSync(p, lines.join('\n'));
    fixed++;
  }
}
console.log('Fixed ' + fixed + ' files');
