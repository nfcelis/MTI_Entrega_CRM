# 1. Arquitectura del sistema

> Documento técnico. Explica **qué piezas tiene el sistema, dónde vive cada una y cómo se comunican**.
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
│  │                     MTI Desglose, MTI Catalogo, CRM Fields Layout, CRM View Settings, Web Page /mti│
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
2. Descarga en paralelo ofertas, líneas, trabajos, clientes, contactos, catálogos, tareas, comentarios y
   la configuración (≈14 llamadas a la API estándar).
3. Dibuja la pestaña que corresponde al perfil (Comercial → Tablero, Logística → Programación,
   Gerencia → Históricos).

Cada botón (Enviar, Aprobada, Programar…) llama a `ejecutar(accion, datos)`, que lee la oferta, aplica la
regla de negocio, recalcula los campos derivados y la guarda con `PUT /api/resource/CRM Deal/<nombre>`.

### 1.3.2 Frappe (servidor)

- **Guarda** todo y **aplica los permisos** de cada rol.
- **Automatizaciones**: cuando una oferta cambia de etapa crea la tarea del área siguiente; cada hora revisa
  fechas (envío, próximo contacto, visita, servicio) para cambiar el semáforo y crear recordatorios.
- Lleva el **historial** de cada cambio (Version) y los comentarios.

### 1.3.3 Instalador (`mti_instalar.py`)

Script de Python sin dependencias que deja un sitio Frappe CRM recién creado convertido en el sistema de MTI.
Habla con el sitio por la misma API REST que usa el navegador. Es **idempotente**: se puede ejecutar varias
veces, actualiza lo que existe y crea lo que falta.

## 1.4 Dónde están las reglas de negocio

| Regla | Dónde se ejecuta | Por qué |
|---|---|---|
| Totales, equipos de la oferta, máximos de altura/radio/peso | `/mti` al guardar (`derivar`) | Sin Server Scripts no hay "antes de guardar" en el servidor |
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
3. **Cotización fijada**: desde *Aprobada*, equipos, valores y condiciones no se pueden modificar; lo que
   cambie en la ejecución se registra como adicional.

> La capa 2 es de **interfaz**: ordena el trabajo y evita errores, pero un usuario con Sales Manager que
> entre a `/crm` puede editar cualquier oferta. Para un equipo de 4–5 personas de confianza es el balance
> buscado entre control y simplicidad. Si en el futuro se necesitara un control estricto en el servidor,
> se hace con **Permisos de rol** estándar de Frappe (`/app/permission-manager`), sin programar.

Otros puntos:
- El acceso es con usuario y clave; la sesión es la estándar de Frappe (cookie + token CSRF).
- Todo el tráfico va por HTTPS (certificado automático de Frappe Cloud).
- Las claves nunca se guardan en el código ni en el repositorio.

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
