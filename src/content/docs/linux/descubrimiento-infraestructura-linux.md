---
title: Cuánto sabes de tu servidor Linux — checklist de descubrimiento completo
description: Checklist sistemático para tener el mapa completo de cualquier servidor Linux. Qué buscar, en qué orden y por qué — tanto si lo acabas de heredar como si llevas años administrándolo.
sidebar:
  order: 5
---

![Cuánto sabes de tu servidor Linux](/descubrimiento-linux.png)


¿Cuánto sabes realmente de los servidores que administras?

No me refiero a si sabes que hay un nginx corriendo o que la base de datos es MySQL. Me refiero a saber exactamente qué versión del kernel tienes, qué puertos están escuchando en qué interfaces, qué usuarios tienen shell interactiva, cuándo expiran los certificados SSL o qué crons se ejecutan a las 3 de la madrugada.

La mayoría de sysadmins conocen bien los servicios que ellos mismos han instalado. Pero los servidores acumulan años de cambios, instalaciones, configuraciones temporales que se vuelven permanentes y decisiones que nadie recuerda haber tomado.

Esta guía es un checklist sistemático para tener el mapa completo de cualquier servidor Linux — ya sea uno que acabas de heredar, uno que llevas años administrando o uno que simplemente quieres auditar antes de que alguien más lo haga.

---

## Por qué el orden importa

El descubrimiento tiene un orden lógico. Primero entiendes el sistema, luego la red, luego las aplicaciones, luego la seguridad. Si vas al revés pierdes contexto y te pierdes cosas críticas.

El orden que propongo:

1. Sistema operativo y hardware
2. Red y conectividad
3. Servicios activos
4. Stack de aplicaciones
5. Configuraciones clave
6. Tareas programadas
7. Usuarios y seguridad
8. Certificados SSL
9. Logs
10. Paquetes y actualizaciones

---

## 1. Sistema operativo y hardware

Lo primero es saber exactamente con qué sistema estás trabajando.

```bash
# Distribución y versión exacta
cat /etc/os-release

# Versión del kernel
uname -r

# Tiempo que lleva el servidor activo
uptime -p

# Zona horaria — critico para correlacionar logs
timedatectl
```

Para el hardware necesitas saber cuántos recursos tiene y cómo están siendo usados:

```bash
# CPU: nucleos, arquitectura, velocidad
lscpu | grep -E "Model name|CPU\(s\)|Thread|Core|MHz"

# Memoria RAM
free -h

# Discos, particiones y sistema de ficheros
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT

# Uso actual del disco — buscar volúmenes al limite
df -hT | grep -v tmpfs

# LVM si existe
pvs && vgs && lvs
```

Lo que buscas: volúmenes por encima del 80%, kernels sin soporte, distribuciones EOL.

---

## 2. Red y conectividad

```bash
# Interfaces y IPs asignadas
ip -br addr show

# Tabla de rutas
ip route show

# DNS configurado
cat /etc/resolv.conf

# Puertos en escucha — esto es critico
ss -tulnp

# Reglas de firewall
firewall-cmd --list-all 2>/dev/null || iptables -L -n 2>/dev/null || ufw status verbose 2>/dev/null
```

El comando `ss -tulnp` es el más importante de esta sección. Te dice exactamente qué está escuchando conexiones y en qué interfaz. Un puerto abierto en `0.0.0.0` es accesible desde cualquier IP. Un puerto en `127.0.0.1` solo es accesible localmente.

Lo que buscas: servicios expuestos innecesariamente, bases de datos accesibles desde el exterior, ausencia de firewall.

---

## 3. Servicios activos

```bash
# Servicios corriendo ahora mismo
systemctl list-units --type=service --state=running --no-pager

# Servicios habilitados al inicio
systemctl list-unit-files --type=service --state=enabled --no-pager

# Servicios fallidos — esto es urgente
systemctl list-units --type=service --state=failed --no-pager

# Procesos con más consumo de CPU
ps aux --sort=-%cpu | head -20
```

Los servicios fallidos son una señal de alerta inmediata. Un servicio que debería estar activo y no lo está puede significar que el servidor lleva tiempo funcionando de forma degradada sin que nadie lo supiera.

---

## 4. Stack de aplicaciones

Esto es lo que más varía entre servidores. El objetivo es identificar rápidamente qué tecnologías hay instaladas.

```bash
# Servidores web
nginx -v 2>/dev/null && systemctl status nginx --no-pager | head -5
httpd -v 2>/dev/null && systemctl status httpd --no-pager | head -5

# Bases de datos
mysql --version 2>/dev/null
psql --version 2>/dev/null
redis-cli --version 2>/dev/null
mongod --version 2>/dev/null

# Lenguajes instalados
php -v 2>/dev/null | head -1
python3 --version 2>/dev/null
node --version 2>/dev/null
java -version 2>/dev/null

# Contenedores
docker ps --format "table {{.Names}}	{{.Image}}	{{.Status}}" 2>/dev/null
podman ps 2>/dev/null

# Kubernetes
kubectl get nodes 2>/dev/null
```

---

## 5. Configuraciones clave

Una vez identificado el stack hay que revisar cómo está configurado.

```bash
# Nginx: virtual hosts activos
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || ls -la /etc/nginx/conf.d/ 2>/dev/null

# Apache: virtual hosts
apache2ctl -S 2>/dev/null || httpd -S 2>/dev/null

# PHP: configuración
php --ini 2>/dev/null | head -10

# MySQL: bases de datos existentes
mysql -e "SHOW DATABASES;" 2>/dev/null

# Redis: info del servidor
redis-cli info server 2>/dev/null | head -15
```

---

## 6. Tareas programadas

Los crons son una fuente habitual de sorpresas. Scripts que nadie sabe que existen, backups que llevan años sin funcionar, tareas que se ejecutan en horarios críticos.

```bash
# Crontab del usuario root
crontab -l 2>/dev/null

# Crons de sistema
cat /etc/crontab
ls /etc/cron.d/ && cat /etc/cron.d/*

# Timers de systemd
systemctl list-timers --all --no-pager
```

---

## 7. Usuarios y seguridad

```bash
# Usuarios con shell interactiva
grep -E "bash|zsh|sh" /etc/passwd | grep -v nologin

# Grupos con privilegios
cat /etc/group | grep -E "sudo|wheel|docker|www-data"

# Configuración SSH
grep -v "^#" /etc/ssh/sshd_config | grep -v "^$"

# Últimos accesos al sistema
last | head -20

# Intentos de acceso fallidos
lastb 2>/dev/null | head -10
```

Lo que buscas: login root habilitado por SSH, autenticación por contraseña en lugar de clave pública, usuarios con privilegios que no deberían tenerlos.

---

## 8. Certificados SSL

```bash
# Certificados Let's Encrypt
certbot certificates 2>/dev/null

# Certificados en el sistema
find /etc/ssl -name "*.crt" -o -name "*.pem" 2>/dev/null | head -20

# Fecha de expiración del certificado web
echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -dates -subject 2>/dev/null
```

Un certificado caducado en producción es un incidente inmediato. Comprueba las fechas siempre.

---

## 9. Logs

```bash
# Errores recientes del sistema
journalctl -p err -n 30 --no-pager

# Logs de aplicación
tail -20 /var/log/nginx/error.log 2>/dev/null
tail -20 /var/log/apache2/error.log 2>/dev/null
tail -20 /var/log/mysql/error.log 2>/dev/null
```

Los logs de error te dicen rapidamente si hay algo que lleva tiempo fallando en silencio.

---

## 10. Paquetes y actualizaciones pendientes

```bash
# RHEL/Rocky/CentOS
rpm -qa --qf "%{NAME}-%{VERSION}\n" | sort | head -50
yum check-update 2>/dev/null | head -30

# Debian/Ubuntu
dpkg -l | grep -E "^ii" | awk '{print $2"\t"$3}' | head -50
apt list --upgradable 2>/dev/null | head -30
```

---

## Conclusión práctica

Con estos comandos tienes un mapa completo del servidor en menos de una hora. El orden importa: primero el sistema, luego la red, luego las aplicaciones, luego la seguridad.

Los puntos críticos que nunca debes saltarte son los puertos en escucha, los servicios fallidos, las fechas de expiración de certificados y los usuarios con shell interactiva.

Si quieres automatizar todo este proceso en un único comando y obtener un informe estructurado listo para documentar o entregar al cliente, tengo disponible un script completo que ejecuta todos estos checks de forma automática y genera un informe con formato. Contáctame a través de GitHub para más información.