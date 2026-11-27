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

Si el volumen lógico está montado en `/var`, como en el esquema de ejemplo, también es posible ampliar el sistema de archivos de forma explícita. `xfs_growfs` debe recibir el punto de montaje real del sistema de archivos; si se ha montado temporalmente en otra ruta, utiliza esa ruta en lugar de `/var`.

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

## 2. SELinux — control de acceso obligatorio y bastionado del sistema

SELinux (*Security-Enhanced Linux*) es un mecanismo de seguridad integrado en el kernel de Linux que implementa un modelo de control de acceso obligatorio (MAC, *Mandatory Access Control*). Su función es limitar las operaciones que pueden realizar los procesos, usuarios y servicios sobre los recursos del sistema, incluso cuando los permisos tradicionales de Linux permitirían el acceso.

A diferencia del modelo DAC (*Discretionary Access Control*), basado principalmente en propietarios, grupos y permisos Unix, SELinux aplica una política adicional que determina qué interacciones están permitidas entre procesos y objetos.

Por ejemplo, un servidor web puede tener permisos Unix para leer un archivo y, aun así, SELinux puede impedirle acceder a él si el contexto de seguridad del archivo no es adecuado. De esta forma, SELinux ayuda a contener el impacto de errores de configuración y vulnerabilidades en los servicios.

**Recomendación de bastionado:** mantener SELinux habilitado y en modo \`Enforcing\`. No desactivarlo para resolver incidencias. Primero hay que identificar la causa de la denegación y corregir la configuración, las etiquetas o la política de forma justificada.

### 2.1. Arquitectura y conceptos fundamentales

SELinux utiliza contextos de seguridad (*security contexts*) asociados a procesos y objetos, junto con una política que define las operaciones permitidas.

Un contexto SELinux tiene cuatro componentes:

~~~text
usuario:rol:tipo:nivel
~~~

Por ejemplo:

~~~text
system_u:object_r:httpd_sys_content_t:s0
~~~

- **Usuario SELinux:** identifica al usuario dentro del modelo de seguridad de SELinux.
- **Rol:** determina los roles que puede asumir ese usuario.
- **Tipo:** identifica el dominio de un proceso o el tipo de un objeto. Es el componente principal del control de acceso basado en tipos (TE, *Type Enforcement*).
- **Nivel:** representa la clasificación de seguridad, utilizada principalmente en configuraciones MLS/MCS.

En instalaciones estándar de RHEL se utiliza habitualmente la política \`targeted\`, que aplica controles específicos a determinados servicios y procesos.

Algunos tipos habituales son:

| Tipo SELinux | Finalidad |
|---|---|
| \`httpd_t\` | Dominio de ejecución de procesos Apache |
| \`httpd_sys_content_t\` | Contenido web que Apache puede leer |
| \`httpd_sys_rw_content_t\` | Contenido web sobre el que Apache puede escribir |
| \`mysqld_t\` | Dominio del servicio MariaDB |
| \`mysqld_db_t\` | Archivos de datos de MariaDB |
| \`sshd_t\` | Dominio del servicio SSH |
| \`var_log_t\` | Archivos de registro del sistema |

La política determina qué dominios pueden acceder a qué tipos y qué operaciones pueden realizar. Una operación no autorizada se deniega y, cuando la auditoría está disponible, puede generar un evento AVC (*Access Vector Cache*).

SELinux complementa los permisos tradicionales de Linux: una operación debe superar los controles DAC y también los controles MAC. No sustituye a los propietarios, grupos, permisos Unix, firewall ni controles de autenticación.

### 2.2. Estados y modos de funcionamiento

SELinux dispone de tres modos:

| Modo | Comportamiento | Uso recomendado |
|---|---|---|
| \`Enforcing\` | Aplica la política y bloquea los accesos no autorizados. | Producción |
| \`Permissive\` | Registra las denegaciones, pero no las bloquea. | Diagnóstico controlado y desarrollo de políticas |
| \`Disabled\` | SELinux no aplica la política. | No recomendado |

El modo recomendado para los sistemas de producción es \`Enforcing\`.

El modo \`Permissive\` puede utilizarse temporalmente para investigar una incidencia o desarrollar una política. No debe convertirse en una solución permanente ni utilizarse para ocultar errores de etiquetado o configuración.

El modo \`Disabled\` elimina esta capa de protección. Además, habilitar SELinux después de haberlo mantenido desactivado requiere planificar la restauración de las etiquetas de seguridad.

#### Comprobar el estado actual

~~~bash
getenforce
sestatus
~~~

\`getenforce\` muestra el modo actual. \`sestatus\` proporciona información adicional, como el estado de SELinux, la política cargada y el modo configurado para el siguiente arranque.

Ejemplo de información esperada:

~~~text
SELinux status:                 enabled
Loaded policy name:             targeted
Current mode:                   enforcing
Mode from config file:          enforcing
~~~

Es importante comprobar tanto el modo actual como el configurado en el archivo persistente. Pueden ser distintos si se ha utilizado \`setenforce\` durante la sesión.

#### Cambiar temporalmente el modo

Para activar el modo \`Enforcing\`:

~~~bash
setenforce 1
~~~

Para pasar temporalmente a \`Permissive\`:

~~~bash
setenforce 0
~~~

Comprobar el resultado:

~~~bash
getenforce
~~~

Estos cambios no modifican la configuración persistente y dejan de aplicarse al reiniciar si el modo configurado en el sistema es diferente.

En producción, cualquier cambio temporal a \`Permissive\` debe estar autorizado, limitado en el tiempo y acompañado de un plan de diagnóstico y vuelta a \`Enforcing\`.

### 2.3. Configuración persistente de SELinux

La configuración principal se encuentra en:

~~~text
/etc/selinux/config
~~~

Consultar su contenido:

~~~bash
cat /etc/selinux/config
~~~

En una instalación estándar con la política dirigida, la configuración habitual es:

~~~ini
SELINUX=enforcing
SELINUXTYPE=targeted
~~~

Los valores posibles de \`SELINUX\` son:

- \`enforcing\`: aplica la política de seguridad.
- \`permissive\`: registra las denegaciones sin bloquearlas.
- \`disabled\`: deshabilita SELinux.

\`SELINUXTYPE\` identifica la política que se carga. En instalaciones estándar de RHEL se utiliza normalmente \`targeted\`.

Editar el archivo con una herramienta de administración:

~~~bash
vi /etc/selinux/config
~~~

No es recomendable modificarlo mediante sustituciones automáticas sin comprobar previamente su contenido y validar el resultado.

Después de cambiar el modo persistente, reiniciar cuando corresponda y verificar:

~~~bash
reboot
~~~

~~~bash
getenforce
sestatus
~~~

Cambiar de \`Permissive\` a \`Enforcing\` no implica necesariamente que haya que relabelar todo el sistema. Sin embargo, si existen etiquetas incorrectas o SELinux estuvo deshabilitado, debe planificarse la restauración de contextos antes de aplicar la política de forma estricta.

#### Habilitar SELinux en un sistema donde estaba deshabilitado

Este procedimiento requiere especial cuidado. Los archivos creados mientras SELinux estaba deshabilitado pueden no disponer de las etiquetas adecuadas. Activar directamente \`Enforcing\` sin restaurar los contextos puede impedir el funcionamiento correcto de servicios.

Procedimiento general recomendado por Red Hat:

1. Configurar SELinux en modo `Permissive` en `/etc/selinux/config` y mantener `SELINUXTYPE=targeted`, salvo que el entorno requiera otra política.
2. Reiniciar el sistema para que arranque en modo permisivo.
3. Comprobar los eventos AVC y resolver las incidencias de etiquetado o configuración que puedan identificarse.
4. Como root y mientras SELinux sigue en modo permisivo, programar la restauración completa de etiquetas:

~~~bash
fixfiles -F onboot
~~~

Este comando crea `/.autorelabel` y fuerza la restauración de etiquetas durante el siguiente arranque. Red Hat indica que se debe estar en modo permisivo antes de ejecutar `fixfiles -F onboot`.

5. Antes del reinicio de relabel, garantizar que el sistema arranque en modo permisivo. Puede utilizarse temporalmente el parámetro de kernel `enforcing=0` siguiendo el procedimiento de administración del cargador de arranque.
6. Reiniciar y permitir que termine la restauración.
7. Una vez iniciado el sistema, comprobar el estado, revisar los registros y verificar los servicios.
8. Si no quedan incidencias que impidan aplicar la política, configurar `SELINUX=enforcing`, reiniciar cuando corresponda y verificar el modo.

~~~bash
getenforce
sestatus
~~~

No debe utilizarse el parámetro `selinux=0` como método de diagnóstico en producción: desactiva la infraestructura SELinux durante el arranque. Para investigar problemas debe preferirse el modo permisivo.

El relabel puede prolongar el arranque en función del número de archivos y del almacenamiento. Debe realizarse durante una ventana de mantenimiento, con acceso a consola, copia de seguridad y procedimiento de recuperación.

### 2.4. Administración de contextos SELinux

Los contextos de seguridad determinan cómo se clasifican los procesos y los objetos del sistema.

Consultar el contexto de archivos y directorios:

~~~bash
ls -Z /var/www/html/
~~~

Consultar los contextos de los procesos:

~~~bash
ps -eZ
~~~

Consultar el contexto de un archivo concreto:

~~~bash
ls -Z /var/www/html/index.html
~~~

Una causa frecuente de denegaciones es que un archivo o directorio tenga un contexto incorrecto. Puede ocurrir, por ejemplo, al copiar contenido desde un directorio personal hacia una ubicación utilizada por Apache.

#### Restaurar el contexto predeterminado

Para restaurar el contexto esperado por la política:

~~~bash
restorecon -v /var/www/html/index.html
~~~

Para aplicarlo recursivamente:

~~~bash
restorecon -Rv /var/www/html/
~~~

\`restorecon\` consulta las reglas de etiquetado del sistema y aplica el contexto que corresponde a la ruta. Es preferible a cambiar etiquetas manualmente sin conocer las implicaciones.

#### Comprobar el contexto esperado

~~~bash
matchpathcon /var/www/html/index.html
~~~

Para comparar el contexto actual con el esperado:

~~~bash
matchpathcon -V /var/www/html/index.html
~~~

Estas consultas permiten detectar diferencias entre el contexto aplicado y el definido por la política.

#### Definir contextos permanentes para directorios personalizados

Si una aplicación utiliza una ubicación no estándar, puede ser necesario registrar una regla de etiquetado.

Por ejemplo, para contenido web almacenado en \`/srv/myweb/\`:

~~~bash
semanage fcontext -a -t httpd_sys_content_t "/srv/myweb(/.*)?"
restorecon -Rv /srv/myweb/
~~~

Comprobar el resultado:

~~~bash
ls -Zd /srv/myweb/
matchpathcon -V /srv/myweb/
~~~

Las herramientas cumplen funciones distintas:

- \`semanage fcontext\` registra una regla persistente de etiquetado.
- \`restorecon\` aplica al sistema de archivos el contexto definido por las reglas.

Si la regla ya existe, debe modificarse con \`-m\` en lugar de intentar añadirla de nuevo:

~~~bash
semanage fcontext -m -t httpd_sys_content_t "/srv/myweb(/.*)?"
~~~

No se deben asignar tipos genéricos o excesivamente permisivos para evitar denegaciones. Hay que seleccionar el tipo que corresponda a la función del recurso.

Para contenido web de solo lectura puede utilizarse \`httpd_sys_content_t\`. Para directorios en los que Apache necesite escribir, puede corresponder \`httpd_sys_rw_content_t\`, pero debe limitarse a las rutas que realmente requieran escritura.

### 2.5. Gestión de booleanos SELinux

Los booleanos permiten habilitar o deshabilitar determinadas funcionalidades de la política sin desarrollar un módulo personalizado.

Consultar todos los booleanos:

~~~bash
getsebool -a
~~~

Consultar los relacionados con Apache:

~~~bash
getsebool -a | grep httpd
~~~

Consultar sus descripciones y valores:

~~~bash
semanage boolean -l
~~~

#### Modificar un booleano temporalmente

Por ejemplo, para permitir que Apache establezca conexiones de red con bases de datos cuando la arquitectura lo requiera:

~~~bash
setsebool httpd_can_network_connect_db on
~~~

Este cambio modifica el comportamiento en ejecución, pero no se conserva necesariamente después de reiniciar.

#### Modificar un booleano de forma persistente

~~~bash
setsebool -P httpd_can_network_connect_db on
~~~

Comprobar el resultado:

~~~bash
getsebool httpd_can_network_connect_db
~~~

Para deshabilitarlo de forma persistente:

~~~bash
setsebool -P httpd_can_network_connect_db off
~~~

Los booleanos deben habilitarse únicamente cuando exista una necesidad funcional justificada. Antes de activar uno, hay que consultar su descripción y comprender qué operaciones adicionales permite.

### 2.6. Configuración de puertos SELinux

SELinux también controla la asociación entre puertos y tipos. Un servicio puede estar correctamente configurado para escuchar en un puerto y, aun así, SELinux puede impedirle utilizarlo si la asociación no corresponde con su política.

Consultar las asociaciones de puertos:

~~~bash
semanage port -l
~~~

Consultar los puertos asociados al tipo utilizado por HTTP:

~~~bash
semanage port -l | grep http_port_t
~~~

Si Apache necesita utilizar TCP 8080 y el puerto no está asociado a un tipo adecuado, puede registrarse la asociación:

~~~bash
semanage port -a -t http_port_t -p tcp 8080
~~~

Comprobar:

~~~bash
semanage port -l | grep http_port_t
~~~

Si el puerto ya está registrado con otro tipo, no debe añadirse una asociación incompatible. Primero hay que identificar la asignación existente y valorar si corresponde modificarla:

~~~bash
semanage port -m -t http_port_t -p tcp 8080
~~~

No se deben reasignar puertos indiscriminadamente. Un cambio puede afectar a otros servicios que dependan de la asociación original.

La configuración de SELinux no sustituye a \`firewalld\` ni garantiza que el servicio esté escuchando en el puerto. También deben comprobarse el firewall, la configuración de la aplicación y los sockets en escucha.

### 2.7. Diagnóstico de denegaciones SELinux

Cuando una aplicación o servicio no puede realizar una operación, no debe asumirse automáticamente que SELinux es el responsable.

Antes de modificar la política, revisar:

- Permisos tradicionales, propietario y grupo de los archivos.
- Configuración y registros del servicio.
- Existencia y disponibilidad del recurso.
- Contextos SELinux del proceso y del objeto.
- Eventos de auditoría relacionados con la operación.

#### Consultar eventos AVC

El registro de auditoría suele encontrarse en:

~~~text
/var/log/audit/audit.log
~~~

Consultar las denegaciones recientes:

~~~bash
ausearch -m AVC,USER_AVC -ts recent
~~~

Consultar las del día:

~~~bash
ausearch -m AVC,USER_AVC -ts today
~~~

Para ampliar la consulta a otros mensajes de SELinux:

~~~bash
ausearch -m AVC,USER_AVC,SELINUX_ERR,USER_SELINUX_ERR -ts recent
~~~

Si no aparecen eventos, comprobar que el servicio de auditoría está activo:

~~~bash
systemctl status auditd
~~~

Si `auditd` está activo y no se encuentran mensajes, consultar los eventos de `setroubleshoot` en el journal:

~~~bash
journalctl -t setroubleshoot
~~~

Si SELinux está activo pero el demonio de auditoría no se está ejecutando, revisar los mensajes del kernel:

~~~bash
dmesg | grep -i -e type=1300 -e type=1400
~~~

En determinadas situaciones, las reglas `dontaudit` pueden evitar que algunas denegaciones se registren. Solo durante un diagnóstico controlado, se pueden desactivar temporalmente para que se registren más eventos:

~~~bash
semodule -DB
~~~

Reproducir la operación que falla y volver a consultar los registros. Al terminar, restaurar siempre el comportamiento normal de la política:

~~~bash
semodule -B
~~~

Esta operación puede generar un volumen elevado de eventos y no debe dejarse aplicada de forma permanente.

Los eventos pueden proporcionar información sobre:

- El proceso que intentó realizar la operación.
- El recurso al que intentaba acceder.
- La operación denegada.
- El dominio SELinux del proceso.
- El contexto del objeto afectado.
- La clase de objeto implicada.

Ejemplo simplificado:

~~~text
type=AVC
avc: denied { write }
comm="httpd"
path="/srv/myweb/index.html"
scontext=system_u:system_r:httpd_t:s0
tcontext=system_u:object_r:var_t:s0
tclass=file
permissive=0
~~~

En este ejemplo, Apache (\`httpd_t\`) intenta escribir en un archivo etiquetado como \`var_t\`. La solución no tiene por qué ser conceder permiso de escritura: primero hay que determinar si el archivo está mal etiquetado y si Apache debería escribir en él.

#### Analizar los mensajes con sealert

\`sealert\` permite interpretar las denegaciones y proporciona información sobre sus posibles causas y soluciones.

En sistemas donde no esté disponible, comprobar e instalar los paquetes necesarios desde los repositorios configurados:

~~~bash
dnf install policycoreutils-python-utils setroubleshoot-server
~~~

Consultar los informes disponibles:

~~~bash
sealert -l "*"
~~~

Analizar el registro de auditoría:

~~~bash
sealert -a /var/log/audit/audit.log
~~~

El análisis puede incluir el proceso afectado, el recurso, posibles errores de etiquetado, booleanos relacionados y recomendaciones.

Las sugerencias de \`sealert\` deben revisarse antes de aplicarse. No todas son apropiadas para cualquier arquitectura o política local.

### 2.8. Resolución de problemas habituales

La resolución debe comenzar por identificar la causa real de la denegación. En muchos casos, el problema se debe a etiquetas incorrectas, ubicaciones no estándar o permisos que no corresponden con la función de la aplicación.

#### Caso 1. Un servicio no puede acceder a un directorio

Comprobar el contexto:

~~~bash
ls -Zd /ruta/del/directorio
~~~

Compararlo con el esperado:

~~~bash
matchpathcon -V /ruta/del/directorio
~~~

Si corresponde restaurar el contexto predeterminado:

~~~bash
restorecon -Rv /ruta/del/directorio
~~~

Si se trata de una ubicación personalizada, estudiar si necesita una regla persistente mediante \`semanage fcontext\`.

#### Caso 2. Apache no puede acceder a contenido web personalizado

Supongamos que el contenido se encuentra en \`/srv/myweb/\`.

Comprobar el contexto:

~~~bash
ls -Zd /srv/myweb/
~~~

Registrar el tipo adecuado para contenido web de solo lectura:

~~~bash
semanage fcontext -a -t httpd_sys_content_t "/srv/myweb(/.*)?"
restorecon -Rv /srv/myweb/
~~~

Si Apache necesita escribir en determinados directorios, no debe asignarse indiscriminadamente un tipo de escritura a todo el árbol. Conviene separar el contenido estático de las rutas que realmente necesitan escritura y utilizar el tipo correspondiente solo en estas últimas.

#### Caso 3. Una aplicación necesita conectarse a una base de datos

Comprobar si existe un booleano que permita esa operación:

~~~bash
getsebool httpd_can_network_connect_db
~~~

Si la necesidad está justificada:

~~~bash
setsebool -P httpd_can_network_connect_db on
~~~

Después, verificar la conectividad y comprobar que no se han habilitado permisos adicionales innecesarios.

#### Caso 4. Un servicio utiliza un puerto no estándar

Consultar las asociaciones:

~~~bash
semanage port -l
~~~

Si el puerto debe pertenecer al tipo \`http_port_t\`, registrar la asociación de forma controlada:

~~~bash
semanage port -a -t http_port_t -p tcp 8080
~~~

Comprobar también la configuración del servicio y del firewall.

### 2.9. Políticas SELinux personalizadas y audit2allow

En determinados escenarios, una aplicación puede necesitar realizar operaciones que no están contempladas por la política estándar. Cuando se han descartado errores de etiquetado, configuración y booleanos, puede ser necesario desarrollar una política local.

La herramienta \`audit2allow\` permite generar reglas a partir de eventos de auditoría, pero su uso requiere especial cuidado.

**No debe utilizarse como primera solución ante una denegación SELinux.** Generar reglas automáticamente a partir de todos los eventos AVC puede introducir permisos innecesarios o demasiado amplios. También puede incorporar denegaciones provocadas por errores de configuración que deberían corregirse de otra manera.

Antes de plantear una política personalizada:

1. Identificar el proceso y el recurso afectados.
2. Revisar los contextos del proceso y del objeto.
3. Comprobar las reglas de etiquetado.
4. Revisar los booleanos disponibles.
5. Verificar la configuración de puertos, directorios y servicios.
6. Confirmar que la operación solicitada es legítima y necesaria.
7. Analizar únicamente los eventos relacionados con la aplicación.
8. Revisar las reglas propuestas antes de incorporarlas al sistema.

Consultar la ayuda:

~~~bash
audit2allow --help
~~~

Como ejemplo de generación de un módulo a partir de eventos previamente seleccionados y revisados:

~~~bash
ausearch -m AVC -ts recent --raw > /root/selinux-avc-revisados.log
audit2allow -M local_aplicacion -i /root/selinux-avc-revisados.log
~~~

Este ejemplo no debe ejecutarse indiscriminadamente sobre todos los eventos recientes. El archivo de entrada debe contener únicamente denegaciones pertinentes y previamente analizadas. A continuación, revisar el archivo \`.te\` generado antes de instalar el módulo.

La instalación de un módulo aprobado se realiza con:

~~~bash
semodule -i local_aplicacion.pp
~~~

Para consultar los módulos instalados:

~~~bash
semodule -lfull
~~~

Si un módulo local deja de ser necesario, debe retirarse de forma controlada:

~~~bash
semodule -r local_aplicacion
~~~

Los módulos locales deben documentarse, versionarse y revisarse cuando se actualice la política del sistema o la aplicación. La política debe seguir el principio de mínimo privilegio y conceder únicamente las operaciones imprescindibles al dominio correspondiente.

### 2.10. Usuarios y roles SELinux

SELinux dispone de un modelo de usuarios y roles que permite restringir las capacidades de determinados usuarios del sistema.

En instalaciones estándar, muchos usuarios Linux se asignan al usuario SELinux \`unconfined_u\`. Esto no significa que estén exentos de todos los controles de seguridad del sistema.

Consultar las asignaciones:

~~~bash
semanage login -l
~~~

Consultar los usuarios SELinux disponibles:

~~~bash
semanage user -l
~~~

Consultar el contexto de la sesión actual:

~~~bash
id -Z
~~~

En entornos con requisitos de seguridad elevados puede estudiarse el uso de usuarios confinados y roles administrativos específicos. La implantación requiere planificación y pruebas, ya que puede afectar a sesiones SSH, sudo, herramientas administrativas y procesos automatizados.

No se recomienda modificar las asignaciones de usuarios de forma generalizada sin validar antes el impacto operativo.

### 2.11. SELinux en entornos de contenedores

SELinux proporciona una capa adicional de aislamiento para los contenedores. En plataformas como Podman, los procesos y recursos pueden disponer de etiquetas específicas que limitan su interacción con el sistema anfitrión y con otros contenedores.

No debe desactivarse SELinux para resolver problemas de acceso a volúmenes o directorios. Primero hay que revisar las etiquetas y las opciones de montaje.

En Podman, las opciones de volumen \`:Z\` y \`:z\` permiten ajustar el etiquetado SELinux:

~~~bash
podman run -v /datos/aplicacion:/datos:Z imagen
~~~

- \`:Z\` aplica una etiqueta privada para el uso del volumen por un contenedor.
- \`:z\` aplica una etiqueta compartida cuando el contenido debe ser utilizado por varios contenedores.

Estas opciones pueden modificar el etiquetado del contenido del host. Deben utilizarse únicamente en directorios destinados a ese uso y nunca indiscriminadamente sobre directorios del sistema o ubicaciones compartidas con servicios ajenos a los contenedores.

### 2.12. Verificación y auditoría de SELinux

Después de aplicar cambios, comprobar que el sistema continúa funcionando y que las protecciones permanecen activas.

~~~bash
# Estado y modo de SELinux
getenforce
sestatus

# Denegaciones recientes
ausearch -m AVC,USER_AVC -ts recent

# Booleanos disponibles y sus valores
semanage boolean -l

# Reglas locales de contextos
semanage fcontext -l -C

# Asociaciones locales de puertos
semanage port -l -C

# Módulos de política instalados
semodule -lfull
~~~

En servidores de producción conviene mantener un registro de:

- Cambios de modo SELinux.
- Booleanos habilitados o deshabilitados.
- Contextos personalizados.
- Asociaciones de puertos.
- Módulos de políticas locales.
- Incidencias AVC relevantes y su resolución.

Los cambios deben estar justificados, documentados y sujetos a revisión periódica.

### 2.13. Lista de comprobación de bastionado

Antes de considerar validada la configuración de SELinux:

- [ ] SELinux está habilitado.
- [ ] El modo actual es \`Enforcing\`.
- [ ] El modo persistente está configurado como \`enforcing\`.
- [ ] La política utilizada es la esperada, normalmente \`targeted\`.
- [ ] No existen errores de etiquetado conocidos.
- [ ] Los directorios personalizados tienen contextos adecuados.
- [ ] Los booleanos habilitados responden a necesidades justificadas.
- [ ] Los puertos personalizados tienen asociaciones SELinux correctas.
- [ ] Las denegaciones AVC relevantes han sido investigadas.
- [ ] No se han generado políticas locales indiscriminadamente.
- [ ] Los módulos personalizados están documentados.
- [ ] Los cambios han sido probados y verificados.

### Conclusión

SELinux es una de las capas fundamentales de seguridad de Red Hat Enterprise Linux. Su correcta configuración permite limitar las interacciones entre procesos, usuarios y recursos, reduciendo el impacto de posibles vulnerabilidades o compromisos de servicios.

Un sistema correctamente bastionado no se limita a mantener SELinux habilitado: también debe disponer de contextos adecuados, políticas coherentes, booleanos controlados y mecanismos de auditoría que permitan identificar y resolver las denegaciones.

La regla fundamental es **corregir la causa de una denegación, no eliminar la protección que la provoca**.

En producción, SELinux debe permanecer en modo \`Enforcing\`, y cualquier modificación de su política debe responder a una necesidad técnica justificada y seguir el principio de mínimo privilegio.
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

#### SELinux

- [RHEL 10 — Uso de SELinux](https://docs.redhat.com/es/documentation/red_hat_enterprise_linux/10/html/using_selinux/index): documentación general de arquitectura, configuración, administración y políticas. Aunque la ruta utiliza el prefijo `/es/`, Red Hat muestra el contenido de esta página en inglés.
- [RHEL 10 — Resolución de problemas relacionados con SELinux](https://docs.redhat.com/es/documentation/red_hat_enterprise_linux/10/html/using_selinux/troubleshooting-problems-related-to-selinux): diagnóstico de denegaciones, análisis de AVC y resolución de incidencias. Esta página también se muestra en inglés.

#### Instalación y particionado

- [RHEL 10 — Instalación interactiva y planificación del almacenamiento](https://docs.redhat.com/es/documentation/red_hat_enterprise_linux/10/pdf/interactively_installing_rhel_from_installation_media/index) (español): puntos de montaje, dimensionamiento y consideraciones para instalaciones físicas.

#### LVM

Las siguientes páginas pertenecen a la documentación oficial de RHEL 10. Red Hat sirve estos contenidos en inglés, aunque se acceda mediante la ruta localizada /es/.

- [RHEL 10 — Administración de volúmenes físicos LVM](https://docs.redhat.com/es/documentation/red_hat_enterprise_linux/10/html/configuring_and_managing_logical_volumes/managing-lvm-physical-volumes) (inglés).
- [RHEL 10 — Administración de grupos de volúmenes LVM](https://docs.redhat.com/es/documentation/red_hat_enterprise_linux/10/html/configuring_and_managing_logical_volumes/managing-lvm-volume-groups) (inglés).
- [RHEL 10 — Gestión básica de volúmenes lógicos](https://docs.redhat.com/es/documentation/red_hat_enterprise_linux/10/html/configuring_and_managing_logical_volumes/basic-logical-volume-management) (inglés).

#### Sistemas de archivos y montaje

- [RHEL 10 — Creación de un sistema de archivos XFS](https://docs.redhat.com/es/documentation/red_hat_enterprise_linux/10/html/managing_file_systems/creating-an-xfs-file-system) (inglés).
- [RHEL 10 — Ampliación de un sistema de archivos XFS](https://docs.redhat.com/es/documentation/red_hat_enterprise_linux/10/html/managing_file_systems/increasing-the-size-of-an-xfs-file-system) (inglés).
- [RHEL 10 — Montaje persistente de sistemas de archivos](https://docs.redhat.com/es/documentation/red_hat_enterprise_linux/10/html/managing_file_systems/persistently-mounting-file-systems) (inglés).
