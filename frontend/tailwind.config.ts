import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#18281f', forest: '#1f664b', mint: '#e8f4ec', paper: '#f7f8f4', muted: '#78837c' }, boxShadow: { soft: '0 8px 30px rgba(23,52,37,.06)' } } }, plugins: [] };
export default config;
