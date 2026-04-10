#!/usr/bin/env python3
# nuevo-articulo.py — crea un artículo nuevo con la estructura correcta

import os

print("=== Nuevo artículo para EMTSysLab ===")
print("")

seccion = input("Sección (linux/kubernetes/containers/ia): ").strip()
fichero = input("Nombre del fichero (sin espacios, con guiones. Ej: hardening-rhel): ").strip()
titulo = input("Título del artículo: ").strip()
descripcion = input("Descripción breve (para SEO): ").strip()
orden = input("Orden en el sidebar (número): ").strip()

ruta = f"src/content/docs/{seccion}/{fichero}.md"

os.makedirs(f"src/content/docs/{seccion}", exist_ok=True)

plantilla = f"""---
title: {titulo}
description: {descripcion}
sidebar:
  order: {orden}
---

Escribe aquí la introducción del artículo.

## Sección 1

Contenido.

## Conclusión práctica

Conclusión.
"""

with open(ruta, "w") as f:
    f.write(plantilla)

print(f"")
print(f"Artículo creado en: {ruta}")
print(f"Edítalo con: nano {ruta}")
print(f"")
print(f"Cuando esté listo:")
print(f"  git add -A")
print(f"  git commit -m \"docs: añadir {titulo}\"")
print(f"  git push origin main")
