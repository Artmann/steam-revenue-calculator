import type { Config } from 'tailwindcss'

const config = {
  darkMode: ['class'],
  content: ['./app/**/*.{js,jsx,ts,tsx}'],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      },
      colors: {
        ink: 'var(--ink)',
        paper: {
          DEFAULT: 'var(--paper)',
          muted: 'var(--paper-muted)',
          dim: 'var(--paper-dim)'
        },
        rule: {
          DEFAULT: 'var(--rule)',
          strong: 'var(--rule-strong)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          strong: 'var(--accent-strong)'
        },
        /* Legacy token kept so any unmigrated `text-primary` falls back to accent */
        primary: 'var(--accent)'
      },
      fontFamily: {
        sans: [
          '"Instrument Sans"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif'
        ],
        display: ['Fraunces', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        serif: ['Fraunces', 'Georgia', 'Cambria', 'Times New Roman', 'serif']
      },
      fontSize: {
        'display-xl': [
          'clamp(4rem, 2.5rem + 7vw, 7.5rem)',
          { lineHeight: '0.92', letterSpacing: '-0.03em' }
        ],
        display: [
          'clamp(3rem, 2rem + 5vw, 5.5rem)',
          { lineHeight: '0.95', letterSpacing: '-0.02em' }
        ]
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
} satisfies Config

export default config
