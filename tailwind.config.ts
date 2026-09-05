import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05040A",
        panel: "#0F0B1B",
        panel2: "#150F26",
        ink: "#EDE9FE",
        violet: {
          DEFAULT: "#8B5CF6",
          bright: "#C084FC",
          dim: "#5B21B6",
          glow: "#A78BFA",
        },
        line: "rgba(167,139,250,0.18)",
        muted: "rgba(237,233,254,0.58)",
        success: "#34D399",
        warning: "#FBBF24",
        danger: "#F87171",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        head: ["var(--font-head)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: { card: "20px", chip: "999px" },
      boxShadow: {
        glow: "0 0 0 1px rgba(167,139,250,0.25), 0 0 32px -8px rgba(139,92,246,0.55)",
        glowSm: "0 0 0 1px rgba(167,139,250,0.2), 0 0 16px -6px rgba(139,92,246,0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
