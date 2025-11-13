// encode.js
const fs = require("fs");
const key = fs.readFileSync("../realestate-fbcf5-firebase-adminsdk-fbsvc-0aded39002.json", "utf8");
const base64 = Buffer.from(key).toString("base64");
console.log(base64);