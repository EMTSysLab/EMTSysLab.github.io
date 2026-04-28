---
title: SELinux avanzado en producción
description: Gestión avanzada de SELinux en sistemas RHEL y Rocky Linux. Políticas personalizadas, troubleshooting real y casos de uso en producción.
sidebar:
  order: 2
---

![SELinux Avanzado en Producción](/selinux-avanzado-en-pro.png)


SELinux es el control de acceso obligatorio (MAC) más potente disponible en Linux. La mayoría de administradores lo desactiva cuando da problemas. Los que saben cómo funciona lo usan como ventaja.

Esta guía asume que ya tienes SELinux en `Enforcing`. Si no, vuelve a la guía de hardening.

## Cómo funciona SELinux realmente

SELinux etiqueta cada objeto del sistema: ficheros, procesos, puertos, sockets. Cada etiqueta tiene tres componentes clave:

```bash
# Ver etiqueta de un proceso
ps auxZ | grep nginx
# system_u:system_r:httpd_t:s0   nginx: master process

# Ver etiqueta de un fichero
ls -Z /var/www/html/index.html
# unconfined_u:object_r:httpd_sys_content_t:s0

# Formato: usuario:rol:tipo:nivel
# El TIPO es lo más importante — define qué puede hacer cada proceso
```

La política SELinux define qué tipos pueden interactuar entre sí. Cuando un proceso intenta acceder a algo fuera de su política, SELinux lo bloquea y lo registra en el log de auditoría.

---

## Comandos esenciales de diagnóstico

```bash
# Estado completo
sestatus

# Ver todas las negaciones recientes
ausearch -m avc -ts recent

# Ver negaciones de las últimas 24 horas
ausearch -m avc -ts today

# Ver negaciones para un proceso concreto
ausearch -m avc -c nginx -ts recent

# Interpretar un AVC con contexto completo
sealert -a /var/log/audit/audit.log

# Ver contexto de seguridad de procesos
ps axZ | grep -v grep | grep httpd

# Ver contexto de ficheros
ls -laZ /etc/nginx/
stat -c "%n %C" /var/www/html/*
```

---

## Troubleshooting real: el flujo correcto

Cuando SELinux bloquea algo, sigue siempre este orden:

### Paso 1 — Confirma que es SELinux y no otro problema

```bash
# Cambia temporalmente a Permissive (NO lo dejes así)
setenforce 0

# Prueba si el problema desaparece
# Si desaparece → es SELinux
# Si persiste → busca en otro sitio

# Vuelve a Enforcing inmediatamente
setenforce 1
```

### Paso 2 — Lee el AVC completo

```bash
ausearch -m avc -ts recent -i
```

Un AVC típico tiene esta estructura:
type=AVC msg=audit(1712700000.123:456): avc: denied { read }
for pid=1234 comm="nginx" name="app.conf" dev="sda1" ino=789
scontext=system_u:system_r:httpd_t:s0
tcontext=unconfined_u:object_r:admin_home_t:s0
tclass=file permissive=0

Lo que te dice: el proceso `nginx` (tipo `httpd_t`) intentó **leer** un fichero con contexto `admin_home_t`. SELinux lo bloqueó porque `httpd_t` no tiene permiso para leer `admin_home_t`.

### Paso 3 — Identifica la solución correcta

Hay tres soluciones posibles, en orden de preferencia:

**A) Reetiqueta el fichero** (solución más común y correcta)

```bash
# El fichero está en la ubicación correcta pero con etiqueta incorrecta
chcon -t httpd_sys_content_t /ruta/al/fichero

# Hacerlo permanente con semanage
semanage fcontext -a -t httpd_sys_content_t "/ruta/al/directorio(/.*)?"
restorecon -Rv /ruta/al/directorio
```

**B) Activa un booleano de SELinux** (cuando la función está prevista en la política)

```bash
# Listar booleanos relacionados con httpd
getsebool -a | grep httpd

# Ejemplos comunes
setsebool -P httpd_can_network_connect on      # nginx/apache conecta a backend
setsebool -P httpd_use_nfs on                   # servir ficheros desde NFS
setsebool -P httpd_read_user_content on         # leer home de usuarios
setsebool -P httpd_can_sendmail on              # enviar correo desde app web
setsebool -P httpd_execmem on                   # necesario para algunas apps PHP

# Ver descripción de un booleano
semanage boolean -l | grep httpd_can_network_connect
```

**C) Crea una política personalizada** (cuando las dos anteriores no son suficientes)

```bash
# Generar módulo desde los AVCs registrados
ausearch -m avc -ts recent | audit2allow -M mi_modulo

# Revisar qué permisos va a otorgar ANTES de aplicarlo
cat mi_modulo.te

# Aplicar el módulo
semodule -i mi_modulo.pp

# Listar módulos instalados
semodule -l | grep mi_modulo
```

---

## Gestión de contextos de ficheros

```bash
# Ver política de contextos definida
semanage fcontext -l | grep nginx

# Añadir contexto para directorio personalizado
semanage fcontext -a -t httpd_sys_content_t "/srv/web(/.*)?"
restorecon -Rv /srv/web

# Restaurar contextos al valor por defecto de la política
restorecon -Rv /var/www/html

# Verificar que los contextos son correctos
matchpathcon -V /var/www/html/index.html
```

---

## Puertos no estándar

Cuando una aplicación escucha en un puerto distinto al estándar, SELinux lo bloquea:

```bash
# Ver puertos permitidos para httpd
semanage port -l | grep http

# Permitir nginx en puerto 8443
semanage port -a -t http_port_t -p tcp 8443

# Verificar
semanage port -l | grep 8443

# Para otros servicios
semanage port -l | grep ssh        # puertos SSH permitidos
semanage port -a -t ssh_port_t -p tcp 2222
```

---

## Casos reales de producción

### Caso 1: Aplicación web con directorio personalizado

```bash
# Problema: nginx sirve desde /srv/myapp pero SELinux lo bloquea
ls -Z /srv/myapp
# unconfined_u:object_r:var_t:s0   ← tipo incorrecto

# Solución
semanage fcontext -a -t httpd_sys_content_t "/srv/myapp(/.*)?"
restorecon -Rv /srv/myapp
ls -Z /srv/myapp
# unconfined_u:object_r:httpd_sys_content_t:s0   ← correcto
```

### Caso 2: Aplicación que conecta a base de datos remota

```bash
# Problema: app PHP no puede conectar a MySQL en otro servidor
ausearch -m avc -ts recent | grep connect

# Solución: activar booleano de red
setsebool -P httpd_can_network_connect_db on
# o si conecta a cualquier puerto:
setsebool -P httpd_can_network_connect on
```

### Caso 3: Script personalizado ejecutado por systemd

```bash
# El script en /opt/scripts/ es bloqueado por SELinux
# Etiquetar como ejecutable del sistema
semanage fcontext -a -t bin_t "/opt/scripts(/.*)?"
restorecon -Rv /opt/scripts

# Si necesita permisos más amplios, crear política
ausearch -m avc -c mi_script -ts today | audit2allow -M mi_script
semodule -i mi_script.pp
```

---

## Monitorización continua de SELinux

```bash
# Ver negaciones en tiempo real
tail -f /var/log/audit/audit.log | grep AVC

# Contar negaciones por tipo
ausearch -m avc -ts today | grep "comm=" | \
  sed 's/.*comm="\([^"]*\)".*/\1/' | sort | uniq -c | sort -rn

# Script de alerta diaria
cat > /etc/cron.daily/selinux-check << 'CRONEOF'
#!/bin/bash
DENIALS=$(ausearch -m avc -ts today 2>/dev/null | wc -l)
if [ "$DENIALS" -gt 0 ]; then
    ausearch -m avc -ts today | \
      mail -s "SELinux: $DENIALS negaciones hoy en $(hostname)" admin@tudominio.com
fi
CRONEOF
chmod +x /etc/cron.daily/selinux-check
```

---

## Lo que nunca debes hacer

```bash
# NUNCA hagas esto en producción
setenforce 0                          # desactiva la protección
sed -i 's/SELINUX=enforcing/SELINUX=disabled/' /etc/selinux/config  # permanente

# NUNCA apliques audit2allow sin leer el .te generado
# Puede otorgar permisos excesivos que no necesitas

# NUNCA uses chcon sin semanage fcontext + restorecon
# Los cambios de chcon se pierden en el siguiente relabel del sistema
```

---

## Conclusión práctica

SELinux bien gestionado te da una capa de seguridad que ningún firewall puede replicar. El flujo es siempre el mismo: leer el AVC, entender qué proceso quiere hacer qué, y elegir la solución mínima necesaria — reetiqueta, booleano o política personalizada.

La clave está en no saltarse el paso de leer el AVC. El 90% de los problemas se resuelven con un `restorecon` o un `setsebool`.
