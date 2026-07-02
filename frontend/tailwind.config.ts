import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#030712', // gray-950 — app background
          card: '#111827',    // gray-900 — card surfaces
          elevated: '#1f2937', // gray-800 — elevated surfaces, inputs
          border: '#374151',  // gray-700 — borders
        },
        accent: {
          DEFAULT: '#4f46e5', // indigo-600 — primary interactive
          hover: '#4338ca',   // indigo-700
          light: '#e0e7ff',   // indigo-100
          muted: '#312e81',   // indigo-900 — subtle backgrounds
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        card: '0 2px 8px 0 rgba(0,0,0,0.4)',
        'card-hover': '0 12px 32px 0 rgba(0,0,0,0.6)',
        'accent-glow': '0 0 24px 0 rgba(79,70,229,0.45)',
        'accent-glow-sm': '0 0 12px 0 rgba(79,70,229,0.30)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'fade-out': 'fadeOut 0.2s ease-in forwards',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.25s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'modal-in': 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'modal-out': 'modalOut 0.2s cubic-bezier(0.4, 0, 1, 1) forwards',
        shimmer: 'shimmer 2.2s linear infinite',
        'toast-in': 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-out': 'toastHide 0.2s ease-in forwards',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        modalIn: {
          '0%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        modalOut: {
          '0%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0.95)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        toastSlideIn: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        toastHide: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.96)' },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
