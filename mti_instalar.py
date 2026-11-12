"""
Instalador de la configuración MTI Grúas sobre Frappe CRM (versión 3 · estándar).

Funciona igual contra el entorno local y contra Frappe Cloud porque solo usa la API
estándar de Frappe con la cuenta de administrador. No usa Server Scripts ni código
instalado en el servidor: todo queda como configuración estándar (campos
personalizados, etapas, automatizaciones visuales, permisos por rol y una Página web).

Uso (desde la carpeta del proyecto):
    Local:          docker compose exec frappe python3 /workspace/mti_instalar.py
    Frappe Cloud:   docker compose exec frappe python3 /workspace/mti_instalar.py \
                        --url https://mtigruas.frappe.cloud --clave "CLAVE_DEL_ADMINISTRADOR"

Opciones:
    --usuarios-demo   crea los usuarios de prueba (mcamila@mti.demo, ...). No usar en producción.
    --solo-pantallas  solo vuelve a publicar /mti (mti_app.js y mti_app.css).

Se puede ejecutar varias veces: actualiza lo que existe y crea lo que falta, sin duplicar.
Solo usa la biblioteca estándar de Python 3.
"""

import argparse
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
SERIE = "OF-.#####"
PRIMERA_OFERTA = 40513  # desde nov. 2026 las ofertas nuevas siguen desde la 40513 (antes 40448). Nunca baja el contador
CLAVE_DEMO = "Mti.2026!"

ABIERTAS = ["Cotización enviada", "Seguimiento"]

# nombre, color, tipo, probabilidad
ESTADOS = [
	("Solicitud recibida", "gray", "Open", 5),
	("Visita técnica", "orange", "Ongoing", 15),
	("Análisis de Proyectos", "blue", "Ongoing", 30),
	("Cotización preparada", "cyan", "Ongoing", 45),
	("Cotización enviada", "amber", "Ongoing", 55),
	("Seguimiento", "yellow", "Ongoing", 65),
	("En modificación", "purple", "Ongoing", 60),
	("Aprobada", "green", "Won", 100),
	("Enviada a Logística", "teal", "Won", 100),
	("Programada", "violet", "Won", 100),
	("En ejecución", "pink", "Won", 100),
	("Ejecutada", "black", "Won", 100),
	("En espera", "gray", "On Hold", 30),
	("Perdida", "red", "Lost", 0),
	("Cancelada", "gray", "Lost", 0),
]

# Perfiles MTI. Todos los usuarios llevan además "Sales Manager" (rol estándar de Frappe CRM):
# en Frappe CRM un "Sales User" solo ve sus propias ofertas y en MTI todas las áreas ven todas.
# El perfil MTI decide qué botones y pestañas ve cada uno en /mti (Gerencia: solo consulta).
ROLES_MTI = ["MTI Comercial", "MTI Proyectos", "MTI Logística", "MTI Gerencia"]

USUARIOS_DEMO = [
	# correo, nombre, apellido, roles
	("mcamila@mti.demo", "María Camila", "Vásquez", ["Sales Manager", "Sales User", "MTI Comercial", "MTI Logística"]),
	("ncelis@mti.demo", "Néstor", "Celis", ["Sales Manager", "Sales User", "MTI Proyectos"]),
	("wvasquez@mti.demo", "William", "Vásquez", ["Sales Manager", "Sales User", "MTI Logística"]),
	("mcelis@mti.demo", "Marco", "Celis", ["Sales Manager", "MTI Gerencia"]),
]

FUENTES = ["WhatsApp", "Correo", "Llamada", "Referido"]
MOTIVOS_PERDIDA = [
	"Precio",
	"Eligió a la competencia",
	"Proyecto cancelado o aplazado",
	"Cliente sin respuesta",
	"Equipo no disponible en la fecha",
	"Servicio cancelado por el cliente",
]

# Equipos = Productos estándar de Frappe CRM (código, categoría, capacidad en t)
EQUIPOS = [
	("Grúa 30 t", "Grúa", 30),
	("Grúa 50 t", "Grúa", 50),
	("Grúa 90 t", "Grúa", 90),
	("Grúa 150 t", "Grúa", 150),
	("Cama alta", "Transporte", 0),
	("Cama baja", "Transporte", 0),
	("Tractocamión con plancha", "Transporte", 0),
]
# Personal y servicios (catálogo simple, editable desde /mti o desde la lista "MTI Catalogo")
CATALOGO = [
	("Personal", "J. Pérez", "Técnico de visitas"),
	("Personal", "L. Gómez", "Técnico de visitas"),
	("Personal", "Carlos Rincón", "Operador"),
	("Personal", "Édgar Molina", "Operador"),
	("Personal", "Jhon Suárez", "Aparejador"),
	("Personal", "Fabián Rojas", "Conductor"),
	("Servicio", "Izaje", ""),
	("Servicio", "Montaje", ""),
	("Servicio", "Desmontaje y traslado", ""),
	("Servicio", "Cargue y descargue", ""),
	("Servicio", "Reubicación", ""),
	("Servicio", "Transporte", ""),
	("Servicio", "Alquiler con operador", ""),
	("Servicio", "Movimiento manual", ""),
]

EMPRESA = {
	"empresa_nombre": "MONTAJES TELESCÓPICOS INDUSTRIALES SAS",
	"empresa_nit": "901.120.491-6",
	"formato_codigo": "MTI-CL-FR-002 V:01",
	"pie_pagina": "Celular 310 272 39 38\n"
	"Avenida Calle 17 No. 52 - 36 Zona Industrial – Puente Aranda Bogotá – Colombia\nwww.mtigruas.com",
	"clausula_primero": "La disponibilidad de la grúa inicia a contar desde que el equipo se presenta en portería y "
	"hasta que se retire de la planta, en consecuencia, cualquier inspección, capacitación, curso, autorización "
	"de ingreso y salida, arme y desarme de la grúa contará en la disponibilidad y será por cuenta del "
	"CONTRATANTE. PARÁGRAFO PRIMERO: LA EMPRESA podrá retirar la grúa una vez se ejecute la labor contratada "
	"y/o se cumpla el tiempo contratado. Independiente de que la grúa termine en menos tiempo del contratado. "
	"- Únicamente para el movimiento descrito en TRABAJO A EJECUTAR",
	"clausulas_finales": "Tercero. LA SEGURIDAD DE LA EJECUCIÓN. Dependerá en parte del DESTINATARIO DE LA OFERTA, "
	"quien en calidad de custodio y guardián del equipo contratado tendrá bajo su dependencia el personal a cargo "
	"y suministrado, además de la supervisión, control y dirección de la actividad que se despliega.\n"
	"Cuarto. PERMISOS. Es responsabilidad del Contratante obtener los permisos necesarios para el ingreso y "
	"ubicación de nuestro personal y equipos al lugar de operación, ya sea en zona privada o pública. Además, EL "
	"CONTRATANTE debe garantizar la capacidad portante del suelo, así como la limpieza de la zona de anclaje del equipo.\n"
	"Quinto. SEGUROS. LA EMPRESA cuenta con una póliza de responsabilidad civil extracontractual por "
	"$3.000.000.000, no obstante, se aclara que el elemento a izar no está cubierto por la póliza, por tal motivo "
	"es responsabilidad del CONTRATANTE tener la carga asegurada. LA EMPRESA NO SE HACE RESPONSABLE POR DAÑOS "
	"OCASIONADOS AL ELEMENTO IZADO EN EL MARCO DE LA OFERTA MERCANTIL.\n"
	"Sexto. FORMA DE PAGO. Consignación anticipada en efectivo o por transferencia del 100 % a la cuenta de ahorros "
	"número 002870696982 de DAVIVIENDA a nombre de MONTAJES TELESCÓPICOS INDUSTRIALES SAS.",
}


# ---------------------------------------------------------------------------
# Cliente de la API estándar de Frappe
# ---------------------------------------------------------------------------


class Frappe:
	def __init__(self, url, usuario, clave):
		self.url = url.rstrip("/")
		jar = http.cookiejar.CookieJar()
		manejadores = [urllib.request.HTTPCookieProcessor(jar)]
		if "localhost" in self.url or "127.0.0.1" in self.url:
			manejadores.append(urllib.request.ProxyHandler({}))
		self.op = urllib.request.build_opener(*manejadores)
		self.metodo("login", {"usr": usuario, "pwd": clave})

	def _req(self, verbo, ruta, datos=None):
		cuerpo, cab = None, {"Accept": "application/json"}
		if datos is not None:
			cuerpo = json.dumps(datos).encode()
			cab["Content-Type"] = "application/json"
		req = urllib.request.Request(self.url + urllib.parse.quote(ruta, safe="/?=&%"), data=cuerpo, method=verbo, headers=cab)
		try:
			with self.op.open(req, timeout=120) as r:
				return json.loads(r.read() or b"{}")
		except urllib.error.HTTPError as e:
			texto = e.read().decode(errors="replace")
			try:
				j = json.loads(texto)
				msg = j.get("_server_messages") or j.get("exception") or j.get("message") or texto
				if isinstance(msg, str) and msg.startswith("["):
					msg = " ".join(json.loads(m).get("message", m) if m.startswith("{") else m for m in json.loads(msg))
			except Exception:
				msg = texto
			err = RuntimeError(f"{e.code} · {verbo} {ruta}: {str(msg)[:600]}")
			err.code = e.code
			raise err from None

	def metodo(self, nombre, datos=None):
		return self._req("POST", "/api/method/" + nombre, datos or {}).get("message")

	def existe(self, doctype, nombre):
		try:
			self._req("GET", f"/api/resource/{doctype}/{urllib.parse.quote(str(nombre), safe='')}")
			return True
		except RuntimeError as e:
			if getattr(e, "code", 0) == 404:
				return False
			raise

	def obtener(self, doctype, nombre):
		return self._req("GET", f"/api/resource/{doctype}/{urllib.parse.quote(str(nombre), safe='')}")["data"]

	def lista(self, doctype, campos=("name",), filtros=None, limite=0):
		q = {"fields": json.dumps(list(campos)), "limit_page_length": limite}
		if filtros:
			q["filters"] = json.dumps(filtros)
		return self._req("GET", f"/api/resource/{doctype}?" + urllib.parse.urlencode(q, quote_via=urllib.parse.quote))["data"]

	def crear(self, doctype, datos):
		return self._req("POST", f"/api/resource/{doctype}", datos)["data"]

	def actualizar(self, doctype, nombre, datos):
		return self._req("PUT", f"/api/resource/{doctype}/{urllib.parse.quote(str(nombre), safe='')}", datos)["data"]

	def borrar(self, doctype, nombre):
		self._req("DELETE", f"/api/resource/{doctype}/{urllib.parse.quote(str(nombre), safe='')}")

	def guardar(self, doctype, nombre, datos):
		"""Crea o actualiza un documento con nombre conocido."""
		if self.existe(doctype, nombre):
			return self.actualizar(doctype, nombre, datos)
		return self.crear(doctype, datos)


def paso(titulo):
	print("•", titulo, flush=True)


# ---------------------------------------------------------------------------
# Configuración general
# ---------------------------------------------------------------------------


def configurar_sistema(f):
	paso("Idioma, zona horaria y moneda (COP)")
	f.actualizar("System Settings", "System Settings", {
		"language": "es", "time_zone": "America/Bogota", "country": "Colombia", "date_format": "dd-mm-yyyy",
		"number_format": "#.###,##", "currency": "COP", "float_precision": "3", "currency_precision": "0",
	})
	if f.existe("Currency", "COP"):
		f.actualizar("Currency", "COP", {"enabled": 1, "symbol": "$", "number_format": "#.###,##"})
	else:
		f.crear("Currency", {"currency_name": "COP", "symbol": "$", "fraction": "Centavo", "fraction_units": 100,
			"number_format": "#.###,##", "enabled": 1})
	f.actualizar("FCRM Settings", "FCRM Settings", {"currency": "COP", "brand_name": "MTI Grúas"})
	# Al iniciar sesión, los usuarios de MTI llegan directo a las pantallas /mti
	try:
		f.actualizar("Website Settings", "Website Settings", {"home_page": "mti"})
	except RuntimeError as e:
		print("  (no se pudo fijar la página de inicio:", str(e)[:120], ")")


def poner_logo(f):
	"""Logo y favicon de MTI en el CRM estándar (Configuración del CRM → Marca)."""
	paso("Logo de MTI en el CRM")
	import base64
	actual = f.obtener("FCRM Settings", "FCRM Settings")
	for campo, archivo in (("brand_logo", "mti_logo_grande.png"), ("favicon", "mti_favicon.png")):
		ruta = os.path.join(AQUI, archivo)
		if not os.path.exists(ruta) or str(actual.get(campo) or "").endswith(archivo):
			continue
		with open(ruta, "rb") as fh:
			datos = base64.b64encode(fh.read()).decode()
		f.metodo("frappe.client.attach_file", {"filename": archivo, "filedata": datos, "decode_base64": 1,
			"doctype": "FCRM Settings", "docname": "FCRM Settings", "docfield": campo, "is_private": 0})
	# el mismo logo en la pantalla de ingreso y en el escritorio de Frappe
	logo = f.obtener("FCRM Settings", "FCRM Settings").get("brand_logo")
	if logo:
		try:
			f.actualizar("Navbar Settings", "Navbar Settings", {"app_logo": logo})
		except RuntimeError as e:
			print("  (logo de la pantalla de ingreso no fijado:", str(e)[:100], ")")


def crear_roles(f):
	paso("Perfiles MTI (roles)")
	for rol in ROLES_MTI:
		if not f.existe("Role", rol):
			f.crear("Role", {"role_name": rol, "desk_access": 1})


def _doctype(f, nombre, campos, **props):
	"""Crea o completa un DocType personalizado (Personalizar → Nuevo DocType)."""
	if f.existe("DocType", nombre):
		dt = f.obtener("DocType", nombre)
		existentes = {c["fieldname"] for c in dt["fields"]}
		nuevos = [c for c in campos if c["fieldname"] not in existentes]
		if nuevos:
			f.actualizar("DocType", nombre, {"fields": dt["fields"] + nuevos})
		return
	f.crear("DocType", {"name": nombre, "module": "FCRM", "custom": 1, "fields": campos, **props})


def crear_doctypes(f):
	paso("Tipos de documento propios (configuración, trabajos y catálogo)")
	todos = [{"role": r, "read": 1, "write": 1, "create": 1, "delete": 1, "report": 1, "export": 1}
		for r in ("System Manager", "Sales Manager", "Sales User")]
	lectura = [{"role": "MTI Gerencia", "read": 1, "report": 1, "export": 1}]

	_doctype(f, "MTI Configuracion", [
		{"fieldname": "sec_semaforo", "fieldtype": "Section Break", "label": "Reglas del semáforo"},
		{"fieldname": "verde_hasta", "fieldtype": "Int", "label": "Verde: de 0 a (días)", "default": "2"},
		{"fieldname": "amarillo_hasta", "fieldtype": "Int", "label": "Amarillo: hasta (días)", "default": "4"},
		{"fieldname": "dias_proximo_contacto", "fieldtype": "Int", "label": "Próximo contacto por defecto (días)", "default": "3"},
		{"fieldname": "dias_vigencia", "fieldtype": "Int", "label": "Vigencia de la oferta (días)", "default": "15"},
		{"fieldname": "sec_avisos", "fieldtype": "Section Break", "label": "Avisos"},
		{"fieldname": "avisar_app", "fieldtype": "Check", "label": "Avisar en la aplicación", "default": "1"},
		{"fieldname": "avisar_correo", "fieldtype": "Check", "label": "Avisar por correo", "default": "1"},
		{"fieldname": "avisar_whatsapp", "fieldtype": "Check", "label": "Avisar por WhatsApp", "default": "0"},
		{"fieldname": "resumen_diario", "fieldtype": "Check", "label": "Resumen diario", "default": "1"},
		{"fieldname": "hora_resumen", "fieldtype": "Data", "label": "Hora del resumen", "default": "7:30"},
		{"fieldname": "sec_resp", "fieldtype": "Section Break", "label": "Responsables por área"},
		{"fieldname": "proyectos_default", "fieldtype": "Link", "options": "User", "label": "Dirección de Proyectos"},
		{"fieldname": "logistica_default", "fieldtype": "Link", "options": "User", "label": "Logística"},
		{"fieldname": "sec_oferta", "fieldtype": "Section Break", "label": "Formato de la oferta (impresión)"},
		{"fieldname": "empresa_nombre", "fieldtype": "Data", "label": "Razón social"},
		{"fieldname": "empresa_nit", "fieldtype": "Data", "label": "NIT"},
		{"fieldname": "formato_codigo", "fieldtype": "Data", "label": "Código del formato"},
		{"fieldname": "clausula_primero", "fieldtype": "Long Text", "label": "Cláusula Primero (disponibilidad)"},
		{"fieldname": "clausulas_finales", "fieldtype": "Long Text", "label": "Cláusulas Tercero a Sexto"},
		{"fieldname": "pie_pagina", "fieldtype": "Small Text", "label": "Pie de página"},
	], issingle=1, permissions=todos + lectura)

	_doctype(f, "MTI Trabajo", [
		{"fieldname": "descripcion", "fieldtype": "Small Text", "label": "Trabajo", "in_list_view": 1},
		{"fieldname": "equipo", "fieldtype": "Data", "label": "Equipo", "in_list_view": 1},
		{"fieldname": "altura", "fieldtype": "Float", "label": "Altura (m)", "in_list_view": 1},
		{"fieldname": "radio", "fieldtype": "Float", "label": "Radio (m)", "in_list_view": 1},
		{"fieldname": "peso", "fieldtype": "Float", "label": "Peso (t)", "in_list_view": 1},
		{"fieldname": "especificaciones", "fieldtype": "Small Text", "label": "Especificaciones"},
	], istable=1, editable_grid=1)

	# Desglose del precio de un trabajo ejecutado (la oferta se cotiza unificada y al final se reparte)
	_doctype(f, "MTI Desglose", [
		{"fieldname": "concepto", "fieldtype": "Data", "label": "Equipo / concepto", "reqd": 1, "in_list_view": 1},
		{"fieldname": "valor", "fieldtype": "Currency", "label": "Valor", "in_list_view": 1},
		{"fieldname": "nota", "fieldtype": "Data", "label": "Nota", "in_list_view": 1},
	], istable=1, editable_grid=1)

	# Horas/días adicionales u otros cobros registrados al ejecutar el servicio
	_doctype(f, "MTI Adicional", [
		{"fieldname": "linea", "fieldtype": "Data", "label": "Equipo / concepto", "reqd": 1, "in_list_view": 1},
		{"fieldname": "tipo", "fieldtype": "Select", "label": "Tipo", "in_list_view": 1,
			"options": "Horas adicionales\nDías adicionales\nSemanas adicionales\nQuincenas adicionales\nMeses adicionales\nCobro adicional"},
		{"fieldname": "cantidad", "fieldtype": "Float", "label": "Cantidad", "in_list_view": 1},
		{"fieldname": "valor_unitario", "fieldtype": "Currency", "label": "Valor unidad"},
		{"fieldname": "valor", "fieldtype": "Currency", "label": "Valor", "in_list_view": 1},
		{"fieldname": "descripcion", "fieldtype": "Data", "label": "Motivo", "in_list_view": 1},
	], istable=1, editable_grid=1)

	_doctype(f, "MTI Catalogo", [
		{"fieldname": "tipo", "fieldtype": "Select", "label": "Tipo", "options": "Personal\nServicio", "reqd": 1, "in_list_view": 1, "in_standard_filter": 1},
		{"fieldname": "nombre", "fieldtype": "Data", "label": "Nombre", "reqd": 1, "in_list_view": 1},
		{"fieldname": "categoria", "fieldtype": "Data", "label": "Cargo / categoría", "in_list_view": 1},
		{"fieldname": "activo", "fieldtype": "Check", "label": "Activo", "default": "1", "in_list_view": 1},
	], autoname="hash", title_field="nombre", permissions=todos + lectura)


def campo(fieldname, fieldtype, label, **kw):
	return dict(fieldname=fieldname, fieldtype=fieldtype, label=label, **kw)


NOTAS = "\nNA\n10\n9\n8\n7\n6\n5\n4\n3\n2\n1"

CAMPOS_OFERTA = [
	campo("mti_tab", "Tab Break", "MTI"),
	campo("mti_sec_oferta", "Section Break", "Oferta mercantil"),
	campo("mti_codigo", "Data", "Oferta No.", read_only=1, in_list_view=1, in_standard_filter=1),
	campo("mti_version", "Int", "Versión", default="0", read_only=1),
	campo("mti_servicio", "Data", "Servicio", in_list_view=1, in_standard_filter=1),
	campo("mti_ubicacion", "Data", "Lugar de prestación del servicio"),
	campo("mti_col_o1", "Column Break", ""),
	campo("mti_equipo", "Data", "Equipos de la oferta", read_only=1),
	campo("mti_vigencia", "Date", "Vigencia de la oferta"),
	campo("mti_sec_tecnica", "Section Break", "Trabajo a ejecutar"),
	campo("mti_trabajos", "Table", "Trabajos", options="MTI Trabajo"),
	campo("mti_altura", "Float", "Altura máxima (m)", read_only=1),
	campo("mti_radio", "Float", "Radio máximo (m)", read_only=1),
	campo("mti_peso", "Float", "Peso máximo (t)", read_only=1),
	campo("mti_col_t1", "Column Break", ""),
	campo("mti_restricciones", "Small Text", "Restricciones del sitio"),
	campo("mti_observaciones", "Small Text", "Observaciones técnicas"),
	campo("mti_diagrama", "Attach", "Diagrama de izaje (Compu Crane)"),
	campo("mti_sec_visita", "Section Break", "Visita técnica"),
	campo("mti_requiere_visita", "Check", "Requiere visita técnica", default="1"),
	campo("mti_estado_visita", "Select", "Estado de la visita", options="\nPor agendar\nProgramada\nPendiente de información\nRealizada\nNo requerida"),
	campo("mti_fecha_visita", "Datetime", "Fecha de la visita"),
	campo("mti_tecnico", "Data", "Técnico que realiza la visita"),
	campo("mti_recordar_visita", "Check", "Recordarme 1 día antes", default="1"),
	campo("mti_avisar_tecnico", "Check", "Avisar al técnico", default="1"),
	campo("mti_col_v1", "Column Break", "Checklist de levantamiento"),
	campo("mti_chk_ubicacion", "Check", "✔ Ubicación / acceso"),
	campo("mti_chk_altura", "Check", "✔ Altura de izaje"),
	campo("mti_chk_radio", "Check", "✔ Radio de operación"),
	campo("mti_chk_peso", "Check", "✔ Peso de la carga"),
	campo("mti_chk_restricciones", "Check", "✔ Restricciones del sitio"),
	campo("mti_chk_fotos", "Check", "✔ Fotos"),
	campo("mti_sec_ajuste", "Section Break", "Renegociación"),
	campo("mti_tipo_ajuste", "Select", "Tipo de ajuste", options="\nComercial\nTécnico"),
	campo("mti_motivo_ajuste", "Small Text", "Qué pidió el cliente"),
	campo("mti_versiones", "Long Text", "Versiones anteriores (JSON)", hidden=1),
	campo("mti_oferta_html", "Long Text", "Texto editado de la oferta al cliente", hidden=1, ignore_xss_filter=1),
	campo("mti_oferta_base", "Data", "Huella de la plantilla editada", hidden=1),
	campo("mti_oferta_editada", "Datetime", "Texto de la oferta editado el", read_only=1),
	campo("mti_oferta_editor", "Link", "Texto de la oferta editado por", options="User", read_only=1),
	campo("mti_sec_log", "Section Break", "Logística"),
	campo("mti_fecha_solicitada", "Date", "Fecha solicitada por el cliente"),
	campo("mti_hora_solicitada", "Data", "Hora solicitada"),
	campo("mti_contacto_sitio", "Data", "Contacto en sitio"),
	campo("mti_tel_sitio", "Data", "Teléfono en sitio"),
	campo("mti_col_l1", "Column Break", ""),
	campo("mti_notas_logistica", "Small Text", "Notas para Logística"),
	campo("mti_fecha_servicio", "Date", "Inicio programado del servicio", read_only=1),
	campo("mti_reprogramaciones", "Int", "Reprogramaciones", read_only=1),
	campo("mti_fecha_ejecucion", "Date", "Fecha de ejecución"),
	campo("mti_sec_adic", "Section Break", "Adicionales y valor final"),
	campo("mti_adicionales", "Table", "Adicionales del servicio", options="MTI Adicional"),
	campo("mti_valor_adicionales", "Currency", "Total adicionales", read_only=1),
	campo("mti_valor_final", "Currency", "Valor final consolidado", read_only=1),
	campo("mti_sec_cierre", "Section Break", "Reporte diario y calificación del cliente"),
	campo("mti_reporte_diario", "Data", "N.º reporte diario"),
	campo("mti_recibido_por", "Data", "Vo. Bo. recibido por"),
	campo("mti_reporte_foto", "Attach", "Foto del reporte firmado"),
	campo("mti_obs_cliente", "Small Text", "Comentario del cliente"),
	campo("mti_col_c1", "Column Break", ""),
	campo("mti_cal_calidad", "Select", "Calidad del servicio prestado", options=NOTAS),
	campo("mti_cal_personal", "Select", "Desempeño del personal de MTI", options=NOTAS),
	campo("mti_cal_maquinaria", "Select", "Maquinaria enviada", options=NOTAS),
	campo("mti_cal_puntualidad", "Select", "Puntualidad en el servicio", options=NOTAS),
	campo("mti_cal_promedio", "Float", "Calificación promedio", read_only=1),
	campo("mti_sec_desglose", "Section Break", "Desglose del precio (históricos)"),
	campo("mti_desglose", "Table", "Desglose del precio", options="MTI Desglose"),
	campo("mti_sec_espera", "Section Break", "En espera"),
	campo("mti_estado_previo", "Data", "Etapa antes de la espera", read_only=1),
	campo("mti_fecha_espera", "Date", "En espera desde", read_only=1),
	campo("mti_col_e1", "Column Break", ""),
	campo("mti_motivo_espera", "Small Text", "Motivo de la espera"),
	campo("mti_retomar_el", "Date", "Retomar el"),
	campo("mti_sec_resp", "Section Break", "Seguimiento"),
	campo("mti_resp_proyectos", "Link", "Responsable de Proyectos", options="User"),
	campo("mti_resp_logistica", "Link", "Responsable de Logística", options="User"),
	campo("mti_aprobo_envio", "Link", "Envió la oferta", options="User", read_only=1),
	campo("mti_col_s1", "Column Break", ""),
	campo("mti_semaforo", "Select", "Semáforo", options="\n🟢 Verde\n🟡 Amarillo\n🔴 Rojo\n⚪ Sin enviar", in_list_view=1),
	campo("mti_fecha_envio", "Date", "Fecha de envío"),
	campo("mti_ultimo_contacto", "Date", "Último contacto"),
	campo("mti_proximo_contacto", "Date", "Próximo contacto", in_list_view=1),
]

# Columnas extra de los Productos de la oferta (cada producto = una línea: equipo, modalidad, valores…)
CAMPOS_LINEA = [
	campo("mti_tipo", "Select", "Tipo de línea", options="Equipo\nTransporte\nOtro", default="Equipo"),
	campo("mti_descripcion", "Data", "Descripción MTI"),
	campo("mti_modalidad", "Select", "Modalidad", options="Hora\nDía\nSemana\nQuincena\nMes\nGlobal", default="Día"),
	campo("mti_horas_jornada", "Int", "Horas por jornada", default="10"),
	campo("mti_jornada", "Select", "Jornada", options="Diurna\nNocturna\nMixta\n24 horas", default="Diurna"),
	campo("mti_movilizacion", "Check", "Incluye movilización", default="1"),
	campo("mti_valor_adicional", "Currency", "Valor unidad adicional", options="currency"),
	campo("mti_incluir", "Check", "Incluir en la oferta al cliente", default="1", in_list_view=1),
	campo("mti_sec_prog", "Section Break", "Programación (Logística)"),
	campo("mti_prog_desde", "Date", "Programado desde"),
	campo("mti_prog_hasta", "Date", "Programado hasta"),
	campo("mti_prog_hora_inicio", "Data", "Hora de inicio"),
	campo("mti_prog_hora_fin", "Data", "Hora de fin"),
	campo("mti_prog_dias", "Select", "Frecuencia", options="\nLunes a viernes\nLunes a sábado\nTodos los días"),
	campo("mti_prog_operador", "Data", "Operador asignado"),
	campo("mti_prog_notas", "Small Text", "Notas de programación"),
]

CAMPOS_EQUIPO = [
	campo("mti_categoria", "Select", "Categoría MTI", options="Grúa\nTransporte\nOtro", default="Grúa"),
	campo("mti_capacidad", "Float", "Capacidad (t)"),
]

CAMPOS_CLIENTE = [
	campo("mti_sec_cliente", "Section Break", "Datos del cliente (MTI)"),
	campo("mti_nit", "Data", "NIT"),
	campo("mti_direccion", "Data", "Dirección"),
	campo("mti_contacto", "Data", "Contacto principal"),
	campo("mti_telefono", "Data", "Teléfono"),
	campo("mti_email", "Data", "Correo"),
]


def _campos(f, doctype, campos, despues_de):
	anterior = despues_de
	for c in campos:
		datos = {"dt": doctype, "insert_after": anterior, **c}
		f.guardar("Custom Field", f"{doctype}-{c['fieldname']}", datos)
		anterior = c["fieldname"]


def _propiedad(f, doctype, campo_, propiedad, valor, tipo="Text"):
	f.guardar("Property Setter", f"{doctype}-{campo_}-{propiedad}", {
		"doctype_or_field": "DocField", "doc_type": doctype, "field_name": campo_,
		"property": propiedad, "value": valor, "property_type": tipo,
	})


def crear_campos(f):
	paso("Campos personalizados (oferta, líneas, equipos y clientes)")
	_campos(f, "CRM Deal", CAMPOS_OFERTA, "lost_notes")
	_campos(f, "CRM Products", CAMPOS_LINEA, "net_amount")
	_campos(f, "CRM Product", CAMPOS_EQUIPO, "standard_rate")
	_campos(f, "CRM Organization", CAMPOS_CLIENTE, "company_description")
	# Número de oferta MTI: OF-40513, OF-40514…
	_propiedad(f, "CRM Deal", "naming_series", "options", SERIE)
	_propiedad(f, "CRM Deal", "naming_series", "default", SERIE)
	fijar_consecutivo(f)


def _num_oferta(nombre):
	try:
		return int(str(nombre).split("-", 1)[1].split(".")[0])
	except (IndexError, ValueError):
		return 0


def fijar_consecutivo(f):
	"""La siguiente oferta nueva será PRIMERA_OFERTA, o la siguiente a la más alta que ya exista.
	Nunca baja el contador (no se repiten números)."""
	try:
		ultimas = f.lista("CRM Deal", ("name",), [["name", "like", "OF-%"]], 0)
		mayor = max([_num_oferta(x["name"]) for x in ultimas] or [0])
		dns = f.obtener("Document Naming Settings", "Document Naming Settings")
		dns.update({"prefix": SERIE})
		try:
			r = f._req("POST", "/api/method/run_doc_method", {"method": "get_current", "docs": json.dumps(dns)})
			v = r.get("message")
			if v in (None, ""):
				v = ((r.get("docs") or [{}])[0] or {}).get("current_value")
			contador = int(v) if v not in (None, "") else mayor
		except (RuntimeError, TypeError, ValueError, AttributeError):
			contador = mayor
		objetivo = max(PRIMERA_OFERTA - 1, mayor)
		if contador < objetivo:
			dns.update({"current_value": objetivo})
			f.metodo("run_doc_method", {"method": "update_series_start", "docs": json.dumps(dns)})
			print(f"  · la siguiente oferta nueva será la {objetivo + 1}")
		else:
			print(f"  · consecutivo de ofertas sin cambios: la siguiente será la {contador + 1}")
	except RuntimeError as e:
		print("  (no se pudo fijar el consecutivo de ofertas:", str(e)[:150], ")")


def restringir_exportacion(f):
	"""Comercial y Logística (y cualquier Sales User/Manager) no exportan clientes ni contactos desde el CRM.
	Proyectos y Gerencia exportan desde /mti → Clientes; el administrador (System Manager) conserva todo."""
	paso("Exportación de clientes solo desde /mti (Proyectos y Gerencia)")
	for dt in ("CRM Organization", "Contact"):
		for rol in ("Sales Manager", "Sales User"):
			try:
				f.metodo("frappe.core.page.permission_manager.permission_manager.update",
					{"doctype": dt, "role": rol, "permlevel": 0, "ptype": "export", "value": 0})
			except RuntimeError as e:
				print(f"  (no se pudo ajustar {dt}/{rol}: {str(e)[:80]})")


def crear_estados(f):
	paso("Etapas del flujo MTI (15)")
	for pos, (nombre, color, tipo, prob) in enumerate(ESTADOS, start=1):
		f.guardar("CRM Deal Status", nombre, {"deal_status": nombre, "color": color, "type": tipo, "position": pos, "probability": prob})
	nuestros = {e[0] for e in ESTADOS}
	for st in f.lista("CRM Deal Status"):
		if st["name"] not in nuestros and not f.lista("CRM Deal", filtros={"status": st["name"]}, limite=1):
			try:
				f.borrar("CRM Deal Status", st["name"])
			except RuntimeError:
				pass


def crear_catalogos(f, datos_iniciales=True):
	paso("Listas: canales, motivos de pérdida, equipos, personal y servicios")
	for fuente in FUENTES:
		if not f.existe("CRM Lead Source", fuente):
			f.crear("CRM Lead Source", {"source_name": fuente})
	for motivo in MOTIVOS_PERDIDA:
		if not f.existe("CRM Lost Reason", motivo):
			f.crear("CRM Lost Reason", {"lost_reason": motivo})
	if not datos_iniciales:
		return
	for codigo, cat, cap in EQUIPOS:
		if not f.existe("CRM Product", codigo):
			f.crear("CRM Product", {"product_code": codigo, "product_name": codigo, "mti_categoria": cat, "mti_capacidad": cap})
	if not f.lista("MTI Catalogo", limite=1):
		for tipo, nombre, cat in CATALOGO:
			f.crear("MTI Catalogo", {"tipo": tipo, "nombre": nombre, "categoria": cat, "activo": 1})


# Ajustes puntuales al texto de la oferta en sitios que ya existen (configurar_mti no pisa lo que MTI
# cambió, así que estos cambios pedidos por MTI se aplican solo si encuentran el texto anterior).
# (campo, texto que debe estar, texto nuevo, texto que indica que ya se aplicó)
AJUSTES_TEXTO = [
	("pie_pagina", "PBX. 57 3103157285 Ext. 101 // 102 Celular", "Celular", None),
	("clausula_primero", "Independiente de que la grúa termine en menos tiempo del contratado.",
		"Independiente de que la grúa termine en menos tiempo del contratado. "
		"- Únicamente para el movimiento descrito en TRABAJO A EJECUTAR",
		"Únicamente para el movimiento descrito en TRABAJO A EJECUTAR"),
]


def configurar_mti(f, demo):
	paso("Reglas del semáforo, responsables y formato de la oferta")
	cfg = f.obtener("MTI Configuracion", "MTI Configuracion")
	cambios = {}
	for k, antes, despues, hecho in AJUSTES_TEXTO:
		txt = cfg.get(k) or ""
		if antes in txt and not (hecho and hecho in txt):
			cambios[k] = txt.replace(antes, despues, 1)
			print(f"  · texto de la oferta actualizado: {k}")
	for k, v in (("verde_hasta", 2), ("amarillo_hasta", 4), ("dias_proximo_contacto", 3), ("dias_vigencia", 15),
			("hora_resumen", "7:30"), ("avisar_app", 1), ("avisar_correo", 1), ("resumen_diario", 1)):
		if not cfg.get(k):
			cambios[k] = v
	for k, v in EMPRESA.items():
		if not cfg.get(k):
			cambios[k] = v
	if demo:
		cambios.setdefault("proyectos_default", cfg.get("proyectos_default") or "ncelis@mti.demo")
		cambios.setdefault("logistica_default", cfg.get("logistica_default") or "wvasquez@mti.demo")
	if cambios:
		f.actualizar("MTI Configuracion", "MTI Configuracion", cambios)


def crear_usuarios_demo(f):
	paso("Usuarios de prueba (clave " + CLAVE_DEMO + ")")
	for email, nombre, apellido, roles in USUARIOS_DEMO:
		if not f.existe("User", email):
			f.crear("User", {"email": email, "first_name": nombre, "last_name": apellido, "send_welcome_email": 0,
				"user_type": "System User", "language": "es", "time_zone": "America/Bogota", "new_password": CLAVE_DEMO,
				"roles": [{"role": r} for r in roles]})
		else:
			u = f.obtener("User", email)
			tiene = {r["role"] for r in u.get("roles", [])}
			faltan = [r for r in roles if r not in tiene]
			if faltan:
				f.actualizar("User", email, {"roles": u["roles"] + [{"role": r} for r in faltan]})


# ---------------------------------------------------------------------------
# Formularios estándar de Frappe CRM (respaldo /crm)
# ---------------------------------------------------------------------------


def configurar_formularios(f):
	paso("Formularios de Frappe CRM (ficha, panel lateral y alta rápida)")
	panel = [
		{"label": "Contacts", "name": "contacts_section", "opened": True, "editable": False, "contacts": []},
		{"label": "Oferta", "name": "mti_datos_clave", "opened": True, "columns": [{"name": "mti_c1", "fields": [
			"mti_codigo", "organization", "mti_servicio", "mti_equipo", "mti_ubicacion", "deal_value", "source"]}]},
		{"label": "Seguimiento", "name": "mti_seguimiento", "opened": True, "columns": [{"name": "mti_c2", "fields": [
			"mti_semaforo", "mti_fecha_envio", "mti_vigencia", "mti_ultimo_contacto", "mti_proximo_contacto"]}]},
		{"label": "Responsables", "name": "mti_responsables", "opened": False, "columns": [{"name": "mti_c3", "fields": [
			"deal_owner", "mti_resp_proyectos", "mti_resp_logistica"]}]},
		{"label": "Logística", "name": "mti_logistica", "opened": False, "columns": [{"name": "mti_c4", "fields": [
			"mti_fecha_solicitada", "mti_hora_solicitada", "mti_contacto_sitio", "mti_tel_sitio", "mti_fecha_servicio", "mti_fecha_ejecucion"]}]},
	]
	datos = [{"name": "first_tab", "sections": [
		{"label": "Trabajo a ejecutar", "name": "mti_s_tecnica", "opened": True, "columns": [
			{"name": "mti_d1", "fields": ["mti_servicio", "mti_ubicacion", "mti_vigencia"]},
			{"name": "mti_d2", "fields": ["mti_altura", "mti_radio", "mti_peso"]},
			{"name": "mti_d3", "fields": ["mti_restricciones", "mti_observaciones", "mti_diagrama"]}]},
		{"label": "Trabajos", "name": "mti_s_trabajos", "opened": True, "columns": [{"name": "mti_d9", "fields": ["mti_trabajos"]}]},
		{"label": "Visita técnica", "name": "mti_s_visita", "opened": True, "columns": [
			{"name": "mti_d4", "fields": ["mti_requiere_visita", "mti_estado_visita", "mti_fecha_visita", "mti_tecnico"]},
			{"name": "mti_d5", "fields": ["mti_chk_ubicacion", "mti_chk_altura", "mti_chk_radio"]},
			{"name": "mti_d6", "fields": ["mti_chk_peso", "mti_chk_restricciones", "mti_chk_fotos"]}]},
		{"label": "Logística", "name": "mti_s_logistica", "opened": True, "columns": [
			{"name": "mti_d7", "fields": ["mti_fecha_solicitada", "mti_hora_solicitada", "mti_contacto_sitio"]},
			{"name": "mti_d8", "fields": ["mti_tel_sitio", "mti_notas_logistica", "mti_fecha_ejecucion"]}]},
		{"label": "Adicionales y valor final", "name": "mti_s_adic", "opened": True, "columns": [
			{"name": "mti_d13", "fields": ["mti_adicionales"]}, {"name": "mti_d14", "fields": ["mti_valor_adicionales", "mti_valor_final"]}]},
		{"label": "Reporte diario y calificación", "name": "mti_s_cierre", "opened": False, "columns": [
			{"name": "mti_d15", "fields": ["mti_reporte_diario", "mti_recibido_por", "mti_reporte_foto", "mti_obs_cliente"]},
			{"name": "mti_d16", "fields": ["mti_cal_calidad", "mti_cal_personal", "mti_cal_maquinaria", "mti_cal_puntualidad", "mti_cal_promedio"]}]},
		{"label": "Desglose del precio", "name": "mti_s_desglose", "opened": True, "columns": [{"name": "mti_d10", "fields": ["mti_desglose"]}]},
		{"label": "En espera / motivo", "name": "mti_s_espera", "opened": False, "columns": [
			{"name": "mti_d11", "fields": ["mti_estado_previo", "mti_fecha_espera", "mti_retomar_el"]},
			{"name": "mti_d12", "fields": ["mti_motivo_espera", "lost_reason", "lost_notes"]}]},
	]}]
	alta = [
		{"name": "organization_section", "hidden": True, "editable": False, "columns": [{"name": "column_GpMP", "fields": ["organization"]}, {"name": "column_FPTn", "fields": []}]},
		{"name": "organization_details_section", "editable": False, "columns": [{"name": "column_S3tQ", "fields": ["organization_name", "territory"]}, {"name": "column_KqV1", "fields": ["website", "annual_revenue", "company_description"]}, {"name": "column_1r67", "fields": ["no_of_employees", "industry", "linkedin", "twitter", "facebook"]}]},
		{"name": "contact_section", "hidden": True, "editable": False, "columns": [{"name": "column_CeXr", "fields": ["contact"]}, {"name": "column_yHbk", "fields": []}]},
		{"name": "contact_details_section", "editable": False, "columns": [{"name": "column_ZTWr", "fields": ["salutation", "email"]}, {"name": "column_tabr", "fields": ["first_name", "mobile_no"]}, {"name": "column_Qjdx", "fields": ["last_name", "gender"]}]},
		{"name": "deal_section", "columns": [{"name": "column_mdps", "fields": ["status", "mti_servicio", "source"]}, {"name": "column_H40H", "fields": ["mti_ubicacion", "mti_requiere_visita"]}]},
	]
	org_alta = [{"name": "details_section", "columns": [
		{"name": "column_o1", "fields": ["organization_name", "mti_nit", "mti_direccion"]},
		{"name": "column_o2", "fields": ["mti_contacto", "mti_telefono", "mti_email"]}]}]
	for dt, tipo, layout in (("CRM Deal", "Side Panel", panel), ("CRM Deal", "Data Fields", datos),
			("CRM Deal", "Quick Entry", alta), ("CRM Organization", "Quick Entry", org_alta)):
		f.guardar("CRM Fields Layout", f"{dt}-{tipo}", {"dt": dt, "type": tipo, "layout": json.dumps(layout)})


def crear_vistas(f):
	paso("Vistas públicas en Frappe CRM (Tablero MTI y Pipeline MTI)")
	vistas = [
		{"label": "Tablero MTI", "type": "list", "doctype": "CRM Deal", "icon": "", "order_by": "modified desc",
			"columns": [
				{"label": "Sem.", "type": "Select", "key": "mti_semaforo", "width": "8rem"},
				{"label": "Oferta", "type": "Data", "key": "mti_codigo", "width": "7rem"},
				{"label": "Cliente", "type": "Link", "key": "organization", "width": "13rem"},
				{"label": "Servicio", "type": "Data", "key": "mti_servicio", "width": "10rem"},
				{"label": "Equipos", "type": "Data", "key": "mti_equipo", "width": "12rem"},
				{"label": "Valor", "type": "Currency", "key": "deal_value", "width": "9rem"},
				{"label": "Estado", "type": "Link", "key": "status", "width": "11rem"},
				{"label": "Próx. contacto", "type": "Date", "key": "mti_proximo_contacto", "width": "8rem"}],
			"rows": ["name", "mti_codigo", "organization", "status", "mti_semaforo", "mti_servicio", "mti_equipo",
				"deal_value", "mti_proximo_contacto", "deal_owner", "modified"]},
		{"label": "Pipeline MTI", "type": "kanban", "doctype": "CRM Deal", "icon": "", "order_by": "modified desc",
			"column_field": "status", "title_field": "organization",
			"kanban_columns": [{"name": e[0]} for e in ESTADOS],
			"kanban_fields": ["mti_codigo", "mti_servicio", "mti_semaforo", "deal_value"]},
	]
	for v in vistas:
		for ex in f.lista("CRM View Settings", filtros={"label": v["label"], "dt": "CRM Deal"}):
			f.borrar("CRM View Settings", ex["name"])
		creada = f.metodo("crm.fcrm.doctype.crm_view_settings.crm_view_settings.create", {"view": v})
		nombre = creada.get("name") if isinstance(creada, dict) else creada
		if nombre:
			f.actualizar("CRM View Settings", nombre, {"public": 1, "pinned": 0, "user": ""})


# ---------------------------------------------------------------------------
# Automatizaciones visuales (Configuración → Automatizaciones en Frappe CRM)
# ---------------------------------------------------------------------------

COD = "{{ doc.mti_codigo or doc.name }}"
RESUMEN = "<p><b>{{ doc.organization }}</b> · {{ doc.mti_servicio or '' }}</p><p>Lugar: {{ doc.mti_ubicacion or '-' }}<br>Equipos: {{ doc.mti_equipo or '-' }}</p>"


def _tarea(titulo, para, descripcion, prioridad="High"):
	return {"doctype": "CRM Task", "values": {
		"title": titulo, "assigned_to": para, "status": "Todo", "priority": prioridad,
		"reference_doctype": "CRM Deal", "reference_docname": "{{ doc.name }}", "description": descripcion}}


def _flujo(titulo, disparo, acciones, filtros=None, condicion=None):
	# revalidate_on_run (solo recordatorios por fecha): justo antes de ejecutar vuelve a revisar
	# filtros y condición; en los cambios de etapa no aplica porque el "cambio" ya pasó.
	d = {"title": titulo, "document_type": "CRM Deal", "enabled": 1, "run_as": "Automation User",
		"automation_user": "Administrator", "stop_on_error": 0, **disparo}
	d["revalidate_on_run"] = 0 if d.get("trigger_type") == "Field Value Changed" else 1
	if filtros:
		d["filters"] = json.dumps(filtros + json.loads(d.get("filters") or "[]"))
	if condicion:
		d["condition"] = condicion
	d["actions"] = [{"step_key": f"paso{i + 1}", "step_type": "Action", "action_type": tipo, "params": json.dumps(p)}
		for i, (tipo, p) in enumerate(acciones)]
	return d


def _cambio_etapa(a):
	return {"trigger_type": "Field Value Changed", "trigger_field": "status", "to_value": a,
		"filters": json.dumps([["status", "=", a]])}


def _en_fecha(campo_, dias, direccion):
	return {"trigger_type": "Date Based", "date_field": campo_, "date_offset": dias, "date_direction": direccion}


def flujos(cfg):
	verde, amarillo = int(cfg.get("verde_hasta") or 2), int(cfg.get("amarillo_hasta") or 4)
	abiertas = [["status", "in", ABIERTAS]]
	return [
		# Traspasos entre áreas
		_flujo("MTI · Traspaso a Proyectos", _cambio_etapa("Análisis de Proyectos"), [("CreateDocument", _tarea(
			"Definir solución técnica · " + COD, "{{ doc.mti_resp_proyectos }}",
			RESUMEN + "<p>Definir equipos, modalidad, configuración y costos. Al terminar, pasar a <b>Cotización preparada</b>.</p>"))]),
		_flujo("MTI · Proyectos terminó: formalizar y enviar", _cambio_etapa("Cotización preparada"), [("CreateDocument", _tarea(
			"Formalizar y enviar · " + COD, "{{ doc.deal_owner }}",
			"<p>Proyectos terminó el análisis. Lista para formalizar y enviar al cliente.</p>" + RESUMEN))]),
		_flujo("MTI · Ajuste técnico pedido por el cliente", _cambio_etapa("En modificación"), [("CreateDocument", _tarea(
			"Ajuste técnico · " + COD, "{{ doc.mti_resp_proyectos }}",
			RESUMEN + "<p>El cliente pidió un cambio técnico: {{ doc.mti_motivo_ajuste or '-' }}</p>"))],
			condicion='doc.mti_tipo_ajuste == "Técnico"'),
		_flujo("MTI · Renegociación comercial", _cambio_etapa("En modificación"), [("CreateDocument", _tarea(
			"Ajustar y reenviar · " + COD, "{{ doc.deal_owner }}",
			RESUMEN + "<p>Renegociación: {{ doc.mti_motivo_ajuste or '-' }}</p>"))],
			condicion='doc.mti_tipo_ajuste != "Técnico"'),
		_flujo("MTI · Aprobada: enviar a Logística", _cambio_etapa("Aprobada"), [("CreateDocument", _tarea(
			"Enviar a Logística · " + COD, "{{ doc.deal_owner }}", "<p>El cliente aprobó la oferta. Enviarla a Logística.</p>"))]),
		_flujo("MTI · Traspaso a Logística", _cambio_etapa("Enviada a Logística"), [("CreateDocument", _tarea(
			"Programar servicio · " + COD, "{{ doc.mti_resp_logistica }}",
			"<p><b>Cliente:</b> {{ doc.organization }}<br><b>Servicio:</b> {{ doc.mti_servicio or '-' }}<br>"
			"<b>Fecha solicitada:</b> {{ doc.mti_fecha_solicitada or '-' }} {{ doc.mti_hora_solicitada or '' }}<br>"
			"<b>Dirección:</b> {{ doc.mti_ubicacion or '-' }}<br><b>Contacto en sitio:</b> {{ doc.mti_contacto_sitio or '-' }} "
			"{{ doc.mti_tel_sitio or '' }}<br><b>Equipos:</b> {{ doc.mti_equipo or '-' }}</p>"
			"<p>Programar fechas, horario y operador en <b>/mti → Programación</b>.</p>"))]),
		# Recordatorios y semáforo
		_flujo("MTI · Semáforo amarillo", _en_fecha("mti_fecha_envio", verde + 1, "After"),
			[("SetFieldValue", {"field": "mti_semaforo", "value": "🟡 Amarillo"})], filtros=abiertas),
		_flujo("MTI · Semáforo rojo: sin respuesta", _en_fecha("mti_fecha_envio", amarillo + 1, "After"), [
			("SetFieldValue", {"field": "mti_semaforo", "value": "🔴 Rojo"}),
			("CreateDocument", _tarea("Sin respuesta · " + COD, "{{ doc.deal_owner }}",
				"<p>{{ doc.organization }} lleva " + str(amarillo + 1) + " días sin respuesta desde el envío. Contactar.</p>"))],
			filtros=abiertas),
		_flujo("MTI · Contactar hoy", _en_fecha("mti_proximo_contacto", 0, "After"), [("CreateDocument", _tarea(
			"Seguimiento · " + COD, "{{ doc.deal_owner }}", "<p>Hoy toca contactar a {{ doc.organization }}.</p>", "Medium"))],
			filtros=abiertas),
		_flujo("MTI · Contacto vencido", _en_fecha("mti_proximo_contacto", 1, "After"),
			[("SetFieldValue", {"field": "mti_semaforo", "value": "🔴 Rojo"})], filtros=abiertas),
		_flujo("MTI · Confirmar visita de mañana", _en_fecha("mti_fecha_visita", 1, "Before"), [("CreateDocument", _tarea(
			"Confirmar visita · " + COD, "{{ doc.deal_owner }}",
			"<p>Visita técnica mañana en {{ doc.organization }} ({{ doc.mti_tecnico or 'sin técnico' }}). Confirmar con el cliente y el técnico.</p>",
			"Medium"))], filtros=[["mti_recordar_visita", "=", 1], ["mti_estado_visita", "!=", "Realizada"]]),
		_flujo("MTI · Retomar oferta en espera", _en_fecha("mti_retomar_el", 0, "After"), [("CreateDocument", _tarea(
			"Retomar oferta · " + COD, "{{ doc.deal_owner }}",
			"<p>Hoy toca retomar la oferta de {{ doc.organization }} que estaba en espera: {{ doc.mti_motivo_espera or '-' }}</p>",
			"Medium"))], filtros=[["status", "=", "En espera"]]),
		_flujo("MTI · Servicio de mañana", _en_fecha("mti_fecha_servicio", 1, "Before"), [("CreateDocument", _tarea(
			"Servicio mañana · " + COD, "{{ doc.mti_resp_logistica }}",
			"<p>Servicio mañana para {{ doc.organization }}: {{ doc.mti_equipo or '' }}. Confirmar operador, movilización y permisos.</p>",
			"Medium"))], filtros=[["status", "=", "Programada"]]),
	]


def crear_flujos(f):
	paso("Automatizaciones: traspasos entre áreas, recordatorios y semáforo (13)")
	cfg = f.obtener("MTI Configuracion", "MTI Configuracion")
	existentes = {x["title"]: x["name"] for x in f.lista("Automation Flow", ("name", "title"), [["title", "like", "MTI ·%"]])}
	for fl in flujos(cfg):
		if fl["title"] in existentes:
			actual = f.obtener("Automation Flow", existentes[fl["title"]])
			fl["enabled"] = actual.get("enabled", 1)  # respeta si MTI la apagó
			f.actualizar("Automation Flow", existentes[fl["title"]], fl)
		else:
			f.crear("Automation Flow", fl)


# ---------------------------------------------------------------------------
# Pantallas /mti (Página web estándar de Frappe)
# ---------------------------------------------------------------------------


def _leer(nombre):
	with open(os.path.join(AQUI, nombre), encoding="utf-8") as fh:
		return fh.read().replace("\r\n", "\n")


def publicar_pantallas(f):
	paso("Pantallas MTI publicadas en /mti")
	datos = {
		"title": "MTI · Ofertas", "route": "mti", "published": 1, "show_title": 0, "full_width": 1,
		"content_type": "HTML", "main_section_html": '<div id="mti-app"><div class="mti-cargando">Cargando…</div></div>',
		"javascript": _leer("mti_app.js"), "insert_style": 1, "css": _leer("mti_app.css"), "dynamic_template": 0,
	}
	existentes = f.lista("Web Page", filtros={"route": "mti"})
	if existentes:
		f.actualizar("Web Page", existentes[0]["name"], datos)
	else:
		f.crear("Web Page", datos)
	# Al iniciar sesión, cada perfil MTI llega directo a /mti
	for rol in ROLES_MTI:
		try:
			f.actualizar("Role", rol, {"home_page": "/mti"})
		except RuntimeError as e:
			print("  (página de inicio del rol", rol, "no fijada:", str(e)[:100], ")")


# ---------------------------------------------------------------------------


def main():
	ap = argparse.ArgumentParser(description="Instala la configuración MTI en un sitio de Frappe CRM")
	ap.add_argument("--url", default="http://localhost:8000", help="dirección del sitio (por defecto el local)")
	ap.add_argument("--usuario", default="Administrator")
	ap.add_argument("--clave", default="admin", help="clave del administrador del sitio")
	ap.add_argument("--usuarios-demo", action="store_true", help="crea los usuarios de prueba (no usar en producción)")
	ap.add_argument("--sin-catalogo", action="store_true", help="no carga equipos, personal ni servicios de ejemplo")
	ap.add_argument("--solo-pantallas", action="store_true", help="solo vuelve a publicar /mti")
	a = ap.parse_args()

	print(f"Conectando a {a.url} …")
	try:
		f = Frappe(a.url, a.usuario, a.clave)
	except Exception as e:
		sys.exit(f"✘ No se pudo iniciar sesión: {e}")

	try:
		if a.solo_pantallas:
			publicar_pantallas(f)
		else:
			configurar_sistema(f)
			poner_logo(f)
			crear_roles(f)
			crear_doctypes(f)
			crear_campos(f)
			restringir_exportacion(f)
			crear_estados(f)
			crear_catalogos(f, not a.sin_catalogo)
			if a.usuarios_demo:
				crear_usuarios_demo(f)
			configurar_mti(f, a.usuarios_demo)
			configurar_formularios(f)
			crear_vistas(f)
			crear_flujos(f)
			publicar_pantallas(f)
	except RuntimeError as e:
		sys.exit(f"\n✘ Se detuvo: {e}\n  Se puede volver a ejecutar: retoma sin duplicar lo que ya quedó.")

	print(f"\n✔ Configuración MTI lista en {a.url}")
	print(f"  Pantallas MTI:  {a.url}/mti")
	print(f"  Frappe CRM:     {a.url}/crm")
	if a.usuarios_demo:
		print(f"  Usuarios demo (clave {CLAVE_DEMO}): " + ", ".join(u[0] for u in USUARIOS_DEMO))


if __name__ == "__main__":
	main()
