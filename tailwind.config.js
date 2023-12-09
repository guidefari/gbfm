/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/pages/**/*.{js,ts,jsx,tsx}', './src/components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        jetbrains: [
          'JetBrainsMono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
      colors: {
        highlight: 'var(--highlight)',
        tomato: 'var(--highlight)',
        'gb-bg': 'var(--bg)',
        'gb-highlight': 'var(--highlight)',
        'gb-tomato': 'var(--highlight)',
        'gb-pastel-green-1': 'var(--pastel-green-1)',
        'gb-pastel-green-2': 'var(--pastel-green-2)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
      scale: {
        101: '1.01',
        102: '1.02',
        103: '1.03',
        104: '1.04',
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), require('@tailwindcss/line-clamp')],
}
