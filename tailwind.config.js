/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // FamilyLedger · dark, minimal, professional finance palette.
        canvas: '#090A0C',
        surface: {
          DEFAULT: '#0F1115',
          raised: '#14171D',
          sunken: '#0C0D10',
          /** Pressed / hovered tint for rows, menus and chips. */
          hover: '#1C2129',
          /** Selected / active tint for chips, tiles and code blocks. */
          active: '#232934',
        },
        line: {
          DEFAULT: '#23282F',
          strong: '#313841',
        },
        accent: {
          DEFAULT: '#2DD4BF',
          strong: '#14B8A6',
          soft: 'rgba(45, 212, 191, 0.10)',
          ink: '#064E3B',
        },
        content: {
          DEFAULT: '#F1F5F9',
          muted: '#94A3B8',
          subtle: '#64748B',
        },
        danger: {
          DEFAULT: '#F87171',
          soft: 'rgba(248, 113, 113, 0.10)',
        },
        warn: {
          DEFAULT: '#FBBF24',
          soft: 'rgba(251, 191, 36, 0.10)',
        },
        positive: '#2DD4BF',
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
        xs: ['0.75rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 32px -20px rgba(0,0,0,0.75)',
        pop: '0 24px 56px -24px rgba(0, 0, 0, 0.85)',
        soft: '0 4px 16px -8px rgba(0, 0, 0, 0.6)',
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
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'toast-in': {
          from: { transform: 'translateY(12px) scale(0.98)', opacity: '0' },
          to: { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'toast-in': 'toast-in 180ms ease-out',
        'pulse-soft': 'pulse-soft 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
