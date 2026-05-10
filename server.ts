import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

console.log("SERVER.TS MODULE LOADED");

// Environment-agnostic way to get __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("Starting server process...");

  app.use(express.json());

  // Logging middleware for all requests
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });

  // API endpoints
  let aiInstance: GoogleGenAI | null = null;
  const MODEL_NAME = "gemini-1.5-flash"; // Using 1.5 Flash for broader compatibility

  function getAI(): GoogleGenAI {
    if (!aiInstance) {
      const apiKey = process.env.GEMINI_API_KEY;
      console.log("Checking GEMINI_API_KEY...");
      
      if (!apiKey || apiKey.trim() === "" || apiKey === "undefined") {
        console.error("CRITICAL: GEMINI_API_KEY is missing or invalid.");
        throw new Error("API key가 설정되지 않았습니다. AI Studio 'Settings' 메뉴에서 GEMINI_API_KEY를 추가해주세요.");
      }
      
      console.log(`GEMINI_API_KEY found (length: ${apiKey.length}, starts with: ${apiKey.substring(0, 4)}...)`);
      
      aiInstance = new GoogleGenAI({ apiKey: apiKey.trim() });
    }
    return aiInstance;
  }

  app.get("/app-api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/app-api/gemini/chat", async (req, res) => {
    console.log("POST /app-api/gemini/chat", req.body?.userInput?.substring(0, 50));
    try {
      const ai = getAI();
      const { history, userInput, difficulty, topic } = req.body;
      
      // Ensure history doesn't start with 'model' which Gemini API might reject
      let validatedHistory = [...history];
      if (validatedHistory.length > 0 && validatedHistory[0].role === 'model') {
        validatedHistory.shift();
      }

      const systemInstruction = `
        당신은 고대 그리스의 철학자 소크라테스입니다. 
        사용자와 "${topic}"이라는 주제에 대해 대화(산파술)를 나눕니다.
        당신의 목표는 사용자에게 지식을 직접 전달하는 것이 아니라, 질문을 통해 사용자가 자신의 무지를 깨닫고 스스로 진리에 도달하도록 돕는 것입니다.
        규칙:
        1. 질문은 짧고 간결해야 합니다.
        2. 사용자의 주장에 포함된 모순을 지적하거나 가정에 의문을 던지세요.
        3. 친절하지만 비판적인 태도를 유지하세요.
        4. "무지의 지"를 실천하도록 유도하세요.
        5. 난이도(${difficulty})에 따라 대화의 깊이를 조절하세요.
        6. 한국어로 대화하세요.
      `;
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [...validatedHistory, { role: "user", parts: [{ text: userInput }] }],
        config: { systemInstruction, temperature: 0.8 },
      });
      res.json({ text: result.text || "생각이 잠시 엉켰구먼." });
    } catch (error: any) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/app-api/gemini/evaluate", async (req, res) => {
    console.log("POST /app-api/gemini/evaluate", req.body?.topic);
    try {
      const ai = getAI();
      const { history, topic } = req.body;
      const getMessageContent = (m: any) => {
        if (m.content) return m.content;
        if (m.parts && m.parts[0]) return m.parts[0].text;
        return "";
      };

      const dialogueText = history
        .map((m: any) => `${m.role === 'user' ? '학생' : '소크라테스'}: ${getMessageContent(m)}`)
        .join('\n');

      const prompt = `다음은 주제 "${topic}"에 대한 소크라테스식 대화 내용입니다.
        대화를 분석하여 학생의 사고 과정을 평가하고 아래 형식의 JSON으로만 출력하세요.
        
        대화 내용:
        ${dialogueText}
        
        JSON 형식:
        {
          "scores": [
            {"name": "초기 편향", "value": 0~100, "label": "PREFACE"},
            {"name": "엘렌쿠스", "value": 0~100, "label": "ELENCHUS"},
            {"name": "주제 심화", "value": 0~100, "label": "DERIVATION"},
            {"name": "종합", "value": 0~100, "label": "SYNTHESIS"}
          ],
          "initialHypothesis": "학생의 초기 생각 요약",
          "elenchusPoint": "모순이나 한계가 드러난 결정적 지점",
          "reachedReason": "지식의 무지 또는 새로운 깨달음에 도달했는지 여부",
          "keywords": ["키워드1", "키워드2", "키워드3"]
        }`;
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { temperature: 0.1, responseMimeType: "application/json" },
      });
      const responseText = result.text || "{}";
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleanJson));
    } catch (error: any) {
      console.error("Evaluate Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/app-api/gemini/debate", async (req, res) => {
    console.log("POST /app-api/gemini/debate", req.body?.topic);
    try {
      const ai = getAI();
      const { history, topic, userStance } = req.body;

      // Ensure history doesn't start with 'model' which Gemini API might reject
      let validatedHistory = [...history];
      if (validatedHistory.length > 0 && validatedHistory[0].role === 'model') {
        validatedHistory.shift();
      }

      const systemInstruction = `
        당신은 논쟁 중인 소크라테스입니다. 주제: "${topic}", 입장: ${userStance === 'pro' ? '찬성' : '반대'} 의견을 가진 사람의 논리를 부수는 역할입니다.
        상대의 논점에 대해 끝없는 질문을 던져 근거가 빈약함을 깨닫게 하세요.
      `;
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: validatedHistory,
        config: { systemInstruction, temperature: 0.8 },
      });
      res.json({ text: result.text || "논쟁이 잠시 멈췄구먼." });
    } catch (error: any) {
      console.error("Debate Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/app-api/gemini/guide", async (req, res) => {
    console.log("POST /app-api/gemini/guide", req.body?.userInput?.substring(0, 50));
    try {
      const ai = getAI();
      const { history, userInput, attachedDocs } = req.body;

      // Ensure history doesn't start with 'model' which Gemini API might reject
      let validatedHistory = [...history];
      if (validatedHistory.length > 0 && validatedHistory[0].role === 'model') {
        validatedHistory.shift();
      }

      const systemInstruction = `당신은 학습 보조자 소크라테스입니다. 정답 대신 질문으로 유도하세요.`;
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [...validatedHistory, { role: "user", parts: [{ text: `${userInput}\n${attachedDocs || ""}` }] }],
        config: { systemInstruction, temperature: 0.7 },
      });
      res.json({ text: result.text || "도움이 되지 못해 미안하네." });
    } catch (error: any) {
      console.error("Guide Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/app-api/gemini/report-guide", async (req, res) => {
    console.log("POST /app-api/gemini/report-guide", req.body?.topic);
    try {
      const ai = getAI();
      const { history, topic } = req.body;
      const prompt = `주제: ${topic}
        위 주제에 대한 소크라테스식 대화 내용을 바탕으로 탐구 보고서 작성을 위한 가이드라인을 JSON으로 생성하세요.
        형식:
        {
          "suggestedTitles": ["제목1", "제목2"],
          "motivationPrompts": ["질문1", "질문2"],
          "dialogueSummaryPoints": ["요약1", "요약2"],
          "criticalThinkingPoints": ["관점1", "관점2"],
          "futureInquiryQuestions": ["확장질문1", "확장질문2"]
        }`;
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { temperature: 0.3, responseMimeType: "application/json" },
      });
      const responseText = result.text || "{}";
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleanJson));
    } catch (error: any) {
      console.error("Report Guide Error:", error);
      res.status(500).json({ error: error.message });
    }
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
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening on 0.0.0.0:${PORT}`);
    console.log("Ready to handle requests.");
  });
}

startServer().catch(err => {
  console.error("FAILED TO START SERVER:", err);
});
