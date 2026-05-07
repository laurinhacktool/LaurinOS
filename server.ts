import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import { spawn } from "child_process";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { getLlama, LlamaChatSession } from "node-llama-cpp";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const apiRouter = express.Router();

  // Inject Gemini API Key into config.json for Python backend
  const CONFIG_PATH = path.join(process.cwd(), "config.json");
  try {
    let configData = { gemini_api_key: "", telegram_token: "" };
    if (fs.existsSync(CONFIG_PATH)) {
      configData = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
    const envApiKey = process.env.MY_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (envApiKey && envApiKey !== "MY_GEMINI_API_KEY") {
      if (configData.gemini_api_key !== envApiKey) {
        configData.gemini_api_key = envApiKey;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(configData, null, 4));
        console.log("Injected/Updated GEMINI_API_KEY in config.json from environment");
      }
    }
  } catch (err) {
    console.error("Failed to inject GEMINI_API_KEY into config.json:", err);
  }

  // Start Python backend
  console.log("Starting Python backend (server.py)...");
  const startPython = (command: string) => {
    console.log(`Attempting to start Python process with command: ${command}`);
    const proc = spawn(command, ["server.py"], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: "1" }
    });

    proc.stdout.on("data", (data) => {
      process.stdout.write(`[Python] ${data}`);
    });

    proc.stderr.on("data", (data) => {
      process.stderr.write(`[Python ERROR] ${data}`);
    });

    proc.on("error", (err: any) => {
      console.error(`Failed to start Python process with ${command}:`, err);
      if (err.code === "ENOENT") {
        (proc as any).enoent = true;
        if (command === "python3") {
          console.log("Retrying with 'python'...");
          startPython("python");
        } else {
          console.error("Python interpreter not found. Python backend will be disabled.");
        }
      }
    });

    proc.on("close", (code) => {
      console.log(`Python process (${command}) exited with code ${code}`);
      if ((proc as any).enoent) return;
      
      if (code !== 0 && code !== null) {
        console.log("Python process crashed. Restarting in 5 seconds...");
        setTimeout(() => startPython(command), 5000);
      }
    });

    return proc;
  };

  const pythonProcess = startPython("python3");

  app.use(cors());
  
  // Merge Node and Python status for status routes
  const statusHandler = async (req: any, res: any, next: any) => {
    try {
      const nvram = readNvram();
      const nodeData = {
        registers: nvram.last_reg_state,
        chat: nvram.chat_history,
        logs: [],
        queries_left: nvram.queries_left || 50,
        total_queries: nvram.total_queries || 50
      };

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // Increased timeout to 5s
        
        const pythonRes = await fetch("http://127.0.0.1:8808/core-api/status", { 
          signal: controller.signal 
        });
        clearTimeout(timeout);

        if (pythonRes.ok) {
          try {
            const pythonData = await pythonRes.json();
            if (pythonData && typeof pythonData === 'object') {
              return res.json({ ...nodeData, ...pythonData });
            }
          } catch (parseErr) {
            console.error("Failed to parse Python status JSON:", parseErr);
          }
        }
      } catch (err: any) {
        // Fallback to basic data if Python is down, timed out, or connection reset
        if (err.name === 'AbortError') {
          console.warn("Python status fetch timed out after 5s");
        }
      }
      res.json(nodeData);
    } catch (err) {
      next();
    }
  };

  app.get("/core-api/status", statusHandler);
  app.get("/api/status", statusHandler);

  app.use("/core-api", apiRouter);
  app.use("/api", apiRouter);

  // Catch-all for unknown API routes to ensure they return JSON
  app.use(["/core-api", "/api"], (req, res, next) => {
    // If it's not handled by apiRouter, let it pass to proxy if matches proxy filters
    next();
  });

  app.use((req, res, next) => {
    if (req.url.startsWith('/core-api') || req.url.startsWith('/api')) {
      console.log(`${req.method} ${req.url}`);
    }
    next();
  });

  const NVRAM_PATH = path.join(process.cwd(), "nvram.json");

  // Initialize nvram.json if it doesn't exist
  if (!fs.existsSync(NVRAM_PATH)) {
    const initialNvram = {
      owner: "Roman Nižňanský",
      last_reg_state: { R0: 0, R1: 0, R2: 0, R3: 0 },
      chat_history: []
    };
    fs.writeFileSync(NVRAM_PATH, JSON.stringify(initialNvram, null, 4));
  }

  const readNvram = (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const data = fs.readFileSync(NVRAM_PATH, "utf-8");
        if (!data || data.trim() === "") {
          throw new Error("Empty nvram file");
        }
        return JSON.parse(data);
      } catch (err) {
        if (i === retries - 1) {
          console.error(`Error reading nvram.json after ${retries} attempts:`, err);
          return { owner: "Unknown", last_reg_state: { R0: 0, R1: 0, R2: 0, R3: 0 }, chat_history: [] };
        }
        // Small synchronous delay without Atomics
        const start = Date.now();
        while(Date.now() - start < 50) { /* wait */ }
      }
    }
    return { owner: "Unknown", last_reg_state: { R0: 0, R1: 0, R2: 0, R3: 0 }, chat_history: [] };
  };

  const writeNvram = (data: any) => {
    try {
      fs.writeFileSync(NVRAM_PATH, JSON.stringify(data, null, 4));
    } catch (err) {
      console.error("Error writing nvram.json:", err);
    }
  };

  const readConfig = () => {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      }
    } catch (err) {
      console.error("Error reading config.json:", err);
    }
    return { 
      gemini_api_key: "", 
      telegram_token: "", 
      telegram_chat_ids: [], 
      custom_api_url: "", 
      custom_api_key: "", 
      custom_model: "",
      preferred_provider: "gemini",
      local_model_path: ""
    };
  };

  const writeConfig = (data: any) => {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 4));
    } catch (err) {
      console.error("Error writing config.json:", err);
    }
  };

  apiRouter.get("/test", (req, res) => {
    res.json({ 
      status: "ok", 
      message: "API is working", 
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      keyLength: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
      actualKey: process.env.GEMINI_API_KEY
    });
  });

  let llamaInstance: any = null;
  let currentModelPath: string = "";
  let currentContext: any = null;
  let currentSession: any = null;

  apiRouter.post("/local-chat", express.json(), async (req, res) => {
    try {
      const { prompt, model_path } = req.body;
      if (!model_path) return res.status(400).json({ error: "Missing model_path" });

      if (!llamaInstance) {
          llamaInstance = await getLlama();
      }
      
      const fullPath = path.join(process.cwd(), model_path);
      if (!fs.existsSync(fullPath)) {
          return res.status(404).json({ error: `Model not found: ${model_path}` });
      }

      if (currentModelPath !== model_path || !currentContext) {
        if (currentContext) {
          await currentContext.dispose?.();
        }
        currentModelPath = model_path;
        console.log(`Loading model ${model_path}...`);
        const model = await llamaInstance.loadModel({ modelPath: fullPath });
        currentContext = await model.createContext();
        currentSession = new LlamaChatSession({ contextSequence: currentContext.getSequence() });
        console.log(`Model loaded successfully.`);
      }

      console.log(`Prompt: ${prompt}`);
      const answer = await currentSession.prompt(prompt);
      console.log(`Answer length: ${answer?.length}`);
      res.json({ response: answer });

    } catch(e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get("/bypass", (req, res) => {
    res.json({ status: "ok", user: "roman" });
  });

  apiRouter.get("/config", (req, res) => {
    try {
      const config = readConfig();
      res.json({ 
        gemini_api_key: config.gemini_api_key || "",
        custom_api_url: config.custom_api_url || "",
        custom_api_key: config.custom_api_key || "",
        custom_model: config.custom_model || "",
        preferred_provider: config.preferred_provider || "gemini",
        local_model_path: config.local_model_path || "",
        local_model_temp: config.local_model_temp ?? 0.7,
        local_model_max_tokens: config.local_model_max_tokens ?? 2048,
        local_model_top_p: config.local_model_top_p ?? 0.9
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load config" });
    }
  });

  apiRouter.post("/config", express.json(), (req, res) => {
    try {
      const { gemini_api_key, custom_api_url, custom_api_key, custom_model, preferred_provider, local_model_path, local_model_temp, local_model_max_tokens, local_model_top_p } = req.body;
      const config = readConfig();
      if (gemini_api_key !== undefined) config.gemini_api_key = gemini_api_key;
      if (custom_api_url !== undefined) config.custom_api_url = custom_api_url;
      if (custom_api_key !== undefined) config.custom_api_key = custom_api_key;
      if (custom_model !== undefined) config.custom_model = custom_model;
      if (preferred_provider !== undefined) config.preferred_provider = preferred_provider;
      if (local_model_path !== undefined) config.local_model_path = local_model_path;
      if (local_model_temp !== undefined) config.local_model_temp = local_model_temp;
      if (local_model_max_tokens !== undefined) config.local_model_max_tokens = local_model_max_tokens;
      if (local_model_top_p !== undefined) config.local_model_top_p = local_model_top_p;
      
      writeConfig(config);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to save config" });
    }
  });

  apiRouter.post("/chat/save", express.json(), (req, res) => {
    try {
      const { message } = req.body;
      const nvram = readNvram();
      nvram.chat_history.push(message);
      writeNvram(nvram);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to save chat" });
    }
  });



  apiRouter.post("/chat/delete", express.json(), (req, res) => {
    try {
      const { index } = req.body;
      const nvram = readNvram();
      if (index >= 0 && index < nvram.chat_history.length) {
        nvram.chat_history.splice(index, 1);
        writeNvram(nvram);
        res.json({ status: "ok" });
      } else {
        res.status(400).json({ error: "Invalid index" });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to delete chat" });
    }
  });

  apiRouter.post("/download-model", express.json(), (req, res) => {
    const { url, filename } = req.body;
    console.log(`Starting model download process for ${filename} from ${url}...`);
    
    // Clear previous status if exists
    const statusPath = path.join(process.cwd(), 'download_status.json');
    if (fs.existsSync(statusPath)) {
      try { fs.unlinkSync(statusPath); } catch(e) {}
    }

    const dest = path.join(process.cwd(), filename || 'dolphin.gguf');
    const updateStatus = (progress: number, status: string, error?: string) => {
      fs.writeFileSync(statusPath, JSON.stringify({ progress, status, error, timestamp: Date.now() }));
    };

    updateStatus(0, 'starting');

    const downloadUrlStr = url || 'https://huggingface.co/mradermacher/Dolphin3.0-Llama3.1-8B-GGUF/resolve/main/Dolphin3.0-Llama3.1-8B.Q4_K_M.gguf';

    let totalExpectedSize = 0;
    const originalDownloadUrl = url || 'https://huggingface.co/mradermacher/Dolphin3.0-Llama3.1-8B-GGUF/resolve/main/Dolphin3.0-Llama3.1-8B.Q4_K_M.gguf';

    const startDownload = async (currentUrl: string, retries = 50) => {
      try {
        const https = await import('https');
        
        let downloadedSize = 0;
        let options: any = { headers: {} };
        if (fs.existsSync(dest)) {
          const stat = fs.statSync(dest);
          downloadedSize = stat.size;
          if (downloadedSize > 0) {
            options.headers['Range'] = `bytes=${downloadedSize}-`;
            console.log(`Resuming download from ${downloadedSize} bytes...`);
          }
        }

        https.get(currentUrl, options, (response: any) => {
          if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 307 || response.statusCode === 308) {
            if (response.headers.location) {
              console.log(`Redirecting to: ${response.headers.location}`);
              startDownload(response.headers.location, retries);
              return;
            }
          }

          if (response.statusCode !== 200 && response.statusCode !== 206) {
            if (response.statusCode === 416) {
              console.log('Got 416, file might be already downloaded completely');
              updateStatus(100, 'completed');
              return;
            }
            const errMsg = `Failed to download: ${response.statusCode}`;
            console.error(errMsg);
            if (retries > 0) {
              console.log(`Retrying from original URL... (${retries} left)`);
              setTimeout(() => startDownload(originalDownloadUrl, retries - 1), 2000);
            } else {
              updateStatus(0, 'error', errMsg);
            }
            return;
          }

          if (response.statusCode === 200 && downloadedSize > 0) {
            console.log('Server ignored Range header, starting from scratch');
            downloadedSize = 0;
            totalExpectedSize = 0;
          }

          if (totalExpectedSize === 0) {
            const contentLength = parseInt(response.headers['content-length'] || '0', 10);
            if (response.statusCode === 206) {
              totalExpectedSize = downloadedSize + contentLength;
            } else {
              totalExpectedSize = contentLength;
            }
          }

          const file = fs.createWriteStream(dest, { flags: response.statusCode === 206 ? 'a' : 'w' });

          response.setTimeout(30000, () => {
            console.error('Download connection timed out. Retrying...');
            response.destroy();
            file.close();
            if (retries > 0) {
              setTimeout(() => startDownload(originalDownloadUrl, retries - 1), 2000);
            } else {
              updateStatus(Math.round((downloadedSize / totalExpectedSize) * 100) || 0, 'error', 'Download timed out');
            }
          });

          let lastUpdate = 0;
          response.on('data', (chunk: any) => {
            downloadedSize += chunk.length;
            const now = Date.now();
            if (totalExpectedSize > 0 && now - lastUpdate > 500) {
              const progress = Math.round((downloadedSize / totalExpectedSize) * 100);
              updateStatus(progress, 'downloading');
              lastUpdate = now;
            }
          });

          response.pipe(file);

          file.on('finish', () => {
             file.close();
             if (downloadedSize >= totalExpectedSize || totalExpectedSize === 0) {
               console.log('Download completed.');
               updateStatus(100, 'completed');
             } else {
               console.log(`Connection finished but file is incomplete. Retrying...`);
               if (retries > 0) {
                 setTimeout(() => startDownload(originalDownloadUrl, retries - 1), 2000);
               } else {
                 updateStatus(Math.round((downloadedSize / totalExpectedSize) * 100), 'error', 'Download interrupted');
               }
             }
          });

          file.on('error', (err: any) => {
            file.close();
            const errMsg = `File error: ${err.message}`;
            console.error(errMsg);
            if (retries > 0) {
              setTimeout(() => startDownload(originalDownloadUrl, retries - 1), 2000);
            } else {
              updateStatus(Math.round((downloadedSize / totalExpectedSize) * 100) || 0, 'error', errMsg);
            }
          });

        }).on('error', (err: any) => {
          const errMsg = `Network error: ${err.message}`;
          console.error(errMsg);
          if (retries > 0) {
            setTimeout(() => startDownload(originalDownloadUrl, retries - 1), 2000);
          } else {
            updateStatus(Math.round((downloadedSize / totalExpectedSize) * 100) || 0, 'error', errMsg);
          }
        });
      } catch (err: any) {
        const errMsg = `System error: ${err.message}`;
        console.error(errMsg);
        if (retries > 0) {
          setTimeout(() => startDownload(originalDownloadUrl, retries - 1), 2000);
        } else {
          updateStatus(0, 'error', errMsg);
        }
      }
    };

    startDownload(originalDownloadUrl);

    // Write headers and initial small JSON to resolve frontend's `fetch`, but leave it open!
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{"status": "started"}\n');
    
    // Keep connection alive to prevent Cloud Run CPU throttling
    const keepAlive = setInterval(() => {
      res.write(' ');
    }, 5000);
    
    // Original updateStatus but now it also closes the response on completion!
    const originalUpdateStatus = updateStatus;
    const boundedUpdateStatus = (progress: number, status: string, error?: string) => {
      originalUpdateStatus(progress, status, error);
      if (status === 'completed' || status === 'error') {
        clearInterval(keepAlive);
        res.end();
      }
    };
    
    // Overwrite the updateStatus used inside startDownload closure... wait, we can't easily overwrite it since startDownload already captures the original.
    // Let's just create a watcher that checks download_status.json
    const checkCompletion = setInterval(() => {
      if (fs.existsSync(statusPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
          if (data.status === 'completed' || data.status === 'error') {
            clearInterval(keepAlive);
            clearInterval(checkCompletion);
            res.end();
          }
        } catch(e) {}
      }
    }, 2000);

    req.on('close', () => {
      clearInterval(keepAlive);
      clearInterval(checkCompletion);
    });
  });

  apiRouter.get("/download-status", (req, res) => {
    const statusPath = path.join(process.cwd(), 'download_status.json');
    if (fs.existsSync(statusPath)) {
      try {
        const data = fs.readFileSync(statusPath, 'utf-8');
        return res.json(JSON.parse(data));
      } catch (e) {
        return res.json({ status: 'error', message: 'Failed to read status' });
      }
    }
    res.json({ status: 'idle' });
  });

  apiRouter.get("/models", (req, res) => {
    try {
      const files = fs.readdirSync(process.cwd());
      const models = files.filter(f => f.endsWith('.gguf'));
      res.json({ models });
    } catch (err) {
      res.status(500).json({ error: "Failed to list models" });
    }
  });

  apiRouter.delete("/models/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      if (!filename.endsWith('.gguf')) {
        return res.status(400).json({ error: "Invalid file type" });
      }
      const filePath = path.join(process.cwd(), filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ status: "deleted" });
      } else {
        res.status(404).json({ error: "File not found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to delete model" });
    }
  });

  // Proxy API requests to Python backend
  const proxy = createProxyMiddleware({
    target: "http://127.0.0.1:8808",
    changeOrigin: true,
    ws: true,
    pathFilter: ["/core-api", "/api", "/fs-api", "/sys-api", "/net-api"],
    pathRewrite: {
      "^/fs-api": "/fs",
      "^/sys-api": "/sys",
      "^/net-api": "/net",
      "^/api": "/core-api", // Ensure /api calls go to the same Python /core-api endpoints
    },
    on: {
      proxyReq: (proxyReq, req) => {
        console.log(`Proxying ${req.method} ${req.url} -> http://127.0.0.1:8808${proxyReq.path}`);
        fixRequestBody(proxyReq, req);
      },
      error: (err, req, res) => {
        console.error("Proxy error:", err);
        if (res && 'writeHead' in res && !res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Python backend is not responding", details: err.message }));
        }
      }
    }
  });

  app.use(proxy);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
