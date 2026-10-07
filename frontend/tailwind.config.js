/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sphoorthy: {
          navy: "#0f172a",
          dark: "#0b0f19",
          card: "#182234",
          gold: "#f59e0b",
          green: "#10b981",
          red: "#ef4444",
          blue: "#2563eb",
        }
      }
    },
  },
  plugins: [],
}
