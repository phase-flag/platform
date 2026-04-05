import { defineConfig } from 'vitepress'

export default defineConfig({
  head: [
    [
      'style',
      {},
      `
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
    ],
  ],
  title: 'Phase Flag',
  description: 'Feature flagging for developers — open source, self-hosted, or SaaS',
  lang: 'en-US',

  ignoreDeadLinks: true,

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Phase Flag Docs',

    nav: [
      { text: 'Guide', link: '/introduction' },
      { text: 'Quickstart', link: '/quickstart' },
      { text: 'API Reference', link: '/api-reference/overview' },
      { text: 'Dashboard', link: 'https://app.phaseflag.io' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/introduction' },
          { text: '5-Minute Quickstart', link: '/quickstart' },
        ],
      },
      {
        text: 'SDK Guides',
        items: [
          { text: 'JavaScript / TypeScript', link: '/sdks/javascript' },
          { text: 'Python', link: '/sdks/python' },
          { text: 'Go', link: '/sdks/go' },
          { text: 'React', link: '/sdks/react' },
          { text: 'Java', link: '/sdks/java' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Overview', link: '/api-reference/overview' },
          { text: 'Authentication', link: '/api-reference/authentication' },
          { text: 'Flags', link: '/api-reference/flags' },
          { text: 'Evaluation', link: '/api-reference/evaluation' },
        ],
      },
      {
        text: 'Deployment',
        items: [
          { text: 'Docker Compose', link: '/deployment/docker' },
          { text: 'OSS Docker (Local Dev)', link: '/deployment/oss-docker' },
          { text: 'Self-Hosted (Production)', link: '/deployment/self-hosted' },
          { text: 'Kubernetes / Helm', link: '/deployment/kubernetes' },
          { text: 'Terraform', link: '/deployment/terraform' },
        ],
      },
      {
        text: 'Architecture',
        items: [
          { text: 'Architecture Overview', link: '/architecture' },
          { text: 'Component Details', link: '/architecture/overview' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/phaseflag/phaseflag' },
    ],

    editLink: {
      pattern: 'https://github.com/phaseflag/phaseflag/edit/main/docs/site/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the Apache 2.0 License.',
      copyright: 'Copyright © 2024 Phase Flag',
    },

    search: {
      provider: 'local',
    },
  },
})
