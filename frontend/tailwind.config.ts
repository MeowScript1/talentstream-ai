import type { Config } from 'tailwindcss'

const config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Plus Jakarta Sans"', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-elevated': 'var(--bg-elevated)',
        'accent-primary': 'var(--accent-primary)',
        'accent-hover': 'var(--accent-hover)',
        'accent-muted': 'var(--accent-muted)',
        'violet': 'var(--violet)',
        'pink': 'var(--pink)',
        'cyan': 'var(--cyan)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'border-subtle': 'var(--border-subtle)',
        'border-active': 'var(--border-active)',
        'danger': 'var(--danger)',
        'success': 'var(--success)',
        'warning': 'var(--warning)',
      },
      boxShadow: {
        'card': '0 10px 30px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px var(--border-subtle)',
        'active': '0 0 0 2px var(--border-active)',
        'glow': '0 0 40px -6px rgba(198,255,61,0.28)',
        'glow-violet': '0 0 40px -6px rgba(139,92,246,0.45)',
        // chunky "pressable" button edge
        'pop': '0 4px 0 0 var(--accent-shadow)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(var(--r, 0deg))' },
          '50%': { transform: 'translateY(-10px) rotate(var(--r, 0deg))' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        wiggle: 'wiggle 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config

export default config
