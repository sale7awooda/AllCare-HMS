/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        primary: { 
          50: 'var(--primary-50)', 
          100: 'var(--primary-100)', 
          200: 'var(--primary-200)', 
          300: 'var(--primary-300)', 
          400: 'var(--primary-400)', 
          500: 'var(--primary-500)', 
          600: 'var(--primary-600)', 
          700: 'var(--primary-700)', 
          800: 'var(--primary-800)', 
          900: 'var(--primary-900)' 
        },
        secondary: {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a',
        },
        success: { 500: '#10b981', 50: '#ecfdf5' },
        warning: { 500: '#f59e0b', 50: '#fffbeb' },
        danger: { 500: '#ef4444', 50: '#fef2f2' },
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'card': '0 0 0 1px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.04)',
      }
    }
  },
  plugins: [],
}