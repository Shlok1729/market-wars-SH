/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          black: '#0A0A0A',
          border: '#27272A',
          green: '#10B981',
          red: '#F43F5E'
        }
      }
    },
  },
  plugins: [],
}