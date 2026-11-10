# 4. Despliegue y mantenimiento

> Para quien **administra** el sistema en MTI (hoy: Néstor Celis, `nacb@mtigruas.com`). La mayoría de las
> tareas de este documento **no requieren programar**: se hacen desde pantallas de Frappe.

## 4.1 Cómo está desplegado

| Elemento | Valor |
|---|---|
| Proveedor | **Frappe Cloud** (empresa creadora de Frappe) |
| Cuenta | A nombre de MTI (`nacb@mtigruas.com`), con el medio de pago de MTI |
| Sitio | `mtigruas.v.frappe.cloud` · región N. Virginia (EE. UU.) |
| Dirección de trabajo | **https://mtigruas.v.frappe.cloud/mti** |
| Versión | Frappe 16 + Frappe CRM |
| Plan | Compartido de USD 5/mes: 0,5 h de cómputo/día, 250 MB de base de datos, 2,5 GB de disco |
| Incluye | Servidor, actualizaciones, HTTPS, copias de seguridad en el servidor |
| No incluye en este plan | Copias externas (*offsite*, desde USD 25), garantía de producto (desde USD 50) |

### Qué hace Frappe Cloud y qué hace MTI

| Frappe Cloud (automático) | MTI (administrador) |
|---|---|
| Mantener el servidor encendido y seguro | Crear y desactivar usuarios |
| Actualizar Frappe y Frappe CRM | Ajustar catálogos, cláusulas y reglas |
| Certificado HTTPS | Descargar una copia de seguridad al mes |
| Copias de seguridad diarias en el servidor | Revisar el uso del plan y subirlo si hace falta |
| Monitoreo de la plataforma | Pagar el plan |

## 4.2 Despliegue desde cero (referencia)

Así se hizo el despliegue de producción. Sirve para repetirlo si algún día hay que montar otro sitio
(por ejemplo, uno de pruebas).

1. **Cuenta** en https://frappecloud.com con un correo corporativo de MTI. Agregar el medio de pago en
   *Billing*.
2. **Nuevo sitio**: *Sites → New Site* → app **CRM** → **Version 16** → proveedor con región en EE. UU.
   → plan → subdominio (`mtigruas`) → *Create*. Tarda 5–10 minutos hasta quedar **Active**.
3. **Asistente** (*Setup Site*): idioma Español, país Colombia, zona America/Bogota, moneda COP y el
   usuario administrador de MTI. En el asistente del CRM: **saltar** correo, datos de ejemplo e
   invitaciones.
4. **Instalador**, desde la carpeta del proyecto con Docker encendido:
   ```powershell
   docker compose start
   docker compose exec frappe python3 /workspace/mti_instalar.py `
       --url https://mtigruas.v.frappe.cloud --usuario nacb@mtigruas.com --clave "CLAVE"
   ```
   Debe terminar con **"✔ Configuración MTI lista"**. Sin `--usuarios-demo` y sin `mti_demo.py`.
5. **Usuarios** (ver 4.3), **responsables** en `/app/mti-configuracion`, **clientes** y **catálogos**.
6. **Prueba** de una oferta de punta a punta con todos los perfiles y borrarla.

## 4.3 Usuarios

### Crear un usuario

1. `/app/user` → **+ Agregar usuario**.
2. Correo (será su usuario para entrar), nombre y apellido.
3. Desmarcar **Enviar correo de bienvenida** mientras el sitio no tenga correo de salida configurado.
4. Guardar. En **Roles** marcar **Sales Manager** + su perfil MTI (tabla de abajo). Guardar.
5. En **Cambiar contraseña** → *Nueva contraseña* → Guardar. Entregarle correo y clave; que la cambie al
   entrar.

| Persona | Roles |
|---|---|
| Administrador (Néstor) | System Manager + Sales Manager + MTI Proyectos |
| Comercial – Cotizaciones | Sales Manager + MTI Comercial (+ MTI Logística si también programa) · no ve Históricos ni exporta clientes |
| Logística | Sales Manager + MTI Logística · no ve Históricos ni exporta clientes |
| Gerencia | Sales Manager + MTI Gerencia · ve todo, sin editar |

Reglas:
- **Sales Manager siempre**: sin él, el usuario solo ve las ofertas que él mismo creó.
- **System Manager solo para quien administra**.
- Cada persona con su propio correo, para que el historial diga quién hizo qué. Si dos personas comparten
  buzón, a una se le puede poner un correo de `@mtigruas.com` que no exista (solo sirve para entrar; si
  olvida la clave, el administrador se la cambia).

### Otras tareas de usuarios

| Tarea | Cómo |
|---|---|
| Cambiar la clave de alguien | `/app/user` → usuario → Cambiar contraseña |
| Cambiar de funciones a alguien | Marcar o desmarcar su perfil MTI |
| Alguien se va de la empresa | Desmarcar **Habilitado** (*Enabled*) en su usuario. **No borrarlo**: su historial se conserva |
| Cambiar el correo de un usuario | En su usuario: menú ⋯ → **Renombrar** (conserva el historial) |

## 4.4 Tareas de mantenimiento

### Mensual (10 minutos)

| Tarea | Dónde |
|---|---|
| **Descargar una copia de seguridad** (base de datos y archivos) y guardarla en el Drive de MTI | Frappe Cloud → el sitio → **Backups** → *Download* |
| Revisar el uso del plan (cómputo, base de datos, disco) | Frappe Cloud → el sitio → **Overview / Insights** |
| Revisar que no haya automatizaciones con error | `/app/automation-run`, filtrar por estado de error |

Si alguna barra de uso pasa del **70–80 %**, subir de plan: Frappe Cloud → el sitio → **Plan** → *Change
Plan*. Es inmediato, sin migrar ni detener el sistema, y se cobra por día. Lo primero que suele llenarse
es el **disco**, por las fotos de las visitas. Las fotos que se suben desde `/mti` ya se reducen solas
(≈ 300 KB cada una), así que los 2,5 GB alcanzan para varios miles.

### Cuando cambie algo del negocio

| Cambio | Dónde | Notas |
|---|---|---|
| Nuevo equipo, operador, técnico o servicio | `/mti` → **Catálogos** | "Quitar" lo oculta sin borrar el historial |
| Nuevos clientes en cantidad | `/mti` → Clientes → **Importar desde Excel** | Descargar la plantilla, llenarla y subirla |
| Cláusulas, NIT, cuenta bancaria, pie de página, código del formato | `/app/mti-configuracion` | Se ve de inmediato en la oferta impresa. En el repositorio la cuenta bancaria va como `XXXXXXXXXXXX`; la real solo está en el sitio |
| Responsable de Proyectos o Logística | `/app/mti-configuracion` | Aplica a las ofertas que pasen de etapa desde ese momento |
| Días del semáforo y vigencia | `/mti` → Alertas → *Reglas del semáforo* | Ver nota abajo |
| Canales de entrada | `/app/crm-lead-source` | |
| Motivos de pérdida | `/app/crm-lost-reason` | |
| Colores de las etapas | `/app/crm-deal-status` | **No cambiar los nombres** de las etapas |
| Cuántos días esperan las alertas antes de ponerse en rojo | `mti_app.js` → `LIMITES` (requiere publicar con `--solo-pantallas`) | Ver [02-codigo.md](02-codigo.md#237-alertas-por-área) |

> **Días del semáforo:** al guardarlos en `/mti` cambian el cálculo en pantalla de inmediato. Las
> automatizaciones que pintan el semáforo y crean la tarea "Sin respuesta" tienen sus propios días; para
> igualarlos, un System Manager abre `/app/automation-flow` → *MTI · Semáforo amarillo* y *MTI ·
> Semáforo rojo* y cambia **Date Offset** (verde + 1 y amarillo + 1), o vuelve a correr el instalador.

### Automatizaciones

En `/app/automation-flow` están las 13 automatizaciones `MTI · …` (lista completa en
[03-frappe.md](03-frappe.md#35-automatizaciones-automation-flow)).

| Quiero… | Cómo |
|---|---|
| Que una deje de funcionar | Abrirla → desmarcar **Enabled** → Guardar |
| Cambiar a quién se asigna una tarea | Abrirla → acción → en los valores, `assigned_to` (p. ej. `{{ doc.deal_owner }}`) |
| Cambiar el texto de una tarea | Abrirla → acción → `title` / `description` |
| Cambiar cuántos días antes avisa | Abrirla → **Date Offset** |
| Pausarlas todas (carga masiva de datos) | `/app/automation-settings` → **Disable Automations** |
| Ver por qué una no corrió | `/app/automation-run` → abrir la ejecución → error |

Si se edita una automatización y luego se vuelve a correr el instalador completo, el instalador la deja
como viene en el código (respetando si está apagada). Para cambios permanentes, cambiarlos también en
`mti_instalar.py` (función `flujos`).

## 4.5 Actualizaciones

- **Frappe y Frappe CRM**: las aplica Frappe Cloud. Como el sistema no tiene código instalado en el
  servidor, una actualización no debería romper nada. Después de una actualización grande (una versión
  nueva de Frappe, p. ej. 16 → 17), probar una oferta de punta a punta antes de seguir trabajando.
- **Pantallas `/mti`** (ajustes pedidos por MTI): se cambian `mti_app.js` / `mti_app.css` y se publican:
  ```powershell
  docker compose exec frappe python3 /workspace/mti_instalar.py `
      --url https://mtigruas.v.frappe.cloud --usuario nacb@mtigruas.com --clave "CLAVE" --solo-pantallas
  ```
  Los usuarios ven el cambio al recargar con **Ctrl+F5**. Los datos no se tocan.
- **Campos, etapas o automatizaciones nuevas**: el mismo comando **sin** `--solo-pantallas`. No borra
  datos ni duplica nada.

## 4.6 Copias de seguridad y recuperación

| Situación | Qué hacer |
|---|---|
| Copia mensual | Frappe Cloud → Backups → *Download* (base de datos + archivos públicos y privados) |
| Eliminar una oferta (duplicada, de prueba, creada por error) | Solo el administrador: en la ficha → **🗑 Eliminar oferta** → escribir el número para confirmar |
| Se borró una oferta por error | En `/app/deleted-document` se puede **restaurar** |
| Se dañaron datos | Frappe Cloud → Backups → elegir una copia → **Restore** (vuelve el sitio a ese día: lo hecho después se pierde) |
| Mudar el sistema a otro proveedor | Descargar la copia y restaurarla en cualquier servidor con Frappe 16 + CRM; luego correr el instalador con `--solo-pantallas` |

## 4.7 Opcionales

### Dominio propio (`crm.mtigruas.com`)
1. En el proveedor del dominio de MTI, crear un registro **CNAME** `crm` → `mtigruas.v.frappe.cloud`.
2. Frappe Cloud → el sitio → **Domains** → *Add domain* → `crm.mtigruas.com` → verificar.
3. HTTPS se configura solo. La dirección anterior sigue funcionando.

### Correo de salida
Necesario para: recuperar clave por correo, invitaciones y, a futuro, avisos por correo.
`/crm` → Configuración → **Email** → Gmail u Outlook (según use MTI en `@mtigruas.com`) → seguir los
pasos (suele pedir una "contraseña de aplicación" de la cuenta).

## 4.8 Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Sin perfil MTI" al entrar a `/mti` | El usuario no tiene rol MTI | Marcar su perfil en `/app/user` |
| Un usuario solo ve algunas ofertas | Le falta **Sales Manager** | Marcarlo en `/app/user` |
| No le llega la tarea a Proyectos o Logística | Responsable vacío en `MTI Configuracion` | Elegirlo y guardar |
| El semáforo no cambia de color en `/crm` | Automatizaciones apagadas o con error | `/app/automation-settings` y `/app/automation-run` |
| `/mti` se ve como la versión anterior | Caché del navegador | **Ctrl+F5** o ventana de incógnito |
| `/mti` queda en "Cargando…" | Error de JavaScript o sesión vencida | Recargar; si sigue, F12 → Consola y enviar captura al soporte |
| El sitio está lento a cierta hora | Se acabó el cómputo diario del plan | Esperar al día siguiente o subir de plan |
| "Not permitted" al correr el instalador | El usuario no es System Manager | Usar el administrador del sitio |

## 4.9 Soporte

| Tema | A quién |
|---|---|
| El sitio no abre, lentitud, copias, cobros | **Frappe Cloud**: panel → *Help / Support* (tickets) |
| Errores de Frappe o Frappe CRM | Foro https://discuss.frappe.io (comunidad) |
| Cambios en las pantallas MTI, campos o flujo | Cualquier desarrollador o integrador de Frappe, con este repositorio y su documentación |
