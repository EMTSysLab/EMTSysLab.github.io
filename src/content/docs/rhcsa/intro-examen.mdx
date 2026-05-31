---
title: "RHCSA: todo lo que debes saber antes de empezar"
description: "Qué es el examen EX200, qué cubre en RHEL 10, cómo se diferencia del RHCE y por qué sigue siendo una de las certificaciones más respetadas en Linux."
sidebar:
  label: "Qué es el RHCSA"
  order: 1
---

![Road to RHCSA — Qué es el EX200](/rhcsa-1-que-es-rhcsa.png)


import { Aside, Badge, Card, CardGrid } from '@astrojs/starlight/components';

<Aside type="note" title="Serie RHCSA sobre RHEL 10">
Esta guía forma parte de la serie de formación RHCSA de EMTSysLab. Todo el contenido está actualizado para **RHEL 10** y el examen **EX200** vigente.
</Aside>

## Por qué el RHCSA sigue importando

Hay cientos de certificaciones de Linux. La mayoría son tests de tipo test: memorizas definiciones, marcas respuestas y obtienes un PDF. El RHCSA no funciona así.

El examen **EX200** de Red Hat es completamente práctico. No hay preguntas de opción múltiple. Te sientas delante de una o dos máquinas virtuales con RHEL y tienes que resolver una lista de tareas en tiempo real. El sistema las evalúa automáticamente al finalizar. O funciona o no funciona.

Eso hace que la certificación sea difícil de inflar. Un candidato que aprueba el EX200 sabe administrar Linux.

---

## Qué es exactamente el EX200

El **EX200** es el examen que otorga la certificación **RHCSA** (*Red Hat Certified System Administrator*). Es el nivel de entrada en el programa de certificación de Red Hat y el prerequisito para certificaciones superiores como el RHCE.

<CardGrid>
  <Card title="Duración" icon="clock">
    3 horas (180 minutos) de examen completamente práctico, sin preguntas teóricas.
  </Card>
  <Card title="Formato" icon="laptop">
    Entorno real: dos VMs con RHEL. Resuelves tareas en la terminal. El sistema las puntúa automáticamente al enviar.
  </Card>
  <Card title="Nota de corte" icon="approve-check">
    210 sobre 300 puntos para aprobar. Aproximadamente un 70 % de las tareas correctas.
  </Card>
  <Card title="Validez" icon="star">
    3 años. Renovable con un examen de recertificación o aprobando una certificación superior.
  </Card>
</CardGrid>

<Aside type="tip" title="Sin apuntes, sin internet">
El examen se realiza en un entorno aislado. No hay acceso a internet ni a tus propios apuntes. Sí tienes acceso a las páginas `man` y a `--help`. Eso es todo. Aprende a navegar la documentación del sistema.
</Aside>

---

## Qué cubre el EX200 en RHEL 10

Red Hat actualiza los objetivos del examen con cada versión mayor de RHEL. Para RHEL 10, los bloques principales son:

### Fundamentos del sistema

- Comprensión del entorno de arranque: GRUB2 y systemd
- Uso fluido de la línea de comandos: navegación, redirección, tuberías, expresiones regulares
- Localización de archivos y uso de `find`, `grep` y herramientas asociadas
- Documentación del sistema: `man`, `info`, `/usr/share/doc`

### Gestión de usuarios y grupos

- Creación y modificación de cuentas de usuario y grupo
- Control de contraseñas y políticas de envejecimiento
- Configuración de acceso con `sudo`

### Permisos y seguridad de archivos

- Permisos estándar UGO y bits especiales (setuid, setgid, sticky bit)
- Listas de control de acceso (ACL) con `getfacl` y `setfacl`
- Atributos de archivo extendidos

### Almacenamiento

- Creación y gestión de particiones MBR y GPT con `fdisk` y `parted`
- Volúmenes lógicos con LVM: physical volumes, volume groups, logical volumes
- Sistemas de ficheros XFS y ext4: creación, montaje, opciones en `/etc/fstab`
- **Stratis**: gestión avanzada de almacenamiento, nueva en RHEL 8+ y consolidada en RHEL 10
- Espacio de intercambio (swap)

### Gestión de paquetes

- DNF5 (sustituto de yum en RHEL 10): instalación, actualización, eliminación
- Repositorios: configuración, habilitación y prioridades
- Módulos de aplicación (*AppStream*)

### Servicios y systemd

- Gestión de unidades systemd: iniciar, detener, habilitar, deshabilitar
- Configuración de *targets* y modo de recuperación
- Programación de tareas con `cron`, `at` y *systemd timers*

### Red

- Configuración de interfaces con NetworkManager y `nmcli`
- Resolución de nombres y fichero `/etc/hosts`
- Gestión básica del cortafuegos con `firewalld`

### SELinux

- Modos de operación: Enforcing, Permissive, Disabled
- Gestión de contextos y booleanos
- Análisis de logs con `ausearch` y `sealert`
- Restauración de contextos con `restorecon`

### Contenedores con Podman

<Badge text="Nuevo en RHEL 10" variant="tip" />

- Gestión de imágenes y contenedores con `podman`
- Ejecución de contenedores como servicios de systemd
- Volúmenes y redes básicas en contenedores

---

## RHCSA vs RHCE: cuál necesitas

| | RHCSA (EX200) | RHCE (EX294) |
|---|---|---|
| Nivel | Entrada | Intermedio-avanzado |
| Prerequisito | Ninguno | RHCSA |
| Tecnología central | Administración RHEL | Ansible |
| Tipo de examen | Práctico, terminal | Práctico, playbooks |
| Público objetivo | SysAdmins, DevOps junior | SysAdmins senior, DevOps |

Si empiezas desde cero o llevas pocos años en el sector, el RHCSA es el objetivo correcto. El RHCE añade Ansible y automatización a gran escala: tiene sentido una vez que tienes sólida la base de administración del sistema.

---

## RHEL 10 vs versiones anteriores: lo que cambia

Si vienes de versiones anteriores de RHEL, hay diferencias que debes conocer:

### DNF5 en lugar de yum

RHEL 10 viene con **DNF5**, una reescritura completa del gestor de paquetes. La sintaxis es compatible con los comandos `dnf` anteriores, pero hay cambios internos relevantes. `yum` ya no existe como binario independiente.

### Podman en el examen

Los contenedores con Podman forman parte del EX200 desde RHEL 9. En RHEL 10 es un objetivo consolidado. Si solo conoces Docker, dedica tiempo a entender el modelo sin demonio (*daemonless*) de Podman y cómo integrar contenedores con systemd usando `podman generate systemd` o Quadlet.

### Stratis como opción de almacenamiento

Stratis es el gestor de almacenamiento avanzado de Red Hat. Simplifica la creación de pools y sistemas de ficheros con funciones como instantáneas y gestión dinámica del espacio. Está en el temario del EX200.

### NetworkManager exclusivo

`ifconfig` y los scripts de red heredados de RHEL 6/7 no existen. Todo pasa por NetworkManager. Aprende `nmcli` a fondo: es la herramienta que usarás en el examen.

---

## Cómo funciona la evaluación

Al finalizar el examen, el sistema evalúa automáticamente el estado de las máquinas virtuales. No hay corrector humano revisando tus pasos: solo importa si el resultado es correcto.

Esto tiene implicaciones prácticas importantes:

**Los atajos que "casi funcionan" no puntúan.** Un servicio configurado pero no habilitado, un usuario creado sin las propiedades correctas, un sistema de ficheros montado en el lugar equivocado: todo eso es cero puntos aunque hayas hecho el 90 % del trabajo.

**El orden importa.** Algunas tareas dependen de otras. Si no completas una tarea base, las que dependen de ella tampoco funcionarán aunque las hagas correctamente.

**El tiempo es el recurso más escaso.** 3 horas para entre 15 y 20 tareas. No es un tiempo generoso si no tienes los comandos automatizados en la memoria muscular.

---

## Qué esperar de esta serie

En EMTSysLab voy a cubrir todos los objetivos del EX200 con artículos prácticos orientados a producción real, no a aprobar el examen memorizando. Cada artículo explica el concepto, muestra los comandos con contexto y señala los puntos donde el examen suele evaluar.

El enfoque es directo: lo que necesitas saber, cómo aplicarlo, y qué errores cometes cuando no lo tienes claro.

<CardGrid>
  <Card title="Siguiente: laboratorio" icon="laptop">
    Cómo montar un entorno de laboratorio con KVM y RHEL 10 sin suscripción de pago.
  </Card>
  <Card title="Índice completo" icon="list-format">
    Todos los artículos de la serie RHCSA disponibles en el sidebar izquierdo.
  </Card>
</CardGrid>

---

## Recursos oficiales

- [Objetivos del examen EX200](https://www.redhat.com/en/services/training/ex200-red-hat-certified-system-administrator-rhcsa-exam) — Red Hat (en inglés)
- [Documentación de RHEL 10](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10) — Red Hat
- [CentOS Stream 10](https://www.centos.org/centos-stream/) — alternativa gratuita para practicar