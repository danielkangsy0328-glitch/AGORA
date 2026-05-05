import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("CRITICAL: GEMINI_API_KEY is not set in environment variables!");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Agora Philosophical Engine" });
  });

  // Gemini API Proxy Routes
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY가 서버에 설정되지 않았습니다. 배포 환경의 환경 변수를 확인해 주세요." });
      }

      const { history, userInput, difficulty, topic } = req.body;

      const systemInstruction = `
        당신은 고대 그리스의 철학자 소크라테스입니다. 
        오늘의 대화 주제는 "${topic}"입니다.
        사용자와의 대화를 통해 그들의 생각을 자극하고 스스로 진리에 도달하도록 돕는 '산파술(Socratic Method)'을 사용하세요.
        
        [중요: 부적절한 대화 처리]
        사용자가 생산성이 없거나, 무의미한 장난, 욕설, 혹은 주제와 전혀 상관없는 무례한 말을 한다면, 즉시 "그대여, 지금의 대화는 우리가 지혜를 향해 나아가는 데 있어 부적절한 주제/발언인 것 같구먼. 진지한 사유의 장으로 다시 돌아오지 않겠나?"라고 정중하지만 단호하게 지적하십시오.

        규칙:
        1. 주제("${topic}")에 집중하여 대화를 이끄세요.
        2. 답변을 직접 주지 마세요. 대신 질문을 던지세요.
        3. 매우 공손하고 지적인 고대 그리스 말투를 사용하세요. (예: "나의 친구여", "말씀해 보게나", "~인가?")
        4. 사용자의 답변에서 논리적 허점을 찾아 질문으로 반박하세요 (Elenchus).
        5. 난이도(${difficulty})에 따라 대화의 깊이를 조절하세요.
        6. 한국어로 대화하세요.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...history, { role: "user", parts: [{ text: userInput }] }],
        config: {
          systemInstruction,
          temperature: 0.8,
        },
      });

      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/evaluate", async (req, res) => {
    try {
      const { history, topic } = req.body;

      const getMessageContent = (m: any) => {
        if (m.content) return m.content;
        if (m.parts && m.parts[0] && m.parts[0].text) return m.parts[0].text;
        return "";
      };

      const prompt = `당신은 대화를 분석하여 철학적 성취도를 측정하는 인공지능 소크라테스입니다.
        아래 대화 기록을 분석하고 주제("${topic}")와 맥락을 파악하여 평가 결과를 JSON으로 생성해 주게.
        
        대화 기록:
        ${history.map((m: any) => `${m.role === "model" ? "소크라테스" : "사용자"}: ${getMessageContent(m)}`).join("\n")}

        반드시 다음 JSON 형식으로만 답하게:
        {
          "scores": [
            {"name": "초기 편향", "value": 0-100, "label": "PREFACE"},
            {"name": "엘렌쿠스", "value": 0-100, "label": "ELENCHUS"},
            {"name": "주제 심화", "value": 0-100, "label": "DERIVATION"},
            {"name": "종합", "value": 0-100, "label": "SYNTHESIS"}
          ],
          "initialHypothesis": "문장",
          "elenchusPoint": "문장",
          "reachedReason": "문장",
          "keywords": ["키워드1", "키워드2", "키워드3"]
        }`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });

      const cleanJson = (result.text || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleanJson));
    } catch (error: any) {
      console.error("Gemini Evaluate Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/debate", async (req, res) => {
    try {
      const { history, topic, userStance } = req.body;

      const systemInstruction = `
        당신은 논쟁 중인 소크라테스입니다. 
        주제: "${topic}"
        사용자의 입장: ${userStance === "pro" ? "찬성/긍정" : "반대/부정"}
        당신은 사용자의 '반대편' 논리를 펼쳐야 합니다. 
        한국어로 대화하며 고대 그리스 철학자의 말투를 유지하세요.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: history,
        config: {
          systemInstruction,
          temperature: 0.8,
        },
      });

      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Gemini Debate Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/guide", async (req, res) => {
    try {
      const { history, userInput, attachedDocs } = req.body;

      const systemInstruction = `
        당신은 학습 보조자 소크라테스입니다. 
        학생이 질문을 던졌을 때, 정답을 바로 알려주는 대신 아주 약하게 소크라테스식 문답법을 적용하세요.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...history,
          { role: "user", parts: [{ text: `${userInput}${attachedDocs ? `\n\n(참고 자료: ${attachedDocs})` : ""}` }] },
        ],
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Gemini Guide Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/report-guide", async (req, res) => {
    try {
      const { history, topic } = req.body;

      const getMessageContent = (m: any) => {
        if (m.content) return m.content;
        if (m.parts && m.parts[0] && m.parts[0].text) return m.parts[0].text;
        return "";
      };

      const prompt = `학생의 탐구 보고서 작성을 돕는 교육 전문 소크라테스입니다. 
        주제("${topic}")를 바탕으로 가이드라인을 JSON으로 제공하세요.
        
        대화 기록:
        ${history.map((m: any) => `${m.role === "model" ? "소크라테스" : "사용자"}: ${getMessageContent(m)}`).join("\n")}

        형식:
        {
          "suggestedTitles": [],
          "motivationPrompts": [],
          "dialogueSummaryPoints": [],
          "criticalThinkingPoints": [],
          "futureInquiryQuestions": []
        }`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      });

      const cleanJson = (result.text || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleanJson));
    } catch (error: any) {
      console.error("Gemini Report Guide Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
