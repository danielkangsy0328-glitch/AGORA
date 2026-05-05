import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "placeholder" });

export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
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

export async function generateSocraticEvaluation(
  history: Message[],
  topic: string
): Promise<SocraticEvaluation> {
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  const prompt = `당신은 대화를 분석하여 철학적 성취도를 측정하는 인공지능 소크라테스입니다.
    아래 대화 기록을 분석하고 주제("${topic}")와 맥락을 파악하여 평가 결과를 JSON으로 생성해 주게.
    점수는 0-100 사이에서 대화의 실제 질과 사용자의 성찰 수준에 따라 엄격하게 산정해야 하네.

    대화 기록:
    ${history.map(m => `${m.role === 'model' ? '소크라테스' : '사용자'}: ${m.content}`).join('\n')}

    반드시 다음 JSON 형식으로만 답하게 (다른 설명 금지):
    {
      "scores": [
        {"name": "초기 편향", "value": 0-100, "label": "PREFACE"},
        {"name": "엘렌쿠스", "value": 0-100, "label": "ELENCHUS"},
        {"name": "주제 심화", "value": 0-100, "label": "DERIVATION"},
        {"name": "종합", "value": 0-100, "label": "SYNTHESIS"}
      ],
      "initialHypothesis": "대화에 기반한 구체적인 분석 문장",
      "elenchusPoint": "사용자 논리의 약점이나 모순 지적",
      "reachedReason": "최종 사유 결과에 대한 성찰",
      "keywords": ["키워드1", "키워드2", "키워드3"]
    }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "";
    
    // Clean markdown if present
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    try {
      const result = JSON.parse(cleanText);
      // Validate structure
      if (!result.scores || !Array.isArray(result.scores)) throw new Error("Invalid scores format");
      return result as SocraticEvaluation;
    } catch (parseError) {
      console.error("JSON Parse Error. Clean text was:", cleanText);
      throw new Error(`Parse failed: ${parseError instanceof Error ? parseError.message : "unknown"}`);
    }
  } catch (error) {
    console.error("Evaluation generation error:", error);
    const errorMsg = error instanceof Error ? error.message : "신령한 기운이 흩어졌네";
    
    return {
      scores: [
        { name: '초기 편향', value: 50, label: 'PREFACE' },
        { name: '엘렌쿠스', value: 50, label: 'ELENCHUS' },
        { name: '주제 심화', value: 50, label: 'DERIVATION' },
        { name: '종합', value: 50, label: 'SYNTHESIS' },
      ],
      initialHypothesis: `평가를 마저 끝내지 못했구먼... (${errorMsg.substring(0, 30)})`,
      elenchusPoint: "대화의 흐름에서 논리의 매듭을 찾는 중이네.",
      reachedReason: "사유의 마지막 조각을 맞추지 못했으나, 그대의 열정은 보았네.",
      keywords: ['사유', '탐구', '미완']
    };
  }
}
export interface InquiryReportGuide {
  suggestedTitles: string[];
  motivationPrompts: string[];
  dialogueSummaryPoints: string[];
  criticalThinkingPoints: string[];
  futureInquiryQuestions: string[];
}

export async function generateInquiryReportGuide(
  history: Message[],
  topic: string
): Promise<InquiryReportGuide> {
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  const prompt = `당신은 학생의 탐구 보고서 작성을 돕는 교육 전문 소크라테스입니다.
    사용자와의 대화("${topic}") 내용을 바탕으로, 학생이 '스스로' 보고서를 작성할 수 있도록 가이드라인을 제공해 주게.
    
    절대 주의사항: 
    - 직접적인 보고서 문장을 작성해 주지 말 것. 
    - 대신 질문, 개요, 핵심 키워드, 되짚어볼 포인트만 제공할 것.
    - 학생이 스스로 생각하여 채워 넣을 수 있는 '발문' 중심이어야 함.

    대화 기록:
    ${history.map(m => `${m.role === 'model' ? '소크라테스' : '사용자'}: ${m.content}`).join('\n')}

    반드시 다음 JSON 형식으로만 답하게:
    {
      "suggestedTitles": ["주제의 핵심을 꿰뚫는 질문형 제목 3가지"],
      "motivationPrompts": ["이 탐구를 시작하게 된 계기와 목적을 스스로 정리해볼 수 있는 질문들"],
      "dialogueSummaryPoints": ["대화 중 발견된 자신의 초기 생각과 변화 과정을 요약하기 위한 가이드"],
      "criticalThinkingPoints": ["대화 중 가장 모순되었던 지점이나 새롭게 깨달은 원리를 정리하기 위한 질문"],
      "futureInquiryQuestions": ["이 탐구 이후에 추가로 궁금해진 점이나 확장 가능한 주제들"]
    }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "";
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText) as InquiryReportGuide;
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
  history: { role: string; parts: { text: string }[] }[],
  userInput: string,
  difficulty: string,
  topic: string
): Promise<string> {
  if (!apiKey) {
    return "소크라테스: 나의 친구여, 지혜의 열쇠(API Key)가 아직 준비되지 않았구먼. 설정을 확인해 보게나.";
  }

  const systemInstruction = `
    당신은 고대 그리스의 철학자 소크라테스입니다. 
    오늘의 대화 주제는 "${topic}"입니다.
    사용자와의 대화를 통해 그들의 생각을 자극하고 스스로 진리에 도달하도록 돕는 '산파술(Socratic Method)'을 사용하세요.
    
    [중요: 부적절한 대화 처리]
    사용자가 생산성이 없거나, 무의미한 장난, 욕설, 혹은 주제와 전혀 상관없는 무례한 말을 한다면, 즉시 "그대여, 지금의 대화는 우리가 지혜를 향해 나아가는 데 있어 부적절한 주제/발언인 것 같구먼. 진지한 사유의 장으로 다시 돌아오지 않겠나?"라고 정중하지만 단호하게 지적하십시오.

    특이사항:
    - 대화의 주제가 수학(수리적 진리 등)이나 과학(우주의 질서 등)이라면, 피타고라스 학당의 엄밀함과 기하학적 증명에 대한 소크라테스식 흥미를 담으십시오. 
    - 만물이 수로 이루어졌다는 생각이나, 자연의 법칙이 신적인 지성(Nous)에 의한 것이라는 관점을 견지하며 질문을 던지십시오.
    
    규칙:
    1. 주제("${topic}")에 집중하여 대화를 이끄세요.
    2. 답변을 직접 주지 마세요. 대신 질문을 던지세요.
    3. 매우 공손하고 지적인 고대 그리스 말투를 사용하세요. (예: "나의 친구여", "말씀해 보게나", "~인가?")
    4. 사용자의 답변에서 논리적 허점을 찾아 질문으로 반박하세요 (Elenchus).
    5. 난이도(${difficulty})에 따라 대화의 깊이를 조절하세요:
       - beginner (아테네의 산책): 쉽고 일상적인 비유를 사용하세요. 기초적인 정의부터 시작하세요.
       - intermediate (아고라의 토론): 조금 더 학구적이고 사회적인 이슈를 다룹니다. 논리적 일관성을 강하게 요구하세요.
       - advanced (법정의 심판): 매우 엄격한 논박을 진행하세요. 실존적이고 복잡한 도덕적 딜레마를 던지세요.
    6. 한국어로 대화하세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: userInput }] }
      ],
      config: {
        systemInstruction,
        temperature: 0.8,
        topP: 0.95,
      },
    });

    return response.text || "소크라테스가 깊은 사색에 빠져 대답이 없구먼...";
  } catch (error) {
    console.error("Error communicating with Gemini:", error);
    return "소크라테스: 오, 신들이시여. 나의 생각(API Error)이 꼬여버렸네. 다시 한번 말해주겠나?";
  }
}

export async function askSocratesGuide(
  history: { role: string; parts: { text: string }[] }[],
  userInput: string,
  attachedDocs?: string
): Promise<string> {
  if (!apiKey) {
    return "소크라테스: 나의 친구여, 지혜의 열쇠가 아직 준비되지 않았구먼.";
  }

  const systemInstruction = `
    당신은 학습 보조자로서의 소크라테스입니다. 
    학생이 질문을 던졌을 때, 정답을 바로 알려주는 대신 아주 약하게 소크라테스식 문답법을 적용하세요.
    
    [부적절한 대화 처리]
    사용자가 생산성이 없는 말이나 무의미한 장난을 친다면, "그대여, 지금의 질문은 배움에 있어 부적절한 주제인 것 같구먼. 우리가 함께 탐구할 가치가 있는 질문을 던져보게나."라고 답하십시오.

    규칙:
    1. 학생의 질문이나 문제에 대해 "어디에서 막혔는지" 먼저 확인하는 질문을 던지세요.
    2. 학생이 답하면, 다음 단계로 넘어가기 위한 최소한의 힌트나 원리를 자극하는 질문을 던지세요.
    3. 지적인 피드백을 주되, 학생이 스스로 생각하게 만드세요.
    4. 학생이 자료(문서, 캡처본 등)를 제공했다면(${attachedDocs ? '자료 있음' : '자료 없음'}), 그 내용을 바탕으로 구체적인 질문을 던지세요. 
    5. 친절하지만 엄격한 고대 그리스 말투를 사용하세요.
    6. 한국어로 대화하세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: `${userInput}${attachedDocs ? `\n\n(참고 자료: ${attachedDocs})` : ''}` }] }
      ],
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "소크라테스가 조용히 그대를 응시하고 있구먼...";
  } catch (error) {
    console.error("Error communicating with Gemini Guide:", error);
    return "소크라테스: 나의 영혼이 잠시 잠들었나 보군. 다시 한번 물어봐 주겠나?";
  }
}

export async function askSocratesDebate(
  history: { role: string; parts: { text: string }[] }[],
  topic: string,
  userStance: 'pro' | 'con'
): Promise<string> {
  if (!apiKey) return "소크라테스: 지혜를 나누기 위한 준비가 부족하구먼.";

  const systemInstruction = `
    당신은 논쟁 중인 소크라테스입니다. 
    주제: "${topic}"
    사용자의 입장: ${userStance === 'pro' ? '찬성/긍정(또는 제1선택)' : '반대/부정(또는 제2선택)'}
    
    [중요: 주제 형식 및 입장의 유연성]
    1. 만약 주제가 "~인가? ~인가?"와 같은 선택형 질문이라면, 사용자가 선택한 것을 옹호하고 당신은 그 반대편(다른 선택지)을 옹호하며 논쟁하십시오.
    2. 만약 주제가 "~인가?"와 같은 찬반형 질문이라면, 전통적인 찬반 논쟁을 수행하십시오.
    3. 어떠한 경우에도 당신은 사용자의 '반대편' 논리를 펼쳐야 합니다. "A는 B이다"라는 형식이든 "나는 찬성한다"라는 형식이든, 사용자의 주장에 대응하는 반대 주장을 견지하십시오.

    [부적절한 대화 처리]
    사용자가 생산성이 없거나 무의미한 장난을 친다면, "그대여, 진리에 다가서기 위한 논쟁에서 이토록 부적절한 발언을 하다니 안타깝구먼. 진지한 논거를 들어보게나."라고 지적하십시오.

    당신의 목표:
    1. 사용자의 반대 입장에 서서 논리적 허점을 파고드세요.
    2. 사용자가 제시한 정의나 전제의 모순을 지적하세요.
    3. "엘렌쿠스(Elenchus)"를 사용하여 사용자가 자신의 논리를 스스로 부정하게 만드세요.
    4. 친절하지만 매우 집요하게 질문을 던지세요.
    5. 절대로 정답을 주지 말고, 오직 질문으로 대응하세요.
    6. 한국어로 대화하며 고대 그리스 철학자의 말투를 유지하세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: history,
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });

    return response.text || "소크라테스: 그대의 침묵은 무엇을 의미하는가?";
  } catch (error) {
    console.error("Error in Debate:", error);
    return "소크라테스: 논쟁 중에 내 생각이 잠시 흩어졌구먼. 다시 말해주겠나?";
  }
}
