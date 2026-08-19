/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aws: {
          squid: '#232f3e',
          orange: '#ff9900',
          smile: '#ec7211',
          anchor: '#0073bb',
          dark: '#161e2d',
          card: '#1e293b',
          border: '#334155'
        }
      }
    },
  },
  plugins: [],
}
