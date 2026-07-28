/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
        sans: ["'DM Sans'", "sans-serif"],
      },
      colors: {
        dark: {
          900: "#0a0e17",
          800: "#111827",
          700: "#1a2235",
          600: "#243044",
        },
        accent: {
          green:  "#00ff88",
          red:    "#ff4444",
          yellow: "#ffcc00",
          blue:   "#4d9fff",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s infinite",
        "blink": "blink 1s step-end infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
      },
      keyframes: {
        blink:   { "0%,100%": { opacity: 1 }, "50%": { opacity: 0 } },
        slideUp: { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
      },
    },
  },
  plugins: [],
}
