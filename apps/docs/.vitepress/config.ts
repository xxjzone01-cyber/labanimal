import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'LabAnimal Docs',
  description: 'Open-source laboratory animal management system documentation',
  lang: 'en-US',
  ignoreDeadLinks: [/localhost/],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Compliance', link: '/compliance/' },
      { text: 'API', link: '/api/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Architecture', link: '/guide/architecture' },
          ],
        },
      ],
      '/compliance/': [
        {
          text: 'Compliance',
          items: [
            { text: 'Overview', link: '/compliance/' },
            { text: 'AVMA Euthanasia', link: '/compliance/avma' },
            { text: 'IACUC Protocol', link: '/compliance/iacuc' },
            { text: 'Cage Density', link: '/compliance/density' },
            { text: '21 CFR Part 11', link: '/compliance/cfr-part11' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [{ text: 'OpenAPI Reference', link: '/api/' }],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/xxjzone01-cyber/labanimal' }],

    footer: {
      message: 'Released under the Apache-2.0 License.',
      copyright: 'Copyright © 2026-present LabAnimal Contributors',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/xxjzone01-cyber/labanimal/edit/main/apps/docs/:path',
      text: 'Edit this page on GitHub',
    },

    outline: {
      level: [2, 3],
      label: 'On this page',
    },

    lastUpdated: {
      text: 'Last updated',
    },
  },
});
