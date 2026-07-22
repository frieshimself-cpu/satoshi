import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: "#070907",
          900: "#0b0f0b",
          850: "#0f140f",
          800: "#141a14",
          700: "#1c241c",
          600: "#2a352a",
        },
        phosphor: {
          DEFAULT: "#33ff66",
          dim: "#1fa347",
          faint: "#144d28",
        },
        amber: {
          glow: "#ffb000",
          dim: "#8a6200",
        },
        alert: "#ff4d4d",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "JetBrains Mono",
          "Fira Code",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      keyframes: {
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        pulseglow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        flashmove: {
          "0%": { backgroundColor: "rgba(255,176,0,0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        pulseglow: "pulseglow 1.4s ease-in-out infinite",
        flashmove: "flashmove 1.6s ease-out 1",
      },
    },
  },
  plugins: [],
};

export default config;
