# MTI Grúas · Trazabilidad de ofertas y visitas técnicas

Sistema para **Montajes Telescópicos Industriales SAS (MTI Grúas)** que registra cada oferta desde que
llega la solicitud hasta que el servicio se ejecuta, la pasa automáticamente entre Comercial, Proyectos y
Logística y avisa cuando algo se atrasa. Está construido sobre **[Frappe CRM](https://github.com/frappe/crm)**
(código abierto), usando solo elementos estándar, para que MTI pueda mantenerlo sin un área de TI.

**En producción:** https://mtigruas.v.frappe.cloud/mti (Frappe Cloud · Frappe 16 + Frappe CRM)

![Tablero de ofertas](docs/capturas/01-tablero.png)

## Flujo

```
Solicitud recibida → Visita técnica → Análisis de Proyectos → Cotización preparada → Cotización enviada
      → Seguimiento → Aprobada → Enviada a Logística → Programada → En ejecución → Ejecutada
                   ↘ En modificación (el cliente pide cambios) ↗          ↘ Perdida / Cancelada
        (cualquier etapa abierta) ⇄ En espera (con motivo y fecha para retomar)
```

Cada área tiene su propia pestaña de **alertas** (Comercial, Análisis de Proyectos, Logística) para que no
se olviden cotizaciones, análisis ni programaciones.

| Perfil | Qué hace en el sistema |
|---|---|
| Comercial – Cotizaciones | Registra solicitudes y clientes, agenda visitas, envía ofertas, hace seguimiento con semáforo, aprueba y pasa a Logística; registra el desglose del precio al terminar |
| Dirección de Proyectos | Define la solución técnica: equipos, modalidad, valores, trabajos (altura, radio, peso) y sube el diagrama de Compu Crane; ve todas las vistas |
| Logística | Programa equipos y operadores, registra adicionales (horas/días extra, otros cobros), el reporte diario y la calificación del cliente, y cierra los servicios |
| Gerencia | Consulta todas las vistas, históricos, indicadores y satisfacción de clientes; exporta clientes (solo lectura) |

## Pantallas

| | |
|---|---|
| ![Ficha](docs/capturas/03-ficha-oferta.png) Ficha de la oferta con barra de etapas | ![Visitas](docs/capturas/05-visitas.png) Calendario de visitas y checklist |
| ![Programación](docs/capturas/06-programacion.png) Programación de Logística | ![Históricos](docs/capturas/07-historicos.png) Históricos e indicadores |

## Cómo está hecho

- **Datos y permisos**: Frappe CRM estándar (Negocios = ofertas, Organizaciones = clientes, Productos =
  equipos y líneas, Tareas).
- **Configuración**: campos personalizados `mti_*`, 15 etapas (incluida *En espera*), 5 doctypes de configuración y 13
  **Automatizaciones** de Frappe 16 (traspasos entre áreas, semáforo y recordatorios).
- **Pantallas de trabajo `/mti`**: una Página web de Frappe con `mti_app.js` y `mti_app.css`, que solo usa
  la API REST estándar.
- **Sin** app propia, **sin** Server Scripts y **sin** cambios al código de Frappe: las actualizaciones
  de Frappe Cloud no lo rompen.
- **`mti_instalar.py`** configura cualquier sitio Frappe CRM (local o en la nube) en pocos minutos.

## Inicio rápido (local, con Docker)

```bash
docker compose up -d                       # 1.ª vez: 10–15 min
docker compose logs -f frappe              # esperar "Running on http://0.0.0.0:8000"
docker compose exec frappe python3 /workspace/mti_instalar.py --usuarios-demo
docker compose exec frappe bash -lc "cp /workspace/mti_demo.py frappe-bench/apps/crm/crm/ && cd frappe-bench && bench --site crm.localhost execute crm.mti_demo.cargar"
```

Abrir http://localhost:8000/mti · usuarios de prueba `mcamila@mti.demo`, `ncelis@mti.demo`,
`wvasquez@mti.demo`, `mcelis@mti.demo` (clave `Mti.2026!`, solo local).

Para producción ver [docs/04-despliegue-y-mantenimiento.md](docs/04-despliegue-y-mantenimiento.md).

## Documentación

| Documento | Para quién |
|---|---|
| [01 · Arquitectura](docs/01-arquitectura.md) | Visión técnica: componentes, decisiones, seguridad |
| [02 · Código](docs/02-codigo.md) | Desarrolladores: instalador, pantallas, cómo extender y publicar |
| [03 · Configuración de Frappe](docs/03-frappe.md) | Inventario de campos, etapas, automatizaciones, roles y formularios |
| [04 · Despliegue y mantenimiento](docs/04-despliegue-y-mantenimiento.md) | Administrador de MTI: usuarios, copias, cambios sin código, problemas frecuentes |
| [05 · Manual de uso](docs/05-manual-de-uso.md) | Usuarios: Comercial, Proyectos, Logística y Gerencia |

## Archivos

| Archivo | Qué es |
|---|---|
| `mti_instalar.py` | Instalador (Python 3, sin dependencias) |
| `mti_app.js`, `mti_app.css` | Pantallas `/mti` |
| `mti_logo_grande.png`, `mti_favicon.png` | Logo de MTI |
| `docker-compose.yml`, `init.sh` | Entorno local |
| `mti_demo.py` | Datos de demostración (solo local) |

## Licencia

El código de este repositorio se publica bajo la licencia **MIT** (ver [LICENSE](LICENSE)).
Frappe Framework (MIT) y Frappe CRM (AGPL-3.0) conservan sus propias licencias. El logo y los datos de la
empresa pertenecen a MTI Grúas.
