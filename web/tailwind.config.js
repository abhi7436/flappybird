/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Nunito', 'sans-serif'] },
      colors: {
        sky: {
          day:   '#87CEEB',
          dusk:  '#FF7E5F',
          night: '#0F0C29',
        },
        brand: {
          yellow: '#FFD700',
          orange: '#FF6B35',
          green:  '#4CAF50',
          purple: '#9B59B6',
        },
        neon: {
          yellow: '#FFE000',
          orange: '#FF5A1F',
          pink:   '#FF2EF7',
          cyan:   '#00F0FF',
          green:  '#00FF94',
          purple: '#9333EA',
        },
        arcade: {
          bg:       '#020B18',
          surface:  '#0a1628',
          card:     '#0f1e35',
        },
      },
      animation: {
        'float':          'float 3s ease-in-out infinite',
        'float-bird':     'float-bird 2.8s ease-in-out infinite',
        'pulse-soft':     'pulse-soft 2s ease-in-out infinite',
        'slide-up':       'slide-up 0.3s ease-out',
        'slide-down':     'slide-down 0.3s ease-out',
        'fade-in':        'fade-in 0.4s ease-out',
        'bounce-in':      'bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'neon-pulse':     'neon-pulse 3s ease-in-out infinite',
        'champion-glow':  'champion-glow 2s ease-in-out infinite',
        'score-burst':    'score-burst 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'shimmer':        'shimmer 0.55s ease forwards',
        'rank-pop':       'rank-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'badge-glow':     'badge-glow 1.6s ease-in-out infinite',
        'crown-bounce':   'crown-bounce 1.8s ease-in-out infinite',
        'star-twinkle':   'star-twinkle 2.5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'float-bird': {
          '0%, 100%': { transform: 'translateY(0) rotate(-4deg)' },
          '50%':      { transform: 'translateY(-16px) rotate(4deg)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.7' },
        },
        'slide-up': {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        'slide-down': {
          from: { transform: 'translateY(-20px)', opacity: '0' },
          to:   { transform: 'translateY(0)',     opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'bounce-in': {
          '0%':   { transform: 'scale(0.3)', opacity: '0' },
          '50%':  { transform: 'scale(1.05)' },
          '70%':  { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        'neon-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.85' },
        },
        'champion-glow': {
          '0%, 100%': { boxShadow: '0 0 24px rgba(255,215,0,0.5), 0 0 48px rgba(255,215,0,0.25)' },
          '50%':      { boxShadow: '0 0 48px rgba(255,215,0,0.85), 0 0 96px rgba(255,215,0,0.55)' },
        },
        shimmer: {
          '0%':   { transform: 'translateX(-120%) skewX(-12deg)' },
          '100%': { transform: 'translateX(260%)  skewX(-12deg)' },
        },
        'rank-pop': {
          '0%':   { transform: 'scale(0) rotate(-20deg)' },
          '60%':  { transform: 'scale(1.2) rotate(5deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
        'badge-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(16,185,129,0.5)' },
          '50%':      { boxShadow: '0 0 20px rgba(16,185,129,1), 0 0 35px rgba(16,185,129,0.5)' },
        },
        'crown-bounce': {
          '0%, 100%': { transform: 'translateY(0) rotate(-5deg)' },
          '50%':      { transform: 'translateY(-6px) rotate(5deg)' },
        },
        'star-twinkle': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%':      { opacity: '1',   transform: 'scale(1.4)' },
        },
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        glow:          '0 0 20px rgba(255, 215, 0, 0.4)',
        'glow-blue':   '0 0 20px rgba(99, 179, 237, 0.4)',
        'glow-neon':   '0 0 30px rgba(255, 224, 0, 0.6)',
        'glow-cyan':   '0 0 20px rgba(0, 240, 255, 0.5)',
        'glow-pink':   '0 0 20px rgba(255, 46, 247, 0.5)',
        'glow-green':  '0 0 20px rgba(0, 255, 148, 0.5)',
        glass:         '0 8px 32px rgba(0, 0, 0, 0.2)',
        champion:      '0 0 48px rgba(255,215,0,0.7), 0 0 96px rgba(255,215,0,0.4)',
        arcade:        '0 0 0 1px rgba(255,224,0,0.3), 0 8px 32px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
