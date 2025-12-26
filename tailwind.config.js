/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // <--- ESTO ACTIVA EL MODO OSCURO MANUAL
  theme: {
    extend: {},
  },
  plugins: [],
}