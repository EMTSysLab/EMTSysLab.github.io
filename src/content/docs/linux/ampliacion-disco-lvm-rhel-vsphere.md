---
title: Ampliacion de disco LVM en RHEL con vSphere
description: Como ampliar un volumen logico LVM en RHEL tras anadir un disco en VMware vSphere.
sidebar:
  order: 4
---

Una de las tareas mas habituales en administracion de sistemas es quedarse sin espacio en un volumen y necesitar ampliarlo sin poder reiniciar el servidor ni limpiar ficheros.

---

## Estado inicial

Antes de empezar verificamos el estado del sistema:

```bash
df -h
```

```
Filesystem                Size  Used Avail Use%  Mounted on
devtmpfs                  4.0M     0  4.0M   0%  /dev
tmpfs                     7.7G  80K   7.7G   1%  /dev/shm
tmpfs                     3.1G  9.0M  3.1G   1%  /run
/dev/mapper/rhel-root      20G  4.1G   16G  21%  /
/dev/mapper/rhel-var       40G   36G  4.3G  90%  /var
/dev/mapper/rhel-var_log   10G  256M  9.8G   3%  /var/log
/dev/sda2                1014M  397M  618M  40%  /boot
/dev/mapper/rhel-home      10G  104M  9.9G   2%  /home
/dev/sda1                 599M  7.1M  592M   2%  /boot/efi
```

El volumen `/var` esta al **90% de uso**. El sistema tiene un unico disco `sda` de 100GB. El objetivo es anadir un segundo disco de 100GB y ampliar `/var`.

---

## Paso 1 - Anadir el disco en vCenter

1. En vSphere Client, selecciona la VM, **Edit Settings**
2. Haz clic en **Add New Device, Hard Disk**
3. Establece el tamano deseado, en este caso 100GB
4. Selecciona **Thick Provision Lazy Zeroed** o **Thin Provision** segun tu politica
5. Haz clic en **OK** para confirmar

> No es necesario apagar la VM. vSphere permite anadir discos en caliente.

---

## Paso 2 - Hacer visible el disco sin reiniciar

Despues de anadir el disco en vCenter, el kernel de Linux no lo detecta automaticamente. Hay que forzar el rescan del bus SCSI:

```bash
for host in /sys/class/scsi_host/host*/scan; do
    echo "- - -" > $host
done

lsblk
```

Si el disco no aparece, espera unos segundos y vuelve a ejecutar `lsblk`.

---

## Paso 3 - Particionar el nuevo disco

```bash
fdisk /dev/sdb
```

Dentro de fdisk:

```bash
n    # nueva particion
p    # primaria
1    # numero de particion
     # primer sector, valor por defecto
     # ultimo sector, usar todo el disco
w    # escribir cambios y salir
```

Verificar la particion:

```bash
lsblk /dev/sdb
```

---

## Paso 4 - Crear el Physical Volume

> **Importante:** No formatees la particion con `mkfs` antes de este paso. Para LVM la particion debe estar sin formato previo.

```bash
pvcreate /dev/sdb1
pvs
```

---

## Paso 5 - Extender el Volume Group

```bash
vgextend rhel /dev/sdb1
vgs
```

El VG `rhel` ahora tiene 100GB libres disponibles.

---

## Paso 6 - Extender el Logical Volume

```bash
lvextend -L +100G /dev/mapper/rhel-var
```

Para usar todo el espacio libre del VG:

```bash
lvextend -l +100%FREE /dev/mapper/rhel-var
```

---

## Paso 7 - Redimensionar el sistema de ficheros XFS

```bash
xfs_growfs /dev/mapper/rhel-var
```

> Para sistemas de ficheros **ext4** el comando es diferente: `resize2fs /dev/mapper/rhel-var`

---

## Verificacion final

```bash
df -h
```

```
Filesystem                Size  Used Avail Use%  Mounted on
devtmpfs                  4.0M     0  4.0M   0%  /dev
tmpfs                     7.7G  80K   7.7G   1%  /dev/shm
tmpfs                     3.1G  9.0M  3.1G   1%  /run
/dev/mapper/rhel-root      20G  4.1G   16G  21%  /
/dev/mapper/rhel-var      140G   36G  105G  26%  /var
/dev/mapper/rhel-var_log   10G  256M  9.8G   3%  /var/log
/dev/sda2                1014M  397M  618M  40%  /boot
/dev/mapper/rhel-home      10G  104M  9.9G   2%  /home
/dev/sda1                 599M  7.1M  592M   2%  /boot/efi
```

`/var` ha pasado de **40GB al 90%** a **140GB al 26%**. Operacion completada sin reinicio.

---

## Resumen del proceso

```bash
# 1. Rescan SCSI tras anadir disco en vCenter
for host in /sys/class/scsi_host/host*/scan; do echo "- - -" > $host; done

# 2. Particionar
fdisk /dev/sdb

# 3. Crear PV
pvcreate /dev/sdb1

# 4. Extender VG
vgextend rhel /dev/sdb1

# 5. Extender LV
lvextend -L +100G /dev/mapper/rhel-var

# 6. Redimensionar filesystem
xfs_growfs /dev/mapper/rhel-var

# 7. Verificar
df -h
```

---

## Conclusion practica

El proceso completo no requiere reinicio ni perdida de servicio. Los puntos criticos son dos: el rescan del bus SCSI para que el kernel detecte el nuevo disco sin reiniciar, y no formatear la particion con `mkfs` antes de `pvcreate` si el destino es LVM. Todo lo demas es una secuencia lineal que tarda menos de 5 minutos.