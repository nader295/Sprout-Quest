const fs = require('fs');
const path = require('path');

const i18nDir = path.join(__dirname, '../lib/i18n/translations');
const files = fs.readdirSync(i18nDir).filter(f => f.endsWith('.ts'));

// Helper to extract keys and values from a file content
function extractTranslations(content) {
  const translations = {};
  // match "key": "value" or 'key': 'value'
  // this is a simplified regex, but works well for flat translation objects
  const regex = /(["'])([^"']+)\1\s*:\s*(["'])(.*?)\3/gs;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[2];
    const value = match[4];
    translations[key] = value;
  }
  return translations;
}

const enContent = fs.readFileSync(path.join(i18nDir, 'en.ts'), 'utf8');
const enTranslations = extractTranslations(enContent);

let totalMissing = 0;

files.forEach(file => {
  if (file === 'en.ts') return;
  
  const filePath = path.join(i18nDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const langTranslations = extractTranslations(content);
  
  const missingKeys = [];
  for (const [key, value] of Object.entries(enTranslations)) {
    if (!(key in langTranslations)) {
      missingKeys.push({ key, value });
    }
  }
  
  if (missingKeys.length > 0) {
    let match = content.match(/}(\s*as const)?\s*;/);
    if (!match) {
      match = content.match(/}(\s*)export default/);
    }
    
    if (match) {
      const lastBraceIndex = match.index;
      let toAdd = '\n  // Added missing keys from en.ts\n';
      missingKeys.forEach(item => {
        toAdd += `  "${item.key}": "${item.value.replace(/"/g, '\\"')}",\n`;
      });
      
      content = content.slice(0, lastBraceIndex) + toAdd + content.slice(lastBraceIndex);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[${file}] Added ${missingKeys.length} missing keys.`);
      totalMissing += missingKeys.length;
    } else {
      console.log(`[${file}] Could not find insertion point.`);
    }
  } else {
    console.log(`[${file}] is fully synchronized.`);
  }
});

console.log(`Total missing keys added across all languages: ${totalMissing}`);
