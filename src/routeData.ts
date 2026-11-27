import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const sectionByPrefix: Record<string, string> = {
  'suse-virtualization': 'SUSE Virtualization',
  linux: 'Linux',
  kubernetes: 'Kubernetes, Podman & Docker',
  ia: 'Inteligencia Artificial',
  rhcsa: 'Road to Cert',
  toolkit: 'SysAdmin Toolkit',
  automatizacion: 'Automatización & Scripting',
};

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const sectionPrefix = route.id.split('/')[0];
  const activeSection = sectionByPrefix[sectionPrefix];

  if (!activeSection) return;

  route.sidebar = route.sidebar.filter(
    (item) => item.type === 'group' && item.label === activeSection
  );
});
