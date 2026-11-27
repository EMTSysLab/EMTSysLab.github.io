---
title: Hardening de RHEL en producción
description: Guía de bastionado para Red Hat Enterprise Linux 10, con procedimientos prácticos, controles de seguridad y referencias oficiales.
sidebar:
  order: 1
---

![Hardening RHEL en Producción](/hardening-rhel-banner.png)

El hardening de un sistema Red Hat Enterprise Linux (RHEL) no consiste en ejecutar una lista de comandos una sola vez. Es un proceso continuo de reducción de la superficie de ataque, aplicación de controles de seguridad y verificación de su eficacia.

Esta guía aborda medidas de bastionado para RHEL 10 mediante procedimientos reproducibles, ejemplos independientes y referencias a la documentación oficial. Los ejemplos deben adaptarse a la arquitectura, los servicios y las políticas de cada entorno antes de aplicarse en producción.

> **Alcance:** los procedimientos se contrastan con la documentación de RHEL 10. Las opciones disponibles pueden variar entre versiones menores, paquetes instalados y perfiles de seguridad.

## 1. Configuración inicial del sistema

### 1.1. Planificación del almacenamiento

Una planificación adecuada del almacenamiento es una medida importante dentro del hardening de un sistema RHEL. Separar determinados sistemas de archivos permite controlar mejor el consumo de espacio, limitar el impacto de un llenado de disco y aplicar opciones de montaje específicas según la función de cada directorio.

Antes de instalar el sistema, conviene identificar:

- Tipo de infraestructura: servidor físico, máquina virtual o entorno cloud.
- Capacidad de almacenamiento disponible.
- Aplicaciones y servicios que se ejecutarán.
- Volumen previsto de registros y datos.
- Necesidades de crecimiento.
- Requisitos de disponibilidad y recuperación.

No existe un esquema de particionado universal. La distribución debe adaptarse a las necesidades del sistema y a las políticas de la organización.

### 1.2. Esquema de particionado en RHEL 10

Red Hat contempla particiones estándar, Logical Volume Manager (LVM) y LVM thin provisioning durante la instalación.

Para instalaciones físicas, la documentación de RHEL 10 contempla los siguientes puntos de montaje:

| Punto de montaje | Función |
|---|---|
| /boot | Kernel y archivos necesarios para el arranque |
| / | Sistema de archivos raíz |
| /home | Directorios personales de usuarios |
| swap | Espacio de intercambio |
| /boot/efi | Partición del sistema EFI, cuando corresponda |

También pueden crearse sistemas de archivos independientes para /var, /tmp y /usr, según las necesidades del entorno.

**Referencias de dimensionamiento de Red Hat:**

- **/boot:** al menos 2 GiB como referencia general.
- **/:** al menos 10 GiB.
- **/var:** al menos 5 GiB si se configura como sistema de archivos independiente.

Estos valores son referencias de instalación, no una recomendación universal para cualquier carga de trabajo. Por ejemplo, un servidor con una elevada generación de registros o una aplicación que almacene grandes cantidades de datos necesitará una planificación específica.

La partición /boot debe ser estándar y no puede alojarse en un volumen lógico LVM. En sistemas UEFI también debe contemplarse la partición EFI correspondiente.

**Consideración:** el esquema de particionado recomendado para instalaciones físicas no se aplica automáticamente a instalaciones virtuales o cloud. En estos escenarios debe evaluarse la arquitectura de almacenamiento disponible.

### 1.3. Logical Volume Manager (LVM)

LVM es una tecnología de gestión de almacenamiento que proporciona una capa de abstracción entre los dispositivos físicos y los sistemas de archivos.

En lugar de asignar directamente una partición a cada punto de montaje, LVM permite agrupar dispositivos y crear volúmenes lógicos que pueden ampliarse o reorganizarse según las necesidades del sistema.

Red Hat contempla LVM como una opción de almacenamiento para la mayoría de los puntos de montaje, reservando particiones estándar para elementos como /boot y las particiones de arranque.

**Componentes principales de LVM**

- **PV (Physical Volume):** dispositivo o partición física inicializada para utilizarse con LVM.
- **VG (Volume Group):** grupo de volúmenes que reúne uno o varios PV y proporciona espacio para crear volúmenes lógicos.
- **LV (Logical Volume):** volumen lógico creado dentro de un VG. El sistema operativo lo utiliza como dispositivo de bloques para alojar sistemas de archivos o swap.

La relación entre estos componentes es:

~~~text
Dispositivo físico → PV → VG → LV → Sistema de archivos
~~~

**Ventajas de LVM**

- Permite ampliar volúmenes lógicos cuando existe espacio disponible en el grupo de volúmenes.
- Facilita incorporar nuevos dispositivos físicos a un grupo existente.
- Permite distribuir el almacenamiento entre diferentes volúmenes lógicos.
- Admite configuraciones avanzadas como thin provisioning y snapshots.
- Facilita la administración del almacenamiento en servidores virtualizados.

LVM no sustituye a una estrategia de copias de seguridad ni proporciona por sí solo alta disponibilidad. La pérdida de un dispositivo físico puede afectar a los volúmenes que dependen de él si no existe una arquitectura de redundancia adecuada.

### 1.4. Diseño de un esquema LVM para un servidor

Como ejemplo didáctico, podemos plantear un servidor con un disco virtual dedicado al sistema operativo y un grupo de volúmenes denominado **rhel_vg**.

La distribución podría ser:

| Volumen lógico | Punto de montaje | Sistema de archivos |
|---|---|---|
| lv_root | / | XFS |
| lv_var | /var | XFS |
| lv_log | /var/log | XFS |
| lv_home | /home | XFS |
| lv_tmp | /tmp | XFS |
| lv_swap | swap | Swap |

Los tamaños se definirán según la capacidad del disco, los servicios y el crecimiento esperado.

No es obligatorio separar todos estos directorios. Una separación excesiva puede complicar la administración y generar problemas si un volumen se queda sin espacio mientras otros mantienen capacidad libre.

Una alternativa habitual es mantener una estructura más sencilla y separar únicamente los directorios cuyo consumo o requisitos de seguridad justifican un volumen independiente.

### 1.5. Comprobación del almacenamiento

Antes de realizar modificaciones, es necesario conocer la distribución actual de discos, particiones, sistemas de archivos y volúmenes lógicos.

~~~bash
# Mostrar dispositivos y sistemas de archivos
lsblk --fs

# Consultar el espacio utilizado
df -hT

# Consultar los puntos de montaje
findmnt

# Mostrar volúmenes físicos
pvs

# Mostrar grupos de volúmenes
vgs

# Mostrar volúmenes lógicos
lvs
~~~

Para obtener información más detallada:

~~~bash
pvdisplay
vgdisplay
lvdisplay
~~~

Estos comandos permiten identificar la capacidad total, el espacio libre y las relaciones entre los distintos componentes de LVM.

### 1.6. Creación de volúmenes lógicos

El siguiente ejemplo muestra cómo preparar un disco nuevo y vacío (/dev/sdb) para utilizarlo con LVM.

> **Advertencia:** pvcreate escribe metadatos LVM en el dispositivo seleccionado. Comprueba cuidadosamente su identidad y asegúrate de que no contiene información que debas conservar. No ejecutes estos comandos sobre un disco que forme parte de un sistema existente.

Primero, identifica el dispositivo:

~~~bash
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT
~~~

Inicializa el dispositivo como volumen físico:

~~~bash
pvcreate /dev/sdb
~~~

Crea un grupo de volúmenes:

~~~bash
vgcreate rhel_vg /dev/sdb
~~~

Crea un volumen lógico de ejemplo:

~~~bash
lvcreate -L 10G -n lv_var rhel_vg
~~~

Formatea el volumen con XFS:

~~~bash
mkfs.xfs /dev/rhel_vg/lv_var
~~~

Crea el punto de montaje:

~~~bash
mkdir -p /mnt/var-nuevo
~~~

Para un sistema existente, no montes directamente este volumen sobre un directorio que ya contiene datos. Antes habría que planificar y realizar la migración de su contenido.

Una vez preparado el punto de montaje y realizada la migración correspondiente, puede montarse:

~~~bash
mount /dev/rhel_vg/lv_var /mnt/var-nuevo
~~~

Verifica el resultado:

~~~bash
lsblk --fs
df -hT /mnt/var-nuevo
~~~

La configuración persistente del montaje debe realizarse mediante /etc/fstab, utilizando el UUID del sistema de archivos.

### 1.7. Sistemas de archivos: XFS y ext4

RHEL 10 utiliza XFS como sistema de archivos predeterminado para instalaciones generales.

**XFS**

- Adecuado para sistemas de archivos de gran tamaño.
- Permite ampliar el sistema de archivos mientras está montado.
- No permite reducir su tamaño.

**ext4**

- Compatible con volúmenes lógicos LVM.
- Permite ampliar y reducir sistemas de archivos, siguiendo el procedimiento adecuado.
- Puede ser una alternativa cuando se necesita esa flexibilidad de redimensionamiento.

La elección debe basarse en los requisitos de la aplicación, la operativa y la política de almacenamiento.

En cualquier caso, antes de modificar el tamaño de un sistema de archivos debe existir una copia de seguridad válida y un procedimiento de recuperación.

### 1.8. Ampliación de volúmenes lógicos

Una de las ventajas de LVM es la posibilidad de ampliar un volumen lógico cuando el grupo de volúmenes dispone de espacio libre.

Por ejemplo, para ampliar lv_var en 5 GiB:

~~~bash
# Comprobar el espacio disponible
vgs
lvs

# Ampliar el volumen lógico y el sistema de archivos
lvextend -r -L +5G /dev/rhel_vg/lv_var
~~~

La opción -r solicita que también se redimensione el sistema de archivos.

Si se utiliza XFS, también es posible ampliar el sistema de archivos de forma explícita:

~~~bash
lvextend -L +5G /dev/rhel_vg/lv_var
xfs_growfs /var
~~~

Si el grupo de volúmenes no dispone de espacio libre, será necesario incorporar almacenamiento adicional y ampliar el grupo antes de extender el volumen lógico.

Por ejemplo, después de identificar y preparar un nuevo dispositivo:

~~~bash
pvcreate /dev/sdc
vgextend rhel_vg /dev/sdc
~~~

**Importante:** XFS no permite reducir el sistema de archivos. Una planificación incorrecta del tamaño de los volúmenes puede obligar a realizar una migración completa para recuperar espacio.

### 1.9. Opciones de montaje y hardening

Las opciones de montaje permiten aplicar restricciones adicionales a determinados sistemas de archivos.

| Opción | Función |
|---|---|
| nodev | No interpreta dispositivos especiales en ese sistema de archivos |
| nosuid | Ignora los bits SUID y SGID |
| noexec | Impide la ejecución directa de binarios desde ese sistema de archivos |

Por ejemplo, en un sistema de archivos independiente destinado a archivos temporales:

~~~text
UUID=<UUID_DEL_SISTEMA> /tmp xfs defaults,nodev,nosuid,noexec 0 0
~~~

En /home puede valorarse:

~~~text
UUID=<UUID_DEL_SISTEMA> /home xfs defaults,nodev,nosuid 0 0
~~~

Y para un sistema de archivos dedicado a registros:

~~~text
UUID=<UUID_DEL_SISTEMA> /var/log xfs defaults,nodev,nosuid,noexec 0 0
~~~

Estos ejemplos son orientativos. Antes de aplicar las restricciones hay que comprobar las necesidades de las aplicaciones y los servicios que utilizan esos directorios.

Por ejemplo, noexec puede impedir que determinados instaladores o aplicaciones ejecuten binarios almacenados en directorios temporales.

**Validación de /etc/fstab**

Antes de reiniciar el servidor, comprueba la configuración:

~~~bash
# Obtener UUID de los sistemas de archivos
blkid

# Validar las entradas de fstab
findmnt --verify --verbose
~~~

Después de realizar los cambios, valida cada punto de montaje de forma controlada y comprueba que los servicios siguen funcionando correctamente.

### 1.10. Verificación y mantenimiento

Una configuración de almacenamiento segura necesita supervisión continua.

Conviene revisar periódicamente:

- Espacio disponible en cada sistema de archivos.
- Espacio libre en los grupos de volúmenes.
- Crecimiento de /var y /var/log.
- Estado de los dispositivos físicos.
- Configuración de /etc/fstab.
- Opciones de montaje efectivas.
- Necesidades de ampliación de volúmenes.

Comandos de comprobación:

~~~bash
# Espacio utilizado por sistema de archivos
df -hT

# Espacio libre en grupos de volúmenes
vgs

# Estado de los volúmenes lógicos
lvs

# Árbol de dispositivos y montajes
lsblk --fs

# Opciones de montaje efectivas
findmnt
~~~

El almacenamiento debe diseñarse para facilitar su mantenimiento y crecimiento, pero también para evitar que un único volumen lleno provoque una interrupción general del servicio.

---

> **Estado de revisión:** el apartado 1 ya está adaptado a RHEL 10. Los apartados 2 a 9 y la conclusión se han recuperado de la versión anterior para evitar perder contenido; todavía están pendientes de revisión y actualización específica para RHEL 10. No deben considerarse validados hasta completar esa revisión.

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

---

### Referencias oficiales

- [RHEL 10 — Esquema de particionado recomendado](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html-single/interactively_installing_rhel_from_installation_media/index#recommended-partitioning-scheme): puntos de montaje, dimensionamiento y consideraciones para instalaciones físicas.
- [RHEL 10 — Administración de volúmenes físicos LVM](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/configuring_and_managing_logical_volumes/managing-lvm-physical-volumes): inicialización y administración de PV.
- [RHEL 10 — Administración de grupos de volúmenes](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/configuring_and_managing_logical_volumes/managing-lvm-volume-groups): creación y ampliación de VG.
- [RHEL 10 — Gestión básica de volúmenes lógicos](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/configuring_and_managing_logical_volumes/basic-logical-volume-management): creación, ampliación y reducción de LV.
- [RHEL 10 — Comparación y selección de sistemas de archivos](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/managing_file_systems/overview-of-available-file-systems): características de XFS y ext4.
- [RHEL 10 — Creación de un sistema de archivos XFS](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/managing_file_systems/creating-an-xfs-file-system): uso de `mkfs.xfs`.
- [RHEL 10 — Ampliación de un sistema de archivos XFS](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/managing_file_systems/increasing-the-size-of-an-xfs-file-system): procedimiento con `xfs_growfs`.
- [RHEL 10 — Montaje de sistemas de archivos](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/managing_file_systems/mounting-file-systems): `/etc/fstab`, `findmnt` y opciones de montaje.
