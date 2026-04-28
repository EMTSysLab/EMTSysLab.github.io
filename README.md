# EMTSysLab — Learn & Automate IT

> Un laboratorio personal hecho público. Casos reales, soluciones probadas en producción y documentación que uso yo mismo — por si a ti también te salva el día.

🌐 **Sitio web:** [emtsyslab.github.io](https://emtsyslab.github.io)

---

## ¿Qué es EMTSysLab?

EMTSysLab es un proyecto de documentación técnica orientado a administradores de sistemas. El contenido está basado en experiencia real de producción — sin teoría vacía, sin casos inventados.

Tanto si estás empezando en Linux como si llevas años administrando clústeres Kubernetes en producción, aquí encontrarás lo que las certificaciones no te enseñan.

---

## Secciones

| Sección | Estado | Contenido |
|---|---|---|
| 🐧 Linux | ✅ Activo | Hardening, SELinux, auditorías, LVM, descubrimiento |
| ☸️ Kubernetes, Podman & Docker | 🔜 Próximamente | Contenedores en producción |
| 🤖 Inteligencia Artificial | ✅ Activo | LLMs locales con Ollama |
| 🎓 Road to Cert | ✅ Activo | Preparación RHCSA EX200 |
| ⚙️ Automatización & Scripting | 🔜 Próximamente | Bash, Ansible, Python para sysadmins |
| 🛠️ SysAdmin Toolkit | 🔜 Próximamente | Monitorización, ticketing, inventario |

---

## Artículos publicados

### Linux
- [Hardening de RHEL en producción](https://emtsyslab.github.io/linux/hardening-rhel/)
- [SELinux avanzado en producción](https://emtsyslab.github.io/linux/selinux-avanzado/)
- [Auditoría de seguridad Linux — caso real ENS](https://emtsyslab.github.io/linux/auditoria-linux-ens-caso-real/)
- [Ampliación de disco LVM en RHEL con vSphere](https://emtsyslab.github.io/linux/ampliacion-disco-lvm-rhel-vsphere/)
- [Cuánto sabes de tu servidor Linux](https://emtsyslab.github.io/linux/descubrimiento-infraestructura-linux/)

### Inteligencia Artificial
- [Ollama — LLMs locales en Linux](https://emtsyslab.github.io/ia/ollama-llms-locales/)

### Road to Cert
- [Qué es el RHCSA — EX200](https://emtsyslab.github.io/rhcsa/intro-examen/)

---

## Stack técnico

- **Framework:** [Astro](https://astro.build) + [Starlight](https://starlight.astro.build)
- **Tema:** Catppuccin Mocha
- **Hosting:** GitHub Pages
- **CI/CD:** GitHub Actions — deploy automático en cada push a `main`

---

## Comandos de desarrollo

```bash
# Instalar dependencias
npm install

# Servidor local
npm run dev

# Build de producción
npm run build

# Preview del build
npm run preview
```

---

## Licencia

El contenido (artículos y guías) está bajo licencia **CC BY-NC-ND 4.0** — puedes compartirlo dando crédito, pero no para uso comercial ni obras derivadas.

El código fuente del sitio está bajo licencia **MIT**.

---

*Hecho con experiencia real. Compartido para que no te quede en un cajón.*
