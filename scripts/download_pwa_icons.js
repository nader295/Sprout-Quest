const https = require('https');
const fs = require('fs');
const path = require('path');

const downloadIcon = (size) => {
  return new Promise((resolve, reject) => {
    const url = `https://api.dicebear.com/7.x/initials/png?seed=RX&backgroundColor=1d9bf0&textColor=ffffff&fontWeight=700&size=${size}`;
    const dest = path.join(__dirname, '..', 'public', `icon-${size}x${size}.png`);

    
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, (redirectRes) => {
          const file = fs.createWriteStream(dest);
          redirectRes.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        });
      } else {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }
    }).on('error', reject);
  });
};

Promise.all([downloadIcon(192), downloadIcon(512)])
  .then(() => console.log('Icons generation completed!'))
  .catch((err) => console.error('Error downloading icons:', err));
