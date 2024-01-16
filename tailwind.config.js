/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      xxs: "280px",
      xs: "320px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      blur: {
        smp: "5px",
      },
      backgroundImage: {
        "movie-banner": "url('/movie-banner.jpg')",
      },
      colors: {
        transparent: "transparent",
        shark: {
          50: "#f4f6f7",
          100: "#e3e7ea",
          200: "#cad0d7",
          300: "#a5b0bb",
          400: "#788698",
          500: "#5d6a7d",
          600: "#505a6a",
          700: "#454c59",
          800: "#3e434c",
          900: "#2e3138",
        },
        white: "#ffffff",
        black: "#000000",
      },
    },
  },
  plugins: [],
};
