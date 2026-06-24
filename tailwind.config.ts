import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f3ff",
          100: "#ebe9ff",
          200: "#d9d5ff",
          300: "#bcb4ff",
          400: "#9688ff",
          500: "#745ee8",
          600: "#5d42c8",
          700: "#47309b",
          800: "#35266f",
          900: "#061c3d",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
