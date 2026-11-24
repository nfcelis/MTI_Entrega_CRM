# 6. Guía de soporte y mantenimiento para MTI

> **Para quién:** el administrador del sistema en MTI y quien lo reemplace. No hace falta saber programar.
> **Cómo usarla:** busque lo que necesita en el **índice rápido** (6.1). Cada tarea dice *dónde*, *cómo* y
> *quién* la puede hacer. Para el uso diario de las pantallas, vea el [manual de uso](05-manual-de-uso.md).
> La parte técnica para desarrolladores está en [02-codigo.md](02-codigo.md) y [03-frappe.md](03-frappe.md).

---

## 6.0 Ficha del sistema

Llene esta tabla al recibir el sistema y manténgala actualizada. **No escriba claves aquí.**

| Dato | Valor |
|---|---|
| Dirección de trabajo | https://mtigruas.v.frappe.cloud/mti |
| CRM estándar (respaldo) | https://mtigruas.v.frappe.cloud/crm |
| Escritorio de administración | https://mtigruas.v.frappe.cloud/app |
| Panel del proveedor (servidor, copias, pagos) | https://frappecloud.com → *Sites* → `mtigruas.v.frappe.cloud` |
| Cuenta del proveedor | `nacb@mtigruas.com` (a nombre de MTI) |
| Plan contratado | Compartido de USD 5/mes (ver 6.6) |
| Medio de pago | Tarjeta registrada en Frappe Cloud → *Billing* |
| Administrador del sistema | Néstor Celis (`nacb@mtigruas.com`) |
| Administrador suplente | ______________________ |
| Dónde se guardan las copias de seguridad | ______________________ (p. ej. Google Drive de MTI → *Sistema CRM / Copias*) |
| Dónde se guardan las claves | ______________________ (gestor de contraseñas o sobre sellado en gerencia) |
| Repositorio del código | ______________________ (GitHub) |
| Versión instalada | Frappe 16 + Frappe CRM · pantallas MTI v8 (noviembre 2026) |

---

## 6.1 Índice rápido: "necesito…"

| Necesito… | Dónde | Quién | Ver |
|---|---|---|---|
| Crear un usuario nuevo | `/app/user` → *+ Agregar* | Administrador | 6.4.1 |
| Desactivar a alguien que se fue | `/app/user` → usuario → desmarcar *Habilitado* | Administrador | 6.4.3 |
| Cambiar o recuperar una clave | `/app/user` → usuario → *Cambiar contraseña* | Administrador | 6.4.2 |
| Que alguien vea otras pestañas o botones | `/app/user` → usuario → *Roles* | Administrador | 6.4.4 |
| Agregar un equipo, operador o servicio | `/mti` → **Catálogos** | Comercial, Proyectos, Logística | 6.5.1 |
| Cargar muchos clientes de una vez | `/mti` → **Clientes** → *Importar desde Excel* | Comercial | 6.5.2 |
| Descargar la base de clientes | `/mti` → **Clientes** → *Exportar clientes* | Proyectos, Gerencia | 6.5.3 |
| Cambiar cláusulas, NIT o cuenta bancaria de la oferta impresa | `/app/mti-configuracion` | Administrador | 6.5.4 |
| Cambiar a quién le llegan las tareas de Proyectos o Logística | `/app/mti-configuracion` | Administrador | 6.5.4 |
| Cambiar los días del semáforo | `/mti` → **Alertas** → *Reglas del semáforo* | Comercial | 6.5.5 |
| Pausar o ajustar una tarea automática | `/app/automation-flow` | Administrador | 6.5.6 |
| Eliminar una oferta creada por error | Ficha de la oferta → **🗑 Eliminar oferta** | Administrador | 6.5.7 |
| Recuperar una oferta eliminada | `/app/deleted-document` | Administrador | 6.7.2 |
| Descargar una copia de seguridad | Frappe Cloud → el sitio → **Backups** | Administrador | 6.7.1 |
| Volver el sistema a un día anterior | Frappe Cloud → **Backups** → *Restore* | Administrador (con cuidado) | 6.7.3 |
| Ver si el plan se está llenando | Frappe Cloud → el sitio → **Overview / Insights** | Administrador | 6.6 |
| Subir de plan | Frappe Cloud → el sitio → **Plan** → *Change Plan* | Administrador | 6.6 |
| Pagar o cambiar la tarjeta | Frappe Cloud → **Billing** | Administrador / Gerencia | 6.6 |
| Usar una dirección propia (`crm.mtigruas.com`) | Proveedor del dominio + Frappe Cloud → **Domains** | Administrador + quien maneje el dominio | 6.9.1 |
| Que el CRM envíe correos | `/crm` → Configuración → **Email** | Administrador | 6.9.2 |
| Algo no funciona | Tabla de síntomas | Cualquiera → Administrador | 6.8 |
| Pedir ayuda | Escalamiento por niveles | Administrador | 6.10 |

---

## 6.2 Cómo está armado (en una página)

```
 Usuarios (navegador o celular)
        │
        ▼
 https://mtigruas.v.frappe.cloud/mti   ← pantallas de trabajo de MTI (una página web dentro del sistema)
        │
        ▼
 Frappe CRM (programa de código abierto)  ← guarda todo, controla permisos, corre las tareas automáticas
        │
        ▼
 Frappe Cloud (proveedor)  ← servidor, actualizaciones, HTTPS, copias de seguridad
```

- **No hay programas instalados en los computadores** de MTI. Solo se necesita un navegador actualizado
  (Chrome, Edge o Firefox).
- **No hay código propio en el servidor.** Todo lo de MTI es configuración estándar de Frappe (campos,
  etapas, automatizaciones) más la página `/mti`. Por eso Frappe Cloud puede actualizar el sistema sin
  romperlo.
- **Si `/mti` fallara**, los datos siguen completos y se pueden ver y editar en `/crm`.

---

## 6.3 Rutinas de mantenimiento

### Cada semana (5 minutos)

| Tarea | Dónde | Qué mirar |
|---|---|---|
| Revisar que no haya alertas atrasadas olvidadas | `/mti` → **Alertas** (cada área) | Grupo rojo "Atrasadas" |
| Revisar que las tareas automáticas estén corriendo | `/app/automation-run` | Que haya ejecuciones recientes y ninguna con error |

### Cada mes (15 minutos) · **obligatorio**

| # | Tarea | Dónde | Por qué |
|---|---|---|---|
| 1 | **Descargar la copia de seguridad** (base de datos + archivos) y guardarla en el Drive de MTI con el nombre `AAAA-MM mtigruas` | Frappe Cloud → el sitio → **Backups** → la más reciente → *Download* | El plan actual no guarda copias fuera del servidor |
| 2 | Revisar el uso del plan | Frappe Cloud → el sitio → **Overview / Insights** | Si algo pasa del 70–80 %, subir de plan (6.6) |
| 3 | Revisar usuarios activos | `/app/user` | Desactivar a quien ya no trabaje en MTI |
| 4 | Revisar ejecutadas sin desglose ni calificación | `/mti` → **Históricos** (columna *Desglose*) | Para que los indicadores salgan completos |
| 5 | Revisar errores del sistema | `/app/error-log` | Si hay muchos del mismo tipo, reportarlo (6.10) |

### Cada año

| Tarea | Dónde |
|---|---|
| Revisar que la tarjeta de pago siga vigente | Frappe Cloud → **Billing** |
| Probar una restauración en un sitio de prueba (opcional, recomendado) | Ver 6.7.3 |
| Revisar cláusulas, NIT y datos de la oferta impresa | `/app/mti-configuracion` |
| Revisar que el administrador suplente tenga acceso y sepa usar esta guía | — |

---

## 6.4 Usuarios y accesos

### 6.4.1 Crear un usuario

1. Entrar a `/app/user` → **+ Agregar usuario**.
2. **Correo** (será su usuario para entrar), **nombre** y **apellido**.
3. Desmarcar **Enviar correo de bienvenida** (el sitio no tiene correo de salida configurado; ver 6.9.2).
4. Guardar. En la sección **Roles** marcar **Sales Manager** y su perfil MTI:

| Persona | Roles a marcar | Qué puede hacer |
|---|---|---|
| Comercial – Cotizaciones | Sales Manager + **MTI Comercial** | Clientes, ofertas, visitas, envío, seguimiento, aprobación, paso a Logística. No ve Históricos ni exporta clientes |
| Comercial que también programa | + **MTI Logística** | Lo anterior y programación |
| Dirección de Proyectos | Sales Manager + **MTI Proyectos** | Solución técnica, valores, diagrama Compu Crane; ve todas las vistas y exporta clientes |
| Logística | Sales Manager + **MTI Logística** | Programación, adicionales, reporte diario y calificación. No ve Históricos ni exporta clientes |
| Gerencia | Sales Manager + **MTI Gerencia** | Ve todo, no modifica nada; exporta clientes |
| Administrador del sistema | + **System Manager** | Todo, incluido eliminar ofertas y configurar. **Solo 1 o 2 personas** |

5. Guardar. En **Cambiar contraseña** → *Nueva contraseña* → Guardar.
6. Entregarle el correo y la clave por un medio privado y pedirle que la cambie al entrar.

> **Reglas:** *Sales Manager* siempre (sin él, el usuario solo ve las ofertas que él creó). Una persona,
> un usuario: no compartir cuentas, porque el historial registra quién hizo cada cosa. Si dos personas
> comparten buzón, a una se le puede poner un correo `@mtigruas.com` que no exista: solo sirve para entrar.

### 6.4.2 Claves

| Situación | Qué hacer |
|---|---|
| Alguien olvidó su clave | Administrador: `/app/user` → usuario → **Cambiar contraseña** → nueva clave → Guardar |
| Cambiar la propia clave | El usuario: `/app/user` → su usuario (o avatar → *Mi configuración*) → **Cambiar contraseña** |
| El administrador olvidó su clave | Frappe Cloud → el sitio → **Actions → Reset Administrator Password**, entrar como `Administrator` y cambiar la del administrador |
| Se perdió el acceso a Frappe Cloud | En frappecloud.com → *Forgot password* con `nacb@mtigruas.com` |

Recomendaciones: claves de al menos 10 caracteres, distintas para cada persona, guardadas en un gestor de
contraseñas. La clave de **Administrator** y la de **Frappe Cloud** solo las conocen el administrador y su
suplente.

### 6.4.3 Cuando alguien se va de MTI

1. `/app/user` → su usuario → desmarcar **Habilitado** (*Enabled*) → Guardar. **No borrar el usuario**:
   su historial en las ofertas se conserva.
2. Si era responsable por defecto de Proyectos o Logística, cambiarlo en `/app/mti-configuracion`.
3. Reasignar sus tareas abiertas: `/crm` → **Tareas** → filtrar por la persona → cambiar el asignado.
4. Si era administrador, cambiar las claves de **Administrator** y de **Frappe Cloud**.

### 6.4.4 Cambiar lo que alguien puede ver o hacer

Marcar o desmarcar su **perfil MTI** en `/app/user` → *Roles*. El cambio se ve al recargar `/mti`
(**Ctrl+F5**). Las reglas de cada perfil están en el [manual de uso](05-manual-de-uso.md#51-lo-básico).

---

## 6.5 Cambios del día a día (sin programar)

### 6.5.1 Catálogos (equipos, personal, servicios)
`/mti` → **Catálogos** → **Agregar**. "Quitar" lo oculta de las listas pero no cambia las ofertas que lo
usaron. Además, cuando alguien escribe en una oferta un equipo, técnico o servicio nuevo, se agrega solo.

**Cómo nombrar los equipos.** La alarma de Programación ("equipo programado dos veces a la misma hora") solo
se activa para equipos cuyo nombre **lleva un número**, porque son una unidad única: *Grúa 90 t*,
*Grúa 150 t*, *TMS 800*. Los nombres **sin número** (*Grúa Telescópica*, *Camión Grúa*, *Cama alta*,
*Tractocamión con plancha*) se tratan como equipos de los que MTI tiene varias unidades y se pueden repetir.
Si un equipo único no lleva número en el nombre, agréguele su referencia (capacidad o modelo) para que la
alarma lo cuide.

### 6.5.2 Importar clientes desde Excel
`/mti` → **Clientes** → **Importar desde Excel ↗** → *Nuevo* → tipo de documento **CRM Organization** →
descargar la plantilla, llenarla (nombre, NIT, dirección, contacto, teléfono, correo) → subirla → *Iniciar
importación*. Para pocos clientes, mejor **+ Nuevo cliente**.

### 6.5.3 Exportar clientes
`/mti` → **Clientes** → **⬇ Exportar clientes** (solo Proyectos y Gerencia). Descarga un archivo que abre
Excel con los datos de cada cliente, sus ofertas, el valor ejecutado y la calificación promedio.
Comercial y Logística no pueden exportar, ni desde `/mti` ni desde el CRM estándar.

### 6.5.4 Configuración MTI
`/app/mti-configuracion`:

| Sección | Qué se cambia |
|---|---|
| Reglas del semáforo | Días en verde y amarillo, días para el próximo contacto, vigencia |
| Responsables por área | Quién recibe las tareas de **Proyectos** y de **Logística** |
| Formato de la oferta | Razón social, NIT, código del formato, cláusulas (incluida la **cuenta bancaria**), pie de página |

Guardar. Se aplica de inmediato en las pantallas y en la oferta impresa.

### 6.5.5 Días del semáforo
`/mti` → **Alertas** → *Reglas del semáforo* → *Guardar reglas*. Cambia el cálculo en pantalla. Para que
las tareas automáticas "Sin respuesta" usen los mismos días, el administrador ajusta en
`/app/automation-flow` las automatizaciones **MTI · Semáforo amarillo** y **MTI · Semáforo rojo** (campo
*Date Offset* = días en verde + 1, y días en amarillo + 1).

### 6.5.6 Tareas automáticas (Automatizaciones)
En `/app/automation-flow` están las 13 automatizaciones **MTI · …** (lista completa en
[03-frappe.md](03-frappe.md#35-automatizaciones-automation-flow)).

| Quiero… | Cómo |
|---|---|
| Que una deje de crear tareas | Abrirla → desmarcar **Enabled** → Guardar |
| Cambiar a quién se asigna | Abrirla → la acción → valor `assigned_to` |
| Cambiar el texto de la tarea | Abrirla → la acción → `title` / `description` |
| Cambiar cuántos días antes avisa | Abrirla → **Date Offset** |
| Pausarlas todas (p. ej. durante una carga masiva) | `/app/automation-settings` → **Disable Automations** (¡acordarse de volver a activarlas!) |
| Ver por qué una no corrió | `/app/automation-run` → abrir la ejecución → ver el error |

### 6.5.7 Eliminar una oferta
Solo el administrador: abrir la oferta → **🗑 Eliminar oferta** → escribir el número para confirmar. Se
borran también sus tareas, notas, comentarios y adjuntos. Úselo solo para ofertas duplicadas, de prueba o
creadas por error; una oferta que el cliente no aceptó se marca **Perdida**, no se elimina.

### 6.5.8 Lo que NO se debe cambiar

| No cambie… | Por qué |
|---|---|
| El **nombre** de las etapas (`/app/crm-deal-status`) | Las pantallas y automatizaciones las buscan por nombre. El color sí se puede cambiar |
| Ni borre campos que empiezan por `mti_` (`/app/customize-form`) | Las pantallas los usan |
| La página **MTI · Ofertas** en `/app/web-page` a mano | Se reemplaza completa al publicar cambios |
| Los roles **MTI Comercial / Proyectos / Logística / Gerencia** | Definen los perfiles |
| Los títulos de las automatizaciones **MTI · …** | El instalador las reconoce por el título |
| Dar **System Manager** a usuarios del día a día | Permite borrar y reconfigurar todo |

---

## 6.6 Plan, capacidad y costos

| Recurso | Plan actual (USD 5/mes) | Plan siguiente (USD 10/mes) |
|---|---|---|
| Procesamiento | 0,5 h de cómputo al día | 1 h al día |
| Base de datos | 250 MB | 500 MB |
| Disco (fotos, PDF) | 2,5 GB | 5 GB |
| Copias fuera del servidor | No (desde USD 25) | No (desde USD 25) |

**Cuánto dura (estimado, ~30 ofertas al mes):** las fotos se comprimen solas (≈ 300–500 KB cada una), así
que el disco alcanza para unas 1.000 ofertas con fotos (2 a 3 años). La base de datos, más de un año.

**Cuándo subir de plan:** si alguna barra de uso pasa del 70–80 % o si el sistema se pone lento a ciertas
horas (se agotó el procesamiento del día). Frappe Cloud → el sitio → **Plan** → *Change Plan*. Es
inmediato, no detiene el sistema ni pierde datos, se cobra por día y se puede volver a bajar.

**Pagos:** Frappe Cloud cobra mensualmente a la tarjeta registrada en **Billing**. Allí se descargan las
facturas. Si el pago falla, el sitio puede suspenderse: mantener la tarjeta vigente.

---

## 6.7 Copias de seguridad y recuperación

### 6.7.1 Descargar una copia
Frappe Cloud → el sitio → **Backups** → elegir la más reciente → **Download** (base de datos, archivos
públicos y privados). Guardar los archivos juntos en una carpeta `AAAA-MM mtigruas` del Drive de MTI.
Conservar al menos las de los últimos 12 meses.

### 6.7.2 Recuperar una oferta (u otro documento) borrado
`/app/deleted-document` → buscar por número (`OF-40466`) → abrir → **Restore**.

### 6.7.3 Volver todo el sistema a una fecha
Frappe Cloud → el sitio → **Backups** → elegir la copia → **Restore**. **Todo lo hecho después de esa
fecha se pierde.** Úselo solo ante un daño grave (datos borrados en masa, error que dañó información) y
avise antes a todos los usuarios. Si tiene dudas, abra primero un ticket con Frappe Cloud (6.10).

### 6.7.4 Llevarse el sistema a otro proveedor
Con la copia descargada se puede montar el mismo sistema en cualquier servidor con Frappe 16 + Frappe CRM
(otro proveedor o un servidor propio) y luego publicar las pantallas MTI con el instalador (6.11). Los datos
son de MTI y el software es de código abierto: no hay dependencia de un proveedor.

---

## 6.8 Problemas frecuentes y solución

| Síntoma | Causa probable | Solución | Quién |
|---|---|---|---|
| "Sin perfil MTI" al entrar a `/mti` | El usuario no tiene perfil MTI | Marcar su perfil en `/app/user` | Administrador |
| Un usuario solo ve algunas ofertas | Le falta **Sales Manager** | Marcarlo en `/app/user` | Administrador |
| No le aparece una pestaña (p. ej. Históricos) | Su perfil no la tiene (Comercial y Logística no ven Históricos) | Es lo esperado; si debe verla, darle el perfil adecuado | Administrador |
| No puedo editar equipos o valores de una oferta | La oferta está **aprobada** y quedó fijada | Es lo esperado; los cambios del servicio van como **adicionales** | — |
| No le llega la tarea a Proyectos o Logística | Responsable vacío en Configuración MTI | Elegirlo en `/app/mti-configuracion` | Administrador |
| No se crean tareas automáticas | Automatizaciones pausadas o con error | `/app/automation-settings` (desmarcar *Disable Automations*) y `/app/automation-run` | Administrador |
| `/mti` se ve como una versión anterior | Memoria del navegador | **Ctrl+F5** o ventana de incógnito | Usuario |
| `/mti` se queda en "Cargando…" | Sesión vencida o error | Recargar; salir y volver a entrar; si sigue, captura de pantalla + F12 → *Consola* y reportar | Usuario → Administrador |
| Una foto no se sube | Formato no soportado (HEIC del iPhone en Chrome) o sin conexión | En el iPhone: *Ajustes → Cámara → Formatos → Más compatible*; o subirla desde el computador | Usuario |
| El sistema está lento a cierta hora | Se agotó el procesamiento diario del plan | Esperar al día siguiente o subir de plan | Administrador |
| No se puede eliminar una oferta | No es administrador o escribió mal el número | Entrar como administrador y escribir el número exacto | Administrador |
| El sitio no abre para nadie | Caída del proveedor o pago vencido | Ver https://frappecloud.com (estado) y **Billing**; abrir ticket | Administrador |
| Error 500 "Este sitio necesita una migración" o "Table … doesn't exist" | Frappe Cloud actualizó Frappe pero no migró la base de datos del sitio | Frappe Cloud → **Sites** → el sitio → **Actions** → **Migrate Site** → *In-Place Migrate Site*, **sin** marcar *Skip Failing Patches* → esperar *Success* en **Jobs** → Ctrl+F5. No borra datos. Si falla, ticket a Frappe Cloud con el error | Administrador |
| No sale la alarma de equipo repetido | El equipo no lleva número en el nombre (se trata como genérico) | Renombrarlo con su referencia, p. ej. *Grúa 90 t* (ver 6.5.1) | Administrador |
| Los Históricos no cuadran | Ejecutadas sin desglose o sin fecha de ejecución | Completar desglose y fecha en cada oferta | Comercial / Logística |

**Antes de reportar un problema, anote:** qué estaba haciendo, el número de la oferta, el usuario, la
hora, y una captura de pantalla del error (si es posible también la de F12 → *Consola*).

---

## 6.9 Opcionales

### 6.9.1 Dirección propia (`crm.mtigruas.com`)
1. Quien administra el dominio `mtigruas.com` crea un registro **CNAME**: nombre `crm`, valor
   `mtigruas.v.frappe.cloud`.
2. Frappe Cloud → el sitio → **Domains** → *Add domain* → `crm.mtigruas.com` → verificar.
3. El certificado HTTPS se pone solo. La dirección anterior sigue funcionando.

### 6.9.2 Correo de salida
Sirve para "olvidé mi contraseña", invitaciones y, a futuro, avisos por correo. `/crm` → Configuración →
**Email** → Gmail u Outlook (lo que use MTI en `@mtigruas.com`) y seguir los pasos (suele pedir una
*contraseña de aplicación* de esa cuenta).

---

## 6.10 Soporte y escalamiento

| Nivel | Quién | Para qué | Cómo contactar |
|---|---|---|---|
| **1 · Interno** | Administrador del sistema en MTI | Usuarios, claves, catálogos, configuración, dudas de uso (este documento y el manual) | — |
| **2 · Proveedor** | **Frappe Cloud** | El sitio no abre, lentitud, copias, restauraciones, cobros, dominio | Panel de Frappe Cloud → **Help / Support** (tickets, en inglés) |
| **2 · Comunidad** | Foro de Frappe | Dudas sobre cómo funciona Frappe CRM | https://discuss.frappe.io |
| **3 · Desarrollo** | Un integrador o desarrollador de Frappe | Cambios en las pantallas MTI, campos nuevos, nuevas automatizaciones, errores en `/mti` | Contratar por proyecto; entregarle el **repositorio** y estos documentos |

**Plantilla para reportar un problema** (copiar y llenar):

```
Sistema: MTI Grúas · https://mtigruas.v.frappe.cloud/mti
Fecha y hora:
Usuario:
Pantalla / oferta (número):
Qué intentaba hacer:
Qué pasó (mensaje de error exacto):
¿Les pasa a otros usuarios? Sí / No
Adjuntos: captura de pantalla, captura de F12 → Consola
```

---

## 6.11 Cambios en las pantallas (para el técnico de nivel 3)

Los cambios en `/mti` se hacen en los archivos del repositorio (`mti_app.js`, `mti_app.css`) y se publican
con el instalador. Se necesita un computador con **Python 3** (o Docker) y la clave de un usuario con
*System Manager*:

```bash
# solo pantallas (no toca datos)
python mti_instalar.py --url https://mtigruas.v.frappe.cloud --usuario nacb@mtigruas.com --clave "…" --solo-pantallas

# campos, etapas, permisos o automatizaciones nuevas (no borra datos ni duplica nada)
python mti_instalar.py --url https://mtigruas.v.frappe.cloud --usuario nacb@mtigruas.com --clave "…"
```

Recomendado: probar primero en el entorno local (`docker-compose.yml`, ver [02-codigo.md](02-codigo.md#25-entorno-local)),
publicar fuera del horario laboral y pedir a los usuarios **Ctrl+F5** después. Registrar cada cambio en la
sección 6.13.

---

## 6.12 Lista de traspaso (cuando cambia el administrador)

- [ ] El nuevo administrador tiene usuario con **System Manager** en el sitio.
- [ ] Tiene acceso a la cuenta de **Frappe Cloud** (miembro del equipo en *Settings → Team* o la clave de la cuenta).
- [ ] Conoce dónde están las **copias de seguridad** y las **claves**.
- [ ] Leyó esta guía y el manual de uso.
- [ ] Hizo una vez la rutina mensual acompañado.
- [ ] Se actualizó la **ficha del sistema** (6.0).
- [ ] Se cambiaron las claves de Administrator y de Frappe Cloud si el anterior ya no estará.

---

## 6.13 Registro de cambios

| Fecha | Versión | Cambio | Quién |
|---|---|---|---|
| 2026-11-09 | v3 | Primer despliegue en Frappe Cloud: pantallas `/mti` sobre Frappe CRM estándar, 12 automatizaciones, logo MTI, botón Salir | Equipo del proyecto |
| 2026-11-10 | v4 | Etapa *En espera* con motivo; desglose del precio; alertas por área; compresión de fotos | Equipo del proyecto |
| 2026-11-10 | v5 | Cotización fijada al aprobar; Históricos solo para Proyectos y Gerencia; adicionales y valor final; exportación de clientes restringida; reporte diario y calificación del cliente; diagrama Compu Crane | Equipo del proyecto |
| 2026-11-10 | v6 | Fotos desde la visita; adicionales en la ventana de ejecución; programación por horario; se quitaron avisos no funcionales; Pipeline sin arrastrar | Equipo del proyecto |
| 2026-11-10 | v7–v8 | Eliminar ofertas (solo administrador) | Equipo del proyecto |
| 2026-11-17 | — | Migración del sitio tras actualización de Frappe Cloud (error `tabStudio App`) | Administrador |
| 2026-11-17 | v9 | Programación: la alarma de equipo repetido solo aplica a equipos con referencia (con número); los genéricos pueden repetirse. La ventana Programar también revisa las horas | Equipo del proyecto |
| | | | |

---

## 6.14 Glosario

| Término | Significado |
|---|---|
| **/mti** | Las pantallas de trabajo de MTI (Tablero, Visitas, Programación…) |
| **/crm** | El Frappe CRM estándar; respaldo para ver toda la actividad de una oferta |
| **/app** | El escritorio de administración de Frappe (usuarios, configuración, automatizaciones) |
| **Frappe Cloud** | El proveedor que aloja el sistema (servidor, copias, actualizaciones) |
| **Oferta / cotización** | Un "Negocio" (*CRM Deal*) del CRM, con número `OF-#####` |
| **Etapa** | Estado de la oferta (Solicitud recibida… Ejecutada) |
| **Perfil MTI** | Rol que define qué ve y hace cada persona (Comercial, Proyectos, Logística, Gerencia) |
| **Sales Manager** | Rol estándar del CRM que todos necesitan para ver todas las ofertas |
| **System Manager** | Rol de administrador del sistema |
| **Automatización** | Regla de Frappe que crea tareas o cambia el semáforo sola |
| **Cotización fijada** | Desde *Aprobada*, la oferta no se modifica; los cambios van como adicionales |
| **Adicionales** | Horas, días u otros cobros extra registrados al ejecutar el servicio |
| **Valor final consolidado** | Valor aprobado + adicionales; es el que cuentan los Históricos |
| **Desglose** | Reparto del valor final entre los equipos o conceptos del trabajo |
| **Copia de seguridad (backup)** | Archivo con toda la información del sistema para recuperarlo |
| **Instalador** | `mti_instalar.py`: deja configurado o actualiza el sistema MTI en un sitio Frappe |
