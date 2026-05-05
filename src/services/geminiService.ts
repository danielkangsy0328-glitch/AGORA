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

const MODEL_NAME = "gemini-3-flash-preview";

async function apiFetch(path: string, body: any) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

export async function generateSocraticEvaluation(
  history: Message[],
  topic: string
): Promise<SocraticEvaluation> {
  try {
    return await apiFetch('/api/gemini/evaluate', { history, topic });
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
    return await apiFetch('/api/gemini/report-guide', { history, topic });
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
    const data = await apiFetch('/api/gemini/chat', { history, userInput, difficulty, topic });
    return data.text;
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
    const data = await apiFetch('/api/gemini/guide', { history, userInput, attachedDocs });
    return data.text;
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
    const data = await apiFetch('/api/gemini/debate', { history, topic, userStance });
    return data.text;
  } catch (error: any) {
    console.error("Error in Debate:", error);
    return "소크라테스: 논쟁 중에 내 생각이 잠시 흩어졌구먼. 다시 말해주겠나?";
  }
}
