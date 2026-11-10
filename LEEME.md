# MTI Grúas · CRM de ofertas (versión final del prototipo)

Sistema de trazabilidad de ofertas y visitas técnicas de **MTI Grúas**, montado sobre
**Frappe CRM** (código abierto, licencia AGPL-3.0) con las pantallas de trabajo que MTI pidió en `/mti`.

```
Solicitud recibida → Visita técnica → Análisis de Proyectos → Cotización preparada → Cotización enviada
→ Seguimiento → Aprobada / Perdida → Enviada a Logística → Programada → En ejecución → Ejecutada
```

## Cómo está hecho (y por qué casi no necesita mantenimiento)

| Lo que ve MTI | Lo que hay por debajo (estándar de Frappe) |
|---|---|
| Ofertas (Tablero, Pipeline, ficha) | **CRM Deal** (Negocios), con serie `OF-.#####` desde 40448 |
| Clientes (pestaña Clientes, “+ Nuevo cliente”) | **CRM Organization** + contactos del CRM |
| Equipos y valores de la oferta | Tabla estándar **Productos** del negocio |
| Catálogo de equipos | **CRM Product** |
| Etapas y colores | **CRM Deal Status** |
| Tareas que pasan la oferta de un área a otra, semáforo y recordatorios | **Automatizaciones** de Frappe (12 flujos “MTI · …”) |
| Notas de seguimiento, adjuntos, historial | Comentarios, archivos y registro de cambios estándar |
| Reglas del semáforo, responsables, datos de la empresa | Documento **MTI Configuracion** (se edita como formulario) |
| Pantallas `/mti` | Una **Página web** del sitio (HTML/JS), sin código en el servidor |

- **Sin scripts de servidor ni app propia**: todo lo personalizado son campos, formularios,
  automatizaciones y una página web. Por eso funciona en el plan compartido de Frappe Cloud y las
  actualizaciones de Frappe se aplican sin romper nada.
- Las pantallas `/mti` solo usan la API pública de Frappe. Si algún día fallaran, todos los datos
  siguen disponibles y editables en `/crm` (el CRM estándar) y en `/app`.

## Archivos

| Archivo | Para qué |
|---|---|
| `docker-compose.yml`, `init.sh` | Levantar el entorno local de prueba (Docker Desktop en Windows) |
| `mti_instalar.py` | Configura cualquier sitio Frappe CRM (local o Frappe Cloud) por la API estándar |
| `mti_app.js`, `mti_app.css` | Las pantallas de trabajo `/mti` (las publica el instalador) |
| `mti_logo_grande.png`, `mti_favicon.png` | Logo de MTI para el CRM y la pantalla de ingreso (el instalador los sube) |
| `mti_demo.py` | Carga 61 ofertas de demostración. **Solo local**, nunca en producción |

## 1. Prueba local (Windows + Docker Desktop)

En PowerShell (o WSL), dentro de la carpeta:

```powershell
docker compose up -d                       # la 1.ª vez tarda ~10–15 min (descarga e instala)
docker compose logs -f frappe              # esperar a ver "Running on http://0.0.0.0:8000", luego Ctrl+C
docker compose exec frappe python3 /workspace/mti_instalar.py --usuarios-demo
docker compose exec frappe bash -lc "cp /workspace/mti_demo.py frappe-bench/apps/crm/crm/ && cd frappe-bench && bench --site crm.localhost execute crm.mti_demo.cargar"
```

Abrir http://localhost:8000/mti

| Usuario | Perfil | Clave |
|---|---|---|
| mcamila@mti.demo | Comercial – Cotizaciones (+ Logística) | Mti.2026! |
| ncelis@mti.demo | Dirección de Proyectos | Mti.2026! |
| wvasquez@mti.demo | Comercial – Logística | Mti.2026! |
| mcelis@mti.demo | Gerencia (solo consulta) | Mti.2026! |
| Administrator | Administrador | admin |

Apagar: `docker compose stop` · Volver a encender: `docker compose start` ·
Borrar todo y empezar de cero: `docker compose down -v`.

## 2. Despliegue real en Frappe Cloud (MTI dueño de todo)

1. **Cuenta de MTI**: crear la cuenta en https://frappecloud.com con un correo corporativo de MTI
   (no personal del equipo del proyecto) y registrar el medio de pago de MTI. Plan compartido
   (desde USD 5/mes; 14 días de prueba).
2. **Crear el sitio**: *New Site* → versión **Frappe 16** → app **CRM** → región más cercana
   (p. ej. us-east) → nombre, p. ej. `mtigruas.frappe.cloud`. Guardar la clave de *Administrator*
   que muestra el panel (o fijarla en *Site → Actions → Reset Administrator Password*).
3. **Instalar la configuración MTI** desde cualquier PC con Python 3 (o desde el contenedor local):
   ```
   python mti_instalar.py --url https://mtigruas.frappe.cloud --clave "CLAVE_ADMIN"
   ```
   *Sin* `--usuarios-demo` y *sin* `mti_demo.py`. Agregar `--sin-catalogo` si se van a cargar
   los equipos reales desde Excel. Se puede volver a ejecutar cuantas veces se quiera: no duplica nada.
4. **Datos reales** (en `/crm/data-import` o “Importar desde Excel” en Clientes):
   clientes (Organizaciones), contactos y equipos (Productos). Plantilla descargable desde la misma pantalla.
5. **Usuarios reales**: en `/app/user` crear a María Camila, Néstor, William y Gerencia con su
   correo de MTI. A cada uno darle el rol **Sales Manager** + su perfil: **MTI Comercial**,
   **MTI Proyectos**, **MTI Logística** o **MTI Gerencia**. Luego en *MTI Configuracion* elegir los
   responsables por defecto de Proyectos y Logística.
6. **Correo** (opcional): *CRM → Configuración → Email* para enviar/recibir desde la cuenta de MTI.
7. **Dominio propio** (opcional): *Site → Domains* → `crm.mtigruas.com` (registro CNAME en el
   proveedor del dominio). Frappe Cloud pone el certificado HTTPS.
8. **Comprobar**: entrar con cada usuario a `/mti`, crear una oferta de prueba, recorrer el flujo y borrarla.

### Lo que Frappe Cloud hace solo
Actualizaciones de seguridad y de versión, copias de seguridad diarias (y externas), servidor,
HTTPS, monitoreo. Soporte por tickets desde el panel. Si en el futuro MTI quiere irse, el panel
permite descargar la copia completa (base de datos + archivos) y restaurarla en otro servidor Frappe.

## 3. Manual de mantenimiento (sin programar)

| Quiero… | Dónde |
|---|---|
| Cambiar los días del semáforo, responsables, cláusulas o datos de la empresa | `/app/mti-configuracion` |
| Cambiar cuándo se crean las tareas automáticas o a quién | `/app/automation-flow` → flujos “MTI · …” (se pueden pausar con *Habilitado*) |
| Agregar/quitar equipos, personal o servicios | Pestaña **Catálogos** en `/mti` |
| Agregar clientes | Pestaña **Clientes** → “+ Nuevo cliente” o “Importar desde Excel” |
| Agregar un campo a la ficha del CRM | `/app/customize-form` (CRM Deal) y luego el layout en *CRM → Configuración* |
| Agregar o quitar un usuario | `/app/user` (roles: Sales Manager + perfil MTI) |
| Restaurar una copia | Panel de Frappe Cloud → *Backups* |
| Volver a publicar las pantallas `/mti` (si se editan los archivos) | `python mti_instalar.py --url … --clave … --solo-pantallas` |

**Quién soporta qué**: la plataforma (servidor, Frappe, CRM, copias) → Frappe Cloud. La configuración
MTI → este repositorio; cualquier integrador o desarrollador de Frappe puede tomarla porque solo usa
elementos estándar.

## Licencia
Frappe Framework (MIT) y Frappe CRM (AGPL-3.0) conservan sus licencias. Los archivos de este repositorio
se publican bajo la licencia MIT (ver `LICENSE`).
