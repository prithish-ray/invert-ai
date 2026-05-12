/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f0faf4',
          100: '#d4f0df',
          200: '#a8e0c0',
          300: '#6ec99a',
          400: '#3aad75',
          500: '#2d6a4f',
          600: '#1f5c42',
          700: '#174d37',
          800: '#103d2c',
          900: '#082b1e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
