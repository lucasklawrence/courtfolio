/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}', // if using app directory
    './components/**/*.{js,ts,jsx,tsx}', // adjust as needed
  ],
  theme: {
    extend: {
      fontFamily: {
        handwriting: ['"Patrick Hand"', 'cursive'],
      },
    },
  },
  plugins: [],
}
