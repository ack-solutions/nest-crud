import { defineConfig } from 'vitepress';

// Docs site for @ackplus/nest-crud. Deployed to GitHub Pages at
// https://ack-solutions.github.io/nest-crud/ (base must match the repo name).
export default defineConfig({
  title: 'nest-crud',
  description: 'Powerful CRUD for NestJS + TypeORM — @ackplus/nest-crud',
  base: '/nest-crud/',
  lastUpdated: true,
  cleanUrls: true,
  srcExclude: ['README.md', 'ROADMAP.md'],
  themeConfig: {
    nav: [
      { text: 'Getting started', link: '/getting-started' },
      { text: 'Querying', link: '/querying' },
      { text: 'Changelog', link: 'https://github.com/ack-solutions/nest-crud/blob/main/CHANGELOG.md' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Configuration', link: '/configuration' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Querying', link: '/querying' },
          { text: 'Lifecycle hooks', link: '/lifecycle-hooks' },
          { text: 'Soft delete', link: '/soft-delete' },
          { text: 'Auth & guards', link: '/auth-and-guards' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Error handling', link: '/error-handling' },
          { text: 'Troubleshooting', link: '/troubleshooting' },
        ],
      },
      {
        text: 'Client frameworks',
        items: [
          { text: 'React', link: '/frameworks/react' },
          { text: 'Angular', link: '/frameworks/angular' },
          { text: 'Vue', link: '/frameworks/vue' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/ack-solutions/nest-crud' }],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/ack-solutions/nest-crud/edit/main/docs/:path',
    },
  },
});
