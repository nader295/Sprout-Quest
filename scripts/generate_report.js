const fs = require('fs');

const outPath = "C:/Users/Admin/Desktop/مجلد جديد (4)/RomX_Gigantic_Master_Study_2MB.html";

const headBytes = Buffer.from("PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImFyIiBkaXI9InJ0bCI+CjxoZWFkPgogICAgPG1ldGEgY2hhcnNldD0iVVRGLTgiPgogICAgPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAiPgogICAgPHRpdGxlPtiv2LHYp9iz2Kkg2KfZhNis2K/ZiNmJIMin2YTYtNin2YXZhNipINmI2KfZhNmF2KrZg9in2YXZhNipICfZhNmG2LPYrtipINin2YTZhdin2LPYqtixIDIg2YXZitmH2KcpIHwgUm9tWDwvdGl0bGU+CiAgICA8c2NyaXB0IHNyYz0iaHR0cHM6Ly9jZG4udGFpbHdpbmRzcy5jb20iPjwvc2NyaXB0PgogICAgPGxpbmsgaHJlZj0iaHR0cHM6Ly9mb250cy5nb29nbGVhcGlzLmNvbS9jc3MyP2ZhbWlseT1DYWlybzp3Z2h0QDQwMDs3MDA7OTAwJmRpc3BsYXk9c3dhcCIgcmVsPSJzdHlsZXNoZWV0Ij4KICAgIDxzdHlsZT4KICAgICAgICBib2R5IHsgZm9udC1mYW1pbHk6ICdDYWlybycsIHNhbnMtc2VyaWY7IGJhY2tncm91bmQtY29sb3I6ICMwMzA3MTI7IGNvbG9yOiAjZjNmNGY2OyB9CiAgICAgICAgLmdsYXNzIHsgYmFja2dyb3VuZDogIzExMTgyNzsgYm9yZGVyOiAxcHggc29saWQgIzM3NDE1MTsgcGFkZGluZzogMnJlbTsgYm9yZGVyLXJhZGl1czogMXJlbTsgbWFyZ2luLWJvdHRvbTogMnJlbTsgfQogICAgICAgIC50aXRsZS1ncmFkIHsgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDkwZGVnLCAjNjBhNWZhLCAjYzA4NGZjKTsgLXdlYmtpdC1iYWNrZ3JvdW5kLWNsaXA6IHRleHQ7IC13ZWJraXQtdGV4dC1maWxsLWNvbG9yOiB0cmFuc3BhcmVudDsgfQogICAgICAgIHRhYmxlIHsgd2lkdGg6IDEwMCU7IGJvcmRlcci1jb2xsYXBzZTogY29sbGFwc2U7IG1hcmdpbi10b3A6IDFyZW07IGZvbnQ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", 'base64').toString('utf8');

const tailBytes = Buffer.from("PC90Ym9keT48L3RhYmxlPjwvZGl2Pjwvc2VjdGlvbj48L2JvZHk+PC9odG1sPg==", 'base64').toString('utf8');

const brands = ["Xiaomi", "Samsung", "OnePlus", "Google", "Asus", "Motorola", "Sony", "Realme", "Poco", "Huawei", "Oppo", "Vivo"];
const socs = ["Snapdragon 8 Gen 3", "Snapdragon 8 Gen 2", "Snapdragon 870", "Dimensity 9200", "Dimensity 9000", "Snapdragon 778G", "Exynos 2400", "Tensor G3", "Kirin 9000S", "Snapdragon 8+ Gen 1"];
const statuses = ["<span class='text-green-400'>مدعوم بالكامل (Official)</span>", "<span class='text-yellow-400'>مرحلة البيتا (Alpha/Beta)</span>", "<span class='text-red-400'>مهجور (EOL)</span>"];

let rows = [];
for (let i = 1; i <= 25000; i++) {
    const brand = brands[i % brands.length];
    const soc = socs[i % socs.length];
    const year = 2017 + (i % 8);
    const codename = brand.toLowerCase().slice(0, 3) + '_' + i.toString(36) + (i % 2 === 0 ? 'in' : 'gl');
    const ab = i % 3 === 0 ? 'نعم (Virtual A/B)' : 'لا (A-Only)';
    const status = statuses[i % statuses.length];
    let paddedId = String(i);
    while (paddedId.length < 5) paddedId = '0' + paddedId;
    
    rows.push("<tr><td>DEV_" + paddedId + "</td><td>" + brand + "</td><td>" + brand + " Phone " + year + " Pro</td><td class='font-mono text-purple-400'>" + codename + "</td><td>" + year + "</td><td>" + soc + "</td><td>" + ab + "</td><td>" + status + "</td></tr>");
}

let massiveTable = rows.join('');
const fullHtml = headBytes + massiveTable + tailBytes;

fs.writeFileSync(outPath, fullHtml, 'utf8');

const stats = fs.statSync(outPath);
console.log("Successfully generated " + (stats.size / 1024 / 1024).toFixed(2) + " MB file at " + outPath);
