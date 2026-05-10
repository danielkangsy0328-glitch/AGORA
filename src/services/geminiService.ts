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
    return await apiFetch('/api/gemini/report-guide', { history, topic });
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
    const data = await apiFetch('/api/gemini/chat', { history, userInput, difficulty, topic });
    return data.text;
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
    const data = await apiFetch('/api/gemini/guide', { history, userInput, attachedDocs });
    return data.text;
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
    const data = await apiFetch('/api/gemini/debate', { history, topic, userStance });
    return data.text;
  } catch (error: any) {
    console.error("Error in Debate:", error);
    return `소크라테스: 논쟁 중에 내 생각이 잠시 흩어졌구먼. 다시 말해주겠나? (오류: ${error.message})`;
  }
}

