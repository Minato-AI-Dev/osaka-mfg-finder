import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1f2937',
        brand: { DEFAULT: '#1d4ed8', soft: '#dbeafe' },
      },
    },
  },
  plugins: [],
};

export default config;
