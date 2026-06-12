const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\2036c99f-8b2c-423a-96a5-95d16a812336\\romx_app_icon_1774665513965.png';
const dest512 = path.join(__dirname, '..', 'public', 'icon-512x512.png');
const dest192 = path.join(__dirname, '..', 'public', 'icon-192x192.png');
const svgIcon = path.join(__dirname, '..', 'public', 'icon.svg');

fs.copyFileSync(src, dest512);
fs.copyFileSync(src, dest192);

if (fs.existsSync(svgIcon)) {
  fs.unlinkSync(svgIcon);
}

console.log('Successfully applied new icon.');
