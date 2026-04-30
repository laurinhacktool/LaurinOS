import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

const proxy = createProxyMiddleware({
  target: "http://127.0.0.1:8808",
  changeOrigin: true,
  pathRewrite: {
    "^/core-api": "/api",
  },
  on: {
    proxyReq: (proxyReq, req, res) => {
      console.log(`Proxying ${req.method} ${req.url} to ${proxyReq.path}`);
    }
  }
});

app.use("/core-api", proxy);

app.listen(3001, () => {
  console.log("Test proxy running on 3001");
});
