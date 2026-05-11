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
        Head: './src/components/Head.astro',
      },
      plugins: [
        catppuccin({ defaultFlavour: 'mocha' }),
      ],
      customCss: ['./src/styles/global.css'],
      sidebar: [
        {
          label: 'Linux',
          items: [
            { label: 'Hardening de RHEL', slug: 'linux/hardening-rhel' },
            { label: 'SELinux avanzado', slug: 'linux/selinux-avanzado' },
            { label: 'Auditoría de seguridad Linux — caso real ENS', slug: 'linux/auditoria-linux-ens-caso-real' },
            { label: 'Ampliación de disco LVM en vSphere', slug: 'linux/ampliacion-disco-lvm-rhel-vsphere' },
            { label: 'Cuánto sabes de tu servidor Linux', slug: 'linux/descubrimiento-infraestructura-linux', badge: { text: 'Nuevo', variant: 'tip' } },
          ],
        },
        {
          label: 'Kubernetes, Podman & Docker',
          badge: { text: 'Próximamente', variant: 'caution' },
          items: [
            { label: 'Próximamente...', link: '#' },
          ],
        },
        {
          label: 'Inteligencia Artificial',
          items: [
            { label: 'Ollama — LLMs locales', slug: 'ia/ollama-llms-locales' },
          ],
        },
        {
          label: 'Road to Cert',
          badge: { text: 'Nuevo', variant: 'tip' },
          items: [
            {
              label: 'RHCSA — EX200',
              items: [
                {
                  label: 'Bloque 1 — Fundamentos',
                  items: [
                    { label: 'Qué es el RHCSA', slug: 'rhcsa/intro-examen' },
                    { label: 'Entorno de laboratorio KVM', slug: 'rhcsa/laboratorio-kvm' },
                    { label: 'Acceso a la línea de comandos', slug: 'rhcsa/acceso-linea-comandos', badge: { text: 'Nuevo', variant: 'tip' } },
                    { label: 'Kickstart en RHEL 10', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Comandos esenciales', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Gestión de paquetes DNF5', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                  ],
                },
                {
                  label: 'Bloque 2 — Administración',
                  collapsed: true,
                  items: [
                    { label: 'Usuarios y grupos', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Permisos y ACLs', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Arranque GRUB2 y systemd', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Systemd avanzado', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Almacenamiento y LVM', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'XFS, Stratis y VDO', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                  ],
                },
                {
                  label: 'Bloque 3 — Seguridad y red',
                  collapsed: true,
                  items: [
                    { label: 'Firewalld', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'SELinux en el examen', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Red con NetworkManager', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Tareas programadas', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'SSH hardening', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                  ],
                },
                {
                  label: 'Bloque 4 — Lo nuevo en RHEL 10',
                  collapsed: true,
                  items: [
                    { label: 'Podman en el RHCSA', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Cockpit', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Simulacro EX200', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                  ],
                },
                {
                  label: 'Bloque 5 — Estrategia',
                  collapsed: true,
                  items: [
                    { label: 'Mi método de estudio', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Los 10 errores del EX200', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                    { label: 'Script de laboratorio', link: '#', badge: { text: 'Próximamente', variant: 'caution' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Automatización & Scripting',
          badge: { text: 'Próximamente', variant: 'caution' },
          items: [
            { label: 'Próximamente...', link: '#' },
          ],
        },
        {
          label: 'SysAdmin Toolkit',
          items: [
            {
              label: 'Monitorización',
              items: [
                { label: 'Adagios — Nagios y NRPE', slug: 'toolkit/monitorizacion/adagios-nagios-nrpe' },
              ],
            },
          ],
        },
      ],
    }),
  ],
});
