"""
Datos de demostración para el prototipo MTI (solo para presentaciones en el entorno local).

NO se usa en producción: en Frappe Cloud se cargan los datos reales de MTI.
Necesita que antes se haya corrido mti_instalar.py con --usuarios-demo.

    docker compose exec frappe bash -lc "cp /workspace/mti_demo.py frappe-bench/apps/crm/crm/ && \
        cd frappe-bench && bench --site crm.localhost execute crm.mti_demo.cargar"

Borra todas las ofertas y vuelve a crear ~60 (activas + histórico de 11 meses) con fechas
relativas al día en que se ejecuta, para que el semáforo, las visitas y la programación
coincidan con el día de la demo.
"""

import json

import random

import frappe
from frappe.model.naming import NamingSeries
from frappe.utils import add_days, add_to_date, get_datetime, getdate, nowdate

SERIE = "OF-.#####"
PRIMERA_OFERTA = 40448
ESTADOS_TIPO = {
	"Solicitud recibida": "Open", "Visita técnica": "Ongoing", "Análisis de Proyectos": "Ongoing",
	"Cotización preparada": "Ongoing", "Cotización enviada": "Ongoing", "Seguimiento": "Ongoing",
	"En modificación": "Ongoing", "Aprobada": "Won", "Enviada a Logística": "Won", "Programada": "Won",
	"En ejecución": "Won", "Ejecutada": "Won", "En espera": "On Hold", "Perdida": "Lost", "Cancelada": "Lost",
}
ABIERTAS = ["Cotización enviada", "Seguimiento"]
PRE_ENVIO = ["Solicitud recibida", "Visita técnica", "Análisis de Proyectos", "Cotización preparada", "En modificación"]


def correo(usuario):
	return f"{usuario}@mti.demo"


def L(equipo, modalidad, cantidad, total, adicional=0, horas=10, jornada="Diurna", tipo="Equipo", desc="", movil=1, incluir=1):
	"""Línea de la oferta. incluir=0: alternativa cotizada que no va en la oferta final al cliente."""
	return dict(
		tipo=tipo, equipo=equipo, descripcion=desc, modalidad=modalidad, cantidad=cantidad, horas_jornada=horas,
		jornada=jornada, movilizacion=movil, valor_adicional=adicional, valor_total=total, incluir=incluir,
	)


def T(desc, altura=0, radio=0, peso=0, equipo="", espec=""):
	"""Trabajo a ejecutar."""
	return dict(descripcion=desc, altura=altura, radio=radio, peso=peso, equipo=equipo, especificaciones=espec)


CLIENTES = {
	# nombre: (NIT, dirección, contacto, teléfono, correo)
	"EMPACOR": ("", "Cra. 81 i #55 a 90 sur, Bogotá", "Programador de mantenimiento", "319 6352705", "programador.mantenimiento@empacor.com"),
	"BIOD SA": ("", "Mancilla – Facatativá", "Felipe Torres", "318 7118029", "felipe.torres@biod.com.co"),
	"Constructora Experta": ("", "Metro estación 12, Bogotá", "Roger", "311 2062935", "roger@constructoraexperta.com"),
	"Constructora Los Pinos": ("900.456.112-3", "Funza, Cundinamarca", "Andrés Ruiz", "310 4567812", "aruiz@lospinos.co"),
	"Industrias Ríomar": ("860.221.904-1", "Soacha, Cundinamarca", "Paola Méndez", "315 7781203", "pmendez@riomar.com.co"),
	"Parque Industrial Siberia": ("901.332.118-7", "Cota, Cundinamarca", "Camilo Torres", "300 9914455", "ctorres@siberiapi.co"),
	"Obra Torre Calle 80": ("", "Calle 80, Bogotá", "Lucía Herrera", "311 2203344", "lherrera@torre80.co"),
	"Logística del Norte": ("900.778.341-0", "Tocancipá, Cundinamarca", "Diego Salazar", "320 5567788", "dsalazar@lognorte.co"),
	"Alimentos La Sabana": ("830.115.672-9", "Mosquera, Cundinamarca", "Mónica Rojas", "301 8892211", "mrojas@lasabana.com.co"),
	"Plásticos Andinos": ("900.601.238-4", "Zona Franca de Bogotá", "Hernán Quiroga", "312 4409876", "hquiroga@plasticosandinos.co"),
	"Concretos La Pradera": ("901.004.556-2", "Chía, Cundinamarca", "Julián Castro", "312 2456789", "jcastro@lapradera.co"),
	"Bodegas San Jorge": ("", "Siberia, Cundinamarca", "Andrea Vargas", "316 4451200", "avargas@sanjorge.co"),
	"Constructora Altamar": ("900.887.120-5", "Mosquera, Cundinamarca", "Felipe Navarro", "317 6654321", "fnavarro@altamar.co"),
	"Cementos del Valle": ("", "Facatativá, Cundinamarca", "Ricardo Peña", "314 5502233", "rpena@cvalle.co"),
	"Transportes Andes": ("", "", "Natalia Gil", "300 9087766", "ngil@tandes.co"),
	"Metalmecánica Andina": ("830.509.877-1", "Madrid, Cundinamarca", "Sergio Patiño", "313 4456677", "spatino@metandina.co"),
	"Ingeniería Montajes del Centro": ("901.210.330-8", "Parque Industrial Celta, Funza", "Ramiro Paz", "310 8812045", "rpaz@imcentro.co"),
	"Constructora Bolívar": ("860.007.336-3", "Calle 13 # 68-40, Bogotá", "Laura Ortiz", "315 2200981", "lortiz@cbolivar.co"),
	"Hotel Mirador del Río": ("", "Girardot, Cundinamarca", "Carolina Díaz", "318 7788990", "cdiaz@mirador.co"),
	"Siderúrgica del Centro": ("890.100.452-6", "Tocancipá, Cundinamarca", "Óscar Beltrán", "310 6678120", "obeltran@sidecentro.co"),
	"Gaseosas Andinas": ("860.002.541-1", "Sopó, Cundinamarca", "Paula León", "311 9087123", "pleon@gaseosasandinas.co"),
	"Energía Sabana ESP": ("900.312.009-2", "Madrid, Cundinamarca", "Mauricio Ardila", "316 3301122", "mardila@energiasabana.co"),
}

# Ofertas activas: cubren todas las etapas, colores y los nuevos flujos (renegociación, logística)
DEMO = [
	dict(
		org="Constructora Los Pinos", fuente="WhatsApp", servicio="Izaje", ubicacion="Funza, Cundinamarca",
		lineas=[L("Grúa 90 t", "Día", 2, 18500000, 8200000)],
		trabajos=[T("Izaje de vigas metálicas de cubierta", 24, 18, 12.5, "Grúa 90 t", "Estabilizadores con placas por terreno blando")],
		restricciones="Acceso por vía destapada; redes eléctricas a 15 m", obs="Requiere estabilizadores con placas.",
		tecnico="J. Pérez",
		ruta=[("Solicitud recibida", -15), ("Visita técnica", -14), ("Análisis de Proyectos", -12),
			("Cotización preparada", -11), ("Cotización enviada", -9), ("Seguimiento", -7)],
		visita=(-10, 8, "Realizada", "111111"), envio=-9, proximo=-2,
		seguimientos=[(-9, "Envío", "Oferta enviada al cliente"), (-7, "WhatsApp", "Confirma recepción"),
			(-5, "Llamada", "La revisan con gerencia")],
	),
	dict(
		org="Industrias Ríomar", fuente="Correo", servicio="Izaje", ubicacion="Soacha, Cundinamarca",
		lineas=[L("Grúa 150 t", "Hora", 8, 42000000, 4100000, horas=8, jornada="Nocturna")],
		trabajos=[T("Izaje de transformador sobre base de concreto", 12, 22, 38, "Grúa 150 t", "Validar tabla de carga a 22 m; trabajo nocturno")],
		restricciones="Trabajo nocturno; cierre parcial de vía", obs="", tecnico="J. Pérez",
		ruta=[("Solicitud recibida", -14), ("Visita técnica", -13), ("Análisis de Proyectos", -11),
			("Cotización preparada", -9), ("Cotización enviada", -8)],
		visita=(-9, 14, "Realizada", "111111"), envio=-8, proximo=-1,
		seguimientos=[(-8, "Envío", "Oferta enviada al cliente")],
	),
	dict(
		org="Parque Industrial Siberia", fuente="Llamada", servicio="Montaje", ubicacion="Cota, Cundinamarca",
		lineas=[L("Grúa 50 t", "Semana", 1, 24500000, 4200000, horas=9),
			L("Grúa 50 t", "Quincena", 1, 44000000, 3900000, horas=9, incluir=0)],
		trabajos=[T("Montaje de cubierta metálica por etapas", 18, 14, 6, "Grúa 50 t")],
		restricciones="Horario de 7:00 a 17:00", obs="", tecnico="L. Gómez",
		ruta=[("Solicitud recibida", -9), ("Visita técnica", -8), ("Análisis de Proyectos", -6),
			("Cotización preparada", -4), ("Cotización enviada", -3)],
		visita=(-6, 8, "Realizada", "111111"), envio=-3, proximo=0,
		seguimientos=[(-3, "Envío", "Oferta enviada al cliente"), (-2, "WhatsApp", "Pregunta si se puede ampliar a 2 semanas")],
	),
	dict(
		org="Obra Torre Calle 80", fuente="WhatsApp", servicio="Montaje", ubicacion="Calle 80, Bogotá",
		lineas=[], trabajos=[T("Montaje de estructura metálica", 32, 0, 0)], restricciones="", obs="", tecnico="J. Pérez",
		ruta=[("Solicitud recibida", -6), ("Visita técnica", -5)],
		visita=(0, 10, "Pendiente de información", "110001"), envio=None, proximo=None,
		seguimientos=[(-6, "WhatsApp", "Solicita cotización para montaje de estructura metálica")],
	),
	dict(
		org="Logística del Norte", fuente="Correo", servicio="Cargue y descargue", ubicacion="Tocancipá, Cundinamarca",
		lineas=[L("Grúa 30 t", "Hora", 6, 4800000, 520000)],
		trabajos=[T("Cargue de 3 compresores sobre tractomula", 8, 10, 4.2, "Grúa 30 t")],
		restricciones="Patio de maniobras amplio", obs="", tecnico="",
		ruta=[("Solicitud recibida", -6), ("Análisis de Proyectos", -4), ("Cotización preparada", -2), ("Cotización enviada", -1)],
		visita=None, envio=-1, proximo=3, seguimientos=[(-1, "Envío", "Oferta enviada al cliente")],
	),
	dict(
		org="Concretos La Pradera", fuente="WhatsApp", servicio="Izaje", ubicacion="Chía, Cundinamarca",
		lineas=[], trabajos=[T("Izaje de mixer sobre plataforma", 10, 12, 14, "", "Terreno inclinado")],
		restricciones="Terreno inclinado", obs="", tecnico="L. Gómez",
		ruta=[("Solicitud recibida", -4), ("Visita técnica", -3), ("Análisis de Proyectos", -1)],
		visita=(-1, 9, "Realizada", "111111"), envio=None, proximo=None, seguimientos=[],
	),
	# Renegociación comercial: el cliente pidió 3 días en lugar de 2 → versión .1
	dict(
		org="Alimentos La Sabana", fuente="Llamada", servicio="Montaje", ubicacion="Mosquera, Cundinamarca",
		lineas=[L("Grúa 90 t", "Día", 3, 21900000, 7000000)],
		trabajos=[T("Montaje de silo de 9 t en dos secciones", 28, 16, 9, "Grúa 90 t", "Configuración con 24 t de contrapeso")],
		restricciones="Planta en operación; coordinar con SST", obs="", tecnico="L. Gómez",
		ruta=[("Solicitud recibida", -12), ("Visita técnica", -11), ("Análisis de Proyectos", -9),
			("Cotización preparada", -8), ("Cotización enviada", -7), ("Seguimiento", -5), ("En modificación", -1)],
		visita=(-10, 9, "Realizada", "111111"), envio=None, proximo=None,
		version=1, ajuste=("Comercial", "Pide 3 días en vez de 2 y mejorar el valor del día adicional"),
		versiones=[dict(dias=-7, lineas=[L("Grúa 90 t", "Día", 2, 15800000, 7400000)])],
		seguimientos=[(-7, "Envío", "Oferta enviada al cliente"), (-5, "Llamada", "Lo revisan con producción"),
			(-1, "Ajuste", "Comercial: pide 3 días en vez de 2 y mejorar el valor del día adicional")],
	),
	# Renegociación técnica: cambió el peso de la carga → vuelve a Proyectos
	dict(
		org="Plásticos Andinos", fuente="Correo", servicio="Izaje", ubicacion="Zona Franca de Bogotá",
		lineas=[L("Grúa 50 t", "Hora", 10, 9800000, 850000)],
		trabajos=[T("Izaje de extrusora a segundo piso", 9, 14, 11, "Grúa 50 t", "El cliente actualizó el peso: antes 8 t")],
		restricciones="Ingreso por portería 3; horario 6:00 a 14:00", obs="", tecnico="J. Pérez",
		ruta=[("Solicitud recibida", -10), ("Visita técnica", -9), ("Análisis de Proyectos", -8),
			("Cotización preparada", -7), ("Cotización enviada", -6), ("En modificación", -1)],
		visita=(-9, 10, "Realizada", "111111"), envio=None, proximo=None,
		version=1, ajuste=("Técnico", "La extrusora pesa 11 t y no 8 t: revisar equipo y configuración"),
		versiones=[dict(dias=-6, lineas=[L("Grúa 50 t", "Hora", 10, 9800000, 850000)])],
		seguimientos=[(-6, "Envío", "Oferta enviada al cliente"),
			(-1, "Ajuste", "Técnico: la extrusora pesa 11 t y no 8 t; revisar equipo y configuración")],
	),
	dict(
		org="Bodegas San Jorge", fuente="Correo", servicio="Montaje", ubicacion="Siberia, Cundinamarca",
		lineas=[], trabajos=[], restricciones="", obs="", tecnico="L. Gómez",
		ruta=[("Solicitud recibida", -3), ("Visita técnica", -2)],
		visita=(1, 8, "Programada", "000000"), envio=None, proximo=None,
		seguimientos=[(-3, "Correo", "Pide visita para revisar montaje de estantería")],
	),
	dict(
		org="Constructora Altamar", fuente="WhatsApp", servicio="Izaje", ubicacion="Mosquera, Cundinamarca",
		lineas=[], trabajos=[], restricciones="", obs="", tecnico="J. Pérez",
		ruta=[("Solicitud recibida", -2), ("Visita técnica", -1)],
		visita=(2, 10, "Programada", "000000"), envio=None, proximo=None, seguimientos=[],
	),
	dict(
		org="Cementos del Valle", fuente="Llamada", servicio="", ubicacion="Facatativá, Cundinamarca",
		lineas=[], trabajos=[], restricciones="", obs="", tecnico="",
		ruta=[("Solicitud recibida", -1)], visita=None, envio=None, proximo=None, por_agendar=True,
		seguimientos=[(-1, "Llamada", "Llamar para fijar fecha de visita")],
	),
	dict(
		org="Transportes Andes", fuente="WhatsApp", servicio="Cargue y descargue", ubicacion="",
		lineas=[], trabajos=[], restricciones="", obs="", tecnico="",
		ruta=[("Solicitud recibida", 0)], visita=None, envio=None, proximo=None, por_agendar=True,
		seguimientos=[(0, "WhatsApp", "Esperando dirección exacta de la obra")],
	),
	# Aprobada: lista para enviar a Logística
	dict(
		org="Metalmecánica Andina", fuente="Referido", servicio="Izaje", ubicacion="Madrid, Cundinamarca",
		lineas=[L("Grúa 50 t", "Hora", 8, 7900000, 780000)],
		trabajos=[T("Izaje de tanque de acero inoxidable", 15, 12, 7.5, "Grúa 50 t")],
		restricciones="", obs="", tecnico="J. Pérez",
		ruta=[("Solicitud recibida", -20), ("Visita técnica", -19), ("Análisis de Proyectos", -17),
			("Cotización preparada", -15), ("Cotización enviada", -14), ("Seguimiento", -10), ("Aprobada", -1)],
		visita=(-14, 9, "Realizada", "111111"), envio=-14, proximo=None,
		seguimientos=[(-14, "Envío", "Oferta enviada al cliente"), (-10, "Llamada", "Solicitan descuento del 5 %"),
			(-1, "Correo", "Cliente aprueba la oferta")],
	),
	# Enviada a Logística: William la ve en "Por programar"
	dict(
		org="Ingeniería Montajes del Centro", fuente="Correo", servicio="Montaje", ubicacion="Parque Industrial Celta, Funza",
		lineas=[L("Grúa 90 t", "Día", 2, 17200000, 7600000),
			L("Cama baja", "Global", 1, 4800000, tipo="Transporte", desc="Transporte de piezas del puente grúa en cama baja")],
		trabajos=[T("Montaje de puente grúa en nave industrial", 14, 11, 16, "Grúa 90 t", "Viga principal de 16 t; izaje en tándem no requerido")],
		restricciones="Bodega 7; piso industrial apto para estabilizadores", obs="", tecnico="L. Gómez",
		ruta=[("Solicitud recibida", -18), ("Visita técnica", -17), ("Análisis de Proyectos", -15),
			("Cotización preparada", -13), ("Cotización enviada", -12), ("Seguimiento", -8), ("Aprobada", -2),
			("Enviada a Logística", -1)],
		visita=(-17, 9, "Realizada", "111111"), envio=-12, proximo=None,
		logistica=dict(fecha=3, hora="07:00", contacto="Ing. Ramiro Paz", tel="310 8812045", notas="Ingreso por portería 2 con planilla de seguridad social."),
		seguimientos=[(-12, "Envío", "Oferta enviada al cliente"), (-8, "Llamada", "Confirman presupuesto"),
			(-2, "Correo", "Cliente aprueba la oferta")],
	),
	# Oferta real 40447 de EMPACOR: aprobada y programada para la próxima semana
	dict(
		num=40447, org="EMPACOR", fuente="Correo", servicio="Desmontaje y traslado",
		ubicacion="Cra. 81 i #55 a 90 sur // Dg. 16 # 115 – 25",
		lineas=[
			L("Grúa 150 t", "Hora", 10, 15200000, 1100000, desc="Grúa retiro"),
			L("Grúa 90 t", "Hora", 8, 6600000, 550000, horas=8, desc="Grúa descargue"),
			L("Grúa 90 t", "Hora", 8, 5520000, 460000, horas=8, desc="Grúa instalación chimenea"),
			L("Cama alta", "Global", 1, 2000000, tipo="Transporte", desc="Transporte de secciones de chimenea en cama alta"),
			L("Cama baja", "Global", 1, 5500000, tipo="Transporte", desc="Transporte de caldera en cama baja"),
		],
		trabajos=[
			T("Trabajo I: desmontaje de chimenea de 24 m y retiro de caldera en planta Cra. 81 i", 24, 9, 26, "Grúa 150 t"),
			T("Trabajo II: transporte de caldera en cama baja y de secciones de chimenea en cama alta", 0, 0, 26, "Cama baja", "Desde Cra. 81 i #55 a 90 sur hasta Dg. 16 # 115 – 25"),
			T("Trabajo III: descargue de secciones de chimenea y caldera en planta Fontibón", 4, 6, 26, "Grúa 90 t", "Altura de tractocamión"),
			T("Trabajo IV: montaje de chimenea", 24, 13, 2, "Grúa 90 t"),
		],
		restricciones="Dos sedes: retiro en Kennedy y montaje en Fontibón", obs="", tecnico="J. Pérez",
		ruta=[("Solicitud recibida", -19), ("Visita técnica", -18), ("Análisis de Proyectos", -17),
			("Cotización preparada", -16), ("Cotización enviada", -16), ("Seguimiento", -12), ("Aprobada", -4),
			("Enviada a Logística", -3), ("Programada", -2)],
		visita=(-18, 9, "Realizada", "111111"), envio=-16, proximo=None,
		logistica=dict(fecha=3, hora="06:00", contacto="Programador de mantenimiento", tel="319 6352705", notas="Coordinar permisos de ingreso en ambas sedes."),
		prog=[(0, 3, 3, "06:00", "16:00", "Lunes a viernes", "Carlos Rincón"),
			(4, 3, 3, "10:00", "18:00", "Lunes a viernes", "Fabián Rojas"),
			(3, 4, 4, "07:00", "12:00", "Lunes a viernes", "Fabián Rojas"),
			(1, 4, 4, "08:00", "16:00", "Lunes a viernes", "Édgar Molina"),
			(2, 5, 5, "07:00", "15:00", "Lunes a viernes", "Carlos Rincón")],
		seguimientos=[(-16, "Envío", "Oferta enviada al cliente"), (-12, "Llamada", "Revisan fechas con mantenimiento"),
			(-4, "Correo", "Cliente aprueba la oferta"), (-2, "Logística", "Programado: retiro, transporte, descargue y montaje")],
	),
	# En ejecución esta semana
	dict(
		org="Constructora Bolívar", fuente="Referido", servicio="Alquiler con operador", ubicacion="Calle 13 # 68-40, Bogotá",
		lineas=[L("Grúa 50 t", "Semana", 2, 46000000, 23000000, horas=9)],
		trabajos=[T("Montaje de estructura de bodega por fases", 16, 18, 4.5, "Grúa 50 t", "Montaje de cerchas y correas")],
		restricciones="Obra urbana; horario de 7:00 a 17:00", obs="", tecnico="",
		ruta=[("Solicitud recibida", -20), ("Análisis de Proyectos", -19), ("Cotización preparada", -18),
			("Cotización enviada", -17), ("Seguimiento", -14), ("Aprobada", -9), ("Enviada a Logística", -8),
			("Programada", -7), ("En ejecución", -2)],
		visita=None, envio=-17, proximo=None,
		logistica=dict(fecha=-2, hora="07:00", contacto="Laura Ortiz", tel="315 2200981", notas=""),
		prog=[(0, -2, 11, "07:00", "17:00", "Lunes a sábado", "Édgar Molina")],
		seguimientos=[(-17, "Envío", "Oferta enviada al cliente"), (-9, "Correo", "Cliente aprueba la oferta"),
			(-2, "Logística", "Inicia el servicio en obra")],
	),
	# Perdida
	dict(
		org="Hotel Mirador del Río", fuente="Correo", servicio="Izaje", ubicacion="Girardot, Cundinamarca",
		lineas=[L("Grúa 30 t", "Hora", 6, 6200000, 650000)],
		trabajos=[T("Izaje de chiller a cubierta", 20, 15, 3, "Grúa 30 t")],
		restricciones="Zona hotelera; horario restringido", obs="", tecnico="",
		ruta=[("Solicitud recibida", -25), ("Análisis de Proyectos", -23), ("Cotización preparada", -22),
			("Cotización enviada", -21), ("Seguimiento", -17), ("Perdida", -12)],
		visita=None, envio=-21, proximo=None, perdida=("Precio", "Eligió un proveedor local más económico"),
		seguimientos=[(-21, "Envío", "Oferta enviada al cliente"), (-17, "Llamada", "Comparando con otras dos ofertas")],
	),
	# Trabajos anteriores parecidos al de EMPACOR (para probar "Buscar trabajos similares")
	dict(
		org="EMPACOR", fuente="Correo", servicio="Desmontaje y traslado", ubicacion="Planta Puente Aranda, Bogotá",
		lineas=[L("Grúa 150 t", "Hora", 10, 14600000, 1050000, desc="Grúa retiro"),
			L("Cama baja", "Global", 1, 5200000, tipo="Transporte", desc="Transporte de caldera en cama baja")],
		trabajos=[T("Desmontaje de chimenea de 20 m y retiro de caldera", 20, 8, 22, "Grúa 150 t", "Configuración con contrapeso completo")],
		restricciones="Planta en operación", obs="", tecnico="",
		ruta=[("Solicitud recibida", -150), ("Análisis de Proyectos", -149), ("Cotización preparada", -148),
			("Cotización enviada", -148), ("Aprobada", -145), ("Enviada a Logística", -144), ("Programada", -144),
			("En ejecución", -141), ("Ejecutada", -141)],
		visita=None, envio=-148, proximo=None, ejecucion=-141,
		logistica=dict(fecha=-141, hora="06:00", contacto="Programador de mantenimiento", tel="319 6352705", notas=""),
		prog=[(0, -141, -141, "06:00", "16:00", "Lunes a viernes", "Carlos Rincón"), (1, -141, -141, "10:00", "18:00", "Lunes a viernes", "Fabián Rojas")],
		seguimientos=[(-148, "Envío", "Oferta enviada al cliente"), (-145, "Correo", "Cliente aprueba la oferta")],
	),
	dict(
		org="Siderúrgica del Centro", fuente="Llamada", servicio="Izaje", ubicacion="Tocancipá, Cundinamarca",
		lineas=[L("Grúa 150 t", "Día", 1, 16800000, 12500000)],
		trabajos=[T("Izaje de horno de inducción a nueva base", 22, 10, 28, "Grúa 150 t", "Terreno compactado; placas de apoyo")],
		restricciones="", obs="", tecnico="",
		ruta=[("Solicitud recibida", -210), ("Análisis de Proyectos", -209), ("Cotización preparada", -208),
			("Cotización enviada", -208), ("Aprobada", -204), ("Enviada a Logística", -203), ("Programada", -203),
			("En ejecución", -200), ("Ejecutada", -200)],
		visita=None, envio=-208, proximo=None, ejecucion=-200,
		logistica=dict(fecha=-200, hora="07:00", contacto="Óscar Beltrán", tel="310 6678120", notas=""),
		prog=[(0, -200, -200, "07:00", "17:00", "Lunes a viernes", "Carlos Rincón")],
		seguimientos=[(-208, "Envío", "Oferta enviada al cliente"), (-204, "Correo", "Cliente aprueba la oferta")],
	),
	# Ofertas reales ya ejecutadas
	dict(
		num=40182, org="Constructora Experta", fuente="Correo", servicio="Movimiento manual", ubicacion="Metro estación 12",
		lineas=[L("", "Global", 1, 12200000, tipo="Otro", desc="Movimiento manual y transporte de vigas IP de 1 tonelada, desde Ascendente 1 a descendente 3")],
		trabajos=[T("Movimiento manual y transporte de vigas IP", 0, 0, 1, "", "Desde Ascendente 1 a descendente 3")],
		restricciones="", obs="", tecnico="",
		ruta=[("Solicitud recibida", -114), ("Análisis de Proyectos", -113), ("Cotización preparada", -112),
			("Cotización enviada", -112), ("Aprobada", -110), ("Enviada a Logística", -109), ("Programada", -108),
			("En ejecución", -106), ("Ejecutada", -105)],
		visita=None, envio=-112, proximo=None, ejecucion=-105,
		logistica=dict(fecha=-106, hora="07:00", contacto="Roger", tel="311 2062935", notas=""),
		prog=[(0, -106, -105, "07:00", "17:00", "Lunes a viernes", "Jhon Suárez")],
		seguimientos=[(-112, "Envío", "Oferta enviada al cliente"), (-110, "Correo", "Cliente aprueba la oferta")],
	),
	dict(
		num=40197, org="BIOD SA", fuente="Correo", servicio="Reubicación", ubicacion="Mancilla – Facatativá",
		lineas=[L("Grúa 50 t", "Día", 1, 5600000, 3500000),
			L("Cama alta", "Día", 1, 2000000, tipo="Transporte", desc="Cama alta para transporte interno de contenedores")],
		trabajos=[T("Reubicación de 5 tanques de 4 m de largo y 3 m de diámetro", 0, 14, 1, "Grúa 50 t")],
		restricciones="", obs="", tecnico="",
		ruta=[("Solicitud recibida", -97), ("Análisis de Proyectos", -96), ("Cotización preparada", -96),
			("Cotización enviada", -96), ("En modificación", -95), ("Cotización enviada", -94), ("Aprobada", -93),
			("Enviada a Logística", -92), ("Programada", -92), ("En ejecución", -90), ("Ejecutada", -90)],
		visita=None, envio=-94, proximo=None, ejecucion=-90,
		version=1, ajuste=("Comercial", "Renegociación del valor del día de grúa"),
		versiones=[dict(dias=-96, lineas=[L("Grúa 50 t", "Día", 1, 6200000, 3800000),
			L("Cama alta", "Día", 1, 2000000, tipo="Transporte", desc="Cama alta para transporte interno de contenedores")])],
		logistica=dict(fecha=-90, hora="07:00", contacto="Felipe Torres", tel="318 7118029", notas=""),
		prog=[(0, -90, -90, "07:00", "17:00", "Lunes a viernes", "Carlos Rincón"), (1, -90, -90, "07:00", "17:00", "Lunes a viernes", "Fabián Rojas")],
		seguimientos=[(-96, "Envío", "Oferta enviada al cliente"), (-95, "Ajuste", "Comercial: renegociación del valor del día de grúa"),
			(-94, "Envío", "Versión .1 enviada al cliente"), (-93, "Correo", "Cliente aprueba la oferta")],
	),
]

# Histórico generado: trabajos ejecutados y perdidos en los últimos 11 meses (para los tableros de históricos)
_POOL_CLIENTES = [
	"EMPACOR", "BIOD SA", "Constructora Experta", "Alimentos La Sabana", "Metalmecánica Andina", "Industrias Ríomar",
	"Logística del Norte", "Parque Industrial Siberia", "Concretos La Pradera", "Siderúrgica del Centro",
	"Gaseosas Andinas", "Energía Sabana ESP", "Constructora Bolívar", "Ingeniería Montajes del Centro",
]
_POOL = [
	# equipo, servicio, trabajo, modalidad, (cant min, cant max), valor por unidad, adicional, (alt, rad, peso)
	("Grúa 30 t", "Cargue y descargue", "Cargue de maquinaria sobre tractomula", "Hora", (4, 8), 520000, 520000, (8, 10, 4)),
	("Grúa 50 t", "Izaje", "Izaje de tanque de almacenamiento", "Hora", (8, 10), 780000, 780000, (15, 12, 7)),
	("Grúa 50 t", "Reubicación", "Reubicación de equipos en planta", "Día", (1, 2), 5600000, 3500000, (10, 14, 3)),
	("Grúa 90 t", "Montaje", "Montaje de estructura metálica", "Día", (1, 3), 8600000, 7400000, (26, 16, 9)),
	("Grúa 150 t", "Izaje", "Izaje de transformador", "Hora", (6, 10), 1100000, 1100000, (12, 20, 30)),
	("Grúa 50 t", "Alquiler con operador", "Alquiler de grúa para obra", "Semana", (1, 2), 23000000, 23000000, (16, 18, 4)),
	("Grúa 90 t", "Alquiler con operador", "Alquiler mensual para montaje de planta", "Mes", (1, 1), 78000000, 78000000, (30, 20, 8)),
	("Grúa 30 t", "Montaje", "Montaje de cubierta liviana", "Quincena", (1, 1), 21000000, 21000000, (14, 12, 2)),
]


def _lcg(semilla):
	estado = [semilla]

	def siguiente():
		estado[0] = (estado[0] * 1103515245 + 12345) % 2147483648
		return estado[0] / 2147483648

	return siguiente


def generar_historico():
	rnd = _lcg(2026)
	out = []
	for i in range(40):
		dias = -int(8 + i * 8 + rnd() * 6)  # repartidos en ~11 meses
		if dias > -6:
			dias = -6
		eq, srv, trabajo, mod, (cmin, cmax), unidad, adicional, (alt, rad, peso) = _POOL[int(rnd() * len(_POOL))]
		cant = cmin + int(rnd() * (cmax - cmin + 1))
		total = int(round(unidad * cant * (0.9 + rnd() * 0.25), -4))
		org = _POOL_CLIENTES[int(rnd() * len(_POOL_CLIENTES))]
		lineas = [L(eq, mod, cant, total, adicional, horas=10 if mod != "Hora" else cant)]
		if rnd() < 0.3:
			lineas.append(L("Cama alta", "Global", 1, 2000000 + int(rnd() * 4) * 500000, tipo="Transporte", desc="Transporte de piezas en cama alta"))
		f = lambda x: round(x * (0.8 + rnd() * 0.5), 1)  # noqa: E731
		trab = [T(trabajo, f(alt), f(rad), f(peso), eq)]
		perdida = rnd() < 0.15
		duracion = {"Hora": 0, "Día": cant - 1, "Semana": 7 * cant - 1, "Quincena": 14, "Mes": 29}[mod]
		ej = min(dias + duracion, -1)
		if perdida:
			ruta = [("Solicitud recibida", dias - 9), ("Análisis de Proyectos", dias - 8), ("Cotización preparada", dias - 7),
				("Cotización enviada", dias - 6), ("Seguimiento", dias - 3), ("Perdida", dias)]
			out.append(dict(org=org, fuente="Correo", servicio=srv, ubicacion=CLIENTES[org][1], lineas=lineas, trabajos=trab,
				restricciones="", obs="", tecnico="", ruta=ruta, visita=None, envio=dias - 6, proximo=None,
				perdida=("Precio" if rnd() < 0.6 else "Eligió a la competencia", ""),
				seguimientos=[(dias - 6, "Envío", "Oferta enviada al cliente")]))
			continue
		ruta = [("Solicitud recibida", dias - 9), ("Análisis de Proyectos", dias - 8), ("Cotización preparada", dias - 7),
			("Cotización enviada", dias - 6), ("Aprobada", dias - 3), ("Enviada a Logística", dias - 2),
			("Programada", dias - 2), ("En ejecución", dias), ("Ejecutada", ej)]
		prog = []
		for idx in range(len(lineas)):
			prog.append((idx, dias, dias + (duracion if idx == 0 else 0), "07:00", "17:00", "Lunes a sábado",
				["Carlos Rincón", "Édgar Molina", "Fabián Rojas"][idx % 3]))
		out.append(dict(org=org, fuente=["Correo", "WhatsApp", "Llamada", "Referido"][i % 4], servicio=srv,
			ubicacion=CLIENTES[org][1], lineas=lineas, trabajos=trab, restricciones="", obs="", tecnico="", ruta=ruta,
			visita=None, envio=dias - 6, proximo=None, ejecucion=ej,
			logistica=dict(fecha=dias, hora="07:00", contacto=CLIENTES[org][2], tel=CLIENTES[org][3], notas=""),
			prog=prog, seguimientos=[(dias - 6, "Envío", "Oferta enviada al cliente"), (dias - 3, "Correo", "Cliente aprueba la oferta")]))
	return out


def _habil(n):
	"""Fecha a n días hábiles de hoy (lunes a viernes)."""
	d = getdate(nowdate())
	while d.weekday() >= 5:
		d = add_days(d, 1)
	paso = 1 if n >= 0 else -1
	restantes = abs(n)
	while restantes:
		d = add_days(d, paso)
		if d.weekday() < 5:
			restantes -= 1
	return d


def _dia(n):
	"""Para programación: días hábiles si |n| es pequeño (próximos días), días corridos si es histórico."""
	return _habil(n) if -10 < n < 10 else getdate(add_days(nowdate(), n))


def _hora(dias, hora=9, minuto=0):
	return add_to_date(get_datetime(nowdate()), days=dias, hours=hora, minutes=minuto)


def _numero(d, usados):
	"""Número de oferta coherente con la fecha de envío (las reales usan su número)."""
	if d.get("num"):
		return d["num"]
	base = d["ruta"][0][1] if d.get("envio") is None else d["envio"]
	n = 40447 + int(round((base + 16) * 2.7))
	while n in usados:
		n += 1
	return n




def _fila(l):
	"""Línea MTI → Producto estándar de Frappe CRM."""
	total = l["valor_total"]
	qty = 1 if l["modalidad"] == "Global" else (l["cantidad"] or 1)
	equipo = l["equipo"] or None
	if equipo and not frappe.db.exists("CRM Product", equipo):
		frappe.get_doc({"doctype": "CRM Product", "product_code": equipo, "product_name": equipo,
			"mti_categoria": "Grúa" if "Grúa" in equipo else "Transporte"}).insert(ignore_permissions=True)
	return {
		"product_code": equipo, "product_name": equipo or l["descripcion"] or "Servicio", "qty": qty,
		"rate": total / qty if qty else total, "amount": total, "net_amount": total,
		"mti_tipo": l["tipo"], "mti_descripcion": l["descripcion"], "mti_modalidad": l["modalidad"],
		"mti_horas_jornada": l["horas_jornada"], "mti_jornada": l["jornada"], "mti_movilizacion": l["movilizacion"],
		"mti_valor_adicional": l["valor_adicional"], "mti_incluir": l.get("incluir", 1),
	}


def _semaforo(deal, verde=2, amarillo=4):
	if deal.status not in ABIERTAS:
		return "⚪ Sin enviar" if deal.status in PRE_ENVIO else ""
	if not deal.mti_fecha_envio:
		return "⚪ Sin enviar"
	dias = (getdate(nowdate()) - getdate(deal.mti_fecha_envio)).days
	vencido = deal.mti_proximo_contacto and getdate(deal.mti_proximo_contacto) < getdate(nowdate())
	if dias > amarillo or vencido:
		return "🔴 Rojo"
	return "🟡 Amarillo" if dias > verde else "🟢 Verde"


def _calcular(deal):
	"""Lo mismo que hace /mti al guardar (totales, resumen de equipos, máximos y código)."""
	total, equipos = 0, []
	for p in deal.products:
		if p.get("mti_incluir") == 0:
			continue  # alternativa cotizada que no va en la oferta final
		total += p.amount or 0
		nombre = p.product_code or p.mti_descripcion or p.product_name
		if nombre and nombre not in equipos:
			equipos.append(nombre)
	if deal.products:
		deal.total = deal.net_total = deal.deal_value = total
	deal.mti_equipo = ", ".join(equipos)
	if deal.mti_trabajos:
		deal.mti_altura = max(t.altura or 0 for t in deal.mti_trabajos)
		deal.mti_radio = max(t.radio or 0 for t in deal.mti_trabajos)
		deal.mti_peso = max(t.peso or 0 for t in deal.mti_trabajos)
	inicios = sorted(str(p.mti_prog_desde) for p in deal.products if p.mti_prog_desde)
	deal.mti_fecha_servicio = inicios[0] if inicios else None
	deal.mti_semaforo = _semaforo(deal)


def _tarea(titulo, usuario, deal, dias, prioridad, descripcion):
	frappe.get_doc({
		"doctype": "CRM Task", "title": titulo, "assigned_to": usuario, "status": "Todo", "priority": prioridad,
		"due_date": _hora(dias, 17), "description": descripcion, "reference_doctype": "CRM Deal", "reference_docname": deal,
	}).insert(ignore_permissions=True)


def borrar_ofertas():
	nombres = frappe.get_all("CRM Deal", pluck="name")
	if not nombres:
		return
	tareas = frappe.get_all("CRM Task", {"reference_docname": ["in", nombres]}, pluck="name")
	for hijo in ("CRM Status Change Log", "CRM Contacts", "CRM Products", "CRM Rolling Response Time", "MTI Trabajo", "MTI Desglose", "MTI Adicional"):
		frappe.db.delete(hijo, {"parenttype": "CRM Deal", "parent": ["in", nombres]})
	for dt in ("Automation Run Step", "Automation Run", "Automation Trigger Queue"):
		if frappe.db.table_exists(dt):
			frappe.db.delete(dt)
	frappe.db.delete("Comment", {"reference_doctype": ["in", ["CRM Deal", "CRM Task"]]})
	frappe.db.delete("ToDo", {"reference_type": ["in", ["CRM Deal", "CRM Task"]]})
	frappe.db.delete("CRM Notification", {"reference_doctype": ["in", ["CRM Deal", "CRM Task"]]})
	frappe.db.delete("Notification Log", {"document_type": ["in", ["CRM Deal", "CRM Task"]]})
	frappe.db.delete("DocShare", {"share_doctype": ["in", ["CRM Deal", "CRM Task"]]})
	frappe.db.delete("Version", {"ref_doctype": ["in", ["CRM Deal", "CRM Task"]]})
	for f in frappe.get_all("File", {"attached_to_doctype": "CRM Deal"}, pluck="name"):
		frappe.delete_doc("File", f, force=True, ignore_permissions=True)
	if tareas:
		frappe.db.delete("CRM Task", {"name": ["in", tareas]})
	frappe.db.delete("CRM Deal", {"name": ["in", nombres]})
	frappe.db.commit()


def cargar():
	if not frappe.db.exists("User", correo("mcamila")):
		frappe.throw("Primero ejecuta mti_instalar.py con --usuarios-demo")
	frappe.flags.mute_emails = True
	borrar_ofertas()
	# las automatizaciones se pausan mientras se cargan los datos (no deben crear tareas de demo)
	estaba = frappe.db.get_single_value("Automation Settings", "disable_automations")
	frappe.db.set_single_value("Automation Settings", "disable_automations", 1)
	frappe.clear_cache()
	try:
		_cargar()
	finally:
		frappe.db.set_single_value("Automation Settings", "disable_automations", estaba or 0)
		frappe.db.commit()
		frappe.clear_cache()


def _cargar():
	camila, nestor, william = correo("mcamila"), correo("ncelis"), correo("wvasquez")
	for org, (nit, direccion, contacto, tel, email) in CLIENTES.items():
		if not frappe.db.exists("CRM Organization", org):
			frappe.get_doc({"doctype": "CRM Organization", "organization_name": org}).insert(ignore_permissions=True)
		frappe.db.set_value("CRM Organization", org, {"mti_nit": nit, "mti_direccion": direccion, "mti_contacto": contacto,
			"mti_telefono": tel, "mti_email": email})

	registros = generar_historico() + DEMO
	usados = {d["num"] for d in registros if d.get("num")}
	maximo = PRIMERA_OFERTA - 1
	for d in registros:
		num = _numero(d, usados)
		usados.add(num)
		maximo = max(maximo, num)
		cel, email = CLIENTES[d["org"]][3], CLIENTES[d["org"]][4]
		partes = (CLIENTES[d["org"]][2] or d["org"]).split(" ", 1)
		apellido = partes[1] if len(partes) > 1 else ""
		contacto = frappe.db.get_value("Contact", {"first_name": partes[0], "last_name": apellido, "company_name": d["org"]})
		if not contacto:
			contacto = frappe.get_doc({"doctype": "Contact", "first_name": partes[0], "last_name": apellido, "company_name": d["org"],
				"email_ids": [{"email_id": email, "is_primary": 1}] if email else [],
				"phone_nos": [{"phone": cel, "is_primary_mobile_no": 1}] if cel else []}).insert(ignore_permissions=True).name

		estado_final = d["ruta"][-1][0]
		deal = frappe.new_doc("CRM Deal")
		deal.naming_series = SERIE
		deal.update({"organization": d["org"], "status": estado_final, "source": d["fuente"], "currency": "COP",
			"deal_owner": camila, "mti_servicio": d["servicio"], "mti_ubicacion": d["ubicacion"],
			"mti_restricciones": d["restricciones"], "mti_observaciones": d["obs"], "mti_resp_proyectos": nestor,
			"mti_tecnico": d["tecnico"]})
		deal.append("contacts", {"contact": contacto, "is_primary": 1})
		for linea in d["lineas"]:
			deal.append("products", _fila(linea))
		for trabajo in d["trabajos"]:
			deal.append("mti_trabajos", dict(trabajo))
		for idx, desde, hasta, h1, h2, frec, operador in d.get("prog", []):
			p = deal.products[idx]
			p.mti_prog_desde, p.mti_prog_hasta = _dia(desde), _dia(hasta)
			p.mti_prog_hora_inicio, p.mti_prog_hora_fin, p.mti_prog_dias, p.mti_prog_operador = h1, h2, frec, operador
		if d.get("logistica"):
			lg = d["logistica"]
			deal.update({"mti_resp_logistica": william, "mti_fecha_solicitada": _dia(lg["fecha"]), "mti_hora_solicitada": lg["hora"],
				"mti_contacto_sitio": lg["contacto"], "mti_tel_sitio": lg["tel"], "mti_notas_logistica": lg["notas"]})
		if d.get("ejecucion") is not None:
			deal.mti_fecha_ejecucion = getdate(add_days(nowdate(), d["ejecucion"]))
		if d["visita"]:
			dias, hora, estado_v, checks = d["visita"]
			deal.mti_requiere_visita = 1
			deal.mti_fecha_visita = add_to_date(get_datetime(_habil(dias)), hours=hora)
			deal.mti_estado_visita = estado_v
			for campo, valor in zip(["ubicacion", "altura", "radio", "peso", "restricciones", "fotos"], checks):
				deal.set("mti_chk_" + campo, int(valor))
		elif d.get("por_agendar"):
			deal.mti_requiere_visita, deal.mti_estado_visita = 1, "Por agendar"
		else:
			deal.mti_requiere_visita, deal.mti_estado_visita = 0, "No requerida"
		if d["envio"] is not None:
			deal.mti_fecha_envio = add_days(nowdate(), d["envio"])
			deal.mti_vigencia = add_days(deal.mti_fecha_envio, 15)
			deal.mti_aprobo_envio = camila
		if d["proximo"] is not None:
			deal.mti_proximo_contacto = add_days(nowdate(), d["proximo"])
		if d["seguimientos"]:
			deal.mti_ultimo_contacto = add_days(nowdate(), d["seguimientos"][-1][0])
		if d.get("perdida"):
			deal.lost_reason, deal.lost_notes = d["perdida"]
		deal.mti_version = d.get("version", 0)
		if d.get("ajuste"):
			deal.mti_tipo_ajuste, deal.mti_motivo_ajuste = d["ajuste"]
		if d.get("versiones"):
			hist = []
			for v, ver in enumerate(d["versiones"]):
				hist.append({"version": v, "codigo": str(num) + (f".{v}" if v else ""), "fecha_envio": str(add_days(nowdate(), ver["dias"])),
					"total": sum(x["valor_total"] for x in ver["lineas"]),
					"lineas": [{"tipo": x["tipo"], "equipo": x["equipo"], "descripcion": x["descripcion"], "modalidad": x["modalidad"],
						"cantidad": x["cantidad"], "horas_jornada": x["horas_jornada"], "jornada": x["jornada"], "movilizacion": x["movilizacion"],
						"valor_adicional": x["valor_adicional"], "valor_total": x["valor_total"]} for x in ver["lineas"]],
					"tipo": d["ajuste"][0], "motivo": d["ajuste"][1], "registrado": str(_hora(ver["dias"] + 1, 10)), "por": camila})
			deal.mti_versiones = json.dumps(hist)
		_calcular(deal)
		deal.mti_codigo = str(num) + (f".{deal.mti_version}" if deal.mti_version else "")
		deal.flags.ignore_permissions = True
		deal.insert(set_name=f"OF-{num}")

		# Historial de etapas con fechas reales (línea de tiempo de la ficha)
		frappe.db.delete("CRM Status Change Log", {"parent": deal.name})
		ruta = d["ruta"]
		for i, (estado, dias) in enumerate(ruta):
			desde = _hora(dias, 9 + i % 3, 15)
			hasta = _hora(ruta[i + 1][1], 9 + (i + 1) % 3, 15) if i + 1 < len(ruta) else None
			siguiente = ruta[i + 1][0] if i + 1 < len(ruta) else ""
			quien = siguiente or estado
			autor = nestor if quien == "Cotización preparada" else william if quien in ("Programada", "En ejecución", "Ejecutada") else camila
			frappe.get_doc({"doctype": "CRM Status Change Log", "parent": deal.name, "parenttype": "CRM Deal",
				"parentfield": "status_change_log", "idx": i + 1, "from": estado, "from_type": ESTADOS_TIPO.get(estado, ""),
				"from_date": desde, "to": siguiente, "to_type": ESTADOS_TIPO.get(siguiente, "") if siguiente else "", "to_date": hasta,
				"duration": (get_datetime(hasta) - get_datetime(desde)).total_seconds() if hasta else 0, "log_owner": autor}).db_insert()
		cerrado = getdate(add_days(nowdate(), ruta[-1][1])) if ESTADOS_TIPO.get(estado_final) == "Won" else None
		frappe.db.set_value("CRM Deal", deal.name, {"creation": _hora(ruta[0][1], 8, 30), "owner": camila, "closed_date": cerrado}, update_modified=False)

		for dias, canal, nota in d["seguimientos"]:
			autor = william if canal == "Logística" else camila
			com = frappe.get_doc({"doctype": "Comment", "comment_type": "Comment", "reference_doctype": "CRM Deal",
				"reference_name": deal.name, "comment_email": autor, "owner": autor,
				"comment_by": "William Vásquez" if autor == william else "María Camila Vásquez", "content": f"[{canal}] {nota}"})
			com.db_insert()
			frappe.db.set_value("Comment", com.name, {"creation": _hora(dias, 11), "modified": _hora(dias, 11), "owner": autor}, update_modified=False)

		# Tareas como las habría creado la automatización en cada traspaso
		cod = deal.mti_codigo
		if estado_final == "Análisis de Proyectos":
			_tarea(f"Definir solución técnica · {cod}", nestor, deal.name, 1, "High", "Definir equipos, modalidad, configuración y costos.")
		if estado_final == "En modificación" and deal.mti_tipo_ajuste == "Técnico":
			_tarea(f"Ajuste técnico · {cod}", nestor, deal.name, 1, "High", "El cliente pidió un cambio técnico: " + deal.mti_motivo_ajuste)
		if estado_final == "En modificación" and deal.mti_tipo_ajuste == "Comercial":
			_tarea(f"Ajustar y reenviar · {cod}", camila, deal.name, 1, "High", "Renegociación: " + deal.mti_motivo_ajuste)
		if estado_final == "Aprobada":
			_tarea(f"Enviar a Logística · {cod}", camila, deal.name, 0, "High", "El cliente aprobó la oferta. Enviarla a Logística.")
		if estado_final == "Enviada a Logística":
			_tarea(f"Programar servicio · {cod}", william, deal.name, 1, "High", "Programar equipos, fechas, horario y operador.")
		if deal.mti_semaforo == "🔴 Rojo":
			_tarea(f"Sin respuesta · {cod}", camila, deal.name, 0, "High", f"{deal.organization} no ha respondido la oferta.")

	_extras(camila)

	actual = NamingSeries(SERIE).get_current_value()
	NamingSeries(SERIE).update_counter(max(maximo, actual))
	print(f"✔ {len(registros)} ofertas de demostración cargadas (incluye histórico de 11 meses)")


def _repartir(filas, total):
	"""Desglose de ejemplo: si la oferta llevaba un precio unificado (líneas en $0), se reparte el total."""
	k = [(f.product_code or f.mti_descripcion or f.product_name, f.amount or 0) for f in filas]
	if len(k) > 1 and any(v == 0 for _, v in k):
		base = round(total * 0.72 / 1000) * 1000
		n = len(k) - 1
		resto = [round((total - base) / n / 1000) * 1000 for _ in range(n)]
		resto[-1] = total - base - sum(resto[:-1])
		return [(k[0][0], base)] + [(x[0], v) for x, v in zip(k[1:], resto)]
	return k


def _extras(camila):
	"""Ejemplos de las funciones nuevas: una oferta en espera y el desglose de precios de los trabajos ejecutados."""
	n = frappe.db.get_value("CRM Deal", {"organization": "Industrias Ríomar", "status": "Cotización enviada"})
	if n:
		deal = frappe.get_doc("CRM Deal", n)
		deal.mti_estado_previo = deal.status
		deal.status = "En espera"
		deal.mti_motivo_espera = "El cliente pidió esperar: el presupuesto de la obra se aprueba en la junta de diciembre"
		deal.mti_fecha_espera = add_days(nowdate(), -3)
		deal.mti_retomar_el = nowdate()
		deal.mti_semaforo = ""
		deal.flags.ignore_permissions = True
		deal.save()
		com = frappe.get_doc({"doctype": "Comment", "comment_type": "Comment", "reference_doctype": "CRM Deal", "reference_name": n,
			"comment_email": camila, "owner": camila, "comment_by": "María Camila Vásquez",
			"content": "[En espera] " + deal.mti_motivo_espera})
		com.db_insert()
		frappe.db.set_value("Comment", com.name, "owner", camila, update_modified=False)
		# al pasar a En espera, /mti cierra las tareas que ya no aplican; aquí se hace igual
		for t in frappe.get_all("CRM Task", {"reference_docname": n, "status": ["not in", ["Done", "Canceled"]]}, pluck="name"):
			frappe.db.set_value("CRM Task", t, "status", "Done")
	ejec = frappe.get_all("CRM Deal", {"status": "Ejecutada"}, ["name", "deal_value"], order_by="mti_fecha_ejecucion desc")
	# Adicionales (horas extra y un cobro adicional) en dos trabajos y calificación del cliente en casi todos
	encargados = ["Jefe de mantenimiento", "Residente de obra", "Ing. de proyecto", "Coordinador HSE"]
	con_adic = []
	for e in ejec[2:]:
		m = frappe.db.get_value("CRM Products", {"parent": e.name, "parenttype": "CRM Deal", "idx": 1}, "mti_modalidad")
		if m in ("Hora", "Día") and len(con_adic) < 2:
			con_adic.append(e.name)
	for i, e in enumerate(ejec):
		adic = []
		if e.name in con_adic:
			p0 = frappe.get_all("CRM Products", {"parent": e.name, "parenttype": "CRM Deal"}, ["product_code", "product_name", "mti_modalidad", "mti_valor_adicional"], order_by="idx asc", limit=1)
			if p0:
				p0 = p0[0]
				tipo = {"Hora": "Horas adicionales", "Día": "Días adicionales", "Semana": "Semanas adicionales", "Mes": "Meses adicionales"}.get(p0.mti_modalidad, "Horas adicionales")
				unit = p0.mti_valor_adicional or 350000
				cant = 2 if tipo == "Horas adicionales" else 1
				adic.append((p0.product_code or p0.product_name, tipo, cant, unit, cant * unit, "Demora del cliente en liberar el área"))
			if e.name == con_adic[-1]:
				adic.append(("Otro", "Cobro adicional", 0, 0, 450000, "Escolta adicional por cambio de ruta"))
		for j, a in enumerate(adic, start=1):
			frappe.get_doc({"doctype": "MTI Adicional", "parent": e.name, "parenttype": "CRM Deal", "parentfield": "mti_adicionales", "idx": j,
				"linea": a[0], "tipo": a[1], "cantidad": a[2], "valor_unitario": a[3], "valor": a[4], "descripcion": a[5]}).db_insert()
		suma = sum(a[4] for a in adic)
		e.deal_value = (e.deal_value or 0) + suma  # el desglose de ejemplo reparte el valor final
		vals = {"mti_valor_adicionales": suma, "mti_valor_final": e.deal_value}
		if i % 7 != 1:  # algunos quedan sin calificar
			notas = [str(random.choice([8, 9, 10, 10, 10])) for _ in range(4)]
			if i % 5 == 0: notas[3] = "NA"
			num = [int(n) for n in notas if n != "NA"]
			vals.update({"mti_cal_calidad": notas[0], "mti_cal_personal": notas[1], "mti_cal_maquinaria": notas[2], "mti_cal_puntualidad": notas[3],
				"mti_cal_promedio": round(sum(num) / len(num), 1), "mti_reporte_diario": str(6000 + 3 * i + 7), "mti_recibido_por": random.choice(encargados)})
		frappe.db.set_value("CRM Deal", e.name, vals, update_modified=False)
	for e in ejec[2:]:  # las 2 más recientes quedan sin desglose (aparecen en Alertas de Logística)
		filas = frappe.get_all("CRM Products", {"parent": e.name, "parenttype": "CRM Deal"},
			["product_code", "product_name", "mti_descripcion", "amount"], order_by="idx asc")
		for i, (concepto, valor) in enumerate(_repartir(filas, e.deal_value or 0), start=1):
			frappe.get_doc({"doctype": "MTI Desglose", "parent": e.name, "parenttype": "CRM Deal", "parentfield": "mti_desglose",
				"idx": i, "concepto": concepto, "valor": valor}).db_insert()
