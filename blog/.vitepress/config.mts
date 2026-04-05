import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Phase Flag Blog',
  description: 'Engineering blog by Phase Flag — feature flags, progressive delivery, and developer tools',
  lang: 'en-US',

  ignoreDeadLinks: true,

  appearance: 'dark',

  themeConfig: {
    siteTitle: 'Phase Flag Blog',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Blog', link: '/posts/introducing-phase-flag' },
      { text: 'Docs', link: 'https://docs.phaseflag.com' },
      { text: 'Product', link: 'https://phaseflag.com' },
    ],

    sidebar: [
      {
        text: 'Latest Posts',
        items: [
          {
            text: 'Introducing Phase Flag',
            link: '/posts/introducing-phase-flag',
          },
          {
            text: 'Why Feature Flags Matter',
            link: '/posts/why-feature-flags-matter',
          },
          {
            text: 'Self-Host in 5 Minutes',
            link: '/posts/self-hosting-phase-flag',
          },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/phaseflag/phaseflag' },
    ],

    footer: {
      message: 'Released under the Apache 2.0 License.',
      copyright: 'Copyright © 2024 Phase Flag',
    },

    search: {
      provider: 'local',
    },
  },

  vite: {
    css: {
      preprocessorOptions: {
        css: {
          additionalData: `
            :root {
              --vp-c-brand-1: #818CF8;
              --vp-c-brand-2: #6366F1;
              --vp-c-brand-3: #4F46E5;
              --vp-c-brand-soft: rgba(99, 102, 241, 0.14);
              --vp-button-brand-bg: #4F46E5;
              --vp-button-brand-hover-bg: #4338CA;
              --vp-button-brand-active-bg: #3730A3;
              --vp-button-brand-border: transparent;
              --vp-button-brand-hover-border: transparent;
              --vp-button-brand-text: #ffffff;
              --vp-button-brand-hover-text: #ffffff;
            }
          `,
        },
      },
    },
  },
})
