---
title: OpenShift 4.19 UPI en vSphere 8 — instalación completa en producción
description: Guía completa de instalación de Red Hat OpenShift 4.19 con infraestructura provisionada por el usuario (UPI) sobre vSphere 8.x. Entorno de producción con 3 masters, 3 workers y 3 nodos infra. DNS en Windows Server, balanceo con NetScaler e IPs estáticas.
sidebar:
  order: 1
---

Esta guía documenta la instalación completa de OpenShift Container Platform 4.19 usando el método **User-Provisioned Infrastructure (UPI)** sobre VMware vSphere 8.x con conexión a internet.

El entorno objetivo es un clúster de producción con:
- 1 nodo bootstrap (temporal, solo durante la instalación)
- 3 nodos master (control plane)
- 3 nodos worker
- 3 nodos de infraestructura (infra)
- Balanceo de carga con NetScaler (Citrix ADC)
- DNS en Windows Server
- IPs estáticas en todos los nodos

---

## Arquitectura del clúster
             ┌──────────────────────────┐
             │       NetScaler ADC       │
             │  API VIP :6443 / :22623   │
             │  Ingress VIP :80 / :443   │
             └────────────┬─────────────┘
                          │
     ┌────────────────────┼────────────────────┐
     │                    │                    │
┌─────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐
│ master-01 │       │ master-02 │       │ master-03 │
│ 4vCPU/16G │       │ 4vCPU/16G │       │ 4vCPU/16G │
└───────────┘       └───────────┘       └───────────┘
┌───────────┐       ┌───────────┐       ┌───────────┐
│ worker-01 │       │ worker-02 │       │ worker-03 │
│ 4vCPU/16G │       │ 4vCPU/16G │       │ 4vCPU/16G │
└───────────┘       └───────────┘       └───────────┘
┌───────────┐       ┌───────────┐       ┌───────────┐
│  infra-01 │       │  infra-02 │       │  infra-03 │
│ 4vCPU/16G │       │ 4vCPU/16G │       │ 4vCPU/16G │
└───────────┘       └───────────┘       └───────────┘

---

## Prerrequisitos

### Requisitos de hardware por nodo

| Nodo | vCPU | RAM | Disco OS |
|---|---|---|---|
| Bootstrap (temporal) | 4 | 16 GB | 120 GB |
| Master x3 | 4 | 16 GB | 120 GB |
| Worker x3 | 4 | 16 GB | 120 GB |
| Infra x3 | 4 | 16 GB | 120 GB |
| Bastion | 4 | 8 GB | 100 GB |

> El nodo bootstrap se elimina al finalizar la instalación. No forma parte del clúster en producción.

### Requisitos de software y plataforma

- VMware vCenter 8.x con permisos de administrador
- VMware ESXi 8.x en los hosts
- RHEL 9.x o Rocky Linux 9.x para el nodo bastion
- Acceso a internet desde el bastion
- Cuenta activa en `console.redhat.com` con suscripción OpenShift o cuenta developer gratuita

### Permisos mínimos en vCenter

La cuenta de vCenter usada en el `install-config.yaml` necesita al menos:

- Datastore: `Allocate space`, `Browse datastore`
- Folder: `Create folder`, `Delete folder`
- Network: `Assign network`
- Resource: `Assign virtual machine to resource pool`
- Virtual Machine: permisos de creación, configuración y operación
- vSphere Tagging: `Assign or Unassign vSphere Tag`

### Puertos requeridos en firewall

| Origen | Destino | Puerto | Protocolo | Uso |
|---|---|---|---|---|
| Todos los nodos | API VIP | 6443 | TCP | Kubernetes API |
| Masters | Masters | 2379-2380 | TCP | etcd |
| Todos los nodos | Masters | 22623 | TCP | Machine Config Server |
| Todos los nodos | DNS | 53 | UDP/TCP | Resolución DNS |
| Bastion | Internet | 443 | TCP | Descarga imágenes y binarios |
| NetScaler | Masters + Bootstrap | 6443 | TCP | API load balancing |
| NetScaler | Masters + Bootstrap | 22623 | TCP | MCS load balancing |
| NetScaler | Nodos Infra | 80 / 443 | TCP | Ingress |

---

## Paso 1 — Planificación de IPs y nombres

Define antes de empezar el esquema de direccionamiento completo. Ejemplo con subred `10.0.1.0/24`:

| Nodo | Hostname | IP |
|---|---|---|
| NetScaler API VIP | api.ocp.empresa.local | 10.0.1.10 |
| NetScaler Ingress VIP | *.apps.ocp.empresa.local | 10.0.1.11 |
| Bootstrap | bootstrap.ocp.empresa.local | 10.0.1.20 |
| Master 01 | master-01.ocp.empresa.local | 10.0.1.21 |
| Master 02 | master-02.ocp.empresa.local | 10.0.1.22 |
| Master 03 | master-03.ocp.empresa.local | 10.0.1.23 |
| Worker 01 | worker-01.ocp.empresa.local | 10.0.1.31 |
| Worker 02 | worker-02.ocp.empresa.local | 10.0.1.32 |
| Worker 03 | worker-03.ocp.empresa.local | 10.0.1.33 |
| Infra 01 | infra-01.ocp.empresa.local | 10.0.1.41 |
| Infra 02 | infra-02.ocp.empresa.local | 10.0.1.42 |
| Infra 03 | infra-03.ocp.empresa.local | 10.0.1.43 |
| Bastion | bastion.ocp.empresa.local | 10.0.1.5 |

---

## Paso 2 — Configurar DNS en Windows Server

OpenShift UPI requiere registros DNS correctos **antes** de iniciar la instalación. Es el paso más crítico — la mayoría de instalaciones fallidas se deben a DNS incorrecto.

### Registros A obligatorios

En el DNS Manager de Windows Server, crea los siguientes registros en tu zona `empresa.local`:
; VIPs del NetScaler
api.ocp              A  10.0.1.10
api-int.ocp          A  10.0.1.10
*.apps.ocp           A  10.0.1.11
; Bootstrap
bootstrap.ocp        A  10.0.1.20
; Masters
master-01.ocp        A  10.0.1.21
master-02.ocp        A  10.0.1.22
master-03.ocp        A  10.0.1.23
; Workers
worker-01.ocp        A  10.0.1.31
worker-02.ocp        A  10.0.1.32
worker-03.ocp        A  10.0.1.33
; Infra
infra-01.ocp         A  10.0.1.41
infra-02.ocp         A  10.0.1.42
infra-03.ocp         A  10.0.1.43

> El registro wildcard `*.apps.ocp` en Windows Server DNS se crea como un registro A con el nombre literal `*` dentro de la subzona `apps.ocp`.

### Registros SRV para etcd (obligatorios)

OpenShift requiere registros SRV para el descubrimiento de etcd entre masters. En Windows Server DNS, añade en la zona `ocp.empresa.local`:
_etcd-server-ssl._tcp   SRV  0 10 2380  master-01.ocp.empresa.local.
_etcd-server-ssl._tcp   SRV  0 10 2380  master-02.ocp.empresa.local.
_etcd-server-ssl._tcp   SRV  0 10 2380  master-03.ocp.empresa.local.

### Registros PTR (reverse DNS)

Crea una zona de búsqueda inversa para `1.0.10.in-addr.arpa` y añade:
20   PTR  bootstrap.ocp.empresa.local.
21   PTR  master-01.ocp.empresa.local.
22   PTR  master-02.ocp.empresa.local.
23   PTR  master-03.ocp.empresa.local.
31   PTR  worker-01.ocp.empresa.local.
32   PTR  worker-02.ocp.empresa.local.
33   PTR  worker-03.ocp.empresa.local.
41   PTR  infra-01.ocp.empresa.local.
42   PTR  infra-02.ocp.empresa.local.
43   PTR  infra-03.ocp.empresa.local.

### Verificar DNS desde el bastion antes de continuar

```bash
# Verificar registros críticos
dig api.ocp.empresa.local +short          # → 10.0.1.10
dig api-int.ocp.empresa.local +short      # → 10.0.1.10
dig test.apps.ocp.empresa.local +short    # → 10.0.1.11
dig master-01.ocp.empresa.local +short    # → 10.0.1.21

# Verificar SRV etcd
dig _etcd-server-ssl._tcp.ocp.empresa.local SRV

# Verificar PTR
dig -x 10.0.1.21 +short   # → master-01.ocp.empresa.local.

# NO continúes si alguno de estos falla
```

---

## Paso 3 — Configurar NetScaler

Necesitas dos VIPs con sus servicios asociados. Usa **TCP passthrough** — no SSL offloading. OpenShift gestiona sus propios certificados.

### VIP 1 — API y Machine Config Server (10.0.1.10)

Crea los siguientes servicios backend en NetScaler:

| Nombre servicio | IP | Puerto | Protocolo |
|---|---|---|---|
| ocp-api-bootstrap | 10.0.1.20 | 6443 | TCP |
| ocp-api-master-01 | 10.0.1.21 | 6443 | TCP |
| ocp-api-master-02 | 10.0.1.22 | 6443 | TCP |
| ocp-api-master-03 | 10.0.1.23 | 6443 | TCP |
| ocp-mcs-bootstrap | 10.0.1.20 | 22623 | TCP |
| ocp-mcs-master-01 | 10.0.1.21 | 22623 | TCP |
| ocp-mcs-master-02 | 10.0.1.22 | 22623 | TCP |
| ocp-mcs-master-03 | 10.0.1.23 | 22623 | TCP |

Crea dos virtual servers:
- `ocp-api-vs` → 10.0.1.10:6443 → bind a los 4 servicios ocp-api-*
- `ocp-mcs-vs` → 10.0.1.10:22623 → bind a los 4 servicios ocp-mcs-*

> Una vez finalizada la instalación, elimina los servicios del bootstrap de ambos virtual servers.

### VIP 2 — Ingress (10.0.1.11)

| Nombre servicio | IP | Puerto |
|---|---|---|
| ocp-ingress-infra-01-http | 10.0.1.41 | 80 |
| ocp-ingress-infra-02-http | 10.0.1.42 | 80 |
| ocp-ingress-infra-03-http | 10.0.1.43 | 80 |
| ocp-ingress-infra-01-https | 10.0.1.41 | 443 |
| ocp-ingress-infra-02-https | 10.0.1.42 | 443 |
| ocp-ingress-infra-03-https | 10.0.1.43 | 443 |

Crea dos virtual servers:
- `ocp-ingress-http-vs` → 10.0.1.11:80 → bind a los 3 servicios http
- `ocp-ingress-https-vs` → 10.0.1.11:443 → bind a los 3 servicios https

---

## Paso 4 — Preparar el nodo bastion

```bash
# Instalar herramientas necesarias
sudo dnf install -y wget curl tar bind-utils httpd

# Habilitar Apache para servir ficheros de ignición
sudo systemctl enable --now httpd
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload

# Crear directorio de trabajo
mkdir -p ~/ocp-install && cd ~/ocp-install
```

### Descargar binarios de OpenShift 4.19

```bash
cd ~/ocp-install

# Descargar installer y cliente OC
wget https://mirror.openshift.com/pub/openshift-v4/clients/ocp/4.19.0/openshift-install-linux.tar.gz
wget https://mirror.openshift.com/pub/openshift-v4/clients/ocp/4.19.0/openshift-client-linux.tar.gz

# Extraer e instalar
tar -xzf openshift-install-linux.tar.gz
tar -xzf openshift-client-linux.tar.gz
sudo mv openshift-install oc kubectl /usr/local/bin/
sudo chmod +x /usr/local/bin/{openshift-install,oc,kubectl}

# Verificar
openshift-install version
oc version
```

### Generar par de claves SSH

```bash
ssh-keygen -t ed25519 -N '' -f ~/.ssh/ocp_rsa
# Guarda el contenido de la clave pública para el install-config.yaml
cat ~/.ssh/ocp_rsa.pub
```

### Obtener el pull secret

1. Ve a `https://console.redhat.com/openshift/install/vsphere/user-provisioned`
2. Descarga tu **pull secret**
3. Guárdalo: `cp ~/Downloads/pull-secret.txt ~/ocp-install/pull-secret.json`

---

## Paso 5 — Crear el install-config.yaml

```bash
cd ~/ocp-install
```

Crea el fichero con Python para evitar problemas de escape:

```python
content = """
apiVersion: v1
baseDomain: empresa.local
compute:
  - architecture: amd64
    hyperthreading: Enabled
    name: worker
    replicas: 0
controlPlane:
  architecture: amd64
  hyperthreading: Enabled
  name: master
  replicas: 3
metadata:
  name: ocp
networking:
  clusterNetwork:
    - cidr: 10.128.0.0/14
      hostPrefix: 23
  machineNetwork:
    - cidr: 10.0.1.0/24
  networkType: OVNKubernetes
  serviceNetwork:
    - 172.30.0.0/16
platform:
  vsphere:
    apiVIPs:
      - 10.0.1.10
    ingressVIPs:
      - 10.0.1.11
    vcenters:
      - datacenters:
          - Datacenter
        password: TU_PASSWORD_VCENTER
        port: 443
        server: vcenter.empresa.local
        user: administrator@vsphere.local
    failureDomains:
      - name: production-domain
        region: region-a
        zone: zone-a
        server: vcenter.empresa.local
        topology:
          datacenter: Datacenter
          computeCluster: /Datacenter/host/ClusterProd
          networks:
            - VM Network
          datastore: /Datacenter/datastore/DatastoreProd
          resourcePool: /Datacenter/host/ClusterProd/Resources
fips: false
pullSecret: 'PEGA_AQUI_TU_PULL_SECRET'
sshKey: 'PEGA_AQUI_TU_CLAVE_PUBLICA_SSH'
"""

with open("install-config.yaml", "w") as f:
    f.write(content.strip())
```

> Sustituye los valores de vCenter, password, datacenter, datastore y clúster por los de tu entorno real. El `name: ocp` junto con `baseDomain: empresa.local` formarán el dominio `ocp.empresa.local`.

**Haz una copia de seguridad del fichero — el installer lo consume y elimina:**

```bash
cp install-config.yaml install-config.yaml.bak
```

---

## Paso 6 — Generar manifiestos y ficheros de ignición

```bash
cd ~/ocp-install

# Generar manifiestos
openshift-install create manifests --dir=.

# Verificar que los masters no son schedulables
grep mastersSchedulable manifests/cluster-scheduler-02-config.yml
# Debe ser: mastersSchedulable: false
# Si es true:
sed -i 's/mastersSchedulable: true/mastersSchedulable: false/'   manifests/cluster-scheduler-02-config.yml

# Generar ficheros de ignición
openshift-install create ignition-configs --dir=.

# Verificar los 3 ficheros generados
ls -lh *.ign
# bootstrap.ign  master.ign  worker.ign
```

### Servir los ficheros desde Apache

```bash
sudo cp ~/ocp-install/*.ign /var/www/html/
sudo chmod 644 /var/www/html/*.ign

# Verificar accesibilidad
curl http://10.0.1.5/bootstrap.ign | python3 -m json.tool | head -3
```

---

## Paso 7 — Descargar RHCOS OVA para vSphere

```bash
cd ~/ocp-install

wget https://mirror.openshift.com/pub/openshift-v4/dependencies/rhcos/4.19/latest/rhcos-vmware.x86_64.ova

# Verificar integridad con el sha256 publicado en mirror.openshift.com
sha256sum rhcos-vmware.x86_64.ova
```

---

## Paso 8 — Importar OVA como plantilla en vCenter

1. En vCenter → clic derecho sobre el clúster → **Deploy OVF Template**
2. Selecciona `rhcos-vmware.x86_64.ova`
3. Nombre: `rhcos-4.19-template`
4. Selecciona el datastore de producción
5. Red: selecciona tu red de VMs
6. **No arranques la VM**
7. Clic derecho sobre la VM → **Template** → **Convert to Template**

---

## Paso 9 — Crear las VMs desde la plantilla

Para cada nodo, clona la plantilla y configura los parámetros de ignición y red.

### Generar base64 de los ficheros de ignición

```bash
base64 -w0 ~/ocp-install/bootstrap.ign > /tmp/bootstrap.b64
base64 -w0 ~/ocp-install/master.ign    > /tmp/master.b64
base64 -w0 ~/ocp-install/worker.ign    > /tmp/worker.b64

# Los nodos infra usan el mismo fichero que los workers
```

### Parámetros vApp por VM

Para cada VM clonada, en **Edit Settings → VM Options → Advanced → Configuration Parameters**, añade:

| Parámetro | Valor |
|---|---|
| `guestinfo.ignition.config.data` | Contenido del fichero .b64 correspondiente |
| `guestinfo.ignition.config.data.encoding` | `base64` |
| `disk.EnableUUID` | `TRUE` |

### Configurar red estática (Afterburn)

Para cada VM, añade también el parámetro de red con IPs estáticas:

| Parámetro | Valor (ejemplo master-01) |
|---|---|
| `guestinfo.afterburn.initrd.network-kargs` | `ip=10.0.1.21::10.0.1.1:255.255.255.0:master-01.ocp.empresa.local:ens192:off nameserver=10.0.0.53` |

Formato: `ip=IP::GATEWAY:MASCARA:HOSTNAME:INTERFAZ:off nameserver=DNS`

La interfaz en vSphere suele ser `ens192`. Verifica el nombre en tu entorno.

### Tabla de VMs a crear

| VM | Ignición | IP | Notas |
|---|---|---|---|
| bootstrap | bootstrap.b64 | 10.0.1.20 | Eliminar tras instalación |
| master-01 | master.b64 | 10.0.1.21 | |
| master-02 | master.b64 | 10.0.1.22 | |
| master-03 | master.b64 | 10.0.1.23 | |
| worker-01 | worker.b64 | 10.0.1.31 | |
| worker-02 | worker.b64 | 10.0.1.32 | |
| worker-03 | worker.b64 | 10.0.1.33 | |
| infra-01 | worker.b64 | 10.0.1.41 | Label infra tras instalación |
| infra-02 | worker.b64 | 10.0.1.42 | Label infra tras instalación |
| infra-03 | worker.b64 | 10.0.1.43 | Label infra tras instalación |

---

## Paso 10 — Arrancar los nodos e iniciar la instalación

### Orden de arranque obligatorio

Bootstrap — arrancar primero, esperar 2-3 minutos
Masters — arrancar los tres simultáneamente
Workers e Infra — arrancar después de que los masters estén listos


### Monitorizar el proceso de bootstrap

```bash
cd ~/ocp-install

# Terminal 1: monitorizar el bootstrap
openshift-install wait-for bootstrap-complete --dir=. --log-level=info

# Terminal 2: conectarse al bootstrap para ver logs detallados
ssh -i ~/.ssh/ocp_rsa core@10.0.1.20
journalctl -b -f -u bootkube.service
```

El proceso de bootstrap tarda entre 15 y 30 minutos. El mensaje de éxito es:
INFO Waiting up to 20m0s for the Kubernetes API at https://api.ocp.empresa.local:6443
INFO API v1.32.x up
INFO Waiting up to 30m0s for bootstrapping to complete
INFO It is now safe to remove the bootstrap resources

### Aprobar los CSRs de los nodos

Una vez completado el bootstrap, aprueba los Certificate Signing Requests de los nodos:

```bash
export KUBECONFIG=~/ocp-install/auth/kubeconfig

# Ver estado de los nodos
oc get nodes

# Ver CSRs pendientes
oc get csr

# Aprobar todos los CSRs pendientes (ejecutar dos veces — hay CSRs de cliente y de servidor)
oc get csr -o go-template='{{range .items}}{{if not .status}}{{.metadata.name}}{{"
"}}{{end}}{{end}}'   | xargs oc adm certificate approve

# Esperar a que todos los nodos estén en Ready
watch oc get nodes
```

> Es normal que aparezcan CSRs en dos rondas. Ejecuta la aprobación, espera unos minutos y vuelve a ejecutarla para la segunda ronda.

---

## Paso 11 — Eliminar el bootstrap

Una vez que los masters están en `Ready` y el bootstrap ha completado:

```bash
# Verificar que es seguro eliminar el bootstrap
openshift-install wait-for bootstrap-complete --dir=. --log-level=info
# → "It is now safe to remove the bootstrap resources"
```

1. **En NetScaler:** elimina los servicios `ocp-api-bootstrap` y `ocp-mcs-bootstrap` de ambos virtual servers
2. **En vCenter:** apaga y elimina la VM `bootstrap`

---

## Paso 12 — Configurar nodos de infraestructura

Los nodos infra son workers dedicados a cargas del sistema (router Ingress, Image Registry, Monitoring). Se diferencian de los workers mediante labels y taints.

```bash
export KUBECONFIG=~/ocp-install/auth/kubeconfig

# Añadir label infra
for node in infra-01 infra-02 infra-03; do
  oc label node ${node}.ocp.empresa.local node-role.kubernetes.io/infra=''
done

# Añadir taint para que solo cargas de infra se programen aquí
for node in infra-01 infra-02 infra-03; do
  oc adm taint nodes ${node}.ocp.empresa.local     node-role.kubernetes.io/infra=reserved:NoSchedule
done

# Quitar el label worker de los nodos infra
for node in infra-01 infra-02 infra-03; do
  oc label node ${node}.ocp.empresa.local node-role.kubernetes.io/worker-
done

# Verificar
oc get nodes
```

### Mover el Ingress Router a nodos infra

```bash
oc patch ingresscontroller/default -n openshift-ingress-operator   --type=merge --patch='{
    "spec": {
      "nodePlacement": {
        "nodeSelector": {
          "matchLabels": {
            "node-role.kubernetes.io/infra": ""
          }
        },
        "tolerations": [{
          "key": "node-role.kubernetes.io/infra",
          "value": "reserved",
          "effect": "NoSchedule"
        }]
      }
    }
  }'

# Verificar que los pods del router están en nodos infra
oc get pods -n openshift-ingress -o wide
```

### Mover el Image Registry a nodos infra

```bash
oc patch configs.imageregistry.operator.openshift.io/cluster   --type=merge --patch='{
    "spec": {
      "nodeSelector": {"node-role.kubernetes.io/infra": ""},
      "tolerations": [{
        "key": "node-role.kubernetes.io/infra",
        "value": "reserved",
        "effect": "NoSchedule"
      }]
    }
  }'
```

### Mover Monitoring a nodos infra

```bash
cat << EOF | oc apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-monitoring-config
  namespace: openshift-monitoring
data:
  config.yaml: |
    prometheusOperator:
      nodeSelector:
        node-role.kubernetes.io/infra: ""
      tolerations:
        - key: node-role.kubernetes.io/infra
          value: reserved
          effect: NoSchedule
    prometheusK8s:
      nodeSelector:
        node-role.kubernetes.io/infra: ""
      tolerations:
        - key: node-role.kubernetes.io/infra
          value: reserved
          effect: NoSchedule
    alertmanagerMain:
      nodeSelector:
        node-role.kubernetes.io/infra: ""
      tolerations:
        - key: node-role.kubernetes.io/infra
          value: reserved
          effect: NoSchedule
EOF
```

---

## Paso 13 — Completar la instalación

```bash
cd ~/ocp-install

openshift-install wait-for install-complete --dir=. --log-level=info
```

Mensaje de éxito esperado:
INFO Install complete!
INFO To access the cluster as the system:admin user when using 'oc', run:
export KUBECONFIG=~/ocp-install/auth/kubeconfig
INFO Access the OpenShift web-console here:
https://console-openshift-console.apps.ocp.empresa.local
INFO Login to the console with user: "kubeadmin", and password: "XXXX-XXXX-XXXX-XXXX"

---

## Paso 14 — Verificación post-instalación

```bash
export KUBECONFIG=~/ocp-install/auth/kubeconfig

# Estado de todos los nodos
oc get nodes -o wide

# Todos los operadores deben estar Available=True, Progressing=False, Degraded=False
oc get clusteroperators

# Versión del clúster
oc get clusterversion

# Pods del router en nodos infra
oc get pods -n openshift-ingress -o wide

# Pods de monitoring en nodos infra
oc get pods -n openshift-monitoring -o wide

# Acceso a la consola web
curl -k -o /dev/null -w "%{http_code}"   https://console-openshift-console.apps.ocp.empresa.local
# → 200
```

### Checklist final

```bash
# 1. Todos los nodos en Ready
oc get nodes | grep -v " Ready"
# No debe devolver resultados

# 2. Todos los clusteroperators en estado correcto
oc get co | grep -v "True.*False.*False"
# No debe devolver resultados

# 3. Sin CSRs pendientes
oc get csr | grep Pending
# No debe devolver resultados
```

---

## Problemas comunes y soluciones

### Los masters no obtienen su configuración de ignición

```bash
# Verificar que el fichero es accesible desde la red de los nodos
curl http://10.0.1.5/master.ign | python3 -m json.tool | head -3

# Verificar que Apache está activo en el bastion
systemctl status httpd

# Verificar que el firewall permite el puerto 80
firewall-cmd --list-services | grep http
```

### La API no responde tras el bootstrap

```bash
# Verificar DNS del API
dig api.ocp.empresa.local +short
# Debe devolver 10.0.1.10

# Verificar que NetScaler tiene todos los masters activos
# En la consola de NetScaler: Traffic Management → Load Balancing → Services
# Todos los ocp-api-master-0* deben estar UP

# Verificar conectividad al API directamente a un master
curl -k https://10.0.1.21:6443/healthz
# → ok
```

### CSRs no aparecen tras arrancar los workers

```bash
# Conectarse al worker y verificar el servicio kubelet
ssh -i ~/.ssh/ocp_rsa core@10.0.1.31
journalctl -u kubelet -f

# Verificar que el Machine Config Server es accesible desde el worker
curl -k https://api-int.ocp.empresa.local:22623/config/worker | head -3
```

### Image Registry en estado Removed o Degraded

```bash
# Ver estado del registry
oc get configs.imageregistry.operator.openshift.io cluster -o yaml | grep -A5 managementState

# En instalaciones UPI sin almacenamiento configurado,
# configurar almacenamiento efímero temporalmente:
oc patch configs.imageregistry.operator.openshift.io cluster   --type merge   --patch '"'"'{"spec":{"managementState":"Managed","storage":{"emptyDir":{}}}}'"'"'

# Para producción, configurar un PVC con almacenamiento persistente
```

### etcd no forma quorum

```bash
# Ver estado de etcd
oc get pods -n openshift-etcd

# Ver logs de etcd en un master
oc logs -n openshift-etcd   $(oc get pods -n openshift-etcd -l k8s-app=etcd -o name | head -1)   -c etcd | tail -30

# Verificar conectividad entre masters en los puertos de etcd
ssh -i ~/.ssh/ocp_rsa core@10.0.1.21
nc -zv 10.0.1.22 2379 && nc -zv 10.0.1.23 2379
```

---

## Seguridad post-instalación recomendada

```bash
# 1. Cambiar la contraseña de kubeadmin o crear usuarios con htpasswd
# Crear un fichero htpasswd con un admin
htpasswd -c -B -b /tmp/htpasswd admin TuPasswordSeguro

# Crear el secret en OpenShift
oc create secret generic htpass-secret   --from-file=htpasswd=/tmp/htpasswd   -n openshift-config

# Crear el OAuth provider
cat << EOF | oc apply -f -
apiVersion: config.openshift.io/v1
kind: OAuth
metadata:
  name: cluster
spec:
  identityProviders:
    - name: htpasswd_provider
      mappingMethod: claim
      type: HTPasswd
      htpasswd:
        fileData:
          name: htpass-secret
EOF

# Dar permisos de cluster-admin al nuevo usuario
oc adm policy add-cluster-role-to-user cluster-admin admin

# 2. Deshabilitar kubeadmin una vez verificado el acceso con el nuevo usuario
oc delete secret kubeadmin -n kube-system
```

---

## Conclusión práctica

Una instalación UPI de OpenShift 4.19 sobre vSphere 8 sigue siempre el mismo orden: DNS → balanceador → bastion → ignición → VMs → bootstrap → aprobación CSRs → post-configuración de infra. Los fallos ocurren casi siempre en los mismos puntos: DNS incorrecto o incompleto, ficheros de ignición inaccesibles, o CSRs sin aprobar en la segunda ronda.

Puntos clave a recordar:
- Guarda `~/ocp-install/auth/` en un lugar seguro — contiene el kubeconfig de admin y la contraseña de kubeadmin
- Guarda `~/ocp-install/metadata.json` — necesario para destruir el clúster con el installer si fuera necesario
- El bootstrap **siempre** va antes en el NetScaler y se elimina al finalizar
- Los nodos infra son workers normales hasta que les aplicas los labels y taints manualmente
