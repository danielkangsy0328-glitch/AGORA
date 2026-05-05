import express from "express";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Fallback for NODE_ENV

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Agora Philosophical Engine" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from the dist directory
    // If the server is bundled into dist/server.cjs, __dirname is the dist directory.
    const distPath = path.resolve(__dirname);
    const indexPath = path.join(distPath, "index.html");
    
    console.log(`[Production] Starting server...`);
    console.log(`[Production] Current working directory: ${process.cwd()}`);
    console.log(`[Production] __dirname: ${__dirname}`);
    console.log(`[Production] Static assets path: ${distPath}`);
    console.log(`[Production] Index file path: ${indexPath}`);

    // Log incoming requests for assets to debug blank screen
    app.use((req, res, next) => {
      // Skip logging for health check to avoid noise
      if (req.url === "/api/health") return next();
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });

    // Serve static files from dist
    app.use(express.static(distPath));
    
    // SPA fallback: Serve index.html for any other route
    app.get("*", (req, res) => {
      // If the request looks like an asset that wasn't found, log it specifically
      if (req.url.startsWith("/assets/")) {
        console.warn(`[SPA Fallback WARNING] Asset not found in static middleware: ${req.url}. Serving index.html instead, which will likely cause a syntax error in the browser.`);
      } else {
        console.log(`[SPA Fallback] Serving index.html for: ${req.url}`);
      }
      res.sendFile(indexPath);
    });
  }



  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
