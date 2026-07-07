"use client";

interface RiskGaugeProps {
  score: number; // 0~100
  riskLevel: "low" | "caution" | "high";
}

const LEVEL_CONFIG = {
  low: { color: "#16A34A", label: "안전", ring: "stroke-signal-safe" },
  caution: { color: "#D97706", label: "주의", ring: "stroke-signal-caution" },
  high: { color: "#DC2626", label: "위험", ring: "stroke-signal-danger" },
};

export default function RiskGauge({ score, riskLevel }: RiskGaugeProps) {
  const config = LEVEL_CONFIG[riskLevel];
  const circumference = 2 * Math.PI * 45; // r=45
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          {/* 배경 트랙 */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#1F2937"
            strokeWidth="8"
          />
          {/* 점수를 나타내는 링 */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={config.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="gauge-ring transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-bold" style={{ color: config.color }}>
            {score}
          </span>
          <span className="text-xs text-slate-400">/ 100</span>
        </div>
      </div>
      <span
        className="rounded-full px-4 py-1 text-sm font-semibold"
        style={{ color: config.color, backgroundColor: `${config.color}1A` }}
      >
        {config.label}
      </span>
    </div>
  );
}
