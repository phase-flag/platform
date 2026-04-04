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
                    mint: '#5BBAA7',
                    'mint-light': '#7ED4C1',
                    'mint-pale': '#E8F7F3',
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
