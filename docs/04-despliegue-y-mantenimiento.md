# 4. Despliegue y mantenimiento

> Para quien **administra** el sistema en MTI (hoy: Néstor Celis, `nacb@mtigruas.com`). La mayoría de las
> tareas de este documento **no requieren programar**: se hacen desde pantallas de Frappe.
> Actualizado a la **versión final (v3.1)**. La *Guía del administrador* (documento aparte) explica lo
> mismo paso a paso para alguien sin formación técnica.

## 4.1 Cómo está desplegado

| Elemento | Valor |
|---|---|
| Proveedor | **Frappe Cloud** (empresa creadora de Frappe) |
| Cuenta | A nombre de MTI (`nacb@mtigruas.com`), con el medio de pago de MTI |
| Sitio | `mtigruas.v.frappe.cloud` · región N. Virginia (EE. UU.) |
| Dirección de trabajo | **https://mtigruas.v.frappe.cloud/mti** |
| Versión | Frappe 16 + Frappe CRM |
| Plan | Compartido de USD 5/mes: 0,5 h de cómputo/día, 250 MB de base de datos, 2,5 GB de disco |
| Incluye | Servidor, actualizaciones, HTTPS, copias de seguridad **manuales** en el servidor |
| No incluye en este plan | Copias automáticas diarias y copias externas (*offsite*): según la [documentación de Frappe Cloud](https://docs.frappe.io/cloud/sites/backups), desde USD 25. Garantía de producto (desde USD 50) |
| Límites propios del plan USD 5 | Tareas en segundo plano cada **10 minutos** (las automatizaciones pueden tardar hasta 10 min); solicitudes cortadas a los **30 s** (importar Excel en archivos pequeños); actualizaciones automáticas que no se pueden apagar; después de subir de plan no se puede volver a USD 5 ([fuente](https://docs.frappe.io/cloud/tiny-plan)) |
| Facturación | Mensual, al final del mes (tarjeta o saldo prepagado). No hay plan anual ni descuento por pago anual |

### Qué hace Frappe Cloud y qué hace MTI

| Frappe Cloud (automático) | MTI (administrador) |
|---|---|
| Mantener el servidor encendido y seguro | Crear y desactivar usuarios |
| Actualizar Frappe y Frappe CRM | Ajustar catálogos, cláusulas y reglas |
| Certificado HTTPS | Descargar una copia de seguridad al mes |
| Copias automáticas (desde el plan USD 25) | Hacer y guardar la copia manual mensual; revisar el uso del plan y subirlo si hace falta |
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
       --url https://mtigruas.v.frappe.cloud --usuario 'nacb@mtigruas.com' --clave 'CLAVE'
   ```
   Debe terminar con **"✔ Configuración MTI lista"**. Sin `--usuarios-demo` y sin `mti_demo.py`.
   La clave va entre **comillas simples**: con comillas dobles PowerShell cambia lo que vaya después de
   un `$` y el sitio responde `401 · Invalid login credentials`.
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
| Eliminar un cliente (creado por error o duplicado) | Solo System Manager: `/mti` → Clientes → 🗑 → escribir ELIMINAR. Solo si no tiene ofertas de ningún año; opcionalmente borra sus contactos. Se recupera en `/app/deleted-document` |

## 4.4 Tareas de mantenimiento

### Mensual (10 minutos)

| Tarea | Dónde |
|---|---|
| **Hacer una copia de seguridad** con archivos | Frappe Cloud → el sitio → **Backups** → *Schedule Backup* (con archivos) |
| **Descargarla** y guardarla en el Drive de MTI (acceso restringido; conservar 12 meses) | En el plan USD 5: `/app/backups` dentro del sitio (System Manager). Desde el panel solo se descargan las copias externas (planes desde USD 25) |
| Revisar el uso del plan (cómputo, base de datos, disco) y anotarlo | Frappe Cloud → el sitio → **Overview / Insights** (historia en *Analytics*) |
| Revisar que no haya automatizaciones con error | `/app/automation-run`, filtrar por estado de error |
| Revisar errores y correos | `/app/error-log` (errores nuevos repetidos) y `/app/email-queue` (correos con *Error*) |
| Revisar lo eliminado en el mes | `/app/deleted-document` |

Si alguna barra de uso pasa del **70–80 %**, subir de plan: Frappe Cloud → el sitio → **Plan** → *Change
Plan*. Es inmediato, sin migrar ni detener el sistema, y se cobra por día. Lo primero que suele llenarse
es el **disco**, por las fotos de las visitas. Las fotos que se suben desde `/mti` ya se reducen solas
(≈ 300 KB cada una), así que los 2,5 GB alcanzan para varios miles.

**Estimación con ~1.500 ofertas al año** (a confirmar con el panel cada mes):

| Recurso | Plan USD 5 | Crecimiento estimado | Alcanza para |
|---|---|---|---|
| Base de datos | 250 MB | ≈ 50–80 KB por oferta (con versiones, tareas, comentarios y registros) → ≈ 100 MB/año | ≈ 2 años |
| Disco | 2,5 GB | Fotos, reportes firmados y diagramas → 1 GB o más por año | ≈ 1,5–2 años |
| Cómputo | 0,5 h/día | Con la carga por años y el refresco de una sola oferta (v3.1), el uso diario debería quedar holgado. Los cambios en vivo suman 2 consultas mínimas cada 30 s por pestaña **visible** y una recarga completa cada 30 min | Revisar *Analytics*; si el cómputo sube, es lo primero a revisar (pestañas de `/mti` abiertas todo el día en varios computadores) |

Siguiente paso natural: plan de **USD 10** (1 h/día, 500 MB, 5 GB). El de **USD 25** suma copias
automáticas y externas.

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

- **Frappe y Frappe CRM**: las aplica Frappe Cloud (en el plan USD 5 no se pueden apagar). Como el
  sistema no tiene código instalado en el servidor, una actualización no lo "desinstala". Pero `/mti` lee
  campos y funciones de Frappe CRM, que es un producto joven: si una actualización cambia alguno, una
  parte de `/mti` puede fallar (los datos siguen intactos y se puede trabajar en `/crm` mientras se
  ajusta `mti_app.js`). Mantenimiento esperado: **pocas horas al año**; conviene acordarlo con el
  integrador. Detalle de dependencias en [01 · 1.8](01-arquitectura.md#18-de-qué-depende-mti-para-las-actualizaciones).
- **Cambio de versión mayor** (p. ej. Frappe 16 → 17): no es automático; se hace desde el panel cuando MTI
  decida. Antes, probarlo en local o en un sitio de prueba; después, recorrer una oferta de punta a punta.
- **Pantallas `/mti`** (ajustes pedidos por MTI): se cambian `mti_app.js` / `mti_app.css` y se publican:
  ```powershell
  docker compose exec frappe python3 /workspace/mti_instalar.py `
      --url https://mtigruas.v.frappe.cloud --usuario 'nacb@mtigruas.com' --clave 'CLAVE' --solo-pantallas
  ```
  Los usuarios ven el cambio al recargar con **Ctrl+F5**. Los datos no se tocan.
- **Campos, etapas o automatizaciones nuevas**: el mismo comando **sin** `--solo-pantallas`. No borra
  datos ni duplica nada.
- **Antes de publicar** en producción: copia de seguridad (*Backups → Schedule Backup*) y prueba en local.

### Pasar a la versión final (v3.1)

Agrega `mti_incluir` a las líneas y `mti_oferta_html`, `mti_oferta_base`, `mti_oferta_editada`,
`mti_oferta_editor` a la oferta, publica las pantallas nuevas y ajusta el texto de la oferta en
`MTI Configuracion` (pie de página solo con el celular; cláusula Primero con "- Únicamente para el
movimiento descrito en TRABAJO A EJECUTAR"), y deja el consecutivo para que la siguiente oferta nueva sea
la **40513** (si ya hay una más alta, no lo toca). Los ajustes de texto y el consecutivo requieren el
instalador **completo** (`--solo-pantallas` no los aplica). Las ofertas existentes quedan con todos
sus servicios marcados (sus totales no cambian).

```powershell
# Local
docker compose exec frappe python3 /workspace/mti_instalar.py --usuarios-demo
# Producción (instalador completo, no --solo-pantallas)
docker compose exec frappe python3 /workspace/mti_instalar.py `
    --url https://mtigruas.v.frappe.cloud --usuario 'nacb@mtigruas.com' --clave 'CLAVE' --sin-catalogo
```

## 4.6 Copias de seguridad y recuperación

| Situación | Qué hacer |
|---|---|
| Copia mensual | Frappe Cloud → Backups → *Schedule Backup* (con archivos) y descargarla desde `/app/backups` (base de datos `.sql.gz` + archivos públicos y privados `.tar`) |
| Eliminar una oferta (duplicada, de prueba, creada por error) | Solo el administrador: en la ficha → **🗑 Eliminar oferta** → escribir el número para confirmar |
| Eliminar un cliente | Solo el administrador: Clientes → 🗑 → escribir ELIMINAR (solo sin ofertas) |
| Se borró una oferta o un cliente por error | En `/app/deleted-document` se puede **restaurar** |
| Se dañaron datos | Frappe Cloud → Backups → elegir una copia → **Restore** (vuelve el sitio a ese día: lo hecho después se pierde). Hacerlo con el integrador o con un ticket a Frappe Cloud, teniendo a mano la última copia descargada |
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
| `401 · Invalid login credentials` al correr el instalador | Clave equivocada, o comillas dobles con `$` en PowerShell | Clave entre comillas simples; `--usuario` con un System Manager (si no se pone, entra como `Administrator`) |
| "La cotización ya fue aprobada y quedó fijada" | Regla del sistema | Lo que cambie se registra como adicional |
| La oferta impresa no muestra el total | Es lo esperado desde la v3.1 | El total es solo para Comercial (ficha) |
| Aviso amarillo en la oferta para imprimir | Cambiaron equipos o valores después de editar el texto | Revisar el texto o **Restablecer plantilla** |
| No aparecen ofertas de hace dos años o más | Se cargan bajo demanda | Elegir el año en el filtro, o "Buscar también en años anteriores" |
| Una tarea del CRM (`/crm` → Tasks) tarda en aparecer | En el plan USD 5 las tareas en segundo plano corren cada 10 min | Normal. Las alertas de `/mti` no dependen de ella (llegan en ≤ 30 s). Si no aparece en 10 min, `/app/automation-run` |
| Muchos correos en *Error* | Cuenta de correo mal configurada | `/app/email-queue` muestra el motivo |

## 4.9 Soporte

Prueba rápida para saber a quién llamar: si **`/app` no abre** → Frappe Cloud. Si `/app` y `/crm` abren
pero **`/mti` no** → integrador (mientras tanto se trabaja en `/crm`). Si todo abre pero algo puntual
falla → tabla 4.8 y `/app/error-log`.

| Tema | A quién | Dónde |
|---|---|---|
| El sitio no abre, lentitud, copias, restaurar, cobros, dominio | **Frappe Cloud** | Portal https://support.frappe.io (con el correo de la cuenta), o *Help / Support* en el panel. Atienden lunes a viernes 10:00–18:00 hora de India (**23:30–07:30 hora de Colombia**), en inglés; fines de semana solo emergencias |
| Pantallas `/mti`, instalador, automatizaciones MTI, plantilla de la oferta | **Integrador** del proyecto | Frappe Cloud **no** da soporte a personalizaciones ([alcance](https://frappe.io/handbook/support-scope)) |
| Errores de Frappe o Frappe CRM estándar | Comunidad | Foro https://discuss.frappe.io · errores del CRM https://github.com/frappe/crm/issues · documentación https://docs.frappe.io/crm |
| Si el integrador ya no está disponible | Cualquier partner o desarrollador de Frappe, con este repositorio y su documentación | Directorio https://frappe.io/partners |

Al pedir ayuda enviar: qué se hacía y qué pasó, fecha y hora (Colombia), usuario, número de oferta,
captura de pantalla, el error de `/app/error-log` y, para fallas de `/mti`, la consola del navegador (F12).
