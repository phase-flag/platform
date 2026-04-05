import { defineConfig } from 'vitepress'

export default defineConfig({
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
