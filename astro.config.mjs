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
      defaultLocale: 'es',
      locales: {
        es: { label: 'Español', lang: 'es' },
        en: { label: 'English', lang: 'en' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/EMTSysLab' },
      ],
      plugins: [
        catppuccin({ defaultFlavour: 'mocha' }),
      ],
      sidebar: [
        {
          label: 'Linux',
          items: [
            { label: 'Introducción', slug: 'linux/index' },
            { label: 'Hardening de RHEL', slug: 'linux/hardening-rhel' },
            { label: 'SELinux avanzado', slug: 'linux/selinux-avanzado' },
          ],
        },
        {
          label: 'Kubernetes',
          items: [
            { label: 'Introducción', slug: 'kubernetes/index' },
          ],
        },
        {
          label: 'Podman & Docker',
          items: [
            { label: 'Introducción', slug: 'containers/index' },
          ],
        },
        {
          label: 'GLPI',
          items: [
            { label: 'Introducción', slug: 'glpi/index' },
          ],
        },
      ],
    }),
  ],
});
