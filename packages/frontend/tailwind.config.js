/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        primary: {
          400: '#60a5fa', // blue-400
          500: '#3b82f6', // blue-500 (existing)
          600: '#2563eb', // blue-600
        },
        purple: {
          400: '#c084fc',
          500: '#8b5cf6',
          600: '#9333ea',
        },
        orange: {
          400: '#fb923c',
        },
        red: {
          400: '#f87171',
        },
        cyan: {
          500: '#06b6d4',
        },
        green: {
          500: '#10b981',
        },
      },
      backgroundImage: {
        'gradient-landing': 'linear-gradient(to bottom right, #0f172a, #1e3a8a, #312e81)',
        'gradient-blue-purple': 'linear-gradient(to right, #60a5fa, #c084fc)',
        'gradient-orange-red': 'linear-gradient(to right, #fb923c, #f87171)',
        'gradient-button': 'linear-gradient(to right, #2563eb, #9333ea)',
        'gradient-card':
          'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))',
      },
    },
  },
  plugins: [],
};
