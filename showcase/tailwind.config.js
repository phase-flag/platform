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
                    navy: '#1E293B',
                    dark: '#1E1B4B',
                    primary: '#6366F1',
                    'primary-light': '#818CF8',
                    'primary-pale': '#EEF2FF',
                },
                surface: {
                    DEFAULT: '#111827',
                    light: '#1E1B4B',
                    lighter: '#252B4B',
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
