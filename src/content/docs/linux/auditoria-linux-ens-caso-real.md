---
title: Auditoría de seguridad Linux — caso real ENS
description: Caso real anonimizado de auditoría de seguridad en servidores Linux bajo el Esquema Nacional de Seguridad (ENS) categoría media. Hallazgos, comandos y recomendaciones reales.
sidebar:
  order: 3
---

Este artículo documenta un caso real de auditoría de seguridad realizada sobre servidores Linux en producción, anonimizado para proteger la confidencialidad del cliente. El objetivo era evaluar el cumplimiento del **Esquema Nacional de Seguridad (ENS) categoría media**.

Lo que verás aquí no es teoría — son hallazgos reales, comandos reales y outputs reales de sistemas en producción.

---

## Contexto del proyecto

El cliente operaba varios servidores Linux en producción con diferentes roles y funciones. Todos debían cumplir con los requisitos del ENS categoría media.

La auditoría cubría:

- Información general del sistema y configuración básica
- Gestión de usuarios y políticas de autenticación
- Hardening del sistema
- Servicios activos y software instalado
- Puertos de comunicación y servicios de red
- Logs y monitorización
- Actualizaciones y parches

Todos los registros y análisis utilizan **hora UTC** como referencia temporal, requisito del ENS para garantizar trazabilidad y correlación de eventos entre sistemas.

---

## Metodología: inventario previo al firewall

Antes de tocar ninguna configuración, lo primero es saber exactamente qué está escuchando y qué conexiones activas no puedes cortar.

```bash
# Puertos en escucha con proceso asociado
ss -tulpen

# Conexiones activas establecidas (NO interrumpir)
ss -tpn state established

# Procesos con conexiones de red
lsof -i -P -n

# Servicios en ejecución
systemctl list-units --type=service --state=running
```

Este fue el output real de `ss -tulpen` en uno de los servidores (datos sensibles anonimizados):
Netid  State   Local Address:Port    Process
tcp    LISTEN  127.0.0.1:5432        postgres (BD interna)
tcp    LISTEN  127.0.0.1:6379        redis-server (caché interna)
tcp    LISTEN  127.0.0.1:8001        gunicorn (app backend)
tcp    LISTEN  0.0.0.0:22            sshd (acceso remoto)
tcp    LISTEN  *:80                  nginx (web)
tcp    LISTEN  *:443                 nginx (web seguro)
tcp    LISTEN  172.16.x.x:10001      qualys-cloud-agent
udp    UNCONN  0.0.0.0:5353          avahi-daemon

**Observación positiva:** PostgreSQL, Redis y el backend de la aplicación escuchan solo en `127.0.0.1` — correctamente aislados. nginx gestiona el tráfico externo como proxy inverso.

**Observación negativa:** `avahi-daemon` activo en servidor de producción — servicio de descubrimiento de red diseñado para entornos de escritorio, sin utilidad en un servidor y con superficie de ataque innecesaria.

---

## Hallazgo crítico 1: gestión de usuarios

### Problema detectado

```bash
# Usuarios con shell interactiva
grep -v '/nologin\|/false' /etc/passwd | awk -F: '{print $1, $7}'

# Usuarios con UID 0
awk -F: '$3 == 0 {print $1}' /etc/passwd

# Estado de contraseñas
sudo awk -F: '$2 !~ /^[!*]/ {print $1, "→ contraseña activa"}' /etc/shadow
```

Se detectaron en varios servidores:

- **Cuentas de servicio con shell interactiva** que deberían tener `/usr/sbin/nologin`
- **Cuentas aparentemente abandonadas** sin actividad reciente pero con acceso activo
- **Login directo como root habilitado por SSH** (`PermitRootLogin yes`)
- **Autenticación por contraseña SSH habilitada** en lugar de clave pública exclusivamente

### Impacto

El login directo como root combinado con autenticación por contraseña es uno de los vectores de ataque más explotados en servidores expuestos a internet. Los logs mostraban intentos de fuerza bruta continuos sin mecanismo de bloqueo activo.

### Corrección aplicada

```bash
# Deshabilitar login root por SSH
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config

# Deshabilitar autenticación por contraseña
sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

# Verificar configuración antes de reiniciar
sshd -t && systemctl restart sshd

# Deshabilitar shell en cuentas de servicio abandonadas
usermod -s /usr/sbin/nologin nombre_cuenta
```

---

## Hallazgo crítico 2: firewall ausente o mal configurado

### Problema detectado

```bash
# Verificar estado del firewall
ufw status verbose
systemctl status ufw

# En algunos servidores el resultado fue:
# Status: inactive
```

Varios servidores tenían el firewall desactivado o con reglas permisivas. Uno de los casos más graves: **MySQL expuesto en todas las interfaces** (`0.0.0.0:3306`), accesible desde cualquier dirección IP.

```bash
# Verificar exposición de MySQL
ss -tulpen | grep 3306
# tcp LISTEN 0.0.0.0:3306   ← CRÍTICO
```

### Corrección aplicada (estrategia ENS nivel medio)

El orden de ejecución es crítico para no perder el acceso SSH:

```bash
# PASO 1: Permitir SSH ANTES de activar firewall
ufw allow from IP_ADMINISTRACION to any port 22 proto tcp

# PASO 2: Permitir servicios necesarios
ufw allow 80/tcp
ufw allow 443/tcp

# PASO 3: Configurar política por defecto
ufw default deny incoming
ufw default allow outgoing

# PASO 4: Activar (momento crítico — tener sesión SSH de respaldo abierta)
ufw enable

# PASO 5: Verificar
ufw status verbose
```

Para MySQL, la corrección fue restringir el bind en la configuración:

```bash
# /etc/mysql/mysql.conf.d/mysqld.cnf
bind-address = 127.0.0.1

# Reiniciar y verificar
systemctl restart mysql
ss -tulpen | grep 3306
# tcp LISTEN 127.0.0.1:3306  ← correcto
```

**Lección aprendida:** en producción siempre mantener dos sesiones SSH abiertas simultáneamente antes de activar el firewall. La segunda sesión es el salvavidas si algo sale mal.

---

## Hallazgo medio 1: servicios innecesarios activos

### Problema detectado

```bash
systemctl list-units --type=service --state=running
```

En servidores de producción se encontraron activos:

- `avahi-daemon` — descubrimiento de red (solo útil en escritorio)
- `ModemManager` — gestión de módems (sin sentido en servidor virtual)
- `cups` — sistema de impresión
- `upower` — gestión de energía (diseñado para portátiles)
- `multipathd` — multipath de almacenamiento (sin infraestructura SAN)
- `snapd` — gestión de snaps (incrementa superficie de ataque)

Cada servicio activo innecesario es un vector de ataque potencial. Un servidor de producción debería ejecutar exclusivamente los servicios que justifican su función.

### Corrección aplicada

```bash
# Deshabilitar y parar servicios innecesarios
for svc in avahi-daemon ModemManager cups upower snapd; do
    systemctl disable --now $svc 2>/dev/null && echo "Desactivado: $svc"
done

# Verificar que no se han roto dependencias
systemctl list-units --type=service --state=failed
```

---

## Hallazgo medio 2: hardening SSH incompleto

### Estado inicial detectado

```bash
grep -E "^(PermitRootLogin|PasswordAuthentication|X11Forwarding|MaxAuthTries|Protocol)" /etc/ssh/sshd_config
```

La configuración encontrada en varios servidores tenía valores por defecto inseguros o directivas ausentes.

### Configuración aplicada

```bash
cat >> /etc/ssh/sshd_config << EOF
# Hardening ENS
PermitRootLogin no
PasswordAuthentication no
X11Forwarding no
MaxAuthTries 3
MaxSessions 4
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 30
AllowTcpForwarding no
EOF

sshd -t && systemctl restart sshd
```

---

## Hallazgo medio 3: logs sin monitorización activa

### Problema detectado

```bash
# Verificar intentos de acceso fallidos
grep "Failed password" /var/log/auth.log | tail -20

# Resultado: cientos de intentos de fuerza bruta sin bloqueo
# No había fail2ban ni mecanismo equivalente activo

# Verificar auditd
systemctl status auditd
# → inactive (dead)
```

Los servidores registraban los intentos de intrusión pero no tomaban ninguna acción automática. Sin `auditd` activo no había trazabilidad de comandos ejecutados como root ni escaladas de privilegios.

### Corrección aplicada

```bash
# Instalar y configurar fail2ban
apt install fail2ban -y

cat > /etc/fail2ban/jail.local << EOF
[sshd]
enabled = true
port = ssh
maxretry = 3
bantime = 3600
findtime = 600
EOF

systemctl enable --now fail2ban

# Activar auditd
systemctl enable --now auditd

# Reglas básicas de auditoría
cat > /etc/audit/rules.d/hardening.rules << EOF
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/sudoers -p wa -k sudoers
-w /etc/ssh/sshd_config -p wa -k sshd_config
-a always,exit -F arch=b64 -S execve -F euid=0 -k root_commands
EOF

augenrules --load
```

---

## Hallazgo bajo: actualizaciones pendientes

### Problema detectado

```bash
apt list --upgradeable 2>/dev/null

# Se detectaron paquetes críticos sin actualizar:
# - coreutils
# - nftables
# - snapd
# - binutils

# Kernel actualizado pendiente de reinicio
needs-restarting -r
```

Adicionalmente, un repositorio externo tenía error de verificación GPG, impidiendo la actualización de sus paquetes:

```bash
# Error detectado en apt update:
# W: GPG error: https://repo.externo.com focal InRelease:
#    The following signatures couldn't be verified...

# Corrección
apt-key adv --keyserver keyserver.ubuntu.com --recv-keys CLAVE_GPG
apt update && apt upgrade -y
```

---

## Resumen de hallazgos y prioridades

| Hallazgo | Riesgo | Prioridad |
|---|---|---|
| Login root SSH habilitado | Crítico | Inmediata |
| Autenticación SSH por contraseña | Crítico | Inmediata |
| Firewall inactivo o permisivo | Crítico | Inmediata |
| MySQL expuesto en todas las interfaces | Crítico | Inmediata |
| Servicios innecesarios activos | Medio | Corto plazo |
| auditd inactivo | Medio | Corto plazo |
| fail2ban ausente | Medio | Corto plazo |
| Hardening SSH incompleto | Medio | Corto plazo |
| Actualizaciones pendientes | Medio | Corto plazo |
| Puerto SSH por defecto (22) | Bajo | Medio plazo |
| Repositorio GPG sin verificar | Bajo | Medio plazo |

---

## Buenas prácticas que ya tenían

No todo era negativo. El entorno tenía una base técnica correcta:

- HTTPS activo en todos los servicios web expuestos
- Bases de datos correctamente aisladas en `127.0.0.1` en la mayoría de servidores
- Algoritmos de hash robustos (SHA-512 / yescrypt) para contraseñas
- Herramientas de monitorización de seguridad desplegadas (agente de seguridad activo)
- Separación correcta entre servicios internos y expuestos mediante proxy inverso
- Sistemas dentro de versiones con soporte activo

---

## Conclusión práctica

El principal riesgo no residía en una vulnerabilidad concreta sino en un patrón: **exceso de exposición + falta de restricciones + control de accesos insuficiente**. Ninguno de los problemas era técnicamente complejo de resolver — todos eran configuración incorrecta o servicios no revisados desde la instalación inicial.

La lección más importante de esta auditoría: **un servidor recién instalado con la configuración por defecto no es un servidor seguro**. El hardening no es opcional en producción, especialmente en entornos que deben cumplir ENS.

El checklist mínimo antes de poner un servidor Linux en producción:

1. Deshabilitar login root por SSH
2. Deshabilitar autenticación SSH por contraseña
3. Activar y configurar firewall con política deny-all de entrada
4. Deshabilitar todos los servicios no necesarios
5. Activar auditd y fail2ban
6. Aplicar todas las actualizaciones de seguridad pendientes
7. Verificar que ningún servicio de base de datos escucha en interfaces externas
