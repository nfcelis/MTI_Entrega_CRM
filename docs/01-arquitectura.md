# 1. Arquitectura del sistema

> Documento técnico. Explica **qué piezas tiene el sistema, dónde vive cada una y cómo se comunican**.
> Actualizado a la **versión final (v3.1)**: servicios seleccionados por oferta, oferta al cliente sin
> totales y editable, carga por años para ~1.500 ofertas/año y eliminación de clientes por el administrador.
> Para el detalle del código ver [02-codigo.md](02-codigo.md); para la configuración de Frappe ver
> [03-frappe.md](03-frappe.md).

## 1.1 Problema que resuelve

MTI Grúas no tenía trazabilidad de sus ofertas: las solicitudes llegaban por WhatsApp, correo o llamada; la
visita técnica, el análisis de Proyectos, el envío al cliente, el seguimiento y el paso a Logística quedaban
en conversaciones y hojas sueltas. Nadie sabía con certeza en qué etapa iba cada oferta, quién la tenía ni
cuántos días llevaba sin respuesta.

El sistema registra cada oferta desde que llega la solicitud hasta que el servicio se ejecuta, la pasa
automáticamente de un área a otra y avisa cuando algo se atrasa.

```
Solicitud recibida → Visita técnica → Análisis de Proyectos → Cotización preparada → Cotización enviada
      → Seguimiento → Aprobada → Enviada a Logística → Programada → En ejecución → Ejecutada
                   ↘ En modificación (el cliente pide cambios) ↗          ↘ Perdida / Cancelada
        (cualquier etapa abierta) ⇄ En espera (con motivo y fecha para retomar)
```

## 1.2 Decisión principal: estándar primero

MTI no tiene departamento de TI. Por eso la regla de diseño fue:

> **Todo lo que Frappe ya trae se usa tal cual; lo propio se limita a configuración y a una página web.**

| Necesidad de MTI | Cómo se resolvió | Tipo |
|---|---|---|
| Registrar ofertas con su historial | **CRM Deal** (Negocio) de Frappe CRM | Estándar |
| Clientes y contactos | **CRM Organization** y **Contact** | Estándar |
| Equipos y valores de cada oferta | Tabla **Productos** del negocio (`CRM Products`) | Estándar |
| Elegir qué servicios cotizados van en la oferta final | Casilla `mti_incluir` en cada línea de Productos | Configuración |
| Texto de la oferta al cliente ajustado a mano | Campo `mti_oferta_html` de la oferta (HTML ya limpio) | Configuración |
| Catálogo de equipos | **CRM Product** | Estándar |
| Etapas con color | **CRM Deal Status** | Estándar (datos) |
| Pasar la oferta de un área a otra, semáforo y recordatorios | **Automation Flow** (Automatizaciones de Frappe 16) | Estándar (datos) |
| Notas de seguimiento, adjuntos, quién cambió qué | Comentarios, archivos y registro de versiones de Frappe | Estándar |
| Datos propios de MTI (código de oferta, checklist, logística…) | **Custom Fields** sobre los doctypes estándar | Configuración |
| Reglas del semáforo, responsables, cláusulas | Doctype propio **MTI Configuracion** (single) | Configuración |
| Lista de trabajos de una oferta | Doctype tabla **MTI Trabajo** | Configuración |
| Desglose del precio al terminar el trabajo | Doctype tabla **MTI Desglose** | Configuración |
| Horas/días adicionales y otros cobros del servicio | Doctype tabla **MTI Adicional** | Configuración |
| Personal y servicios | Doctype **MTI Catalogo** | Configuración |
| Pantallas de trabajo que pidió MTI | **Web Page** `/mti` (HTML + JavaScript + CSS) | Configuración |

**Lo que no hay a propósito:**
- No hay una app de Frappe propia (nada que instalar con `bench get-app`).
- No hay *Server Scripts* (los planes compartidos de Frappe Cloud no los permiten y son código que alguien
  debería mantener).
- No hay cambios en el código de Frappe ni de Frappe CRM.

Consecuencia: Frappe Cloud puede actualizar Frappe y Frappe CRM sin que nada propio se rompa, y cualquier
integrador de Frappe entiende el sistema mirando la configuración.

## 1.3 Componentes

```
┌──────────────────────────────── Navegador del usuario ─────────────────────────────────┐
│                                                                                       │
│   /mti  (pantallas MTI)                       /crm  (Frappe CRM estándar)   /app       │
│   mti_app.js + mti_app.css                    respaldo, correo, listas      escritorio │
│   ├─ Tablero, Pipeline, Ficha, Visitas…        "Tablero MTI", "Pipeline MTI" Frappe     │
│   └─ reglas de negocio de la oferta                                                    │
│                 │  fetch()  /api/resource/…  /api/method/…  (sesión + token CSRF)      │
└─────────────────┼──────────────────────────────────────────────────────────────────────┘
                  ▼
┌──────────────────────────────── Sitio Frappe (Frappe Cloud) ───────────────────────────┐
│  Frappe Framework 16  +  Frappe CRM                                                     │
│  ├─ Permisos por rol (Sales Manager, perfiles MTI)                                      │
│  ├─ Doctypes estándar: CRM Deal, CRM Products, CRM Product, CRM Organization, Contact,  │
│  │                     CRM Task, Comment, File, Version                                 │
│  ├─ Configuración MTI: Custom Fields, CRM Deal Status, MTI Configuracion, MTI Trabajo,   │
│  │                     MTI Desglose, MTI Adicional, MTI Catalogo, CRM Fields Layout,    │
│  │                     CRM View Settings, Web Page /mti                                 │
│  ├─ Automation Flow (13 "MTI · …")  ← corre en el servidor (al guardar y cada hora)     │
│  └─ MariaDB · archivos · copias de seguridad                                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
                  ▲
                  │  misma API REST, con la cuenta de administrador
     mti_instalar.py  (se ejecuta una vez y cada vez que se publica un cambio)
```

### 1.3.1 Pantallas `/mti` (cliente)

Es una **Web Page** de Frappe con un `<div id="mti-app">` y el JavaScript de `mti_app.js`. Al cargar:

1. Pregunta quién es el usuario y sus roles (`frappe.core.doctype.user.user.get_current_user_roles`).
2. Descarga en paralelo ofertas, líneas, trabajos, clientes, catálogos, tareas, comentarios y la
   configuración (≈15 llamadas a la API estándar). **No descarga todo el historial** (ver 1.3.4).
3. Dibuja la pestaña que corresponde al perfil (Comercial → Tablero, Logística → Programación,
   Gerencia → Históricos).

Cada botón (Enviar, Aprobada, Programar…) llama a `ejecutar(accion, datos)`, que lee la oferta, aplica la
regla de negocio, recalcula los campos derivados y la guarda con `PUT /api/resource/CRM Deal/<nombre>`.
Después **solo vuelve a leer esa oferta** (no toda la lista), así cada acción cuesta lo mismo aunque haya
miles de ofertas.

**Cambios en vivo:** mientras la pestaña está visible, cada 30 s `/mti` pregunta a Frappe qué ofertas y
tareas cambiaron desde la última vez (`modified >` la última marca, dos consultas de unos bytes) y relee
solo esas. Así las alertas, el Tablero y el contador se actualizan sin recargar. Cada 30 minutos hace una
recarga completa silenciosa (para ofertas eliminadas, clientes, catálogos y notas). Se eligió consultar
cada 30 segundos en vez del canal de tiempo real de Frappe (socket.io) porque funciona igual en cualquier plan
y no depende de piezas internas del escritorio de Frappe.

Las alertas de `/mti` se calculan con la etapa y las fechas de cada oferta, **no** con las tareas que crean
las automatizaciones; por eso un cambio de etapa le llega a la otra área en ≤ 30 s aunque la tarea del CRM
tarde unos minutos en el plan de USD 5.

### 1.3.2 Frappe (servidor)

- **Guarda** todo y **aplica los permisos** de cada rol.
- **Automatizaciones**: cuando una oferta cambia de etapa crea la tarea del área siguiente; cada hora revisa
  fechas (envío, próximo contacto, visita, servicio) para cambiar el semáforo y crear recordatorios.
- Lleva el **historial** de cada cambio (Version) y los comentarios.

### 1.3.3 Instalador (`mti_instalar.py`)

Script de Python sin dependencias que deja un sitio Frappe CRM recién creado convertido en el sistema de MTI.
Habla con el sitio por la misma API REST que usa el navegador. Es **idempotente**: se puede ejecutar varias
veces, actualiza lo que existe y crea lo que falta.

### 1.3.4 Volumen: preparado para ~1.500 ofertas por año

MTI estima unas 1.500 ofertas al año. Para que `/mti` no se vuelva lento ni consuma el cómputo del plan,
la carga es por ventana de tiempo:

| Qué se carga al abrir `/mti` | Detalle |
|---|---|
| Ofertas abiertas | Todas, sin importar la fecha |
| Ofertas cerradas (Ejecutada, Perdida, Cancelada) | Las creadas desde el **1 de enero del año anterior** |
| Líneas, trabajos, desglose, adicionales, historial de etapas | Solo de las ofertas cargadas, en lotes de 300 |
| Última nota de cada oferta (Tablero) | Comentarios de los últimos **120 días** |
| Años anteriores | Se cargan **al elegirlos** en Históricos, Tablero o Buscar ("Buscar también en años anteriores") |

La ficha de una oferta siempre se abre completa (todos sus comentarios y adjuntos), sea del año que sea.

Prueba hecha con el simulador: al guardar una oferta se transfieren ≈26 KB, contra ≈209 KB de la recarga
completa con 62 ofertas; la diferencia crece con los años.

## 1.4 Dónde están las reglas de negocio

| Regla | Dónde se ejecuta | Por qué |
|---|---|---|
| Totales (solo de los servicios **seleccionados**), equipos de la oferta, máximos de altura/radio/peso | `/mti` al guardar (`derivar`) | Sin Server Scripts no hay "antes de guardar" en el servidor |
| Qué servicios van en la oferta al cliente | `/mti` (casilla por línea, hasta que se aprueba) | El total con todo lo cotizado es solo para Comercial |
| Texto de la oferta impresa | Plantilla en `/mti`; si Comercial la edita, se guarda limpio en `mti_oferta_html` | El documento al cliente no lleva totales |
| Código de oferta `40491` / `40491.1` | `/mti` al guardar | Ídem |
| Fecha de envío, próximo contacto y vigencia al enviar | `/mti` | Ídem |
| Responsable de Proyectos/Logística por defecto | `/mti` (toma `MTI Configuracion`) | Ídem |
| Checklist completo para pasar a Proyectos | `/mti` | Ídem |
| Semáforo (cálculo para mostrar) | `/mti` al cargar | Siempre actualizado en pantalla |
| Semáforo (valor guardado) | Automatizaciones (cada hora) | Para que `/crm` y los reportes lo vean |
| Tareas de traspaso entre áreas | Automatizaciones (al cambiar etapa) | Corren en el servidor aunque nadie tenga `/mti` abierto |
| Recordatorios por fecha | Automatizaciones (cada hora) | Ídem |
| Alertas por área (Comercial, Proyectos, Logística) | `/mti` al cargar (`construirAlertas`) | Se calculan con los datos del momento, incluidos los días que lleva cada oferta en su etapa |
| Compresión de fotos | `/mti`, en el navegador, antes de subir | Ahorra disco del plan sin depender de servicios externos |
| Quién puede ver/editar | Frappe (rol **Sales Manager**) + `/mti` (perfil MTI) | Ver 1.5 |

**Consecuencia práctica:** las ofertas se deben trabajar desde `/mti`. Si alguien edita una oferta
directamente en `/crm`, los datos se guardan, pero los campos calculados (código, totales, equipos,
máximos) se recalculan la próxima vez que se guarde desde `/mti`.

## 1.5 Seguridad y permisos

Hay dos capas:

1. **Frappe (servidor)**: todos los usuarios de MTI tienen el rol estándar **Sales Manager**. En Frappe CRM
   un *Sales User* solo ve los negocios que creó; en MTI todas las áreas necesitan ver todas las ofertas.
   Solo el administrador tiene **System Manager**.
2. **`/mti` (pantallas)**: el **perfil MTI** (`MTI Comercial`, `MTI Proyectos`, `MTI Logística`,
   `MTI Gerencia`) decide qué pestañas y botones ve cada uno y qué acciones puede ejecutar
   (tabla `PERMISOS` en `mti_app.js`). Gerencia es de solo consulta. Proyectos y Gerencia ven todas las
   vistas; Comercial y Logística no ven **Históricos** ni pueden **exportar clientes** (esto último también
   está bloqueado en el servidor: sin permiso *Export* sobre clientes y contactos).
3. **Cotización fijada**: desde *Aprobada*, equipos, valores, condiciones y la **selección de servicios**
   no se pueden modificar; lo que cambie en la ejecución se registra como adicional.
4. **Eliminar ofertas y clientes**: solo System Manager (`esAdmin()`), con confirmación escrita. Un cliente
   solo se puede eliminar si no tiene ofertas (Frappe además lo impide por los enlaces). Lo eliminado se
   recupera en `/app/deleted-document`.

> La capa 2 es de **interfaz**: ordena el trabajo y evita errores, pero un usuario con Sales Manager que
> entre a `/crm` puede editar cualquier oferta. Para un equipo de 4–5 personas de confianza es el balance
> buscado entre control y simplicidad. Si en el futuro se necesitara un control estricto en el servidor,
> se hace con **Permisos de rol** estándar de Frappe (`/app/permission-manager`), sin programar.

Otros puntos:
- El acceso es con usuario y clave; la sesión es la estándar de Frappe (cookie + token CSRF).
- Todo el tráfico va por HTTPS (certificado automático de Frappe Cloud).
- Las claves nunca se guardan en el código ni en el repositorio.
- El texto editado de la oferta se limpia en el navegador antes de guardarlo (sin scripts, eventos ni
  enlaces peligrosos) y el logo se guarda como una referencia (`{{MTI_LOGO}}`), no como imagen.

## 1.6 Entornos

| Entorno | Para qué | Dónde |
|---|---|---|
| **Producción** | Uso real de MTI | Frappe Cloud · `https://mtigruas.v.frappe.cloud/mti` · Frappe 16 + CRM · plan compartido |
| **Local** | Probar cambios, demostraciones | Docker en el computador (`docker-compose.yml`), con 61 ofertas de ejemplo |

Ambos se configuran con el mismo instalador; la única diferencia es la dirección y la clave.

## 1.7 Versiones

| Pieza | Versión |
|---|---|
| Frappe Framework | 16 (rama `version-16`) |
| Frappe CRM | v1.92.0 en local; la que Frappe Cloud mantenga actualizada en producción |
| Python (local) | 3.14 |
| MariaDB (local) | 10.11 |

Las **Automatizaciones** (`Automation Flow`) existen desde Frappe 16: el sistema no funciona en Frappe 15.

## 1.8 De qué depende `/mti` (para las actualizaciones)

`/mti` no tiene código en el servidor, así que las actualizaciones automáticas de Frappe Cloud no la
"desinstalan". Lo que sí puede pasar es que una actualización cambie algo de lo que `/mti` lee:

| Dependencia | Estabilidad | Si cambia |
|---|---|---|
| API REST general (`/api/resource`, `frappe.client.get_list`, `getdoc`, `add_comment`) | Muy estable: es la base de todo Frappe | Muy improbable |
| Campos estándar de Frappe CRM (`CRM Deal`, `CRM Products`, `status_change_log`, `deal_value`…) | Estable, pero el CRM es un producto joven | Ajuste puntual en `mti_app.js` |
| `crm.api.session.get_users` (lista de usuarios) | Interna del CRM | `/mti` sigue funcionando; solo se ven correos en vez de nombres |
| `Automation Flow` (nuevo en Frappe 16) | Puede evolucionar | Ajuste en `mti_instalar.py` |

Mantenimiento esperado: **bajo** (pocas horas al año), concentrado después de actualizaciones grandes. Ver
[04](04-despliegue-y-mantenimiento.md#45-actualizaciones).
