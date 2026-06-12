const https = require("https");

https.get("https://m.gsmarena.com/res.php3?sSearch=Poco+X6", {
  headers: {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
  }
}, (res) => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    if (res.statusCode === 200) {
      const match = data.match(/<img src="(https:\/\/fdn2\.gsmarena\.com\/vv\/bigpic\/[^"]+)"/);
      console.log("Image:", match ? match[1] : "Not found");
    } else {
      console.log("Data:", data.slice(0, 200));
    }
  });
}).on("error", (e) => console.error(e));
