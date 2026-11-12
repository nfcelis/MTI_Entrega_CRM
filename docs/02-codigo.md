# 2. Documentación del código

> Para quien vaya a **leer o modificar** el código. Supone conocimientos básicos de JavaScript y Python.
> Actualizado a la **versión final (v3.1)**: ver 2.3.10 a 2.3.13 para lo nuevo.
> Antes de esto conviene leer [01-arquitectura.md](01-arquitectura.md).

## 2.1 Estructura del repositorio

```
mti-gruas-crm/
├── README.md                 Portada: qué es, novedades, cómo se instala y se actualiza, enlaces
├── LICENSE                   Licencia MIT del código de este repositorio
├── .gitignore
│
├── mti_instalar.py           Instalador: configura un sitio Frappe CRM por la API REST (≈850 líneas)
├── mti_app.js                Pantallas /mti: datos, reglas, vistas y eventos (≈3.360 líneas)
├── mti_app.css               Estilos de /mti (≈590 líneas)
├── mti_logo_grande.png       Logo para el CRM y la pantalla de ingreso
├── mti_favicon.png           Icono de la pestaña del navegador
│
├── docker-compose.yml        Entorno local: MariaDB + Redis + Frappe
├── init.sh                   Primer arranque del entorno local (crea el sitio crm.localhost)
├── mti_demo.py               Carga 61 ofertas de demostración (solo local)
│
└── docs/
    ├── 01-arquitectura.md
    ├── 02-codigo.md          (este documento)
    ├── 03-frappe.md          Configuración de Frappe que crea el instalador
    ├── 04-despliegue-y-mantenimiento.md
    ├── 05-manual-de-uso.md
    └── capturas/
```

No hay dependencias que instalar: el instalador usa solo la biblioteca estándar de Python 3 y las
pantallas usan JavaScript del navegador sin frameworks ni librerías externas.

---

## 2.2 Instalador · `mti_instalar.py`

### 2.2.1 Uso

```bash
# Local (desde la carpeta del proyecto, con el entorno Docker encendido)
docker compose exec frappe python3 /workspace/mti_instalar.py --usuarios-demo

# Producción (Frappe Cloud)
docker compose exec frappe python3 /workspace/mti_instalar.py \
    --url https://mtigruas.v.frappe.cloud --usuario 'nacb@mtigruas.com' --clave '…'
```

También se puede ejecutar con cualquier Python 3 instalado en el computador (`python mti_instalar.py …`),
siempre que los archivos `mti_app.js`, `mti_app.css` y los PNG estén en la misma carpeta.

| Opción | Efecto |
|---|---|
| `--url` | Dirección del sitio. Por defecto `http://localhost:8000` |
| `--usuario` | Usuario con rol **System Manager**. Por defecto `Administrator` |
| `--clave` | Clave de ese usuario. Por defecto `admin` (solo sirve en local) |
| `--usuarios-demo` | Crea los 4 usuarios `@mti.demo` con clave `Mti.2026!`. **Nunca en producción** |
| `--sin-catalogo` | No carga los equipos, personal y servicios de ejemplo |
| `--solo-pantallas` | Solo vuelve a publicar `/mti` (JS y CSS). Es lo que se usa para publicar ajustes visuales |

### 2.2.2 Cliente REST (`class Frappe`)

| Método | Llamada | Uso |
|---|---|---|
| `__init__` | `POST /api/method/login` | Inicia sesión y guarda la cookie |
| `metodo(nombre, datos)` | `POST /api/method/<nombre>` | Métodos whitelisted (p. ej. `frappe.client.attach_file`) |
| `existe(dt, nombre)` | `GET /api/resource/<dt>/<nombre>` | `True`/`False` según 200/404 |
| `obtener(dt, nombre)` | `GET /api/resource/<dt>/<nombre>` | Documento completo |
| `lista(dt, campos, filtros, limite)` | `GET /api/resource/<dt>?fields=…&filters=…` | Listas (`limite=0` = todos) |
| `crear` / `actualizar` / `borrar` | `POST` / `PUT` / `DELETE /api/resource/…` | CRUD |
| `guardar(dt, nombre, datos)` | `actualizar` si existe, si no `crear` | Base de la idempotencia |

Los errores de Frappe se convierten en `RuntimeError` con el mensaje del servidor. `main()` los captura y
termina con *"Se detuvo… Se puede volver a ejecutar"*.

> Detalle técnico: los filtros JSON se codifican con `urlencode(..., quote_via=urllib.parse.quote)` para que
> los `+` y espacios no se dañen al viajar en la URL.

### 2.2.3 Pasos de la instalación (en orden)

| # | Función | Qué hace |
|---|---|---|
| 1 | `configurar_sistema` | Idioma `es`, zona `America/Bogota`, moneda `COP` (System Settings, Currency), marca "MTI Grúas" en FCRM Settings, página de inicio del sitio `mti` |
| 2 | `poner_logo` | Sube `mti_logo_grande.png` y `mti_favicon.png` como logo y favicon del CRM (`frappe.client.attach_file`) y pone el logo en *Navbar Settings* (pantalla de ingreso). Si ya están, no los vuelve a subir |
| 3 | `crear_roles` | Roles `MTI Comercial`, `MTI Proyectos`, `MTI Logística`, `MTI Gerencia` |
| 4 | `crear_doctypes` | Doctypes propios `MTI Configuracion` (single), `MTI Trabajo` y `MTI Desglose` (tablas) y `MTI Catalogo`, con sus permisos |
| 5 | `crear_campos` | Custom Fields en `CRM Deal`, `CRM Products`, `CRM Product` y `CRM Organization` (incluidos `mti_incluir` y `mti_oferta_*` de la v3.1); serie `OF-.#####` y consecutivo (`fijar_consecutivo`): la siguiente oferta nueva es la **40513**, o la siguiente a la más alta existente; nunca baja el contador |
| 6 | `crear_estados` | Las 15 etapas (`CRM Deal Status`) con color, tipo y probabilidad; borra las etapas por defecto que no tengan ofertas |
| 7 | `crear_catalogos` | Canales (`CRM Lead Source`), motivos de pérdida, equipos (`CRM Product`), personal y servicios (`MTI Catalogo`) |
| 8 | `crear_usuarios_demo` | Solo con `--usuarios-demo` |
| 9 | `configurar_mti` | Valores por defecto de `MTI Configuracion` y datos de la empresa (solo los campos vacíos: **nunca pisa lo que MTI ya cambió**) |
| 10 | `configurar_formularios` | Distribución de la ficha en `/crm` (`CRM Fields Layout`: panel lateral, campos, alta rápida de negocio y de organización) |
| 11 | `crear_vistas` | Vistas públicas "Tablero MTI" (lista) y "Pipeline MTI" (kanban) en `/crm` |
| 12 | `crear_flujos` | Las 13 Automatizaciones `MTI · …`. Si ya existen las actualiza **respetando si MTI apagó alguna** |
| 13 | `publicar_pantallas` | Crea o actualiza la Web Page `/mti` con `mti_app.js` y `mti_app.css`, y pone `/mti` como página de inicio de los 4 roles MTI |

### 2.2.4 Constantes que se pueden editar

| Constante | Contenido |
|---|---|
| `PRIMERA_OFERTA` | Número desde el que siguen las ofertas nuevas (**40513** desde nov. 2026; antes 40448). Se aplica en cada instalación completa solo si el contador está por debajo; nunca lo baja |
| `ESTADOS` | Etapas: nombre, color, tipo (`Open`/`Ongoing`/`Won`/`Lost`), probabilidad |
| `ROLES_MTI`, `USUARIOS_DEMO` | Perfiles y usuarios de prueba |
| `FUENTES`, `MOTIVOS_PERDIDA` | Canales de entrada y motivos de pérdida |
| `EQUIPOS`, `CATALOGO` | Catálogo inicial (equipos; personal y servicios) |
| `EMPRESA` | Razón social, NIT, código de formato, cláusulas y pie de página de la oferta impresa (valores iniciales: solo se escriben si el campo está vacío) |
| `AJUSTES_TEXTO` | Cambios puntuales de texto que sí se aplican a sitios existentes, solo si encuentran el texto anterior (v3.1: quitar el PBX del pie y agregar "- Únicamente para el movimiento descrito en TRABAJO A EJECUTAR" a la cláusula Primero) |
| `CAMPOS_OFERTA`, `CAMPOS_LINEA`, `CAMPOS_EQUIPO`, `CAMPOS_CLIENTE` | Definición de los Custom Fields (ver [03-frappe.md](03-frappe.md)) |
| `COD`, `RESUMEN` | Plantillas Jinja usadas en el texto de las tareas automáticas |

### 2.2.5 Cómo agregar algo nuevo

**Un campo nuevo en la oferta** (ejemplo: "Orden de compra del cliente"):

1. Agregarlo a `CAMPOS_OFERTA`: `campo("mti_orden_compra", "Data", "Orden de compra")`.
2. Si se va a editar desde `/mti`, agregar `"mti_orden_compra"` a `EDITABLES` y a `CAMPOS_LISTA` en
   `mti_app.js` y dibujarlo en la ficha (`vFicha`).
3. Ejecutar el instalador completo (sin `--solo-pantallas`).

> Alternativa sin código: crearlo en `/app/customize-form` → *CRM Deal*. Queda en el CRM estándar pero
> no aparece en `/mti`.

**Una automatización nueva**: agregar una entrada en `flujos(cfg)` con `_flujo(título, disparo, acciones,
filtros, condicion)`. Disparadores disponibles: `_cambio_etapa("Etapa")` o
`_en_fecha("campo_fecha", días, "Before"|"After")`. Acciones: `("CreateDocument", _tarea(...))` o
`("SetFieldValue", {"field": …, "value": …})`. El título debe empezar por `MTI · `.

> Alternativa sin código: crearla en `/app/automation-flow` (ver [04](04-despliegue-y-mantenimiento.md)).

---

## 2.3 Pantallas · `mti_app.js`

Todo el archivo es una función autoejecutable (`(function () { … })()`) en modo estricto: no deja
variables globales salvo `window.mtiApp` (soporte y pruebas).

### 2.3.1 Mapa del archivo

| Líneas aprox. | Sección | Contenido |
|---|---|---|
| 1–57 | Constantes | Etapas (`PIPE`, `ABIERTAS`, `PRE_ENVIO`, `LOGISTICA`, `GANADAS`, `CERRADAS`, `FIJADAS`), listas de opciones, `CHECKS` del levantamiento, estado `S` |
| 58–156 | Utilidades | Fechas (`parseD`, `ymd`, `addDays`, `diffDays`), formato de dinero, `esc` (escapar HTML), `opts`, `datalist` |
| 157–316 | **Capa de datos** | API estándar de Frappe (`http`, `listar`, `hijosDe`, `leerDoc`…), `PERMISOS`, campos, `filaALinea` / `lineaAFila` |
| 317–475 | **Carga escalable** | `cargarDatos` por ventana de años, `prepararDeal`, `refrescarOferta`, `asegurarAnio`, `cargarOferta` |
| 476–608 | Reglas al guardar | `derivar`, `conOferta`, tareas, versiones |
| 609–985 | **`ejecutar`** | Todas las acciones de negocio (crear, enviar, aprobar, programar, `oferta_texto`, `eliminar_cliente`…) |
| 986–1056 | Orquestación | `window.mtiApp`, `accion` (refresco parcial `PARCIAL`), `refrescar`, `cargar`, `toast`, `modal` |
| 1057–1138 | Alertas | `AREAS`, `areasVisibles`, `construirAlertas` (por área, con `LIMITES`), "Hecho" por usuario |
| 1139–1220 | Marco | Pestañas por perfil (`TABS`), encabezado (`shell`), `render`, router (`ir`) |
| 1221–2616 | **Vistas** | `vTablero`, `vPipeline`, `vFicha` (con `tablaLineas` y la casilla de selección), `plantillaOferta` / `vImprimir` / `enlazarImprimir`, `vVisitas`, `vProgramacion`, `vHistoricos`, `vBuscar`, `vClientes` (con `modalEliminarCliente`), `vCatalogos`, `vAlertas` |
| 2617–2951 | Modales | Nueva oferta, agendar visita, perdida, cancelar, seguimiento, modificar, enviar a Logística, programar, ejecutar, cliente nuevo |
| 2952–3324 | Eventos | `enlazar(vista)`: conecta botones y filtros después de cada `render` |
| 3325–fin | Inicio | `iniciar`: carga, pantalla de "Inicia sesión", `hashchange`, aviso de cambios sin guardar (ficha y texto de la oferta), botón **Salir** |

### 2.3.2 Ciclo de funcionamiento

```
iniciar() ─► cargar() ─► cargarDatos() ─► S.data ─► render() ─► html de la vista ─► enlazar()
                ▲                                       ▲                       │
                │                     refrescar(name) ──┘   clic en un botón ───┘
                │                       (solo esa oferta)                       │
                └──── accion() ◄── ejecutar(acción, datos) ── PUT a Frappe ─────┘
```

- **Estado único** `S`: `S.data` (lo descargado), `S.ficha`/`S.edit` (oferta abierta y sus cambios
  sin guardar), `S.imp` (texto de la oferta editado sin guardar), `S.desde` (desde qué fecha se cargan las
  cerradas), `S.filtros` (Tablero), `S.prog`, `S.hist`, `S.busq`, `S.cli`, etc.
- **Render completo**: cada cambio vuelve a generar el HTML de la vista con *template strings* y lo
  reemplaza en `#mti-app`. Luego `enlazar()` asigna los eventos. Es simple y suficiente para el volumen de
  MTI (cientos de ofertas). `render()` conserva el foco y la posición del cursor.
- **Router por hash**: `#/tablero`, `#/pipeline`, `#/visitas`, `#/programacion`, `#/historicos`,
  `#/buscar`, `#/alertas`, `#/clientes`, `#/catalogos`, `#/cotizacion/<OF-…>`, `#/imprimir/<OF-…>`.
- **Seguridad del HTML**: todo texto que viene de la base de datos pasa por `esc()` antes de insertarse.

### 2.3.3 Capa de datos

Esta capa **reemplazó los Server Scripts** de la versión anterior. Mantiene la misma "forma" de datos que
usaban las vistas, así que estas no cambiaron.

| Función | Qué hace |
|---|---|
| `http.get` / `http.send` | `fetch` con la cookie de sesión y el token `X-Frappe-CSRF-Token` |
| `leerRespuesta` | Convierte errores de Frappe (`_server_messages`, `exception`) en `Error` legibles |
| `listar(dt, campos, filtros, orden, limite)` | `GET /api/resource/<dt>`; sin `limite` trae todos (`limit_page_length=0`) |
| `hijos(dt, padre, …)` | Filas de tablas hijas (`frappe.client.get_list` con `parent`) |
| `hijosDe(dt, campos, nombres, filtros)` | Filas hijas **solo de las ofertas indicadas** (`["parent","in",lote]`, lotes de 300) |
| `leerDoc` / `crearDoc` / `editarDoc` | CRUD de un documento |
| `intentar(fn, porDefecto)` | Ejecuta y, si falla, devuelve el valor por defecto (para datos opcionales) |
| `cargarDatos()` | Las ≈15 lecturas en paralelo y el armado de `S.data`: ofertas **abiertas** + **cerradas desde `S.desde`** (por defecto el 1 de enero del año anterior), sus líneas y trabajos, últimas notas (120 días), perfiles, usuarios, catálogo, clientes, tareas, configuración. Devuelve además `desde` y `primerAnio` |
| `prepararDeal(d, …)` | Arma una oferta para las vistas: `lineasTodas` (todo lo cotizado), `lineas` (solo las incluidas), semáforo, días en la etapa |
| `refrescarOferta(name, conCatalogos)` | Relee **una** oferta (con sus hijos, tareas abiertas y última nota) y la reemplaza en `S.data`; con `guardar` también catálogos y clientes |
| `asegurarAnio(anio)` | Si se elige un año anterior a lo cargado, mueve `S.desde` y recarga; devuelve `true` si cargó |
| `cargarOferta(name)` | Una oferta completa para la ficha (`frappe.desk.form.load.getdoc`: incluye comentarios y adjuntos) |
| `filaALinea` / `lineaAFila` | Traduce una fila de **Productos** del CRM ⇄ una línea de oferta MTI (en "Global" la cantidad es 1; `rate = total / cantidad`; `mti_incluir` ⇄ `incluir`) |
| `derivar(doc, cambios, previo)` | **Reglas al guardar** (ver abajo) |
| `conOferta(name, fn)` | Patrón de guardado: lee la oferta → `fn` aplica cambios → `derivar` → `PUT` → `cerrarTareas` |
| `asegurarCliente` / `asegurarContacto` / `asegurarEquipo` / `alCatalogo` | Crean el cliente, contacto, equipo o personal si no existen (así los catálogos se alimentan solos) |
| `comentar(name, canal, texto)` | Comentario estándar con prefijo de canal: `[Llamada] …`, `[Logística] …` |
| `cerrarTareas(name, estado)` | Marca como hechas las tareas automáticas que ya no corresponden a la etapa (tabla `VIGENTE`) |

**`derivar`** (lo que antes hacía el Server Script "Antes de guardar"):
- Total de la oferta = suma de las líneas **incluidas** (`mti_incluir` ≠ 0) → `deal_value`, `total`, `net_total`.
- `mti_equipo` = lista de equipos de las líneas incluidas.
- `mti_altura` / `mti_radio` / `mti_peso` = máximos de la tabla de trabajos.
- `mti_fecha_servicio` = primera fecha programada de las líneas incluidas.
- `mti_codigo` = número sin `OF-` + `.versión` si hubo renegociación (`40491`, `40491.1`).
- Al cambiar de etapa: fecha de envío, próximo contacto y vigencia al enviar; responsable de Proyectos o
  Logística por defecto desde `MTI Configuracion`; visita "Realizada" al pasar a Proyectos; fecha de
  ejecución al terminar.
- Estado de la visita (Programada / Pendiente de información / Por agendar) según fecha y checklist.
- `mti_semaforo` con `calcularSemaforo`.

**`VIGENTE`**: para cada tarea automática (por el texto antes de ` · ` en el título) dice en qué etapas
sigue vigente. Las Automatizaciones crean las tareas en segundo plano, así que al guardar se cierran las
de etapas anteriores y las vistas no las muestran aunque aún no se hayan cerrado.

### 2.3.4 Acciones (`ejecutar`)

`ejecutar({accion, name, …datos})` primero valida el perfil con la tabla `PERMISOS` y luego aplica la
regla. Las vistas la llaman a través de `accion(datos, mensaje)`, que muestra el aviso y refresca: si la
acción está en `PARCIAL` y devuelve `name`, relee **solo esa oferta** (`refrescar`); si no (crear, catálogo,
reglas, clientes…), recarga todo (`cargar`).

| Acción | Perfiles | Resultado |
|---|---|---|
| `crear` | comercial | Nueva oferta en *Solicitud recibida* (crea cliente y contacto si no existen) |
| `cliente_nuevo` / `cliente` | comercial | Crear / editar un cliente (`CRM Organization`) |
| `guardar` | comercial, proyectos | Guarda la ficha: datos, líneas, trabajos. Con `seleccion` (`[{name, incluir}]`) cambia solo qué líneas van en la oferta, sin crear versión; deja un comentario interno si la oferta ya fue enviada. Rechazado si está fijada |
| `oferta_texto` | comercial | Guarda el texto editado de la oferta impresa (`mti_oferta_html` ya limpio, `mti_oferta_base`, `mti_oferta_editada`, `mti_oferta_editor`); con `html` vacío lo borra y vuelve a la plantilla |
| `agendar` | comercial | Fecha y técnico de la visita → *Visita técnica* |
| `checklist` | comercial, proyectos | Guarda el levantamiento; con "enviar" exige los 6 puntos → *Análisis de Proyectos* |
| `sin_visita` | comercial | Marca "No requerida" → *Análisis de Proyectos* |
| `estado` | comercial, proyectos | Cambios simples de etapa (p. ej. *Cotización preparada*, *Aprobada*, *Perdida*, reabrir) |
| `enviar` | comercial | Fecha de envío, próximo contacto, vigencia, quién envió → *Cotización enviada* |
| `seguimiento` | comercial | Registra el contacto (comentario), reprograma el próximo → *Seguimiento* |
| `posponer` | comercial, logística | Corre 1 día el próximo contacto o la visita |
| `modificar` | comercial | Guarda la versión anterior (`mti_versiones`), sube la versión → *En modificación* (técnico o comercial) |
| `ajuste_listo` | proyectos, comercial | Ajuste técnico terminado → *Cotización preparada* |
| `enviar_logistica` | comercial | Datos para Logística → *Enviada a Logística* |
| `programar` | logística | Fechas, horario, frecuencia y operador por línea → *Programada*; si cambia una fecha ya programada cuenta una reprogramación y avisa a Comercial con una tarea |
| `iniciar` / `ejecutar` | logística | → *En ejecución* / *Ejecutada* |
| `cancelar` | logística, comercial | → *Cancelada* con motivo |
| `espera` | comercial, proyectos, logística (cada uno desde sus etapas, ver `puedeEspera`) | Guarda la etapa actual en `mti_estado_previo`, el motivo, la fecha y la fecha para retomar → *En espera* |
| `reanudar` | comercial, proyectos, logística | Vuelve a `mti_estado_previo` (las automatizaciones de esa etapa vuelven a crear su tarea) |
| `motivo` | comercial, logística | Edita el motivo de una oferta *En espera*, *Perdida* (motivo + detalle) o *Cancelada* |
| `desglose` | comercial, logística | Guarda la tabla `mti_desglose` de una oferta *En ejecución* o *Ejecutada* |
| `adicionales` | comercial, logística | Guarda `mti_adicionales` (horas/días adicionales según la modalidad, o cobro adicional); `derivar` recalcula `mti_valor_adicionales` y `mti_valor_final` |
| `calificacion` | comercial, logística | N.º de reporte diario, quién recibió, comentario, las 4 calificaciones (1–10 o NA) y la foto del reporte; `derivar` calcula `mti_cal_promedio`. `ejecutar` también acepta estos datos |
| `eliminar` | solo administrador (System Manager, `esAdmin()`) | Pide escribir el número de la oferta. Borra primero las notificaciones, tareas, notas y llamadas enlazadas y luego la oferta (Frappe borra comentarios y adjuntos y guarda una copia en *Deleted Document*) |
| `eliminar_cliente` | solo administrador (`esAdmin()`) | Pide escribir ELIMINAR. Rechaza si el cliente tiene **cualquier** oferta (consulta todo el historial, no solo lo cargado); opcionalmente borra sus contactos (`company_name`) y luego la `CRM Organization` |
| `diagrama` | proyectos, comercial | Guarda la URL del diagrama de Compu Crane (`mti_diagrama`); no se permite si la cotización ya está fijada |
| `catalogo` | comercial, proyectos, logística | Agregar, editar o quitar equipos, personal y servicios |
| `reglas` | comercial | Guarda las reglas del semáforo en `MTI Configuracion` |

Si una acción falla, el mensaje de Frappe se muestra en un aviso rojo. Los cambios de la oferta se
guardan en **un solo** `PUT`, así que la oferta no queda a medias (lo auxiliar, como crear el cliente o
un comentario, se hace antes o después).

### 2.3.5 Perfiles y pestañas

`ROL_PERFIL` traduce roles a perfiles; `es(perfil)` dice si el usuario lo tiene. `TABS` define qué
pestañas ve cada perfil y `inicio()` la pestaña inicial (Gerencia → Históricos, solo Logística →
Programación, el resto → Tablero). La tabla completa está en el [manual de uso](05-manual-de-uso.md).

### 2.3.6 Soporte y pruebas

En la consola del navegador (F12), estando en `/mti`:

```js
await mtiApp.cargarDatos()          // todo lo que ve el usuario
await mtiApp.cargarOferta("OF-40491")
await mtiApp.ejecutar({ accion: "seguimiento", name: "OF-40491", canal: "Llamada", nota: "…", dias: 3 })
mtiApp.recargar()
```

Las pruebas de punta a punta del proyecto se hicieron así, con cuatro sesiones (una por perfil) que
recorrieron el flujo completo.

### 2.3.7 Alertas por área

`construirAlertas()` recorre las ofertas y arma una lista con `{area, color, sev, t, s, tipo}`. Las
áreas están en la constante `AREAS` (Comercial, Análisis de Proyectos, Logística); cada usuario ve las de
sus perfiles y Gerencia las ve todas en modo consulta. La pestaña muestra cuántas hay por área y las
agrupa en **Atrasadas** (rojo), **Para hoy** (amarillo) y **Listas para el siguiente paso** (verde).

Los días que lleva una oferta en su etapa (`dias_etapa`) salen del registro estándar de cambios de etapa
de Frappe CRM (`CRM Status Change Log`). Cuándo una alerta pasa a rojo se define en `LIMITES`:

| Clave | Días | Alerta |
|---|---|---|
| `solicitud` | 1 | Solicitud que requiere visita y sigue sin agendar |
| `proyectos` | 2 | Oferta en Análisis de Proyectos sin terminar |
| `preparada` | 1 | Cotización preparada que Comercial no ha enviado |
| `aprobada` | 1 | Aprobada que no se ha pasado a Logística |
| `porprog` | 1 | Enviada a Logística sin programar (también rojo si la fecha pedida es en ≤ 2 días) |
| `espera` | 30 | En espera sin fecha para retomar |
| `desglose` | 30 | Ejecutadas en los últimos N días sin desglose de precio · **área Logística** (antes Comercial) |

### 2.3.8 Cotización fijada y permisos por vista

- `FIJADAS` = Aprobada, Enviada a Logística, Programada, En ejecución, Ejecutada, Cancelada (y *En espera* si
  venía de una de ellas). En esas etapas `guardar` rechaza cambios de líneas y trabajos e ignora los campos
  de la cotización (solo acepta los de Logística, `NO_FIJOS`); `estado` no deja volver a etapas
  anteriores ni marcar *Perdida* (se usa *Cancelar servicio*); `diagrama` tampoco. Lo que cambie en la
  ejecución se registra como **adicional**.
- `verTodo()` (Proyectos o Gerencia): ve todas las pestañas, incluidas **Históricos**, la columna
  *Ejecutado* de Clientes y el botón **Exportar clientes**. Comercial y Logística no. `render()` redirige a
  la pestaña de inicio si alguien abre una ruta que su perfil no tiene.
- Alertas: quien ve todo ve las tres áreas; en las que no son suyas solo tiene el botón *Abrir*.

### 2.3.9 Compresión de fotos

Toda subida pasa por `subirArchivo(file, oferta, {campo, max, calidad})`: adjuntos, foto del reporte firmado,
foto del reporte en el modal de ejecución y diagrama de Compu Crane. `comprimirFoto(file)` reduce en el navegador las fotos JPEG,
PNG o WebP de más de 350 KB: lado mayor 1600 px, JPEG al 80 %, respetando la orientación de la cámara.
Una foto de celular de 3–5 MB queda en unos 250–400 KB. Si el navegador no puede leer la imagen (por
ejemplo HEIC en Chrome) o el resultado no es más liviano, se sube el archivo original. Se ajusta con
`FOTO_MAX`, `FOTO_CALIDAD` y `FOTO_MIN_BYTES`. El diagrama de Compu Crane se guarda con más resolución
(2400 px, 88 %) para que se lean las medidas.

---

### 2.3.10 Selección de servicios (v3.1)

- Cada línea tiene `incluir` (campo `mti_incluir`, 1 por defecto). `tablaLineas` dibuja una casilla
  `data-inc` por línea; las no incluidas se ven tenues (`tr.no-inc`) con la nota "No va en la oferta".
- `puedeEditar("seleccion", f)`: Comercial (y Proyectos antes del envío) mientras la oferta está antes del
  envío o en *Cotización enviada* / *Seguimiento*, y no está fijada.
- Si quien guarda puede editar valores, la casilla viaja dentro de `lineas`; si no, como `seleccion`.
- La oferta debe tener al menos un servicio marcado (la casilla no deja desmarcar el último).
- El total de la ficha ("Total seleccionado antes de IVA · vista comercial") y `deal_value` cuentan solo
  las incluidas. La oferta impresa, el desglose, los adicionales, la programación y los históricos usan
  `f.lineas` (solo incluidas); la ficha usa `lineasTodas`.
- `panelVersiones` compara solo las líneas incluidas de cada versión.

### 2.3.11 Oferta al cliente sin totales y editable (v3.1)

| Pieza | Qué hace |
|---|---|
| `plantillaOferta(f)` | Genera el cuerpo del formato MTI-CL-FR-002 **sin filas de total** (ni "Total antes de IVA" ni "Valor final consolidado"). El logo va como `{{MTI_LOGO}}` (`LOGO_TOKEN`) |
| `vImprimir()` | Muestra `mti_oferta_html` si existe, si no la plantilla, en `#mti-doc`. Para Comercial y el administrador es `contenteditable` y tiene barra: N/K/S, lista, + Fila / − Fila (en la tabla donde está el cursor), **Guardar texto**, **Restablecer plantilla** |
| `hashTxt` | Huella de la plantilla. Si al abrir la huella actual ≠ `mti_oferta_base`, sale el aviso "los datos de la oferta cambiaron después de editar este texto" |
| `limpiarHTML` | Antes de guardar: quita `script`, `style`, `iframe`, `form`, `input`…, atributos `on*`, `contenteditable` y enlaces que no sean `http`, `/`, `#` o `data:image`; reemplaza el logo por `{{MTI_LOGO}}` |
| `enlazarImprimir` | Marca `S.imp.sucio` al escribir; el texto en edición sobrevive a un `render`. Salir de la vista con cambios sin guardar pide confirmación (`hashchange`, `beforeunload`) |

Al imprimir (`@media print`) se ocultan la barra y los avisos; el PDF sale igual al documento.

### 2.3.12 Carga por años (v3.1)

- `desdeInicial()` = 1 de enero del año anterior. `aniosDisponibles()` va desde `primerAnio` (la oferta
  más antigua del sitio) hasta el año actual, aunque esos años no estén cargados.
- Elegir un año anterior en Tablero (`#mti-f-anio`), Históricos (`#h-anio`) o Buscar llama a
  `asegurarAnio`. Buscar muestra "Buscar también en años anteriores" (`data-act='b-anteriores'`) y
  `buscarSimilares` carga todo el historial.
- Clientes indica desde qué año se cuentan las ofertas cuando hay años sin cargar.

### 2.3.13 Eliminar clientes (v3.1)

Botón 🗑 en Clientes solo si `esAdmin()`. `modalEliminarCliente` muestra cuántas ofertas tiene el cliente
en lo cargado; si tiene, solo explica por qué no se puede. Si no, pide ELIMINAR y la opción "Eliminar
también sus contactos". La acción vuelve a verificar en el servidor que no haya ofertas de ningún año.

### 2.3.14 Cambios en vivo (v3.1)

`iniciarVigia()` se llama al final de `iniciar()`. Cada `VIGIA_MS` (30 s) corre `vigiar()`:

1. Si la pestaña está oculta, no hace nada (al volver a verla revisa de inmediato, `visibilitychange`).
2. Pide `CRM Deal` y `CRM Task` con `modified > S.vigia.deal / S.vigia.tarea` (solo `name` y `modified`).
   Sin cambios → termina (≈2 consultas, unos bytes).
3. Con cambios: `refrescarOferta` de cada oferta afectada (más de 25 → recarga completa) y `renderVivo`.
4. Compara las alertas de mis áreas con las que se vieron en el último dibujo (`S.alVistas`, que llena
   `shell`) y muestra un aviso 🔔 con las nuevas. El título de la pestaña lleva el número: `(12) MTI · Ofertas`.
5. Cada `VIGIA_COMPLETA` vueltas (60 ≈ 30 min) o al cambiar de día, recarga completa (`mti_datos`).

`renderVivo` no estorba: en la ficha o en la oferta para imprimir solo actualiza el contador y, si otra
persona cambió **esa** oferta, pone el aviso *Otra persona actualizó esta oferta* con **Ver cambios** (o
pide guardar/descartar primero si hay cambios sin guardar). Si hay un modal abierto o el foco está en un
campo, espera al `focusout`. Lo que cambia la misma persona se marca en `S.vigia.propias` (en `refrescar`)
para no anunciárselo. `window.mtiApp.vigiar()` fuerza una vuelta (pruebas y soporte).

## 2.4 Estilos · `mti_app.css`

- Colores propios de la etapa *En espera* (`.c-hold`, `.mti-banner.hold`, `.mti-step.cur.hold`): azul grisáceo,
  distinto de las demás etapas.
- Todas las clases empiezan por `mti-` para no chocar con los estilos de Frappe.
- Colores en variables (`:root`): `--mti-navy` (encabezado), `--mti-yellow` (acento), `--mti-green`,
  `--mti-yellow-s`, `--mti-red` (semáforo), fondos `--mti-bg`, `--mti-card`, textos `--mti-ink*`.
  Cambiar un color de marca es cambiar una variable.
- El calendario de visitas reparte las visitas que se cruzan en columnas (ancho mínimo 96 px por visita);
  si la semana no cabe, la ficha de la visita pasa debajo.
- La programación (`programados`, `vProgramacion`) es un calendario por **horario**: cada línea programada
  genera un bloque por día trabajado según `prog_dias`, ubicado entre `prog_hora_inicio` y `prog_hora_fin`
  (un turno que pasa de medianoche se muestra hasta las 24:00 con «(+1)»). Los bloques que se cruzan en
  horario se reparten en carriles lado a lado (mín. 100 px). Hay conflicto (⚠) cuando el mismo equipo está
  en dos ofertas el mismo día a horas que se cruzan.
- `@media print` deja solo la oferta en formato MTI-CL-FR-002 al imprimir.
- v3.1: `.mti-selhint`, `td.sel`, `tr.no-inc` (selección de servicios), `.mti-doc-tools`,
  `.mti-print.editable`, `.mti-print-warn` (oferta editable), `.mti-vivo` (aviso de cambios en vivo).

## 2.5 Entorno local

| Archivo | Función |
|---|---|
| `docker-compose.yml` | Proyecto `mti`: `mariadb:10.11`, `redis:alpine` y `frappe/bench:latest`. Monta la carpeta del proyecto en `/workspace` y guarda el bench en el volumen `bench` (sobrevive a `docker compose down` sin `-v`). Puertos 8000 (web) y 9000 (tiempo real) |
| `init.sh` | Si el bench ya existe solo hace `bench start`. Si no: `bench init` (Frappe `version-16`, Python 3.14), `bench get-app crm --branch v1.92.0`, sitio `crm.localhost` con clave `admin`, correos silenciados, programador activado |
| `mti_demo.py` | Se ejecuta **dentro** de Frappe (`bench execute crm.mti_demo.cargar`). Borra ofertas anteriores y carga 61 ofertas coherentes con su etapa (historial, comentarios, tareas), con las automatizaciones pausadas mientras carga |

Comandos:

```powershell
docker compose up -d            # crear / encender
docker compose logs -f frappe   # ver el arranque
docker compose stop             # apagar (conserva datos)
docker compose start            # volver a encender
docker compose down -v          # borrar todo lo local
```

## 2.6 Cómo publicar un cambio

1. Editar `mti_app.js` / `mti_app.css` (o el instalador).
2. Probar en local: `docker compose exec frappe python3 /workspace/mti_instalar.py --solo-pantallas` y
   recargar `http://localhost:8000/mti` con **Ctrl+F5**.
3. Hacer una copia de seguridad en Frappe Cloud (*Backups → Schedule Backup*) y publicar en producción con
   el mismo comando y `--url … --usuario '…' --clave '…'` (comillas simples en PowerShell).
   - Cambios solo de pantallas → `--solo-pantallas`.
   - Campos, etapas o automatizaciones nuevas → instalador completo (no borra datos).
4. Subir el cambio al repositorio con un mensaje que diga qué cambió.

## 2.7 Convenciones

- Nombres en español, como el negocio (`oferta`, `cliente`, `programar`).
- Campos propios con prefijo `mti_`; automatizaciones con título `MTI · …`; doctypes propios `MTI …`.
- Indentación: tabulaciones en Python (como Frappe), 2 espacios en JavaScript.
- Ninguna clave real en el código. Las de demostración (`admin`, `Mti.2026!`) solo funcionan en local.

## 2.8 Limitaciones conocidas

| Tema | Situación | Cómo se resolvería |
|---|---|---|
| Reglas de negocio en el navegador | Los cálculos se hacen al guardar desde `/mti`; editar en `/crm` no los recalcula | Trabajar desde `/mti`; o un plan de Frappe Cloud con Server Scripts |
| Perfil MTI solo en la interfaz | Con Sales Manager se puede editar todo desde `/crm` | Permisos de rol estándar si se necesitara |
| "Hecho" en Alertas | Se guarda en el navegador de cada usuario | Las tareas reales del CRM sí son compartidas |
| Límites de las alertas | Están en el código (`LIMITES`) | Pasarlos a `MTI Configuracion` si MTI quiere cambiarlos seguido |
| Avisos por correo, WhatsApp, resumen diario y "avisar al técnico" | Se quitaron de las pantallas porque no envían nada; los campos siguen en la base de datos sin uso | Correo: conectar la cuenta de salida y agregar la acción en las automatizaciones. WhatsApp: integración aparte |
| Pipeline | Solo consulta: no se arrastran tarjetas (decisión de MTI); la etapa se cambia con los botones de la ficha | — |
| Texto editado de la oferta | Queda fijo: si después cambian equipos o valores, no se actualiza solo (sale un aviso) | **Restablecer plantilla** y volver a ajustar |
| Años anteriores | Tablero, Pipeline, Alertas y Buscar trabajan con lo cargado (abiertas + este año y el anterior) | Elegir el año o "Buscar también en años anteriores" |
| Última nota en el Tablero | Solo de los últimos 120 días | La ficha siempre muestra todo el historial |
| Cambios en vivo | Llegan con hasta 30 s de demora (las alertas de `/mti` no esperan a las automatizaciones; solo la tarea del CRM puede tardar ≈10 min en el plan USD 5); una oferta eliminada por otro desaparece en la siguiente recarga completa (≤ 30 min) | Bajar `VIGIA_MS` sube el consumo de cómputo |
| Selección de servicios en `/crm` | `/crm` muestra todas las líneas; el total (`deal_value`) ya es el de las seleccionadas | Trabajar desde `/mti` |
| Cambiar días del semáforo desde `/mti` | Actualiza la regla en pantalla; los días de las automatizaciones solo los puede cambiar un System Manager | Volver a correr el instalador o editar las automatizaciones (ver [04](04-despliegue-y-mantenimiento.md)) |
