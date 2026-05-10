import { GoogleGenAI, Type } from "@google/genai";

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

// Initialize AI
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

const MODEL_NAME = "gemini-3-flash-preview";

function validateHistory(history: Message[]) {
  if (!history || !Array.isArray(history)) return [];
  
  const mapped = history
    .map((m: any) => ({
      role: (m.role === 'user' || m.role === 'human') ? 'user' : 'model',
      parts: [{ text: (typeof m.content === 'string' ? m.content : (m.parts && m.parts[0]?.text) || "") }]
    }))
    .filter(m => m.parts[0].text.trim().length > 0);

  const firstUserIdx = mapped.findIndex(m => m.role === 'user');
  if (firstUserIdx === -1) return [];

  let cleaned = mapped.slice(firstUserIdx);
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

export async function generateSocraticEvaluation(
  history: Message[],
  topic: string
): Promise<SocraticEvaluation> {
  try {
    const dialogueText = history
      .map((m: any) => `${m.role === 'user' ? '학생' : '소크라테스'}: ${m.content || (m.parts && m.parts[0]?.text) || ""}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `주제 "${topic}"에 대한 다음 대화를 분석하여 평가 JSON을 생성하세요:\n\n${dialogueText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scores: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  label: { type: Type.STRING }
                },
                required: ["name", "value", "label"]
              }
            },
            initialHypothesis: { type: Type.STRING },
            elenchusPoint: { type: Type.STRING },
            reachedReason: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["scores", "initialHypothesis", "elenchusPoint", "reachedReason", "keywords"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Evaluation generation error:", error);
    return {
      scores: [
        { name: '초기 편향', value: 50, label: 'PREFACE' },
        { name: '엘렌쿠스', value: 50, label: 'ELENCHUS' },
        { name: '주제 심화', value: 50, label: 'DERIVATION' },
        { name: '종합', value: 50, label: 'SYNTHESIS' },
      ],
      initialHypothesis: "평가를 생성하지 못했습니다.",
      elenchusPoint: "-",
      reachedReason: "-",
      keywords: []
    };
  }
}

export async function generateInquiryReportGuide(
  history: Message[],
  topic: string
): Promise<InquiryReportGuide> {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `주제 "${topic}"에 대한 대화 내용을 바탕으로 탐구 보고서 가이드 JSON을 생성하세요.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
            motivationPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
            dialogueSummaryPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            criticalThinkingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            futureInquiryQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["suggestedTitles", "motivationPrompts", "dialogueSummaryPoints", "criticalThinkingPoints", "futureInquiryQuestions"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Report Guide generation error:", error);
    return {
      suggestedTitles: ["탐구 보고서 제안"],
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
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [...validateHistory(history), { role: 'user', parts: [{ text: userInput }] }],
      config: {
        systemInstruction: `당신은 고대 그리스의 철학자 소크라테스입니다. 주제: "${topic}", 난이도: ${difficulty}. 질문을 통해 사용자가 스스로 깨닫게 하세요. 직접적인 답은 피하고 산파술을 사용하세요.`,
        temperature: 0.8
      }
    });
    return response.text;
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
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [...validateHistory(history), { role: 'user', parts: [{ text: `${userInput}\n${attachedDocs || ""}` }] }],
      config: {
        systemInstruction: "당신은 학습 보조자 소크라테스입니다. 정답 대신 질문으로 유도하여 학생이 스스로 생각하게 하세요.",
        temperature: 0.7
      }
    });
    return response.text;
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
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: validateHistory(history),
      config: {
        systemInstruction: `당신은 논쟁 중인 소크라테스입니다. 주제: "${topic}", 입장: ${userStance === 'pro' ? '찬성' : '반대'}. 상대의 논리를 부수고 근거를 끝없이 물어보세요.`,
        temperature: 0.8
      }
    });
    return response.text;
  } catch (error: any) {
    console.error("Error in Debate:", error);
    return `소크라테스: 논쟁 중에 내 생각이 잠시 흩어졌구먼. 다시 말해주겠나? (오류: ${error.message})`;
  }
}

