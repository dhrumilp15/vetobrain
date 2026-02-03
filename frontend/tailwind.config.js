/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'c9-blue': '#00adef',
        'c9-dark': '#1a1a1a',
      }
    },
  },
  plugins: [],
}
