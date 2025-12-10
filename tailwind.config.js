/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        scholle: {
          bg: "#F3F3F3", // Haupt-Hintergrund
          "bg-light": "#F7F7F7", // Leichter Container-Hintergrund
          "bg-container": "#FFFFFF", // Container-Hintergrund
          text: "#444444", // Haupt-Textfarbe
          "text-light": "#666666", // Leichter Text
          green: "#6B8F2D", // Grün (Akzentfarbe)
          "green-dark": "#5A7A25", // Dunkleres Grün
          "green-light": "#8BAF4A", // Helleres Grün
          blue: "#0A246A", // Blau (Links)
          "blue-dark": "#071A4D", // Dunkleres Blau
          border: "#DDDDDD", // Rahmenfarbe
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
