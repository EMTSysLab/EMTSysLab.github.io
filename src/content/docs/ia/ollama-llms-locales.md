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

```bashcurl -fsSL https://ollama.com/install.sh | sh

El script detecta automáticamente tu distribución y configura el servicio systemd.

### Verificar instalación

```bashComprobar versión
ollama --versionEstado del servicio
systemctl status ollamaLogs en tiempo real
journalctl -u ollama -f

### Instalación en Rocky Linux / RHEL sin acceso a internet

```bashDescargar el binario directamente
curl -L https://ollama.com/download/ollama-linux-amd64 -o /usr/local/bin/ollama
chmod +x /usr/local/bin/ollamaCrear usuario de sistema
useradd -r -s /bin/false -m -d /usr/share/ollama ollamaCrear servicio systemd manualmente
cat > /etc/systemd/system/ollama.service << 'SVCEOF'
[Unit]
Description=Ollama Service
After=network-online.target[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"[Install]
WantedBy=default.target
SVCEOFsystemctl daemon-reload
systemctl enable --now ollama

---

## Gestión de modelos

### Descargar modelos

```bashModelos recomendados para sysadmin (ordenados por tamaño)
ollama pull llama3.2:1b        # 1.3 GB — muy rápido, bueno para tareas simples
ollama pull llama3.2:3b        # 2.0 GB — equilibrio velocidad/calidad
ollama pull llama3.1:8b        # 4.7 GB — excelente calidad general
ollama pull mistral:7b         # 4.1 GB — muy bueno para código y scripts
ollama pull qwen2.5-coder:7b   # 4.7 GB — especializado en código
ollama pull codellama:7b       # 3.8 GB — optimizado para generación de código

### Gestión básica

```bashListar modelos descargados
ollama listVer información de un modelo
ollama show llama3.1:8bEliminar modelo
ollama rm llama3.2:1bCopiar modelo con nombre personalizado
ollama cp llama3.1:8b mi-asistente-sysadmin

### Uso desde la terminal

```bashModo interactivo
ollama run llama3.1:8bConsulta directa sin modo interactivo
ollama run mistral:7b "Explica qué hace este comando: awk '{print $1}' /var/log/auth.log | sort | uniq -c | sort -rn"Con pipe desde stdin
cat /var/log/syslog | tail -50 | ollama run llama3.1:8b "Analiza estos logs y dime si hay algo anómalo"

---

## API REST local

Ollama expone una API compatible con OpenAI en `http://localhost:11434`:

```bashConsulta básica via curl
curl http://localhost:11434/api/generate -d '{
"model": "llama3.1:8b",
"prompt": "Genera un script bash para rotar logs en /var/log/app/",
"stream": false
}' | jq '.response'Chat con contexto
curl http://localhost:11434/api/chat -d '{
"model": "mistral:7b",
"messages": [
{
"role": "system",
"content": "Eres un experto en administración de sistemas Linux. Responde de forma concisa y con ejemplos prácticos."
},
{
"role": "user",
"content": "¿Cómo optimizo el rendimiento de un servidor con alta carga de I/O?"
}
],
"stream": false
}' | jq '.message.content'

---

## Casos de uso reales para sysadmins

### Análisis de logs con IA

```bash#!/bin/bash
analizar-logs.sh — analiza los últimos errores del sistema con IALOGS=$(journalctl -p err -n 50 --no-pager)
PROMPT="Eres un administrador de sistemas senior. Analiza estos logs de error y:

Identifica los problemas más críticos
Sugiere causa probable para cada uno
Proporciona comandos concretos para investigar
Logs:
$LOGS"echo "$PROMPT" | ollama run llama3.1:8b

### Generación de scripts bajo demanda

```bash#!/bin/bash
generar-script.sh — genera scripts bash con IA localecho "¿Qué script necesitas?"
read -r TAREAPROMPT="Genera un script bash de producción para: $TAREA
Requisitos:

Manejo de errores con set -euo pipefail
Logging con timestamps
Comentarios explicativos
Compatible con RHEL/Rocky Linux"
ollama run qwen2.5-coder:7b "$PROMPT"

### Explicación de comandos desconocidos

```bashFunción para añadir a tu .bashrc
explicar() {
ollama run llama3.2:3b "Explica este comando Linux de forma clara y concisa, incluyendo cada opción: $*"
}Uso
explicar "ss -tlnp"
explicar "awk -F: '$3 >= 1000 {print $1}' /etc/passwd"

### Revisión de configuraciones

```bash#!/bin/bash
revisar-config.sh — revisa un fichero de configuración con IAFICHERO=$1
SERVICIO=$2if [ -z "FICHERO"]∣∣[−z"FICHERO" ] || [ -z "
FICHERO"]∣∣[−z"SERVICIO" ]; then
    echo "Uso: $0
<fichero> <servicio>"
echo "Ejemplo: $0 /etc/nginx/nginx.conf nginx"
exit 1
fiCONTENIDO=(cat"(cat "
(cat"FICHERO")
PROMPT="Revisa esta configuración de $SERVICIO como un sysadmin senior:


Identifica problemas de seguridad
Señala configuraciones subóptimas de rendimiento
Sugiere mejoras concretas
Configuración:
$CONTENIDO"ollama run llama3.1:8b "$PROMPT"

---

## Ejecutar Ollama en contenedor Podman

```bashSin GPU
podman run -d 
--name ollama 
-p 11434:11434 
-v ollama_data:/root/.ollama 
ollama/ollamaCon GPU NVIDIA
podman run -d 
--name ollama 
--device nvidia.com/gpu=all 
-p 11434:11434 
-v ollama_data:/root/.ollama 
ollama/ollamaDescargar modelo dentro del contenedor
podman exec ollama ollama pull llama3.1:8bCrear servicio systemd desde el contenedor
podman generate systemd --name ollama --files --restart-policy=always
mv container-ollama.service ~/.config/systemd/user/
systemctl --user enable --now container-ollama

---

## Seguridad: exponer Ollama en red interna

Por defecto Ollama solo escucha en localhost. Para exponerlo en tu red interna de forma segura:

```bashConfigurar escucha en todas las interfaces
cat > /etc/systemd/system/ollama.service.d/network.conf << 'EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOFsystemctl daemon-reload
systemctl restart ollamaRestringir acceso con firewalld (solo red interna)
firewall-cmd --permanent --add-rich-rule='
rule family="ipv4"
source address="10.0.0.0/8"
port protocol="tcp" port="11434"
accept'
firewall-cmd --reload

---

## Monitorización del rendimiento

```bashVer uso de recursos durante inferencia
watch -n 1 'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits'Para CPU
watch -n 1 'top -bn1 | grep ollama'Métricas de Ollama
curl -s http://localhost:11434/api/ps | jq '.'

---

## Conclusión práctica

Ollama convierte cualquier servidor Linux en una plataforma de IA privada y operativa. Para un sysadmin, los casos de uso más valiosos son el análisis de logs en tiempo real, la generación de scripts bajo demanda y la revisión de configuraciones.

El modelo que más uso en producción para tareas sysadmin es `llama3.1:8b` — equilibrio perfecto entre velocidad y calidad. Para generación de código, `qwen2.5-coder:7b` es claramente superior.

Empieza con un modelo pequeño (`llama3.2:3b`) para validar el setup y escala según tus necesidades de hardware.
