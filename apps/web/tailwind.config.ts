import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "lm-black": "#111111",
        "lm-dark-gray": "#1c1c1c",
        "lm-orange": "#CFFF04",
        "lm-yellow": "#ffff00",
        "lm-green": "#00ff00",
        "lm-gray": "#a6a6a6",
        "lm-red": "#ff3333",
        "lm-terminal-lightgray": "#9e9e9e",
        "lm-terminal-gray": "#474546",
        "lm-terminal-darkgray": "#232323"
      },
      fontFamily: {
        pixer: ["FontName", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      },
      fontSize: {
        xs: "10px",
        sm: "12px",
        md: "14px",
        base: "14px",
        lg: "16px",
        xl: "20px",
        "2xl": "28px"
      }
    }
  },
  plugins: []
};

export default config;

