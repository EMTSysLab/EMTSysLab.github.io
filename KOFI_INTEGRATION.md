# Integración Ko-fi en EMTSysLab

## ✅ Componentes instalados

### 1. SupportBanner.astro
- Banner discreto con enlace a Ko-fi
- Aparece automáticamente en el footer de TODAS las páginas
- Ya está activo, no necesitas hacer nada

### 2. ArticleFooter.astro
- CTA completo para final de artículos
- Incluye botones de Ko-fi + LinkedIn
- Debes añadirlo manualmente en cada artículo donde quieras monetizar

### 3. CustomFooter.astro
- Footer personalizado que integra el SupportBanner
- Ya configurado en astro.config.mjs

## 📝 Cómo usar ArticleFooter en tus artículos

### Opción A: Al final del artículo (recomendado)

Edita cualquier `.md` y añade al final:

\`\`\`markdown
---
title: "Tu artículo"
description: "Descripción"
---

## Contenido del artículo

Aquí va todo tu contenido...

## Conclusión

Texto final...

import ArticleFooter from '@components/ArticleFooter.astro';

<ArticleFooter />
\`\`\`

### Opción B: Antes de la conclusión

\`\`\`markdown
## Paso final

Último contenido técnico...

import ArticleFooter from '@components/ArticleFooter.astro';

<ArticleFooter />

## Conclusión

Resumen y cierre...
\`\`\`

## 🎯 Estrategia de uso recomendada

### Usa ArticleFooter en:
✅ Tutoriales largos (>1500 palabras)
✅ Guías paso a paso que resuelven problemas específicos
✅ Artículos de RHCSA (alta utilidad)
✅ Scripts y automatizaciones
✅ Casos reales complejos (auditorías ENS, troubleshooting)

### NO uses ArticleFooter en:
❌ Artículos muy cortos (<500 palabras)
❌ Posts de noticias o actualizaciones
❌ Páginas de índice o navegación
❌ Contenido de "próximamente"

## 📊 Configuración actual

- **Ko-fi URL**: https://ko-fi.com/emtsyslab
- **LinkedIn**: https://www.linkedin.com/in/elihu-mt
- **Banner footer**: Activo en todas las páginas
- **ArticleFooter**: Manual por artículo

## 🔧 Personalización

Si quieres cambiar los textos o colores, edita:
- `src/components/SupportBanner.astro` - Banner del footer
- `src/components/ArticleFooter.astro` - CTA de artículos

## 🚀 Siguiente paso

1. Haz commit de estos cambios
2. Push al repositorio
3. GitHub Actions desplegará automáticamente
4. En 2-3 minutos verás el banner de Ko-fi en todas las páginas

Para añadir el ArticleFooter, edita tus artículos principales uno por uno.
