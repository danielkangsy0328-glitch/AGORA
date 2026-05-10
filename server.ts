import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

console.log("SERVER.TS STARTING...");

// Environment-agnostic way to get __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API Router to group endpoints
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV || "development",
      time: new Date().toISOString()
    });
  });

  apiRouter.get("/diag", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.AI_STUDIO_API_KEY || process.env.GOOGLE_API_KEY;
    const sanitizedKey = apiKey ? apiKey.trim()
      .replace(/^(GEMINI_API_KEY|VITE_GEMINI_API_KEY|AI_STUDIO_API_KEY|GOOGLE_API_KEY)\s*[:=]\s*/i, "")
      .replace(/^["']|["']$/g, "")
      .replace(/[\s\u00A0\u200B-\u200D\uFEFF]/g, "") : null;
    
    res.json({
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd(),
      nodeEnv: process.env.NODE_ENV,
      apiKeyDetected: !!apiKey,
      apiKeyLength: sanitizedKey ? sanitizedKey.length : 0,
      apiKeyValidFormat: sanitizedKey ? (sanitizedKey.startsWith("AIza") && sanitizedKey.length > 20) : false,
      info: "Gemini API calls are now handled on the client side per AI Studio guidelines."
    });
  });

  // Mount API router
  app.use("/api", apiRouter);

  // Vite + Static serving
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode with Vite middleware");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Robust production path discovery
    const possiblePaths = [
      path.join(process.cwd(), "dist"),
      path.join(__dirname, "dist"),
      path.resolve("dist")
    ];
    
    const fs = await import("fs");
    let distPath = "";
    
    console.log("Production Mode: Searching for static files...");
    for (const p of possiblePaths) {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        distPath = p;
        break;
      }
    }

    if (!distPath) {
      console.error("CRITICAL: 'dist' directory not found!");
    } else {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send("Frontend bundle index.html missing.");
        }
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on 0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
