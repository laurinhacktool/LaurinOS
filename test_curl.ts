import http from "http";

http.get("http://localhost:3000/core-api/status", (res) => {
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    console.log("STATUS:", res.statusCode);
    console.log("HEADERS:", res.headers);
    console.log("BODY:", data.substring(0, 200));
  });
});
