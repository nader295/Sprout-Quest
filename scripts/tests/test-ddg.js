const https = require("https");

const q = encodeURIComponent("Xiaomi Poco X6 smartphone proxy");
const url = `https://html.duckduckgo.com/html/?q=${q}`;

https.get(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0"
  }
}, (res) => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => {
    // Look for image thumbnail in DuckDuckGo HTML results
    const match = data.match(/<img class="result__icon__img" src="\/\/external-content\.duckduckgo\.com\/iu\/\?u=([^&"]+)/);
    if (match) {
        console.log("Success! Found image:", decodeURIComponent(match[1]));
    } else {
        console.log("Not found. Status:", res.statusCode);
        console.log(data.slice(0, 500));
    }
  });
});
