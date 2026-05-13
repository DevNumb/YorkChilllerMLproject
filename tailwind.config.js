/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: '#7fe6ff',
        muted: '#8b9dc3',
        background: '#0f1419',
        surface: '#1a1f2e',
      },
      textColor: {
        'muted-foreground': '#9ab2c8',
      },
    },
  },
  plugins: [
    require('tailwindcss/plugin')(function({ addUtilities }) {
      addUtilities({
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
        },
        '.scrollbar-thumb-cyan-500\\/30': {
          'scrollbar-color': 'rgba(6, 182, 212, 0.3) transparent',
        },
        '.scrollbar-track-transparent': {
          'scrollbar-color': 'rgba(6, 182, 212, 0.3) transparent',
        },
      });
    }),
  ],
}

