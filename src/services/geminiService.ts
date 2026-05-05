import { GoogleGenAI } from "@google/genai";

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

// Initialize Gemini on the client side
const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });

const MODEL_NAME = "gemini-3-flash-preview";

export async function generateSocraticEvaluation(
  history: Message[],
  topic: string
): Promise<SocraticEvaluation> {
  try {
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
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const cleanJson = (result.text || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
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
      initialHypothesis: "평가를 마저 끝내지 못했구먼...",
      elenchusPoint: "대화의 흐름에서 논리의 매듭을 찾는 중이네.",
      reachedReason: "사유의 마지막 조각을 맞추지 못했으나, 그대의 열정은 보았네.",
      keywords: ['사유', '탐구', '미완']
    };
  }
}

export async function generateInquiryReportGuide(
  history: Message[],
  topic: string
): Promise<InquiryReportGuide> {
  try {
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
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });

    const cleanJson = (result.text || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Report Guide generation error:", error);
    return {
      suggestedTitles: ["사유의 흔적: " + topic],
      motivationPrompts: ["왜 이 주제에 관심을 가졌는지 되짚어보게."],
      dialogueSummaryPoints: ["나의 첫 번째 대답은 무엇이었나?"],
      criticalThinkingPoints: ["어떤 질문이 가장 아프게 다가왔나?"],
      futureInquiryQuestions: ["진리는 어디로 향하고 있는가?"]
    };
  }
}

export async function sendMessageToSocrates(
  history: any[],
  userInput: string,
  difficulty: string,
  topic: string
): Promise<string> {
  try {
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
      model: MODEL_NAME,
      contents: [...history, { role: "user", parts: [{ text: userInput }] }],
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });

    return result.text || "미안하네, 생각이 잠시 엉켰구먼.";
  } catch (error: any) {
    console.error("Error communicating with Gemini:", error);
    const detailedError = error.message ? `: ${error.message}` : "";
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      return `소크라테스: 오, 나의 친구여. 지금은 너무 많은 이들이 나를 찾고 있어 잠시 쉼이 필요하구먼. (사용량 초과${detailedError})`;
    }
    return `소크라테스: 오, 신들이시여. 나의 생각이 조금 어지럽구먼. (상세 오류${detailedError})`;
  }
}

export async function askSocratesGuide(
  history: any[],
  userInput: string,
  attachedDocs?: string
): Promise<string> {
  try {
    const systemInstruction = `
      당신은 학습 보조자 소크라테스입니다. 
      학생이 질문을 던졌을 때, 정답을 바로 알려주는 대신 아주 약하게 소크라테스식 문답법을 적용하세요.
    `;

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        ...history,
        { role: "user", parts: [{ text: `${userInput}${attachedDocs ? `\n\n(참고 자료: ${attachedDocs})` : ""}` }] },
      ],
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return result.text || "도움이 되지 못해 미안하네.";
  } catch (error: any) {
    console.error("Error communicating with Gemini Guide:", error);
    return "소크라테스: 나의 영혼이 잠시 잠들었나 보군. 다시 한번 물어봐 주겠나?";
  }
}

export async function askSocratesDebate(
  history: any[],
  topic: string,
  userStance: 'pro' | 'con'
): Promise<string> {
  try {
    const systemInstruction = `
      당신은 논쟁 중인 소크라테스입니다. 
      주제: "${topic}"
      사용자의 입장: ${userStance === "pro" ? "찬성/긍정" : "반대/부정"}
      당신은 사용자의 '반대편' 논리를 펼쳐야 합니다. 
      한국어로 대화하며 고대 그리스 철학자의 말투를 유지하세요.
    `;

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: history,
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });

    return result.text || "논쟁이 끊겼구먼.";
  } catch (error: any) {
    console.error("Error in Debate:", error);
    return "소크라테스: 논쟁 중에 내 생각이 잠시 흩어졌구먼. 다시 말해주겠나?";
  }
}
