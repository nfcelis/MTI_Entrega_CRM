# 2. Documentación del código

> Para quien vaya a **leer o modificar** el código. Supone conocimientos básicos de JavaScript y Python.
> Antes de esto conviene leer [01-arquitectura.md](01-arquitectura.md).

## 2.1 Estructura del repositorio

```
mti-gruas-crm/
├── README.md                 Portada: qué es, cómo se instala, enlaces
├── LICENSE                   Licencia MIT del código de este repositorio
├── .gitignore
│
├── mti_instalar.py           Instalador: configura un sitio Frappe CRM por la API REST (≈780 líneas)
├── mti_app.js                Pantallas /mti: datos, reglas, vistas y eventos (≈2.500 líneas)
├── mti_app.css               Estilos de /mti (≈500 líneas)
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
    --url https://mtigruas.v.frappe.cloud --usuario nacb@mtigruas.com --clave "…"
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
| 5 | `crear_campos` | Custom Fields en `CRM Deal`, `CRM Products`, `CRM Product` y `CRM Organization`; serie `OF-.#####` y consecutivo inicial **40448** |
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
| `PRIMERA_OFERTA` | Primer número de oferta (40448). Solo se aplica si todavía no hay ofertas `OF-…` |
| `ESTADOS` | Etapas: nombre, color, tipo (`Open`/`Ongoing`/`Won`/`Lost`), probabilidad |
| `ROLES_MTI`, `USUARIOS_DEMO` | Perfiles y usuarios de prueba |
| `FUENTES`, `MOTIVOS_PERDIDA` | Canales de entrada y motivos de pérdida |
| `EQUIPOS`, `CATALOGO` | Catálogo inicial (equipos; personal y servicios) |
| `EMPRESA` | Razón social, NIT, código de formato, cláusulas y pie de página de la oferta impresa |
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
| 1–48 | Constantes | Etapas (`PIPE`, `ABIERTAS`, `PRE_ENVIO`, `LOGISTICA`, `GANADAS`, `CERRADAS`), listas de opciones, `CHECKS` del levantamiento, estado `S` |
| 49–143 | Utilidades | Fechas (`parseD`, `ymd`, `addDays`, `diffDays`), formato de dinero, `esc` (escapar HTML), `opts`, `datalist` |
| 144–485 | **Capa de datos** | Lectura y escritura con la API estándar de Frappe, reglas de negocio (`derivar`), tareas |
| 487–740 | **`ejecutar`** | Todas las acciones de negocio (crear, enviar, aprobar, programar…) |
| 742–800 | Orquestación | `accion`, `cargar`, `toast`, `modal` |
| ≈860–1000 | Alertas | `AREAS`, `areasVisibles`, `construirAlertas` (por área, con `LIMITES`), "Hecho" por usuario |
| 850–928 | Marco | Pestañas por perfil (`TABS`), encabezado (`shell`), `render`, router (`ir`) |
| 929–1968 | **Vistas** | `vTablero`, `vPipeline`, `vFicha`, `vImprimir`, `vVisitas`, `vProgramacion`, `vHistoricos`, `vBuscar`, `vClientes`, `vCatalogos`, `vAlertas` |
| 1969–2204 | Modales | Nueva oferta, agendar visita, perdida, cancelar, seguimiento, modificar, enviar a Logística, programar, ejecutar, cliente nuevo |
| 2205–2456 | Eventos | `enlazar(vista)`: conecta botones y filtros después de cada `render` |
| 2457–fin | Inicio | `iniciar`: carga, pantalla de "Inicia sesión", `hashchange`, aviso de cambios sin guardar, botón **Salir** |

### 2.3.2 Ciclo de funcionamiento

```
iniciar() ─► cargar() ─► cargarDatos() ─► S.data ─► render() ─► html de la vista ─► enlazar()
                ▲                                                               │
                │                               clic en un botón ───────────────┘
                └──── accion() ◄── ejecutar(acción, datos) ── PUT a Frappe ──────┘
```

- **Estado único** `S`: `S.data` (todo lo descargado), `S.ficha`/`S.edit` (oferta abierta y sus cambios
  sin guardar), `S.filtros` (Tablero), `S.prog`, `S.hist`, `S.busq`, `S.cli`, etc.
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
| `listar(dt, campos, filtros, orden)` | `GET /api/resource/<dt>` con `limit_page_length=0` |
| `hijos(dt, padre, …)` | Filas de tablas hijas (`frappe.client.get_list` con `parent`) |
| `leerDoc` / `crearDoc` / `editarDoc` | CRUD de un documento |
| `intentar(fn, porDefecto)` | Ejecuta y, si falla, devuelve el valor por defecto (para datos opcionales) |
| `cargarDatos()` | Las ≈14 lecturas en paralelo y el armado de `S.data` (ofertas con semáforo, líneas, trabajos, última nota, perfiles, usuarios, catálogo, clientes, tareas, configuración) |
| `cargarOferta(name)` | Una oferta completa para la ficha (`frappe.desk.form.load.getdoc`: incluye comentarios y adjuntos) |
| `filaALinea` / `lineaAFila` | Traduce una fila de **Productos** del CRM ⇄ una línea de oferta MTI (en "Global" la cantidad es 1; `rate = total / cantidad`) |
| `derivar(doc, cambios, previo)` | **Reglas al guardar** (ver abajo) |
| `conOferta(name, fn)` | Patrón de guardado: lee la oferta → `fn` aplica cambios → `derivar` → `PUT` → `cerrarTareas` |
| `asegurarCliente` / `asegurarContacto` / `asegurarEquipo` / `alCatalogo` | Crean el cliente, contacto, equipo o personal si no existen (así los catálogos se alimentan solos) |
| `comentar(name, canal, texto)` | Comentario estándar con prefijo de canal: `[Llamada] …`, `[Logística] …` |
| `cerrarTareas(name, estado)` | Marca como hechas las tareas automáticas que ya no corresponden a la etapa (tabla `VIGENTE`) |

**`derivar`** (lo que antes hacía el Server Script "Antes de guardar"):
- Total de la oferta = suma de las líneas → `deal_value`, `total`, `net_total`.
- `mti_equipo` = lista de equipos de las líneas.
- `mti_altura` / `mti_radio` / `mti_peso` = máximos de la tabla de trabajos.
- `mti_fecha_servicio` = primera fecha programada de las líneas.
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
regla. Las vistas la llaman a través de `accion(datos, mensaje)`, que muestra el aviso y recarga.

| Acción | Perfiles | Resultado |
|---|---|---|
| `crear` | comercial | Nueva oferta en *Solicitud recibida* (crea cliente y contacto si no existen) |
| `cliente_nuevo` / `cliente` | comercial | Crear / editar un cliente (`CRM Organization`) |
| `guardar` | comercial, proyectos | Guarda la ficha: datos, líneas, trabajos |
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
| `desglose` | 30 | Ejecutadas en los últimos N días sin desglose de precio |

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
3. Publicar en producción con el mismo comando y `--url … --usuario … --clave …`.
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
| Cambiar días del semáforo desde `/mti` | Actualiza la regla en pantalla; los días de las automatizaciones solo los puede cambiar un System Manager | Volver a correr el instalador o editar las automatizaciones (ver [04](04-despliegue-y-mantenimiento.md)) |
