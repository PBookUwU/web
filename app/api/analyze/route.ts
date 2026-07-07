import { NextRequest, NextResponse } from "next/server";
import { analyzeWithRules, InputType } from "@/lib/rules";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 이 파일은 서버에서만 실행됩니다. process.env.GEMINI_API_KEY는
// 브라우저로 절대 전달되지 않으므로, 사용자가 개발자 도구를 열어봐도
// 이 키를 볼 수 없습니다.
const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { text, type } = (await req.json()) as {
      text: string;
      type: InputType;
    };

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text 값이 필요합니다." },
        { status: 400 }
      );
    }

    // ---------- 1단계: 규칙 기반 분석 (항상 실행, API 불필요) ----------
    const ruleResult = analyzeWithRules(text, type);

    let aiComment: string | null = null;

    // ---------- 2단계: 위험 요소(플래그)가 하나라도 감지되면 AI 호출 ----------
    // 위험도 등급(low/caution/high)에 상관없이, 규칙 기반 분석에서
    // 플래그가 하나라도 잡히면 AI에게 추가 설명을 요청합니다.
    if (ruleResult.flags.length > 0 && apiKey) {
      try {
        aiComment = await getAiComment(
          text,
          type,
          ruleResult.score,
          ruleResult.riskLevel,
          ruleResult.flags.map((f) => f.label)
        );
      } catch (aiError) {
        // AI 호출이 실패해도 전체 서비스는 계속 동작해야 합니다.
        // (규칙 기반 결과만으로도 사용자에게 의미 있는 응답이 가능하기 때문)
        console.error("AI 분석 실패:", aiError);
        aiComment = null;
      }
    }

    return NextResponse.json({
      score: ruleResult.score,
      flags: ruleResult.flags,
      riskLevel: ruleResult.riskLevel,
      aiComment,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "서버에서 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

const RISK_LEVEL_LABEL: Record<string, string> = {
  low: "낮음",
  caution: "주의",
  high: "높음",
};

async function getAiComment(
  text: string,
  type: InputType,
  ruleScore: number,
  riskLevel: string,
  flagLabels: string[]
): Promise<string> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

  const levelLabel = RISK_LEVEL_LABEL[riskLevel] ?? riskLevel;
  const flagsText =
    flagLabels.length > 0
      ? flagLabels.map((label) => `- ${label}`).join("\n")
      : "(감지된 세부 항목 없음)";

  const prompt = `당신은 피싱/스미싱 탐지를 돕는 보안 분석가입니다.
다음은 ${type === "sms" ? "문자 메시지" : "이메일"} 내용이며, 규칙 기반 분석에서 위험도 ${ruleScore}점(100점 만점)으로 "${levelLabel}" 등급을 받았습니다.

감지된 위험 요소:
${flagsText}

--- 내용 ---
${text}
------------

이 내용이 피싱/스미싱일 가능성이 있는지, 왜 그렇게 판단했는지 2~3문장으로 간결하게 설명해주세요.
과장하지 말고, 애매한 부분이 있다면 그 점도 솔직하게 언급해주세요.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
