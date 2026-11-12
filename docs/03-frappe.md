# 3. Configuración de Frappe

> Inventario completo de **lo que el instalador deja configurado en Frappe** y dónde verlo o cambiarlo
> desde la interfaz. Todo lo de este documento es configuración estándar: se ve y se edita en el
> escritorio de Frappe (`/app`) sin tocar código.

Rutas útiles (cambiar `mtigruas.v.frappe.cloud` por la dirección del sitio):

| Qué | Dónde |
|---|---|
| Pantallas MTI | `/mti` |
| Frappe CRM | `/crm` |
| Escritorio de Frappe | `/app` |
| Usuarios | `/app/user` |
| Configuración MTI | `/app/mti-configuracion` |
| Automatizaciones | `/app/automation-flow` |
| Etapas | `/app/crm-deal-status` |
| Campos personalizados | `/app/custom-field?dt=CRM%20Deal` |
| Personalizar formulario | `/app/customize-form` |
| Página `/mti` | `/app/web-page` → "MTI · Ofertas" |
| Importar datos | `/app/data-import` (o `/crm/data-import`) |
| Registro de errores | `/app/error-log` |
| Ejecuciones de automatizaciones | `/app/automation-run` |
| Documentos eliminados (restaurar) | `/app/deleted-document` |
| Descargar copias de seguridad | `/app/backups` |
| Cola de correos | `/app/email-queue` |

---

## 3.1 Doctypes estándar que usa el sistema

| Doctype | Qué representa en MTI | Se ve en |
|---|---|---|
| **CRM Deal** (Negocio) | Una **oferta** | `/mti` (Tablero, ficha), `/crm/deals` |
| **CRM Products** (tabla del negocio) | Cada **línea** de la oferta: equipo, modalidad, cantidad, valor y su programación | Ficha de la oferta |
| **CRM Product** | **Equipo** del catálogo (Grúa 50 t, Cama baja…) | `/mti` → Catálogos → Equipos, `/app/crm-product` |
| **CRM Organization** | **Cliente** | `/mti` → Clientes, `/crm/organizations` |
| **Contact** | Persona de contacto del cliente | `/crm/contacts` |
| **CRM Task** | **Tarea** asignada (traspasos y recordatorios) | `/mti` → Alertas, `/crm/tasks` |
| **CRM Deal Status** | **Etapa** del flujo | `/app/crm-deal-status` |
| **CRM Lead Source** | Canal de entrada (WhatsApp, Correo…) | `/app/crm-lead-source` |
| **CRM Lost Reason** | Motivo de pérdida | `/app/crm-lost-reason` |
| **Comment** | Notas de seguimiento (`[Llamada] …`, `[Logística] …`) | Ficha → historial |
| **File** | Fotos de la visita y adjuntos | Ficha → adjuntos |
| **Automation Flow** | Automatizaciones | `/app/automation-flow` |
| **Web Page** | La página `/mti` | `/app/web-page` |

## 3.2 Doctypes propios de MTI

Son doctypes "personalizados" (creados desde la interfaz, `custom = 1`): viven en la base de datos, no en
una app. Se ven en `/app/doctype` filtrando por "MTI".

### MTI Configuracion (documento único)

`/app/mti-configuracion`. Lo leen las pantallas `/mti` cada vez que cargan.

| Sección | Campo | Para qué | Por defecto |
|---|---|---|---|
| Reglas del semáforo | `verde_hasta` | Días desde el envío en verde | 2 |
| | `amarillo_hasta` | Hasta cuántos días amarillo (después, rojo) | 4 |
| | `dias_proximo_contacto` | Próximo contacto al enviar | 3 |
| | `dias_vigencia` | Vigencia de la oferta | 15 |
| Avisos | `avisar_app`, `avisar_correo`, `avisar_whatsapp`, `resumen_diario`, `hora_resumen` | **Sin uso** (reservados para cuando se conecte el correo; ya no aparecen en `/mti`) | 1, 1, 0, 1, 7:30 |
| Responsables por área | `proyectos_default` | Usuario que recibe las tareas de Proyectos | — |
| | `logistica_default` | Usuario que recibe las tareas de Logística | — |
| Formato de la oferta | `empresa_nombre`, `empresa_nit`, `formato_codigo` | Encabezado de la oferta impresa | Datos de MTI |
| | `clausula_primero`, `clausulas_finales`, `pie_pagina` | Texto legal y pie de la oferta impresa | Texto de MTI |

### MTI Trabajo (tabla)

Filas de la tabla **Trabajos** de cada oferta (`mti_trabajos`): `descripcion`, `equipo`, `altura` (m),
`radio` (m), `peso` (t), `especificaciones`. De aquí salen los máximos de la oferta y la búsqueda técnica.

### MTI Desglose (tabla)

Filas de la tabla **Desglose del precio** (`mti_desglose`) de un trabajo en ejecución o ejecutado:
`concepto` (equipo o concepto: Grúa 50 t, Cama baja, Transporte…), `valor`, `nota`. MTI cotiza con un precio
unificado; al terminar el trabajo se reparte ese valor y los **Históricos → Por equipo** usan este
desglose (los trabajos sin desglose siguen usando los valores de la oferta).

### MTI Adicional (tabla)

Filas de **Adicionales del servicio** (`mti_adicionales`): `linea` (equipo o concepto), `tipo` (Horas, Días,
Semanas, Quincenas o Meses adicionales, o Cobro adicional), `cantidad`, `valor_unitario`, `valor`,
`descripcion` (motivo). Su suma va a `mti_valor_adicionales` y `mti_valor_final` = valor aprobado +
adicionales, que es el valor que usan los Históricos.

### MTI Catalogo

Personal y servicios. Campos: `tipo` (Personal / Servicio), `nombre`, `categoria` (cargo), `activo`.
"Quitar" en `/mti` lo marca inactivo: no se borra, para no dañar el historial.

**Exportación de clientes:** el instalador quita el permiso **Export** de *CRM Organization* y *Contact*
a los roles Sales Manager y Sales User (`/app/permission-manager`). Así Comercial y Logística no pueden
descargar la base de clientes desde el CRM; Proyectos y Gerencia la exportan desde `/mti` → Clientes, y
el administrador (System Manager) conserva todos los permisos.

**Permisos de los doctypes propios:** System Manager, Sales Manager y Sales User pueden leer y escribir;
MTI Gerencia solo leer.

## 3.3 Campos personalizados (Custom Fields)

Todos empiezan por `mti_`. Se ven y se pueden ajustar (etiqueta, obligatorio, oculto…) en
`/app/customize-form`. **No borrar** un campo que use `/mti`.

### En la oferta (CRM Deal) — pestaña "MTI"

| Campo (`fieldname`) | Tipo | Etiqueta | Notas |
|---|---|---|---|
| **MTI** | *Tab Break* | | |
| **Oferta mercantil** | *Section Break* | | |
| `mti_codigo` | Data | Oferta No. | solo lectura (calculado) |
| `mti_version` | Int | Versión | por defecto 0; solo lectura (calculado) |
| `mti_servicio` | Data | Servicio |  |
| `mti_ubicacion` | Data | Lugar de prestación del servicio |  |
| `mti_equipo` | Data | Equipos de la oferta | solo lectura (calculado) |
| `mti_vigencia` | Date | Vigencia de la oferta |  |
| **Trabajo a ejecutar** | *Section Break* | | |
| `mti_trabajos` | Table | Trabajos | → MTI Trabajo |
| `mti_altura` | Float | Altura máxima (m) | solo lectura (calculado) |
| `mti_radio` | Float | Radio máximo (m) | solo lectura (calculado) |
| `mti_peso` | Float | Peso máximo (t) | solo lectura (calculado) |
| `mti_restricciones` | Small Text | Restricciones del sitio |  |
| `mti_observaciones` | Small Text | Observaciones técnicas |  |
| `mti_diagrama` | Attach | Diagrama de izaje (Compu Crane) |  |
| **Visita técnica** | *Section Break* | | |
| `mti_requiere_visita` | Check | Requiere visita técnica | por defecto 1 |
| `mti_estado_visita` | Select | Estado de la visita | opciones: Por agendar / Programada / Pendiente de información / Realizada / No requerida |
| `mti_fecha_visita` | Datetime | Fecha de la visita |  |
| `mti_tecnico` | Data | Técnico que realiza la visita |  |
| `mti_recordar_visita` | Check | Recordarme 1 día antes | por defecto 1 |
| `mti_avisar_tecnico` | Check | Avisar al técnico | por defecto 1 · sin uso (ya no aparece en `/mti`) |
| `mti_chk_ubicacion` | Check | ✔ Ubicación / acceso |  |
| `mti_chk_altura` | Check | ✔ Altura de izaje |  |
| `mti_chk_radio` | Check | ✔ Radio de operación |  |
| `mti_chk_peso` | Check | ✔ Peso de la carga |  |
| `mti_chk_restricciones` | Check | ✔ Restricciones del sitio |  |
| `mti_chk_fotos` | Check | ✔ Fotos |  |
| **Renegociación** | *Section Break* | | |
| `mti_tipo_ajuste` | Select | Tipo de ajuste | opciones: Comercial / Técnico |
| `mti_motivo_ajuste` | Small Text | Qué pidió el cliente |  |
| `mti_versiones` | Long Text | Versiones anteriores (JSON) | oculto; cada línea guarda también si estaba incluida |
| **Oferta al cliente (v3.1)** | | | |
| `mti_oferta_html` | Long Text | Texto editado de la oferta al cliente | oculto; *Ignore XSS Filter* (se limpia en `/mti` antes de guardar); vacío = se usa la plantilla |
| `mti_oferta_base` | Data | Huella de la plantilla editada | oculto; si los datos cambian después de editar, `/mti` avisa |
| `mti_oferta_editada` | Datetime | Texto de la oferta editado el | solo lectura |
| `mti_oferta_editor` | Link | Texto de la oferta editado por | → User; solo lectura |
| **Logística** | *Section Break* | | |
| `mti_fecha_solicitada` | Date | Fecha solicitada por el cliente |  |
| `mti_hora_solicitada` | Data | Hora solicitada |  |
| `mti_contacto_sitio` | Data | Contacto en sitio |  |
| `mti_tel_sitio` | Data | Teléfono en sitio |  |
| `mti_notas_logistica` | Small Text | Notas para Logística |  |
| `mti_fecha_servicio` | Date | Inicio programado del servicio | solo lectura (calculado) |
| `mti_reprogramaciones` | Int | Reprogramaciones | solo lectura (calculado) |
| `mti_fecha_ejecucion` | Date | Fecha de ejecución |  |
| **Adicionales y valor final** | *Section Break* | | |
| `mti_adicionales` | Table | Adicionales del servicio | → MTI Adicional |
| `mti_valor_adicionales` | Currency | Total adicionales | solo lectura (calculado) |
| `mti_valor_final` | Currency | Valor final consolidado | solo lectura (calculado) |
| **Reporte diario y calificación del cliente** | *Section Break* | | |
| `mti_reporte_diario` | Data | N.º reporte diario |  |
| `mti_recibido_por` | Data | Vo. Bo. recibido por |  |
| `mti_reporte_foto` | Attach | Foto del reporte firmado |  |
| `mti_obs_cliente` | Small Text | Comentario del cliente |  |
| `mti_cal_calidad` | Select | Calidad del servicio prestado | opciones: NA / 10 / 9 / 8 / 7 / 6 / 5 / 4 / 3 / 2 / 1 |
| `mti_cal_personal` | Select | Desempeño del personal de MTI | opciones: NA / 10 / 9 / 8 / 7 / 6 / 5 / 4 / 3 / 2 / 1 |
| `mti_cal_maquinaria` | Select | Maquinaria enviada | opciones: NA / 10 / 9 / 8 / 7 / 6 / 5 / 4 / 3 / 2 / 1 |
| `mti_cal_puntualidad` | Select | Puntualidad en el servicio | opciones: NA / 10 / 9 / 8 / 7 / 6 / 5 / 4 / 3 / 2 / 1 |
| `mti_cal_promedio` | Float | Calificación promedio | solo lectura (calculado) |
| **Desglose del precio (históricos)** | *Section Break* | | |
| `mti_desglose` | Table | Desglose del precio | → MTI Desglose |
| **En espera** | *Section Break* | | |
| `mti_estado_previo` | Data | Etapa antes de la espera | solo lectura (calculado) |
| `mti_fecha_espera` | Date | En espera desde | solo lectura (calculado) |
| `mti_motivo_espera` | Small Text | Motivo de la espera |  |
| `mti_retomar_el` | Date | Retomar el |  |
| **Seguimiento** | *Section Break* | | |
| `mti_resp_proyectos` | Link | Responsable de Proyectos | → User |
| `mti_resp_logistica` | Link | Responsable de Logística | → User |
| `mti_aprobo_envio` | Link | Envió la oferta | → User; solo lectura (calculado) |
| `mti_semaforo` | Select | Semáforo | opciones: 🟢 Verde / 🟡 Amarillo / 🔴 Rojo / ⚪ Sin enviar |
| `mti_fecha_envio` | Date | Fecha de envío |  |
| `mti_ultimo_contacto` | Date | Último contacto |  |
| `mti_proximo_contacto` | Date | Próximo contacto |  |

Además se usan campos estándar del negocio: `organization` (cliente), `status` (etapa), `deal_owner`
(comercial dueño), `deal_value` (valor), `source` (canal), `lost_reason`, `lost_notes`, `currency`.

**`deal_value`, `total` y `net_total` = suma de las líneas seleccionadas** (`mti_incluir` = 1). Es el valor
comercial de la oferta: se ve en la ficha, el Tablero, el Pipeline y los Históricos, pero **no se imprime**
en la oferta al cliente.

**Numeración:** la serie de nombres de CRM Deal es `OF-.#####` (Property Setter). Empezó en **OF-40448**
(la siguiente a la última oferta en papel, 40447) y desde noviembre de 2026 las ofertas nuevas siguen desde
la **OF-40513** (`PRIMERA_OFERTA` en el instalador). El contador se ve y se ajusta en
`/app/document-naming-settings` (prefijo `OF-.#####`); nunca debe bajarse, para no repetir números. `mti_codigo` muestra el número sin `OF-`, con
`.1`, `.2`… cuando se renegocia.

### En cada línea de la oferta (CRM Products)

Estándar: `product_code` (equipo), `product_name`, `qty` (cantidad), `rate`, `amount` (valor total).

| Campo (`fieldname`) | Tipo | Etiqueta | Notas |
|---|---|---|---|
| `mti_tipo` | Select | Tipo de línea | opciones: Equipo / Transporte / Otro; por defecto Equipo |
| `mti_descripcion` | Data | Descripción MTI |  |
| `mti_modalidad` | Select | Modalidad | opciones: Hora / Día / Semana / Quincena / Mes / Global; por defecto Día |
| `mti_horas_jornada` | Int | Horas por jornada | por defecto 10 |
| `mti_jornada` | Select | Jornada | opciones: Diurna / Nocturna / Mixta / 24 horas; por defecto Diurna |
| `mti_movilizacion` | Check | Incluye movilización | por defecto 1 |
| `mti_valor_adicional` | Currency | Valor unidad adicional | → currency |
| `mti_incluir` | Check | Incluir en la oferta al cliente | por defecto 1 (las líneas existentes quedan incluidas); 0 = alternativa cotizada que no va en la oferta final |
| **Programación (Logística)** | *Section Break* | | |
| `mti_prog_desde` | Date | Programado desde |  |
| `mti_prog_hasta` | Date | Programado hasta |  |
| `mti_prog_hora_inicio` | Data | Hora de inicio |  |
| `mti_prog_hora_fin` | Data | Hora de fin |  |
| `mti_prog_dias` | Select | Frecuencia | opciones: Lunes a viernes / Lunes a sábado / Todos los días |
| `mti_prog_operador` | Data | Operador asignado |  |
| `mti_prog_notas` | Small Text | Notas de programación |  |

### En el equipo (CRM Product)

| Campo (`fieldname`) | Tipo | Etiqueta | Notas |
|---|---|---|---|
| `mti_categoria` | Select | Categoría MTI | opciones: Grúa / Transporte / Otro; por defecto Grúa |
| `mti_capacidad` | Float | Capacidad (t) |  |

### En el cliente (CRM Organization)

| Campo (`fieldname`) | Tipo | Etiqueta | Notas |
|---|---|---|---|
| **Datos del cliente (MTI)** | *Section Break* | | |
| `mti_nit` | Data | NIT |  |
| `mti_direccion` | Data | Dirección |  |
| `mti_contacto` | Data | Contacto principal |  |
| `mti_telefono` | Data | Teléfono |  |
| `mti_email` | Data | Correo |  |

## 3.4 Etapas (CRM Deal Status)

| # | Etapa | Color | Tipo | Probabilidad | Quién la mueve |
|---|---|---|---|---|---|
| 1 | Solicitud recibida | gris | Open | 5 % | Comercial (al crear) |
| 2 | Visita técnica | naranja | Ongoing | 15 % | Comercial (agendar visita) |
| 3 | Análisis de Proyectos | azul | Ongoing | 30 % | Checklist completo o "sin visita" |
| 4 | Cotización preparada | cian | Ongoing | 45 % | Proyectos (análisis terminado) |
| 5 | Cotización enviada | ámbar | Ongoing | 55 % | Comercial (enviar) |
| 6 | Seguimiento | amarillo | Ongoing | 65 % | Primer seguimiento registrado |
| 7 | En modificación | morado | Ongoing | 60 % | "Cliente pide cambios" |
| 8 | Aprobada | verde | Won | 100 % | Comercial |
| 9 | Enviada a Logística | verde azulado | Won | 100 % | Comercial |
| 10 | Programada | violeta | Won | 100 % | Logística (programar) |
| 11 | En ejecución | rosado | Won | 100 % | Logística (iniciar) |
| 12 | Ejecutada | negro | Won | 100 % | Logística (ejecutar) |
| 13 | **En espera** | gris (azul en `/mti`) | On Hold | 30 % | Comercial, Proyectos o Logística, con motivo; "Reanudar" la devuelve a la etapa en que estaba |
| 14 | Perdida | rojo | Lost | 0 % | Comercial, con motivo |
| 15 | Cancelada | gris | Lost | 0 % | Logística o Comercial, con motivo |

> Cambiar el **nombre** de una etapa rompe las pantallas y las automatizaciones (lo buscan por nombre).
> Cambiar el **color** o la **probabilidad** sí se puede desde `/app/crm-deal-status`.

## 3.5 Automatizaciones (Automation Flow)

Son la parte "automática" del sistema y corren en el servidor de Frappe:
- Las de **cambio de etapa** se disparan al guardar la oferta.
- Las **por fecha** se revisan **cada hora**; cada una actúa una sola vez por oferta y día.
- Todas corren como el usuario `Administrator` ("Automation User") para poder asignar tareas a cualquiera.
- Las de fecha tienen **Revalidate on Run**: si la oferta ya cambió de etapa, no hacen nada.

| # | Título | Disparo | Filtros / condición | Acción |
|---|---|---|---|---|
| 1 | MTI · Traspaso a Proyectos | La etapa cambia a **Análisis de Proyectos** | — | Tarea «Definir solución técnica · [código]» para `mti_resp_proyectos` |
| 2 | MTI · Proyectos terminó: formalizar y enviar | La etapa cambia a **Cotización preparada** | — | Tarea «Formalizar y enviar · [código]» para `deal_owner` |
| 3 | MTI · Ajuste técnico pedido por el cliente | La etapa cambia a **En modificación** | `doc.mti_tipo_ajuste == "Técnico"` | Tarea «Ajuste técnico · [código]» para `mti_resp_proyectos` |
| 4 | MTI · Renegociación comercial | La etapa cambia a **En modificación** | `doc.mti_tipo_ajuste != "Técnico"` | Tarea «Ajustar y reenviar · [código]» para `deal_owner` |
| 5 | MTI · Aprobada: enviar a Logística | La etapa cambia a **Aprobada** | — | Tarea «Enviar a Logística · [código]» para `deal_owner` |
| 6 | MTI · Traspaso a Logística | La etapa cambia a **Enviada a Logística** | — | Tarea «Programar servicio · [código]» para `mti_resp_logistica` |
| 7 | MTI · Semáforo amarillo | 3 día(s) después de `mti_fecha_envio` (revisión cada hora) | `status` in Cotización enviada, Seguimiento | Semáforo → 🟡 Amarillo |
| 8 | MTI · Semáforo rojo: sin respuesta | 5 día(s) después de `mti_fecha_envio` (revisión cada hora) | `status` in Cotización enviada, Seguimiento | Semáforo → 🔴 Rojo + Tarea «Sin respuesta · [código]» para `deal_owner` |
| 9 | MTI · Contactar hoy | 0 día(s) después de `mti_proximo_contacto` (revisión cada hora) | `status` in Cotización enviada, Seguimiento | Tarea «Seguimiento · [código]» para `deal_owner` |
| 10 | MTI · Contacto vencido | 1 día(s) después de `mti_proximo_contacto` (revisión cada hora) | `status` in Cotización enviada, Seguimiento | Semáforo → 🔴 Rojo |
| 11 | MTI · Confirmar visita de mañana | 1 día(s) antes de `mti_fecha_visita` (revisión cada hora) | `mti_recordar_visita` = 1; `mti_estado_visita` != Realizada | Tarea «Confirmar visita · [código]» para `deal_owner` |
| 12 | MTI · Retomar oferta en espera | 0 día(s) después de `mti_retomar_el` (revisión cada hora) | `status` = En espera | Tarea «Retomar oferta · [código]» para `deal_owner` |
| 13 | MTI · Servicio de mañana | 1 día(s) antes de `mti_fecha_servicio` (revisión cada hora) | `status` = Programada | Tarea «Servicio mañana · [código]» para `mti_resp_logistica` |

Los días de las automatizaciones 7 y 8 salen de `MTI Configuracion` (verde + 1 y amarillo + 1) en el momento de correr el
instalador.

> En el plan de USD 5 de Frappe Cloud las tareas en segundo plano corren **cada 10 minutos**: una
> automatización de cambio de etapa puede tardar hasta 10 minutos en crear su tarea del CRM. Las alertas
> de `/mti` **no** esperan esa tarea: se calculan con la etapa y llegan a la otra área en ≤ 30 s.

**Ver si funcionaron:** `/app/automation-run` lista cada ejecución (qué automatización, qué oferta, estado
y el error si lo hubo).

**Pausar una:** abrirla y desmarcar **Enabled** (Habilitado). El instalador respeta esa decisión cuando se vuelve a
ejecutar. **Pausar todas** (por ejemplo, para una carga masiva de datos): `/app/automation-settings` →
**Disable Automations**.

## 3.6 Roles y permisos

| Rol | Tipo | Quién lo tiene | Para qué |
|---|---|---|---|
| System Manager | Estándar | Solo el administrador | Configuración, usuarios, todo |
| **Sales Manager** | Estándar (CRM) | **Todos** los usuarios de MTI | Ver y trabajar todas las ofertas en el CRM |
| Sales User | Estándar (CRM) | Nadie (no hace falta) | Solo vería sus propias ofertas |
| MTI Comercial | Propio | Cotizaciones | Botones comerciales en `/mti` |
| MTI Proyectos | Propio | Dirección de Proyectos | Análisis técnico en `/mti` |
| MTI Logística | Propio | Logística | Programación en `/mti` |
| MTI Gerencia | Propio | Gerencia | Consulta en `/mti` (solo lectura) |

Los 4 roles MTI tienen como **página de inicio** `/mti`: al iniciar sesión, el usuario llega directo a
sus pantallas.

## 3.7 Formularios y vistas del CRM estándar (`/crm`)

El instalador también deja ordenado el CRM estándar, para usarlo como respaldo:

- **Ficha del negocio** (`CRM Fields Layout`):
  - *Panel lateral*: Contactos, Oferta (código, cliente, servicio, equipos, lugar, valor, canal),
    Seguimiento (semáforo, envío, vigencia, último y próximo contacto), Responsables y Logística.
  - *Campos*: Trabajo a ejecutar, Trabajos, Visita técnica (con el checklist), Logística, Desglose del
    precio y En espera / motivo.
  - *Alta rápida*: etapa, servicio, canal, lugar y "requiere visita".
- **Alta rápida de organización**: nombre, NIT, dirección, contacto, teléfono y correo.
- **Vistas públicas** en Deals: **Tablero MTI** (lista con semáforo, oferta, cliente, servicio, equipos,
  valor, etapa, próximo contacto) y **Pipeline MTI** (kanban por etapa).

## 3.8 Página `/mti` (Web Page)

| Campo de la Web Page | Valor |
|---|---|
| Título / ruta | "MTI · Ofertas" / `mti` |
| Publicada | Sí, ancho completo, sin título |
| Contenido | `<div id="mti-app">` |
| JavaScript | Contenido completo de `mti_app.js` |
| CSS | Contenido completo de `mti_app.css` |

El JavaScript publicado ronda los 285 KB (≈3.360 líneas) y el CSS los 47 KB.

Se puede ver en `/app/web-page`, pero **no conviene editarla a mano**: el instalador la reemplaza
completa al publicar. Los cambios se hacen en los archivos y se publican con `--solo-pantallas`.

## 3.9 Ajustes generales

| Ajuste | Valor |
|---|---|
| Idioma / zona horaria / moneda | Español / America/Bogota / COP (System Settings) |
| Marca del CRM | "MTI Grúas", logo y favicon de MTI (FCRM Settings) |
| Logo de la pantalla de ingreso | Logo de MTI (Navbar Settings) |
| Página de inicio del sitio | `mti` (Website Settings) |
| Catálogos iniciales | Canales: WhatsApp, Correo, Llamada, Referido. Motivos de pérdida: Precio, Eligió a la competencia, Proyecto cancelado o aplazado, Cliente sin respuesta, Equipo no disponible en la fecha, Servicio cancelado por el cliente |
