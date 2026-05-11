---
title: Adagios — monitorización con Nagios y NRPE en producción
description: Análisis completo de Adagios como interfaz web para Nagios. Instalación, configuración de agentes NRPE, checks y alertas en un entorno real de 500 hosts mixtos Linux y Windows.
sidebar:
  label: Adagios — Nagios y NRPE
  order: 1
---

Adagios no es la herramienta de monitorización más moderna ni la más potente. Pero si quieres entender cómo funciona un ecosistema de monitorización basado en Nagios y NRPE desde cero, es probablemente la forma más sencilla de hacerlo.

Este artículo documenta la instalación y configuración de Adagios en un entorno real sobre RHEL, con aproximadamente 500 hosts mixtos — Linux y Windows — monitorizados mediante agentes NRPE.

---

## ¿Qué es Adagios?

Adagios es una interfaz web para Nagios diseñada para simplificar su configuración y gestión. Donde Nagios expone ficheros de configuración complejos y una interfaz web anticuada, Adagios ofrece un dashboard limpio, una API REST y una forma más intuitiva de gestionar hosts, servicios y alertas.

El stack completo tiene tres capas:

```
Adagios (interfaz web + API REST)
        ↓
Nagios Core (motor de monitorización)
        ↓
NRPE (agentes en los servidores monitorizados)
```

**Estado actual del proyecto:** Adagios es software libre con desarrollo prácticamente paralizado. El último soporte activo está orientado a CentOS 7 y RHEL. Esto no significa que no funcione — en producción funciona perfectamente — pero significa que no debes considerarlo para nuevos proyectos de monitorización a largo plazo. Para entornos de aprendizaje o infraestructuras legacy con Nagios ya instalado, sigue siendo una opción válida y sencilla.

---

## Arquitectura: cómo funciona NRPE

NRPE (Nagios Remote Plugin Executor) es el protocolo que permite a Nagios ejecutar checks en servidores remotos. El flujo es el siguiente:

```
Servidor Nagios/Adagios
        |
        | check_nrpe -H servidor_remoto -c check_disk
        |
        ↓
Agente NRPE (en el servidor remoto)
        |
        | Ejecuta el plugin localmente
        | /usr/lib64/nagios/plugins/check_disk -w 20% -c 10%
        |
        ↓
Devuelve resultado: OK / WARNING / CRITICAL / UNKNOWN
```

El servidor Nagios nunca ejecuta los checks directamente en los hosts remotos. El agente NRPE recibe la petición, ejecuta el plugin localmente y devuelve el resultado. Esto es fundamental para entender por qué cada servidor monitorizado necesita tener el agente instalado.

Los estados posibles de cualquier check en Nagios/NRPE son:

| Estado | Código | Descripción |
|---|---|---|
| OK | 0 | Todo funciona dentro de los umbrales |
| WARNING | 1 | Se ha superado el umbral de aviso |
| CRITICAL | 2 | Se ha superado el umbral crítico |
| UNKNOWN | 3 | No se pudo ejecutar el check |

---

## Prerrequisitos

- RHEL 8.x o Rocky Linux 8.x
- Acceso a repositorios EPEL
- Nagios Core instalado y funcionando
- Acceso root en el servidor de monitorización
- Conectividad en el puerto 5666/TCP desde el servidor Nagios hacia los agentes

---

## Instalación de Adagios en RHEL

### Paso 1 — Habilitar repositorios necesarios

```bash
# EPEL
dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-8.noarch.rpm

# Repositorio de Naemon (necesario para algunas dependencias)
curl -s https://download.opensuse.org/repositories/home:/naemon/AlmaLinux_8/home:naemon.repo \
  > /etc/yum.repos.d/naemon-stable.repo

# CodeReady Builder
subscription-manager repos --enable codeready-builder-for-rhel-8-x86_64-rpms
```

### Paso 2 — Instalar dependencias

```bash
dnf install -y git acl mod_ssl python3-pip python3-setuptools \
               nagios nagios-plugins-nrpe nrpe
```

### Paso 3 — Instalar Adagios

```bash
pip3 install adagios

# O desde RPM si tienes el repositorio configurado
dnf install -y adagios
```

### Paso 4 — Configurar Apache

```bash
# Adagios necesita mod_wsgi
dnf install -y python3-mod_wsgi

# Configuración de Apache para Adagios
cat > /etc/httpd/conf.d/adagios.conf << EOF
Alias /adagios /usr/lib/python3.6/site-packages/adagios

WSGIScriptAlias /adagios /usr/lib/python3.6/site-packages/adagios/wsgi.py

<Directory /usr/lib/python3.6/site-packages/adagios>
    Require all granted
</Directory>
EOF

systemctl enable --now httpd
```

### Paso 5 — Ajustar permisos

```bash
# El usuario de Apache necesita acceso a la configuración de Nagios
usermod -aG nagios apache
chmod g+rwx /etc/nagios
chmod g+rw /etc/nagios/nagios.cfg

systemctl restart httpd nagios
```

Accede a la interfaz en: `http://tu-servidor/adagios`

---

## Instalación del agente NRPE en los servidores monitorizados

### En servidores Linux (RHEL/Rocky)

```bash
# Instalar EPEL y el agente
dnf install -y epel-release
dnf install -y nrpe nagios-plugins-disk nagios-plugins-load \
               nagios-plugins-mem nagios-plugins-procs \
               nagios-plugins-http nagios-plugins-nfs

# Configurar qué checks permite ejecutar el agente
cat > /etc/nagios/nrpe.cfg << EOF
allowed_hosts=127.0.0.1,IP_SERVIDOR_NAGIOS
dont_blame_nrpe=0
allow_bash_command_substitution=0

# Checks básicos
command[check_disk]=/usr/lib64/nagios/plugins/check_disk -w 20% -c 10% -p /
command[check_load]=/usr/lib64/nagios/plugins/check_load -w 5,4,3 -c 10,8,6
command[check_mem]=/usr/lib64/nagios/plugins/check_mem -w 80 -c 90
command[check_procs]=/usr/lib64/nagios/plugins/check_procs -w 250 -c 400

# Checks de servicios específicos
command[check_httpd]=/usr/lib64/nagios/plugins/check_procs -c 1: -w 1: -C httpd
command[check_nfs]=/usr/lib64/nagios/plugins/check_nfs -H localhost
EOF

# Abrir puerto en el firewall
firewall-cmd --permanent --add-port=5666/tcp
firewall-cmd --reload

# Habilitar y arrancar el agente
systemctl enable --now nrpe
```

### En servidores Windows

Para Windows se usa **NSClient++** como agente compatible con NRPE:

```
1. Descargar NSClient++ desde nsclient.org
2. Instalar con la opción NRPE habilitada
3. Editar C:\Program Files\NSClient++\nsclient.ini:
   [/settings/NRPE/server]
   allowed hosts = IP_SERVIDOR_NAGIOS
   port = 5666
4. Iniciar el servicio NSClientpp
```

---

## Configuración de un host en Adagios

Desde la interfaz web de Adagios:

```
1. Configuration → Hosts → Add new host
2. Rellenar:
   - Host name: servidor-produccion-01
   - Address: 10.0.1.50
   - Host template: linux-server
   - Contact groups: admins
3. Guardar y aplicar configuración
```

Verificar desde línea de comandos que el agente responde:

```bash
# Test de conectividad con el agente
/usr/lib64/nagios/plugins/check_nrpe -H 10.0.1.50
# NRPE v3.2.1

# Ejecutar un check específico
/usr/lib64/nagios/plugins/check_nrpe -H 10.0.1.50 -c check_disk
# DISK OK - free space: / 45 GB (62% inode=99%)

/usr/lib64/nagios/plugins/check_nrpe -H 10.0.1.50 -c check_load
# OK - load average: 0.45, 0.38, 0.32
```

---

## Configuración de alertas por email

```bash
# Verificar que el sistema puede enviar correo
dnf install -y postfix mailx
systemctl enable --now postfix

# Probar envío
echo 'Test alerta Nagios' | mail -s 'Test' admin@tudominio.com
```

En Adagios, configurar el contacto:

```
Configuration → Contacts → Add contact
  - Contact name: admin
  - Email: admin@tudominio.com
  - Service notification options: w,c,r (warning, critical, recovery)
  - Host notification options: d,r (down, recovery)
```

---

## Umbrales: WARNING vs CRITICAL

La lógica de umbrales en NRPE es siempre la misma: `-w` para WARNING y `-c` para CRITICAL.

```bash
# Disco: avisar al 80%, crítico al 90%
command[check_disk]=/usr/lib64/nagios/plugins/check_disk -w 20% -c 10% -p /

# Carga de CPU: umbrales para 1, 5 y 15 minutos
command[check_load]=/usr/lib64/nagios/plugins/check_load -w 5,4,3 -c 10,8,6

# Memoria: WARNING al 80%, CRITICAL al 90%
command[check_mem]=/usr/lib64/nagios/plugins/check_mem -w 80 -c 90

# Procesos: WARNING si hay más de 250, CRITICAL si hay más de 400
command[check_procs]=/usr/lib64/nagios/plugins/check_procs -w 250 -c 400

# Servicio httpd: CRITICAL si no hay ningún proceso activo
command[check_httpd]=/usr/lib64/nagios/plugins/check_procs -c 1: -w 1: -C httpd
```

---

## Valoración honesta de Adagios

Después de usarlo en un entorno de 500 hosts mixtos, este es mi análisis real:

**Lo que funciona bien:**
- Instalación sencilla desde RPM — en menos de una hora tienes el entorno funcionando
- La interfaz web hace comprensible el modelo de Nagios para alguien que lo ve por primera vez
- NRPE funciona de forma estable y predecible — una vez configurado no da problemas
- La API REST permite automatizar altas de hosts sin tocar la interfaz
- Para 500 hosts funciona sin problemas de rendimiento

**Lo que limita:**
- Interfaz muy básica sin posibilidad real de personalización
- El proyecto está prácticamente abandonado — no esperes actualizaciones ni nuevas funciones
- Las imágenes Docker oficiales corren sobre CentOS 7 EOL
- No tiene dashboards ni visualización de tendencias — solo estado OK/WARNING/CRITICAL
- La curva de aprendizaje de Nagios sigue siendo necesaria — Adagios la suaviza pero no la elimina

**¿Cuándo tiene sentido usarlo?**
- Entornos legacy donde ya existe Nagios y no hay presupuesto para migrar
- Para aprender cómo funciona la monitorización con NRPE desde cero
- Infraestructuras pequeñas o medianas donde no se necesitan dashboards avanzados

**¿Cuándo no tiene sentido?**
- Proyectos nuevos — hay alternativas mucho más modernas: Zabbix, Checkmk, Prometheus+Grafana
- Entornos que necesiten visualización de métricas y tendencias
- Equipos que no tengan experiencia previa con Nagios

---

## Conclusión práctica

Adagios cumple exactamente lo que promete: hacer Nagios más accesible. Si necesitas entender cómo funciona un sistema de monitorización basado en agentes NRPE, es un punto de partida perfecto. Si necesitas algo para producción a largo plazo, mira hacia Zabbix o Checkmk.

En la guía comparativa de herramientas de monitorización que publicaré próximamente en EMTSysLab, verás cómo se sitúa Adagios frente al resto de opciones disponibles.