const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
     const list = fs.readdirSync(dir);
     list.forEach(file => {
       file = path.join(dir, file);
       const stat = fs.statSync(file);
       if (stat && stat.isDirectory()) {
         if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.next') && !file.includes('locales') && !file.includes('i18n')) {
           results = results.concat(walk(file));
         }
       } else if (file.endsWith('.tsx')) { // ONLY TSX FILES
         results.push(file);
       }
     });
  } catch(e) {}
  return results;
}

const files = [...walk('../app'), ...walk('../components')];
let found = false;
files.forEach(f => {
  try {
      const content = fs.readFileSync(f, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/[\u0600-\u06FF]/.test(line)) {
          // ignore comments
          if (!line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*') && !line.trim().startsWith('<!--')) {
             console.log(f + ':' + (i+1) + ': ' + line.trim());
             found = true;
          }
        }
      });
  } catch(e) {}
});

if (!found) console.log("No Arabic text found in app or components .tsx files.");
