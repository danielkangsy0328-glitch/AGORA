import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

  let genAI: any = null;
  const MODEL_NAME = "gemini-1.5-flash";

  function getAI() {
    if (!genAI) {
      // Check multiple possible env var names
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.AI_STUDIO_API_KEY || process.env.GOOGLE_API_KEY;
      
      if (!apiKey) {
        console.error("CRITICAL: GEMINI_API_KEY is missing from environment. Please set it in AI Studio Settings.");
        throw new Error("API Key가 설정되지 않았습니다. AI Studio 우측 상단의 'Settings' -> 'Environment Variables' 메뉴에서 'GEMINI_API_KEY'를 추가해 주세요.");
      }
      
      let trimmedKey = apiKey.trim();
      
      // Final sanitization
      trimmedKey = trimmedKey.replace(/^["']|["']$/g, "").trim();
      trimmedKey = trimmedKey.replace(/\s/g, "").replace(/[\u200B-\u200D\uFEFF]/g, "");

      if (trimmedKey === "" || trimmedKey === "undefined") {
        console.error("CRITICAL: GEMINI_API_KEY is empty or undefined.");
        throw new Error("API Key가 설정되지 않았습니다. AI Studio 'Settings' -> 'Environment Variables'에서 'GEMINI_API_KEY'를 추가해 주세요.");
      }

      if (trimmedKey.length < 10) {
        console.error(`CRITICAL: GEMINI_API_KEY is suspiciously short (${trimmedKey.length} chars).`);
        throw new Error("입력된 API Key가 너무 짧습니다. 올바른 Gemini API Key(AIza...로 시작하는 긴 문자열)를 입력했는지 확인해 주세요.");
      }
      
      console.log(`Initializing SDK with key (length: ${trimmedKey.length}, prefix: ${trimmedKey.substring(0, 4)}...)`);
      genAI = new GoogleGenerativeAI(trimmedKey);
    }
    return genAI;
  }

  function validateHistory(history: any[]) {
    if (!history || !Array.isArray(history)) return [];
    
    // Map roles and ensure parts exist
    const mapped = history
      .map((m: any) => ({
        role: (m.role === 'user' || m.role === 'human') ? 'user' : 'model',
        parts: [{ text: (typeof m.content === 'string' ? m.content : (m.parts && m.parts[0]?.text) || "") }]
      }))
      .filter(m => m.parts[0].text.trim().length > 0);

    // Gemini requirement: First message must be 'user'
    const firstUserIdx = mapped.findIndex(m => m.role === 'user');
    if (firstUserIdx === -1) return [];

    let cleaned = mapped.slice(firstUserIdx);

    // Filter to ensure alternating roles
    const result = [];
    let lastRole = null;
    for (const msg of cleaned) {
      if (msg.role !== lastRole) {
        result.push(msg);
        lastRole = msg.role;
      } else if (result.length > 0) {
        result[result.length - 1].parts[0].text += "\n" + msg.parts[0].text;
      }
    }
    return result;
  }

  apiRouter.get("/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV || "development",
      time: new Date().toISOString()
    });
  });

  apiRouter.get("/diag", (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.AI_STUDIO_API_KEY || process.env.GOOGLE_API_KEY;
    const sanitizedKey = apiKey ? apiKey.trim().replace(/^["']|["']$/g, "").replace(/\s/g, "") : null;
    
    res.json({
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd(),
      nodeEnv: process.env.NODE_ENV,
      apiKeyDetected: !!apiKey,
      apiKeySource: apiKey === process.env.GEMINI_API_KEY ? "GEMINI_API_KEY" : (apiKey === process.env.VITE_GEMINI_API_KEY ? "VITE_GEMINI_API_KEY" : "OTHER"),
      apiKeyLength: sanitizedKey ? sanitizedKey.length : 0,
      apiKeyPrefix: sanitizedKey ? sanitizedKey.substring(0, 4) : null,
      apiKeyValidFormat: sanitizedKey ? (sanitizedKey.startsWith("AIza") && sanitizedKey.length > 20) : false
    });
  });

  apiRouter.post("/gemini/chat", async (req, res) => {
    try {
      const { history, userInput, difficulty, topic } = req.body;
      const model = getAI().getGenerativeModel({ 
        model: MODEL_NAME,
        systemInstruction: `당신은 고대 그리스의 철학자 소크라테스입니다. 주제: "${topic}", 난이도: ${difficulty}. 질문을 통해 사용자가 스스로 깨닫게 하세요.`
      });
      
      const chat = model.startChat({
        history: validateHistory(history),
      });

      const result = await chat.sendMessage(userInput);
      res.json({ text: result.response.text() });
    } catch (error: any) {
      console.error("Chat Error:", error);
      const errorMessage = error.message || String(error);
      if (errorMessage.includes("API key not valid")) {
        return res.status(401).json({ error: "API Key가 유효하지 않습니다. AI Studio 'Settings' -> 'Environment Variables'에서 GEMINI_API_KEY를 올바르게 입력했는지 확인해 주세요." });
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  apiRouter.post("/gemini/evaluate", async (req, res) => {
    try {
      const { history, topic } = req.body;
      const model = getAI().getGenerativeModel({ model: MODEL_NAME });
      
      const dialogueText = history
        .map((m: any) => `${m.role === 'user' ? '학생' : '소크라테스'}: ${m.content || (m.parts && m.parts[0]?.text) || ""}`)
        .join('\n');

      const prompt = `주제 "${topic}"에 대한 대화를 분석하여 JSON으로 평가하세요.
        형식: { "scores": [{"name": "...", "value": 0~100, "label": "..."}], "initialHypothesis": "...", "elenchusPoint": "...", "reachedReason": "...", "keywords": [...] }
        대화:
        ${dialogueText}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleanJson));
    } catch (error: any) {
      console.error("Evaluate Error:", error);
      const errorMessage = error.message || String(error);
      if (errorMessage.includes("API key not valid")) {
        return res.status(401).json({ error: "API Key가 유효하지 않습니다. AI Studio 'Settings' -> 'Environment Variables'에서 GEMINI_API_KEY를 올바르게 입력했는지 확인해 주세요." });
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  apiRouter.post("/gemini/debate", async (req, res) => {
    try {
      const { history, topic, userStance } = req.body;
      const model = getAI().getGenerativeModel({ 
        model: MODEL_NAME,
        systemInstruction: `당신은 논쟁 중인 소크라테스입니다. 주제: "${topic}", 입장: ${userStance === 'pro' ? '찬성' : '반대'}. 상대의 논리를 부수세요.`
      });
      
      const validatedHistory = validateHistory(history);
      const chat = model.startChat({
        history: validatedHistory.slice(0, -1),
      });

      const lastMessage = validatedHistory[validatedHistory.length - 1];
      const result = await chat.sendMessage(lastMessage.parts[0].text);
      res.json({ text: result.response.text() });
    } catch (error: any) {
      console.error("Debate Error:", error);
      const errorMessage = error.message || String(error);
      if (errorMessage.includes("API key not valid")) {
        return res.status(401).json({ error: "API Key가 유효하지 않습니다. AI Studio 'Settings' -> 'Environment Variables'에서 GEMINI_API_KEY를 올바르게 입력했는지 확인해 주세요." });
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  apiRouter.post("/gemini/guide", async (req, res) => {
    try {
      const { history, userInput, attachedDocs } = req.body;
      const model = getAI().getGenerativeModel({ 
        model: MODEL_NAME,
        systemInstruction: "당신은 학습 보조자 소크라테스입니다. 질문으로 유도하세요."
      });
      
      const chat = model.startChat({
        history: validateHistory(history),
      });

      const result = await chat.sendMessage(`${userInput}\n${attachedDocs || ""}`);
      res.json({ text: result.response.text() });
    } catch (error: any) {
      console.error("Guide Error:", error);
      const errorMessage = error.message || String(error);
      if (errorMessage.includes("API key not valid")) {
        return res.status(401).json({ error: "API Key가 유효하지 않습니다. AI Studio 'Settings' -> 'Environment Variables'에서 GEMINI_API_KEY를 올바르게 입력했는지 확인해 주세요." });
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  apiRouter.post("/gemini/report-guide", async (req, res) => {
    try {
      const { topic } = req.body;
      const model = getAI().getGenerativeModel({ model: MODEL_NAME });
      const prompt = `주제 "${topic}"에 대한 탐구 보고서 가이드를 JSON으로 생성하세요. { "suggestedTitles": [...], "motivationPrompts": [...], "dialogueSummaryPoints": [...], "criticalThinkingPoints": [...], "futureInquiryQuestions": [...] }`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleanJson));
    } catch (error: any) {
      console.error("Report Guide Error:", error);
      const errorMessage = error.message || String(error);
      if (errorMessage.includes("API key not valid")) {
        return res.status(401).json({ error: "API Key가 유효하지 않습니다. AI Studio 'Settings' -> 'Environment Variables'에서 GEMINI_API_KEY를 올바르게 입력했는지 확인해 주세요." });
      }
      res.status(500).json({ error: errorMessage });
    }
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
      console.log(`Checking path: ${p}`);
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        distPath = p;
        break;
      }
    }

    if (!distPath) {
      console.error("CRITICAL: 'dist' directory not found! Frontend will not load.");
      console.error("Contents of CWD:", fs.readdirSync(process.cwd()));
    } else {
      console.log(`Serving static files from: ${distPath}`);
      const indexExists = fs.existsSync(path.join(distPath, "index.html"));
      console.log(`index.html exists: ${indexExists}`);
      
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send("Frontend bundle (index.html) missing in dist folder.");
        }
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on 0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
