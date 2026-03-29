/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        retro: {
          bg: '#2d5a2d',
          field: '#366636',
          card: '#305530',
          gold: '#ffd700',
          'gold-dark': '#b8950a',
          green: '#2a6a2a',
          'green-light': '#3a8a3a',
          border: '#4a7a4a',
          white: '#f0f0f0',
          gray: '#a8bea8',
          red: '#b91c1c',
        },
      },
      fontFamily: {
        display: ['Bebas Neue', 'Impact', 'Arial Black', 'sans-serif'],
        retro: ['Oswald', 'Arial Black', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
