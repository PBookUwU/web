import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 보안 도구다운 톤 — 차분한 남색 베이스 + 위험도를 나타내는 신호색
        ink: {
          950: "#0B1120",
          900: "#111827",
          800: "#1F2937",
        },
        signal: {
          safe: "#16A34A",
          caution: "#D97706",
          danger: "#DC2626",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};
export default config;
