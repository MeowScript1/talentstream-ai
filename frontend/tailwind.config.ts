import type { Config } from 'tailwindcss'

const config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { md: '4px', lg: '6px', xl: '8px', '2xl': '12px' },
      colors: {
        'stamp': 'var(--stamp)',
        'secondary': 'var(--secondary)',
        'secondary-container': 'var(--secondary-container)',
        'on-secondary-container': 'var(--on-secondary-container)',
        // "white" is the ink colour, so every white/10 border and white/[0.03] tint works on a light page
        'white': 'rgb(var(--ink-rgb) / <alpha-value>)',
        'on-accent': 'var(--on-accent)',
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
        'card': '0 0 0 1px var(--border-subtle)',
        'active': '0 0 0 2px var(--border-active)',
        'glow': 'none',
        'glow-violet': 'none',
        'pop': 'none',
      },
    },
  },
  plugins: [],
} satisfies Config

export default config
