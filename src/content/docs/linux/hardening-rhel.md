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

### Referencias oficiales

- [Red Hat Enterprise Linux 10 — Instalación y esquema de particionado](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/interactively_installing_rhel_from_installation_media/).
- [Red Hat Enterprise Linux 10 — Configuración y administración de volúmenes lógicos](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/configuring_and_managing_logical_volumes/).
- [Red Hat Enterprise Linux 10 — Administración de volúmenes físicos](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/configuring_and_managing_logical_volumes/managing-lvm-physical-volumes).
- [Red Hat Enterprise Linux 10 — Administración de grupos de volúmenes](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/configuring_and_managing_logical_volumes/managing-lvm-volume-groups).
