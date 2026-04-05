/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                pf: {
                    navy: '#2B4C5C',
                    dark: '#1E3A4A',
                    primary: '#6366F1',
                    'primary-light': '#818CF8',
                    'primary-pale': '#EEF2FF',
                },
                surface: {
                    DEFAULT: '#162029',
                    light: '#1C2D38',
                    lighter: '#243640',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Josefin Sans', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
        },
    },
    plugins: [],
}
