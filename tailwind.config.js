/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // FamilyLedger dark finance palette.
        canvas: '#0B0C0E',
        surface: {
          DEFAULT: '#141619',
          raised: '#191C20',
          sunken: '#101214',
          /** Pressed / hovered tint for rows and menus (`bg-surface-hover`). */
          hover: '#1E2126',
          /** Selected / pressed tint for chips, tiles and code blocks. */
          active: '#242830',
        },
        line: {
          DEFAULT: '#25282D',
          strong: '#31353B',
        },
        accent: {
          DEFAULT: '#9AE6B4',
          strong: '#7BD9A2',
          soft: 'rgba(154, 230, 180, 0.12)',
          ink: '#06231A',
        },
        content: {
          DEFAULT: '#E7E9EC',
          muted: '#9BA1AA',
          subtle: '#6C737D',
        },
        danger: {
          DEFAULT: '#F87171',
          soft: 'rgba(248, 113, 113, 0.12)',
        },
        warn: {
          DEFAULT: '#FBBF24',
          soft: 'rgba(251, 191, 36, 0.12)',
        },
        positive: '#9AE6B4',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 24px -16px rgba(0,0,0,0.9)',
        pop: '0 20px 48px -24px rgba(0, 0, 0, 0.95)',
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'toast-in': {
          from: { transform: 'translateY(12px) scale(0.98)', opacity: '0' },
          to: { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
        'toast-in': 'toast-in 180ms ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
