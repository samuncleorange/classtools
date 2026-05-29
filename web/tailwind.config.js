import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主色：薄荷青 cyan
        brand: colors.cyan,
        // 强调色：琥珀 amber
        accent: colors.amber,
        // 语义色
        gain: colors.emerald,
        lose: colors.rose,
        mint: {
          50: '#f0fdfa',
          100: '#e6fffb',
        },
      },
      fontFamily: {
        sans: ['system-ui', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
