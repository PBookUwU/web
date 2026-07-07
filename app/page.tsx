"use client";

import { useState } from "react";
import RiskGauge from "@/components/RiskGauge";
import FlagList from "@/components/FlagList";

type InputType = "email" | "sms";

interface AnalysisResult {
  score: number;
  flags: { label: string; detail: string; score: number }[];
  riskLevel: "low" | "caution" | "high";
  aiComment: string | null; // AI(2단계) 코멘트, 규칙 점수가 애매할 때만 채워짐
}

// AI가 보내주는 코멘트에는 종종 **강조** 형태의 마크다운 굵게 표시가
// 섞여 있는데, 일반 <p> 태그로는 별표(**)가 그대로 텍스트로 보입니다.
// 별도 마크다운 라이브러리 없이, **로 감싸진 부분만 <strong>으로 바꿔줍니다.
function renderBoldMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    return <span key={idx}>{part}</span>;
  });
}

const SAMPLE_SMS =
  "[국제발신] 고객님의 택배가 주소 미상으로 반송 예정입니다. 지금 바로 배송 조회 확인 bit.ly/abc123";

const SAMPLE_EMAIL =
  "고객님의 계정이 정지 예정입니다. 즉시 http://arnazon.com/verify 에서 비밀번호를 확인해주세요.";

export default function Home() {
  const [inputType, setInputType] = useState<InputType>("sms");
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!text.trim()) {
      setError("분석할 텍스트를 입력해주세요.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type: inputType }),
      });

      if (!res.ok) {
        throw new Error("분석 중 오류가 발생했습니다.");
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
    } catch (err) {
      setError("분석에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  function loadSample() {
    setText(inputType === "sms" ? SAMPLE_SMS : SAMPLE_EMAIL);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-12">
      {/* 헤더 */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-safe/10">
            <svg
              className="h-5 w-5 text-signal-safe"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="font-display text-xl font-bold text-white">
            PhishGuard AI
          </h1>
        </div>
        <p className="text-sm text-slate-400">
          의심스러운 문자나 이메일을 붙여넣으면 위험 요소를 분석해드립니다.
        </p>
      </header>

      {/* 입력 타입 선택 */}
      <div className="flex gap-2">
        <button
          onClick={() => setInputType("sms")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            inputType === "sms"
              ? "bg-white text-ink-950"
              : "bg-ink-900 text-slate-400 hover:bg-ink-800"
          }`}
        >
          문자 (SMS)
        </button>
        <button
          onClick={() => setInputType("email")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            inputType === "email"
              ? "bg-white text-ink-950"
              : "bg-ink-900 text-slate-400 hover:bg-ink-800"
          }`}
        >
          이메일
        </button>
      </div>

      {/* 입력창 */}
      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            inputType === "sms"
              ? "예: [국제발신] 고객님의 택배가..."
              : "예: 고객님의 계정이 정지 예정입니다..."
          }
          rows={6}
          className="w-full rounded-lg border border-ink-800 bg-ink-900 p-4 text-sm text-slate-100 placeholder:text-slate-600 focus:border-signal-safe focus:outline-none focus:ring-1 focus:ring-signal-safe"
        />
        <div className="flex items-center justify-between">
          <button
            onClick={loadSample}
            className="text-xs text-slate-500 underline hover:text-slate-300"
          >
            샘플 텍스트 넣어보기
          </button>
          {error && <span className="text-xs text-signal-danger">{error}</span>}
        </div>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={isLoading}
        className="rounded-lg bg-signal-safe py-3 text-sm font-semibold text-white transition hover:bg-signal-safe/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "분석 중..." : "위험도 분석하기"}
      </button>

      {/* 결과 */}
      {result && (
        <section className="flex flex-col gap-6 rounded-xl border border-ink-800 bg-ink-900/30 p-6">
          <RiskGauge score={result.score} riskLevel={result.riskLevel} />

          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-300">
              탐지된 위험 요소
            </h2>
            <FlagList flags={result.flags} />
          </div>

          {result.aiComment && (
            <div className="rounded-lg border border-signal-caution/30 bg-signal-caution/5 p-4">
              <p className="mb-1 text-xs font-semibold text-signal-caution">
                AI 종합 분석
              </p>
              <p className="text-sm text-slate-300">
                {renderBoldMarkdown(result.aiComment)}
              </p>
            </div>
          )}
        </section>
      )}

      <footer className="mt-auto pt-8 text-center text-xs text-slate-600">
        규칙 기반 분석 + AI를 결합해 위험도를 판단합니다. 참고용이며, 최종
        판단은 신중하게 하시기 바랍니다.
      </footer>
    </main>
  );
}
