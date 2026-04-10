// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import catppuccin from '@catppuccin/starlight';

export default defineConfig({
  site: 'https://emtsyslab.github.io',
  integrations: [
    starlight({
      title: 'EMTSysLab',
      description: 'Recursos, tutoriales y herramientas para administración de sistemas al siguiente nivel.',
      favicon: '/favicon.ico',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Español', lang: 'es' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/EMTSysLab' },
      ],
      components: {
        Hero: './src/components/HeroTerminal.astro',
      },
      plugins: [
        catppuccin({ defaultFlavour: 'mocha' }),
      ],
      sidebar: [
        {
          label: 'Linux',
          items: [
            { label: 'Hardening de RHEL', slug: 'linux/hardening-rhel' },
            { label: 'SELinux avanzado', slug: 'linux/selinux-avanzado' },
          ],
        },
        {
          label: 'Kubernetes',
          badge: { text: 'Próximamente', variant: 'caution' },
          items: [
            { label: 'Próximamente...', link: '#' },
          ],
        },
        {
          label: 'Podman & Docker',
          badge: { text: 'Próximamente', variant: 'caution' },
          items: [
            { label: 'Próximamente...', link: '#' },
          ],
        },
        {
          label: 'Inteligencia Artificial',
          badge: { text: 'Nuevo', variant: 'tip' },
          items: [
            { label: 'Ollama — LLMs locales', slug: 'ia/ollama-llms-locales' },
          ],
        },
      ],
    }),
  ],
});
