import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export interface Message {
  role: 'user' | 'model';
  content?: string;
  parts?: { text: string }[];
  timestamp?: Date;
}

export interface SocraticEvaluation {
  scores: {
    name: string;
    value: number;
    label: string;
  }[];
  initialHypothesis: string;
  elenchusPoint: string;
  reachedReason: string;
  keywords: string[];
}

export interface InquiryReportGuide {
  suggestedTitles: string[];
  motivationPrompts: string[];
  dialogueSummaryPoints: string[];
  criticalThinkingPoints: string[];
  futureInquiryQuestions: string[];
}

// Model name constant as per guidelines
const MODEL_NAME = "gemini-3-flash-preview";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    // Attempt to get API key from multiple sources
    // In AI Studio, GEMINI_API_KEY is usually available in process.env
    const rawKey = (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || "");
    
    // Minimal sanitization - just remove common wrapping quotes or environment variable prefixes
    const apiKey = rawKey.trim()
      .replace(/^(GEMINI_API_KEY|VITE_GEMINI_API_KEY|AI_STUDIO_API_KEY|GOOGLE_API_KEY)\s*[:=]\s*/i, "")
      .replace(/^["']|["']$/g, "")
      .replace(/[\s\u00A0\u200B-\u200D\uFEFF]/g, "");

    if (!apiKey) {
      console.warn("Gemini API Key is missing. Please set it in AI Studio Settings.");
    }
    
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

function formatHistory(history: Message[]) {
  return history.map(m => ({
    role: m.role,
    parts: m.parts || [{ text: m.content || "" }]
  }));
}

export async function generateSocraticEvaluation(
  history: Message[],
  topic: string
): Promise<SocraticEvaluation> {
  try {
    const ai = getAI();
    const dialogueText = history
      .map((m) => `${m.role === 'user' ? '학생' : '소크라테스'}: ${m.content || m.parts?.[0]?.text || ""}`)
      .join('\n');

    const prompt = `당신은 대화 분석 전문가입니다. 다음 대화를 분석하여 교육적 가치와 '엘렌쿠스(산파술)' 적용 정도를 평가하고 JSON으로 반환하세요.
    주제: "${topic}"
    대화:
    ${dialogueText}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("Evaluation generation error:", error);
    return {
      scores: [
        { name: '초기 편향', value: 50, label: 'PREFACE' },
        { name: '엘렌쿠스', value: 50, label: 'ELENCHUS' },
        { name: '주제 심화', value: 50, label: 'DERIVATION' },
        { name: '종합', value: 50, label: 'SYNTHESIS' },
      ],
      initialHypothesis: "평가를 생성하지 못했습니다. (API 오류)",
      elenchusPoint: "대화 분석 중 오류가 발생했습니다.",
      reachedReason: error.message || "알 수 없는 오류",
      keywords: []
    };
  }
}

export async function generateInquiryReportGuide(
  history: Message[],
  topic: string
): Promise<InquiryReportGuide> {
  try {
    const ai = getAI();
    const prompt = `주제 "${topic}"에 대한 탐구 보고서 가이드를 JSON으로 생성하세요. { "suggestedTitles": [...], "motivationPrompts": [...], "dialogueSummaryPoints": [...], "criticalThinkingPoints": [...], "futureInquiryQuestions": [...] }`;
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Report Guide generation error:", error);
    return {
      suggestedTitles: ["탐구 보고서 제안 (오류 발생)"],
      motivationPrompts: ["탐구 동기를 작성해 보세요."],
      dialogueSummaryPoints: ["대화 내용을 요약해 보세요."],
      criticalThinkingPoints: ["자신의 생각을 정리해 보세요."],
      futureInquiryQuestions: ["더 궁금한 점은 무엇인가요?"]
    };
  }
}

export async function sendMessageToSocrates(
  history: Message[],
  userInput: string,
  difficulty: string,
  topic: string
): Promise<string> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      config: {
        systemInstruction: `당신은 고대 그리스의 철학자 소크라테스입니다. 주제: "${topic}", 난이도: ${difficulty}. 질문을 통해 사용자가 스스로 깨닫게 하세요.`
      },
      contents: [...formatHistory(history), { role: 'user', parts: [{ text: userInput }] }]
    });

    return response.text || "소크라테스가 대답을 하지 못하고 있네...";
  } catch (error: any) {
    console.error("Error communicating with Gemini:", error);
    return `소크라테스: 나의 생각이 조금 어지럽구먼. (오류: ${error.message})`;
  }
}

export async function askSocratesGuide(
  history: Message[],
  userInput: string,
  attachedDocs?: string
): Promise<string> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      config: {
        systemInstruction: "당신은 학습 보조자 소크라테스입니다. 질문으로 유도하세요."
      },
      contents: [...formatHistory(history), { role: 'user', parts: [{ text: `${userInput}\n${attachedDocs || ""}` }] }]
    });

    return response.text || "가이드를 제공할 수 없네...";
  } catch (error: any) {
    console.error("Error communicating with Gemini Guide:", error);
    return `소크라테스: 나의 영혼이 잠시 잠들었나 보군. 다시 한번 물어봐 주겠나? (오류: ${error.message})`;
  }
}

export async function askSocratesDebate(
  history: Message[],
  topic: string,
  userStance: 'pro' | 'con'
): Promise<string> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      config: {
        systemInstruction: `당신은 논쟁 중인 소크라테스입니다. 주제: "${topic}", 입장: ${userStance === 'pro' ? '찬성' : '반대'}. 상대의 논리를 부수세요.`
      },
      contents: formatHistory(history)
    });

    return response.text || "논쟁이 길어지고 있구먼...";
  } catch (error: any) {
    console.error("Error in Debate:", error);
    return `소크라테스: 논쟁 중에 내 생각이 잠시 흩어졌구먼. 다시 말해주겠나? (오류: ${error.message})`;
  }
}

