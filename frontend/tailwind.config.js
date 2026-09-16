/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // TaskNera Official Brand Colors
        brand: {
          50: '#FFF7F4',
          100: '#FFEBE3',
          200: '#FFD6C7',
          300: '#FFB39A',
          400: '#FF8A68',
          500: '#F25E35', // Primary TaskNera Coral-Orange
          600: '#DE4A21', // Hover state
          700: '#BA3714',
          800: '#942E13',
          900: '#7B2813',
          950: '#431206',
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
        'brand': '0 4px 20px -2px rgba(242, 94, 53, 0.22)',
        'brand-lg': '0 10px 30px -4px rgba(242, 94, 53, 0.30)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
