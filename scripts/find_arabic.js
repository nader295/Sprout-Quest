const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const directoriesToScan = ['app', 'components'];

function scanDirectory(dir) {
  let results = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(scanDirectory(fullPath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Look for Arabic text outside of comments
      // A naive approach: strip // comments and /* */ comments first
      let noComments = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
      
      // Match Arabic characters inside strings or JSX text
      // We look for any Arabic characters
      if (/[\u0600-\u06FF]/.test(noComments)) {
        // Find specific lines
        const lines = noComments.split('\n');
        lines.forEach((line, index) => {
          if (/[\u0600-\u06FF]/.test(line)) {
            // Check if it's inside a t() call or console.log or Error
            if (!line.includes('t("') && !line.includes("t('") && !line.includes('console.') && !line.includes('Error(') && !line.includes('flash(') && !line.includes('toast(')) {
              results.push(`${fullPath.replace(projectRoot, '')}:${index + 1}: ${line.trim()}`);
            }
          }
        });
      }
    }
  }
  return results;
}

let allResults = [];
for (const dir of directoriesToScan) {
  allResults = allResults.concat(scanDirectory(path.join(projectRoot, dir)));
}

fs.writeFileSync(path.join(__dirname, 'arabic_strings_report.txt'), allResults.join('\n'));
console.log(`Found ${allResults.length} lines with Arabic text.`);
