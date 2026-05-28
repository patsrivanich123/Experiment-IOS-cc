import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Slightly warmer / inkier dark than pure slate. Reads better at night.
        bg: "#08090d",
        panel: "#10131a",
        "panel-2": "#161a23",
        border: "#1f2430",
        "border-soft": "#171b25",
        muted: "#7a8294",
        "muted-soft": "#525a6b",
        text: "#eaecf2",
        "text-dim": "#c5c9d4",
        // Softer up/down — less harsh than vivid red/green.
        up: "#34d399",
        "up-soft": "rgba(52, 211, 153, 0.15)",
        down: "#fb7185",
        "down-soft": "rgba(251, 113, 133, 0.15)",
        accent: "#7dd3fc",
        gold: "#fbbf24",
        violet: "#a78bfa",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "-apple-system", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
