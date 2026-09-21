/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // TaskNera Executive Royal Indigo & Sapphire Palette (Replaces orange for a prestigious, classy enterprise look)
        brand: {
          50: '#F0F3FF',
          100: '#E0E7FE',
          200: '#C7D4FE',
          300: '#A4B8FC',
          400: '#819BFA',
          500: '#4F46E5', // Primary Executive Indigo
          600: '#4338CA', // Hover & active state
          700: '#3730A3',
          800: '#312E81',
          900: '#1E1B4B',
          950: '#0F0E2A',
        },
        // Refined Slate & Charcoal tones
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      boxShadow: {
        'brand': '0 4px 20px -2px rgba(79, 70, 229, 0.22)',
        'brand-lg': '0 10px 30px -4px rgba(79, 70, 229, 0.30)',
        'glow': '0 0 25px -4px rgba(99, 102, 241, 0.35)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 8px 24px -4px rgba(15, 23, 42, 0.05)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
