import type { Config } from 'tailwindcss'

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  plugins: [],
  theme: {
    extend: {
      colors: {
        'primary': '#BB86FC',
        'secondary': '#03DAC6',
        'error': '#CF6679',
      }
    }
  }
} satisfies Config

