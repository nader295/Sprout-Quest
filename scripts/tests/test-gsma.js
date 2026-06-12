const https = require("https");

const url = "https://fdn2.gsmarena.com/vv/bigpic/xiaomi-poco-x6.jpg";

https.get(url, {
  method: "HEAD",
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Referer": "https://www.gsmarena.com/"
  }
}, (res) => {
  console.log("Status:", res.statusCode);
  console.log("Headers:", res.headers);
}).on("error", (e) => {
  console.error("Error:", e.message);
});
