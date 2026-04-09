---
title: Ollama — LLMs locales en Linux
description: Instala y gestiona modelos de lenguaje locales en Linux con Ollama. Privacidad total, sin coste por token y sin dependencia de servicios en la nube.
sidebar:
  order: 1
---

Ollama es la forma más sencilla de ejecutar modelos de lenguaje grandes (LLMs) directamente en tu infraestructura Linux. Sin enviar datos a terceros, sin coste por petición y con control total sobre el modelo.

Esta guía cubre la instalación, gestión de modelos y casos de uso reales para administradores de sistemas.

## ¿Por qué LLMs locales en un entorno sysadmin?

La respuesta corta: privacidad y control. Cuando usas ChatGPT o Claude para analizar logs, revisar configuraciones o generar scripts, estás enviando información potencialmente sensible a servidores externos.

Con Ollama en local:
- Los logs de producción no salen de tu red
- Las configuraciones internas permanecen privadas
- Funciona en entornos air-gapped sin acceso a internet
- Sin límites de rate ni costes por token

---

## Requisitos del sistema

Ollama funciona con CPU, pero la experiencia real requiere GPU:

| Configuración | RAM mínima | Modelos recomendados |
|---|---|---|
| Solo CPU | 8 GB | llama3.2:1b, qwen2.5:1.5b |
| CPU + 8 GB VRAM | 16 GB | llama3.2:3b, mistral:7b |
| GPU 16+ GB VRAM | 32 GB | llama3.1:8b, qwen2.5:14b |
| GPU 24+ GB VRAM | 64 GB | llama3.1:70b (cuantizado) |

Para entornos de producción sin GPU, los modelos de 1B-3B parámetros son perfectamente útiles para tareas de automatización.

---

## Instalación en Linux

### Instalación directa (recomendada)

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

El script detecta automáticamente tu distribución y configura el servicio systemd.

### Verificar instalación

```bash
# Comprobar versión
ollama --version

# Estado del servicio
systemctl status ollama

# Logs en tiempo real
journalctl -u ollama -f
```

---

## Gestión de modelos

```bash
# Modelos recomendados para sysadmin
ollama pull llama3.2:1b        # 1.3 GB — muy rápido
ollama pull llama3.2:3b        # 2.0 GB — equilibrio velocidad/calidad
ollama pull llama3.1:8b        # 4.7 GB — excelente calidad general
ollama pull mistral:7b         # 4.1 GB — muy bueno para código
ollama pull qwen2.5-coder:7b   # 4.7 GB — especializado en código

# Listar modelos descargados
ollama list

# Eliminar modelo
ollama rm llama3.2:1b
```

### Uso desde la terminal

```bash
# Modo interactivo
ollama run llama3.1:8b

# Consulta directa
ollama run mistral:7b "Explica qué hace: awk '{print $1}' /var/log/auth.log | sort | uniq -c"

# Con pipe desde stdin
cat /var/log/syslog | tail -50 | ollama run llama3.1:8b "Analiza estos logs y dime si hay algo anómalo"
```

---

## API REST local

Ollama expone una API en `http://localhost:11434`:

```bash
# Consulta básica
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Genera un script bash para rotar logs en /var/log/app/",
  "stream": false
}' | jq '.response'

# Chat con contexto de sistema
curl http://localhost:11434/api/chat -d '{
  "model": "mistral:7b",
  "messages": [
    {
      "role": "system",
      "content": "Eres un experto en administración de sistemas Linux."
    },
    {
      "role": "user",
      "content": "Como optimizo un servidor con alta carga de I/O?"
    }
  ],
  "stream": false
}' | jq '.message.content'
```

---

## Casos de uso reales para sysadmins

### Análisis de logs con IA

```bash
#!/bin/bash
# analizar-logs.sh

LOGS=$(journalctl -p err -n 50 --no-pager)
PROMPT="Analiza estos logs de error, identifica problemas críticos y sugiere comandos para investigar:

$LOGS"

echo "$PROMPT" | ollama run llama3.1:8b
```

### Generación de scripts bajo demanda

```bash
#!/bin/bash
# generar-script.sh

echo "Qué script necesitas?"
read -r TAREA

ollama run qwen2.5-coder:7b "Genera un script bash de producción para: $TAREA
Requisitos: manejo de errores con set -euo pipefail, logging con timestamps, compatible con RHEL/Rocky Linux"
```

### Explicación de comandos

```bash
# Añade esta función a tu .bashrc
explicar() {
    ollama run llama3.2:3b "Explica este comando Linux de forma clara, incluyendo cada opción: $*"
}

# Uso
explicar "ss -tlnp"
explicar "awk -F: \'\$3 >= 1000 {print \$1}\' /etc/passwd"
```

### Revisión de configuraciones

```bash
#!/bin/bash
# revisar-config.sh

FICHERO=$1
SERVICIO=$2
CONTENIDO=$(cat "$FICHERO")

ollama run llama3.1:8b "Revisa esta configuración de $SERVICIO como sysadmin senior.
Identifica problemas de seguridad y sugiere mejoras:

$CONTENIDO"
```

---

## Ejecutar Ollama con Podman

```bash
# Sin GPU
podman run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama_data:/root/.ollama \
  ollama/ollama

# Descargar modelo dentro del contenedor
podman exec ollama ollama pull llama3.1:8b

# Crear servicio systemd desde el contenedor
podman generate systemd --name ollama --files --restart-policy=always
mv container-ollama.service ~/.config/systemd/user/
systemctl --user enable --now container-ollama
```

---

## Seguridad: exponer Ollama en red interna

```bash
# Escuchar en todas las interfaces
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/network.conf << EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOF

systemctl daemon-reload
systemctl restart ollama

# Restringir con firewalld a red interna
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.0.0/8" port protocol="tcp" port="11434" accept'
firewall-cmd --reload
```

---

## Conclusión práctica

Ollama convierte cualquier servidor Linux en una plataforma de IA privada y operativa. Para tareas sysadmin el modelo más equilibrado es `llama3.1:8b`. Para generación de código, `qwen2.5-coder:7b` es claramente superior.

Empieza con `llama3.2:3b` para validar el setup y escala según tus necesidades de hardware.
