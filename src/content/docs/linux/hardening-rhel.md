---
title: Hardening de RHEL en producción
description: Guía completa de bastionado para sistemas Red Hat Enterprise Linux en entornos de producción real.
sidebar:
  order: 1
---

![Hardening RHEL en Producción](/hardening-rhel-banner.png)

El hardening de un sistema RHEL no es una lista de comandos a ejecutar una vez. Es una filosofía de defensa en profundidad que debes aplicar desde el primer boot y mantener de forma continua.

Esta guía cubre las medidas más críticas que aplico en sistemas de producción real.

## 1. Configuración inicial del sistema

### Particionado seguro

Separar los sistemas de ficheros críticos limita el impacto de ataques de denegación de servicio por llenado de disco y dificulta la escalada de privilegios.

```bash
# Verificar el esquema de particiones actual
lsblk -o NAME,SIZE,MOUNTPOINT,FSTYPE

# Particiones mínimas recomendadas en producción
# /boot       — 1 GB
# /           — 20 GB mínimo
# /home       — separado (noexec, nosuid)
# /var        — separado (evita llenado del sistema)
# /var/log    — separado (auditoría aislada)
# /tmp        — separado (noexec, nosuid, nodev)
# swap        — igual que RAM o desactivado en K8s
```

Aplica opciones de montaje restrictivas en `/etc/fstab`:

```bash
# /tmp con restricciones
UUID=xxxx /tmp xfs defaults,nodev,nosuid,noexec 0 0

# /home con restricciones
UUID=xxxx /home xfs defaults,nodev,nosuid 0 0

# /var/log separado
UUID=xxxx /var/log xfs defaults,nodev,nosuid,noexec 0 0
```

### Actualización inmediata post-instalación

```bash
dnf update -y
dnf install -y dnf-automatic

# Configurar actualizaciones de seguridad automáticas
systemctl enable --now dnf-automatic-install.timer
```

---

## 2. SELinux — nunca lo desactives

SELinux es la línea de defensa más potente de RHEL. Desactivarlo es el error más común y más grave.

```bash
# Verificar estado
getenforce
sestatus

# Debe estar en Enforcing siempre
# Si está en Permissive, actívalo
setenforce 1

# Hacerlo permanente
sed -i 's/^SELINUX=.*/SELINUX=enforcing/' /etc/selinux/config
```

Cuando una aplicación falla por SELinux, la solución no es desactivarlo:

```bash
# Ver qué está bloqueando SELinux
ausearch -m avc -ts recent
sealert -a /var/log/audit/audit.log

# Generar política personalizada para la aplicación
audit2allow -a -M mi_aplicacion
semodule -i mi_aplicacion.pp
```

---

## 3. Firewall con firewalld

```bash
# Verificar estado
systemctl status firewalld
firewall-cmd --state

# Ver zona activa y reglas
firewall-cmd --get-active-zones
firewall-cmd --list-all

# Ejemplo: servidor web con SSH restringido
firewall-cmd --permanent --remove-service=ssh
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.0.0/8" service name="ssh" accept'
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

---

## 4. SSH hardening

El fichero `/etc/ssh/sshd_config` es crítico. Aplica estas directivas:

```bash
# Deshabilitar autenticación por contraseña
PasswordAuthentication no
PubkeyAuthentication yes

# Deshabilitar login de root
PermitRootLogin no

# Limitar usuarios con acceso SSH
AllowUsers tuusuario
AllowGroups sysadmins

# Protocolo y cifrados seguros
Protocol 2
KexAlgorithms curve25519-sha256,diffie-hellman-group16-sha512
Ciphers aes256-gcm@openssh.com,chacha20-poly1305@openssh.com
MACs hmac-sha2-512-etm@openssh.com

# Timeouts
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 30

# Deshabilitar características innecesarias
X11Forwarding no
AllowTcpForwarding no
MaxAuthTries 3
MaxSessions 4
```

```bash
# Verificar configuración antes de reiniciar
sshd -t

# Reiniciar servicio
systemctl restart sshd
```

---

## 5. PAM y política de contraseñas

```bash
# Instalar herramientas de calidad de contraseñas
dnf install -y libpwquality

# Configurar en /etc/security/pwquality.conf
cat >> /etc/security/pwquality.conf << 'PWEOF'
minlen = 14
minclass = 4
maxrepeat = 2
maxsequence = 3
gecoscheck = 1
PWEOF

# Política de envejecimiento en /etc/login.defs
sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS   90/' /etc/login.defs
sed -i 's/^PASS_MIN_DAYS.*/PASS_MIN_DAYS   7/' /etc/login.defs
sed -i 's/^PASS_WARN_AGE.*/PASS_WARN_AGE   14/' /etc/login.defs
```

---

## 6. Auditoría con auditd

```bash
systemctl enable --now auditd

# Reglas críticas de auditoría en /etc/audit/rules.d/hardening.rules
cat > /etc/audit/rules.d/hardening.rules << 'AUDITEOF'
# Cambios en ficheros de autenticación
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/sudoers -p wa -k sudoers

# Llamadas de sistema privilegiadas
-a always,exit -F arch=b64 -S execve -F euid=0 -k root_commands

# Acceso a ficheros sensibles
-w /etc/ssh/sshd_config -p wa -k sshd_config
-w /var/log/lastlog -p wa -k logins

# Cambios en el sistema de ficheros
-a always,exit -F arch=b64 -S chmod,chown,fchmod,fchown -k perm_mod
AUDITEOF

# Aplicar reglas
augenrules --load
```

---

## 7. Eliminación de servicios innecesarios

```bash
# Ver todos los servicios activos
systemctl list-units --type=service --state=running

# Servicios típicos a desactivar en servidores de producción
for svc in bluetooth cups avahi-daemon rpcbind nfs-server; do
    systemctl disable --now $svc 2>/dev/null && echo "Desactivado: $svc"
done

# Ver puertos en escucha
ss -tlnp
```

---

## 8. AIDE — detección de intrusos por integridad

```bash
dnf install -y aide

# Inicializar base de datos (tras el hardening, no antes)
aide --init
mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz

# Verificación periódica con cron
echo "0 3 * * * root /usr/sbin/aide --check | mail -s 'AIDE Report' admin@tudominio.com" \
  > /etc/cron.d/aide-check
```

---

## 9. Verificación con OpenSCAP

RHEL incluye perfiles SCAP oficiales alineados con CIS y STIG:

```bash
dnf install -y openscap-scanner scap-security-guide

# Listar perfiles disponibles
oscap info /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml | grep "Profile ID"

# Escanear contra perfil CIS Level 2
oscap xccdf eval \
  --profile xccdf_org.ssgproject.content_profile_cis_server_l2 \
  --results /tmp/scan-results.xml \
  --report /tmp/scan-report.html \
  /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml

# Ver el informe
firefox /tmp/scan-report.html
```

---

## Conclusión práctica

El hardening no termina nunca. Estos son los puntos de control que reviso regularmente:

- SELinux en `Enforcing` — verificación semanal
- `dnf-automatic` instalando parches de seguridad — verificación mensual
- Revisión de logs de auditd — diaria (automatizada con alertas)
- Escaneo OpenSCAP — trimestral o tras cambios mayores
- Rotación de claves SSH — anual

Un sistema bien bastionado es aquel cuyo estado puedes verificar en menos de 5 minutos. Si no puedes hacerlo, necesitas más automatización.
