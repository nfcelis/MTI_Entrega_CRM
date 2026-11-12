/* MTI Grúas · pantallas de trabajo sobre Frappe CRM (v3 · estándar)
   Tablero · Pipeline · Ficha de oferta · Visitas técnicas · Programación · Históricos · Buscar trabajos ·
   Alertas · Clientes · Catálogos · Impresión de la oferta (formato MTI-CL-FR-002)
   Datos: solo la API estándar de Frappe (/api/resource). Sin Server Scripts: las tareas, recordatorios y
   el semáforo diario los hacen las Automatizaciones de Frappe CRM (Configuración → Automatizaciones). */
(function () {
  "use strict";

  const PIPE = ["Solicitud recibida", "Visita técnica", "Análisis de Proyectos", "Cotización preparada",
    "Cotización enviada", "Seguimiento", "En modificación", "Aprobada", "Enviada a Logística", "Programada",
    "En ejecución", "Ejecutada", "En espera", "Perdida", "Cancelada"];
  const ABIERTAS = ["Cotización enviada", "Seguimiento"];
  const PRE_ENVIO = ["Solicitud recibida", "Visita técnica", "Análisis de Proyectos", "Cotización preparada", "En modificación"];
  const LOGISTICA = ["Enviada a Logística", "Programada", "En ejecución"];
  const GANADAS = ["Aprobada", "Enviada a Logística", "Programada", "En ejecución", "Ejecutada"];
  const CERRADAS = ["Ejecutada", "Perdida", "Cancelada"];
  const CON_MOTIVO = ["En espera", "Perdida", "Cancelada"];
  // Desde la aprobación, la cotización (equipos, valores, condiciones) queda fijada
  const FIJADAS = ["Aprobada", "Enviada a Logística", "Programada", "En ejecución", "Ejecutada", "Cancelada"];
  const fijada = (c) => FIJADAS.includes(c.status) || (c.status === "En espera" && FIJADAS.includes(c.mti_estado_previo));
  const NO_FIJOS = ["mti_fecha_solicitada", "mti_hora_solicitada", "mti_contacto_sitio", "mti_tel_sitio", "mti_notas_logistica", "mti_proximo_contacto"];
  const TIPOS_ADIC = { "Hora": "Horas adicionales", "Día": "Días adicionales", "Semana": "Semanas adicionales", "Quincena": "Quincenas adicionales", "Mes": "Meses adicionales", "Global": "Horas adicionales" };
  const CALIF = [["mti_cal_calidad", "Calidad del servicio prestado"], ["mti_cal_personal", "El desempeño del personal de MTI"], ["mti_cal_maquinaria", "La maquinaria enviada"], ["mti_cal_puntualidad", "La puntualidad en el servicio"]];
  // Días para que una alerta pase a rojo (cuánto puede esperar cada área antes de que se considere olvidada)
  const LIMITES = { solicitud: 1, proyectos: 2, preparada: 1, aprobada: 1, porprog: 1, espera: 30, desglose: 30 };
  const CANALES = ["Llamada", "WhatsApp", "Correo", "Visita", "Reunión"];
  const FUENTES = ["WhatsApp", "Correo", "Llamada", "Referido"];
  const MODALIDADES = ["Hora", "Día", "Semana", "Quincena", "Mes", "Global"];
  const UNIDAD = { "Hora": ["hora", "horas"], "Día": ["día", "días"], "Semana": ["semana", "semanas"], "Quincena": ["quincena", "quincenas"], "Mes": ["mes", "meses"], "Global": ["servicio", "servicios"] };
  const JORNADAS = ["Diurna", "Nocturna", "Mixta", "24 horas"];
  const FRECUENCIAS = ["Lunes a viernes", "Lunes a sábado", "Todos los días"];
  const CAT_EQUIPO = ["Grúa", "Transporte", "Otro"];
  const CAT_PERSONAL = ["Técnico de visitas", "Operador", "Aparejador", "Conductor", "Otro"];
  const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MESES_L = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const CHECKS = [
    ["ubicacion", "Ubicación / acceso", "mti_ubicacion", "text", ""],
    ["altura", "Altura de izaje", "t:altura", "num", "m"],
    ["radio", "Radio de operación", "t:radio", "num", "m"],
    ["peso", "Peso de la carga", "t:peso", "num", "t"],
    ["restricciones", "Restricciones del sitio", "mti_restricciones", "text", ""],
    ["fotos", "Fotos", null, "fotos", ""],
  ];

  let S = {
    data: null, ficha: null, edit: null,
    filtros: { q: "", estado: "", cliente: "", equipo: "", servicio: "", anio: "", mes: "", vencidas: false, cerradas: true, kpi: "" },
    semana: 0, modoCal: "semana", visitaSel: null, mes: 0,
    prog: { semana: 0, mes: 0, modo: "semana", sel: null },
    hist: { anio: "", equipo: "", cliente: "", servicio: "", mes: null },
    busq: { q: "", cliente: "", anio: "", equipo: "", servicio: "", modalidad: "", estado: "", amin: "", amax: "", rmin: "", rmax: "", pmin: "", pmax: "", ref: null },
    cat: "Equipo", cli: { q: "" }, alArea: "",
  };
  const root = () => document.getElementById("mti-app");

  // ------------------------------------------------------------------ utilidades
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function parseD(s) {
    if (!s) return null;
    if (s instanceof Date) return s;
    const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  }
  const p2 = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const dm = (s) => { const d = parseD(s); return d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}` : "—"; };
  const dmy = (s) => { const d = parseD(s); return d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}` : "—"; };
  const hm = (s) => { const d = parseD(s); return d ? `${d.getHours()}:${p2(d.getMinutes())}` : ""; };
  const hoy = () => parseD(S.data.hoy);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const diffDays = (a, b) => Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()) - new Date(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);
  const lunes = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const w = (x.getDay() + 6) % 7; return addDays(x, -w); };
  const money = (v) => (v ? "$ " + Math.round(v).toLocaleString("es-CO") : "");
  const money0 = (v) => "$ " + Math.round(v || 0).toLocaleString("es-CO");
  const num = (v) => (v || v === 0 ? (Math.round(v * 10) / 10).toLocaleString("es-CO") : "");
  const parseMoney = (s) => { const d = String(s || "").replace(/[^\d]/g, ""); return d ? parseInt(d, 10) : 0; };
  const parseNum = (s) => { const t = String(s || "").trim().replace(/\./g, "").replace(",", "."); const n = parseFloat(t); return isNaN(n) ? 0 : n; };
  const nombreU = (u) => { if (!u) return ""; const x = (S.data.usuarios || []).find((y) => y.name === u); return x ? x.full_name : u; };
  const corto = (u) => { const n = nombreU(u); if (!n) return ""; const p = n.split(" "); return p.length > 1 ? `${p[0][0]}. ${p[p.length - 1]}` : n; };
  const iniciales = (n) => (n || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const colorEstado = (st) => { if (st === "En espera") return "hold"; const e = (S.data.estados || []).find((x) => x.name === st); return e ? e.color : "gray"; };
  const pill = (st, txt) => `<span class="mti-pill c-${colorEstado(st)}">${esc(txt || st)}</span>`;
  const codigo = (c) => c.mti_codigo || String(c.name || "").replace(/^OF-/, "");
  const cat = (tipo) => (S.data.catalogo || []).filter((x) => x.tipo === tipo);
  const catNombres = (tipo) => cat(tipo).map((x) => x.nombre);
  const datalist = (id, arr) => `<datalist id="${id}">${[...new Set(arr)].filter(Boolean).map((o) => `<option value="${esc(o)}">`).join("")}</datalist>`;
  const es = (p) => (S.data.perfiles || []).includes(p);
  const soloLectura = () => !es("comercial") && !es("proyectos") && !es("logistica");
  const soloLogistica = () => es("logistica") && !es("comercial") && !es("proyectos");
  // Proyectos, Gerencia y el administrador ven todas las vistas; Comercial y Logística no ven Históricos ni exportan clientes
  const verTodo = () => es("proyectos") || es("gerencia");
  // Administrador del sistema (rol System Manager): puede eliminar ofertas
  const esAdmin = () => !!(S.data && S.data.admin);
  const fechaRef = (c) => parseD(c.mti_fecha_ejecucion || c.mti_fecha_envio || c.creation);
  const anioDe = (c) => { const d = fechaRef(c); return d ? d.getFullYear() : null; };
  const mesDe = (c) => { const d = fechaRef(c); return d ? d.getMonth() : null; };
  const unidad = (mod, n) => { const u = UNIDAD[mod] || ["unidad", "unidades"]; return Math.abs(n) === 1 ? u[0] : u[1]; };
  const jornadaPl = (j) => ({ "Diurna": "diurnas", "Nocturna": "nocturnas", "Mixta": "mixtas", "24 horas": "continuas" }[j] || "diurnas");

  function duracionTexto(l) {
    const n = l.cantidad || 0, h = l.horas_jornada || 0, j = jornadaPl(l.jornada);
    if (l.modalidad === "Global") return "Servicio global";
    if (l.modalidad === "Hora") return `Disponibilidad de 1 a ${num(n)} horas ${j} consecutivas en el sitio`;
    if (l.modalidad === "Día") return `${num(n)} ${unidad("Día", n)} · disponibilidad de 1 a ${h} horas ${j} consecutivas por día`;
    return `${num(n)} ${unidad(l.modalidad, n)} · jornadas de ${h} horas ${j}`;
  }
  const lineaCorta = (l) => `${l.equipo || l.descripcion || "—"} · ${l.modalidad === "Global" ? "global" : num(l.cantidad) + " " + unidad(l.modalidad, l.cantidad)}${l.modalidad !== "Global" && l.jornada ? " · " + l.jornada.toLowerCase() : ""}`;

  function semClase(sem) {
    if (!sem) return "none";
    if (sem.includes("Rojo")) return "rojo";
    if (sem.includes("Amarillo")) return "amarillo";
    if (sem.includes("Verde")) return "verde";
    return "gris";
  }
  const dot = (sem) => `<span class="mti-dot ${semClase(sem)}" title="${esc(sem || "")}"></span>`;
  function proxTxt(c) {
    if (!ABIERTAS.includes(c.status) || !c.mti_proximo_contacto) return { t: "—", cls: "" };
    const n = diffDays(parseD(c.mti_proximo_contacto), hoy());
    if (n < 0) return { t: "Vencido", cls: "mti-venc" };
    if (n === 0) return { t: "Hoy", cls: "mti-bold" };
    if (n === 1) return { t: "Mañana", cls: "" };
    return { t: dm(c.mti_proximo_contacto), cls: "" };
  }
  function checklist(c) {
    const faltan = CHECKS.filter(([k]) => !c["mti_chk_" + k]).map(([, l]) => l);
    return { faltan, completo: faltan.length === 0 };
  }
  function estadoVisita(c) {
    if (c.mti_estado_visita === "Realizada") return "realizada";
    const f = parseD(c.mti_fecha_visita);
    if (c.mti_estado_visita === "Pendiente de información") return "pendiente";
    if (f && f <= parseD(S.data.ahora) && !checklist(c).completo) return "pendiente";
    return "programada";
  }
  const habil = (d, frec) => { const w = d.getDay(); return frec === "Todos los días" ? true : frec === "Lunes a sábado" ? w !== 0 : w !== 0 && w !== 6; };
  function calcHasta(desde, l, frec) {
    const d = parseD(desde);
    if (!d) return "";
    const n = Math.max(1, Math.round(l.cantidad || 1));
    if (l.modalidad === "Día") { let x = new Date(d), k = 1; while (k < n) { x = addDays(x, 1); if (habil(x, frec)) k++; } return ymd(x); }
    if (l.modalidad === "Semana") return ymd(addDays(d, 7 * n - 1));
    if (l.modalidad === "Quincena") return ymd(addDays(d, 15 * n - 1));
    if (l.modalidad === "Mes") { const x = new Date(d); x.setMonth(x.getMonth() + n); return ymd(addDays(x, -1)); }
    return ymd(d);
  }
  function horaMas(h, horas) {
    const m = String(h || "").match(/(\d{1,2}):(\d{2})/);
    if (!m) return "";
    const t = Math.min(23 * 60 + 59, +m[1] * 60 + +m[2] + Math.round((horas || 0) * 60));
    return `${p2(Math.floor(t / 60))}:${p2(t % 60)}`;
  }

  // ------------------------------------------------------------------ DATOS · solo API estándar de Frappe
  // Esta capa reemplaza a los antiguos Server Scripts. Lee y guarda con /api/resource y métodos
  // estándar de Frappe; los permisos los aplica Frappe según el rol de cada usuario. Las tareas de
  // traspaso, los recordatorios y el semáforo diario los hacen las Automatizaciones de Frappe
  // (Configuración → Automatizaciones), no esta página.
  const DT = "CRM Deal";
  const SERIE = "OF-.#####";
  const ROL_PERFIL = { "MTI Comercial": "comercial", "MTI Proyectos": "proyectos", "MTI Logística": "logistica", "MTI Gerencia": "gerencia" };
  const PERMISOS = {
    crear: ["comercial"], guardar: ["comercial", "proyectos"], enviar: ["comercial"], modificar: ["comercial"],
    ajuste_listo: ["proyectos", "comercial"], seguimiento: ["comercial"], posponer: ["comercial", "logistica"],
    agendar: ["comercial"], checklist: ["comercial", "proyectos"], sin_visita: ["comercial"],
    estado: ["comercial", "proyectos"], enviar_logistica: ["comercial"], programar: ["logistica"],
    iniciar: ["logistica"], ejecutar: ["logistica"], cancelar: ["logistica", "comercial"],
    catalogo: ["comercial", "proyectos", "logistica"], cliente: ["comercial"], cliente_nuevo: ["comercial"], reglas: ["comercial"],
    espera: ["comercial", "proyectos", "logistica"], reanudar: ["comercial", "proyectos", "logistica"],
    motivo: ["comercial", "logistica"], desglose: ["comercial", "logistica"],
    adicionales: ["comercial", "logistica"], calificacion: ["comercial", "logistica"], diagrama: ["proyectos", "comercial"],
    eliminar: ["comercial", "proyectos", "logistica", "gerencia"], // además se exige esAdmin()
    eliminar_cliente: ["comercial", "proyectos", "logistica", "gerencia"], // además se exige esAdmin()
    oferta_texto: ["comercial"],
  };
  const EDITABLES = ["organization", "source", "mti_servicio", "mti_ubicacion", "mti_vigencia", "mti_restricciones",
    "mti_observaciones", "mti_requiere_visita", "mti_estado_visita", "mti_fecha_visita", "mti_tecnico",
    "mti_recordar_visita", "mti_avisar_tecnico", "mti_chk_ubicacion", "mti_chk_altura", "mti_chk_radio", "mti_chk_peso",
    "mti_chk_restricciones", "mti_chk_fotos", "mti_proximo_contacto", "mti_fecha_solicitada", "mti_hora_solicitada",
    "mti_contacto_sitio", "mti_tel_sitio", "mti_notas_logistica", "deal_value"];
  const CAMPOS_PROG = ["prog_desde", "prog_hasta", "prog_hora_inicio", "prog_hora_fin", "prog_dias", "prog_operador", "prog_notas"];
  const CAMPOS_TRABAJO = ["descripcion", "equipo", "altura", "radio", "peso", "especificaciones"];
  const CAMPOS_CLIENTE = ["mti_nit", "mti_direccion", "mti_contacto", "mti_telefono", "mti_email"];
  const CAMPOS_LISTA = ["name", "status", "organization", "deal_owner", "deal_value", "source", "creation", "modified", "closed_date",
    "mti_codigo", "mti_version", "mti_servicio", "mti_equipo", "mti_ubicacion", "mti_vigencia",
    "mti_altura", "mti_radio", "mti_peso", "mti_restricciones", "mti_observaciones",
    "mti_requiere_visita", "mti_estado_visita", "mti_fecha_visita", "mti_tecnico",
    "mti_chk_ubicacion", "mti_chk_altura", "mti_chk_radio", "mti_chk_peso", "mti_chk_restricciones", "mti_chk_fotos",
    "mti_recordar_visita", "mti_avisar_tecnico", "mti_resp_proyectos", "mti_resp_logistica", "mti_aprobo_envio",
    "mti_tipo_ajuste", "mti_motivo_ajuste", "mti_fecha_solicitada", "mti_hora_solicitada", "mti_contacto_sitio",
    "mti_tel_sitio", "mti_notas_logistica", "mti_reprogramaciones", "mti_fecha_ejecucion", "mti_fecha_servicio",
    "mti_fecha_envio", "mti_proximo_contacto", "mti_ultimo_contacto", "lost_reason", "lost_notes",
    "mti_estado_previo", "mti_motivo_espera", "mti_fecha_espera", "mti_retomar_el",
    "mti_valor_adicionales", "mti_valor_final", "mti_cal_promedio", "mti_cal_calidad", "mti_cal_personal", "mti_cal_maquinaria", "mti_cal_puntualidad",
    "mti_reporte_diario", "mti_recibido_por", "mti_diagrama", "mti_obs_cliente", "mti_reporte_foto"];
  const CAMPOS_PRODUCTO = ["name", "parent", "idx", "product_code", "product_name", "qty", "rate", "amount", "net_amount",
    "mti_tipo", "mti_descripcion", "mti_modalidad", "mti_horas_jornada", "mti_jornada", "mti_movilizacion", "mti_valor_adicional", "mti_incluir",
    "mti_prog_desde", "mti_prog_hasta", "mti_prog_hora_inicio", "mti_prog_hora_fin", "mti_prog_dias", "mti_prog_operador", "mti_prog_notas"];
  // Etapas en las que sigue vigente cada tarea automática. Al guardar una oferta, las tareas que ya no
  // corresponden a su etapa se marcan como hechas (las nuevas las crean las Automatizaciones de Frappe).
  const VIGENTE = {
    "Completar levantamiento": ["Solicitud recibida", "Visita técnica"],
    "Confirmar visita": ["Solicitud recibida", "Visita técnica"],
    "Definir solución técnica": ["Análisis de Proyectos"],
    "Ajuste técnico": ["En modificación"],
    "Ajustar y reenviar": ["En modificación"],
    "Formalizar y enviar": ["Cotización preparada"],
    "Seguimiento": ["Cotización enviada", "Seguimiento"],
    "Sin respuesta": ["Cotización enviada", "Seguimiento"],
    "Enviar a Logística": ["Aprobada"],
    "Programar servicio": ["Enviada a Logística"],
    "Servicio mañana": ["Programada"],
    "Fecha del servicio cambió": ["Enviada a Logística", "Programada", "En ejecución"],
    "Retomar oferta": ["En espera"],
  };

  // Logo de MTI (PNG incrustado para que las pantallas no dependan de archivos externos)
  const LOGO = "data:image/png;base64,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";

  function csrf() { return (window.frappe && window.frappe.csrf_token) || window.csrf_token || ""; }
  async function leerRespuesta(r) {
    let j = {};
    try { j = await r.json(); } catch (e) { /* sin cuerpo */ }
    if (!r.ok || j.exc_type || j.exception) {
      let msg = "Error " + r.status;
      try {
        if (j._server_messages) msg = JSON.parse(JSON.parse(j._server_messages)[0]).message;
        else if (j.exception) msg = j.exception.split(":").slice(1).join(":").trim() || msg;
        else if (j.message) msg = j.message;
      } catch (e) { /* ignorar */ }
      const err = new Error(String(msg).replace(/<[^>]+>/g, " "));
      err.status = r.status;
      throw err;
    }
    return j;
  }
  const cab = (json) => ({ Accept: "application/json", "X-Frappe-CSRF-Token": csrf(), ...(json ? { "Content-Type": "application/json" } : {}) });
  const enc = (s) => encodeURIComponent(s);
  const http = {
    get: (ruta, p) => fetch(ruta + (p ? "?" + new URLSearchParams(p) : ""), { headers: cab(), credentials: "same-origin" }).then(leerRespuesta),
    send: (verbo, ruta, cuerpo) => fetch(ruta, { method: verbo, headers: cab(true), credentials: "same-origin", body: JSON.stringify(cuerpo || {}) }).then(leerRespuesta),
  };
  const metodo = async (nombre, args) => (await http.send("POST", "/api/method/" + nombre, args)).message;
  async function listar(doctype, campos, filtros, orden, limite) {
    const p = { fields: JSON.stringify(campos || ["name"]), limit_page_length: limite || 0 };
    if (filtros) p.filters = JSON.stringify(filtros);
    if (orden) p.order_by = orden;
    return (await http.get("/api/resource/" + enc(doctype), p)).data || [];
  }
  const hijos = (doctype, padre, campos, filtros) => metodo("frappe.client.get_list", { doctype, parent: padre, fields: campos, filters: filtros || [], limit_page_length: 0, order_by: "idx asc" });
  // Filas hijas solo de las ofertas cargadas (en lotes, para no traer las de años que no se están viendo)
  async function hijosDe(doctype, campos, nombres, filtros) {
    if (!nombres.length) return [];
    const lotes = [];
    for (let i = 0; i < nombres.length; i += 300) lotes.push(nombres.slice(i, i + 300));
    const partes = await Promise.all(lotes.map((l) => hijos(doctype, DT, campos, [["parent", "in", l], ...(filtros || [])])));
    return [].concat(...partes.map((x) => x || []));
  }
  const leerDoc = async (dt, n) => (await http.get(`/api/resource/${enc(dt)}/${enc(n)}`)).data;
  const crearDoc = async (dt, d) => (await http.send("POST", `/api/resource/${enc(dt)}`, d)).data;
  const editarDoc = async (dt, n, d) => (await http.send("PUT", `/api/resource/${enc(dt)}/${enc(n)}`, d)).data;
  const existe = async (dt, n) => { try { await leerDoc(dt, n); return true; } catch (e) { if (e.status === 404) return false; throw e; } };
  const intentar = async (fn, porDefecto) => { try { return await fn(); } catch (e) { return porDefecto; } };

  // Fecha y hora locales (Bogotá) en el formato de Frappe
  const ahoraTxt = () => { const d = new Date(); return `${ymd(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
  const hoyTxt = () => ymd(new Date());
  const masDias = (base, n) => ymd(addDays(parseD(base) || new Date(), n));

  function reglasDe(cfg) {
    return {
      verde: cfg.verde_hasta || 2, amarillo: cfg.amarillo_hasta || 4, dias_proximo: cfg.dias_proximo_contacto || 3,
      dias_vigencia: cfg.dias_vigencia || 15, avisar_app: cfg.avisar_app, avisar_correo: cfg.avisar_correo,
      avisar_whatsapp: cfg.avisar_whatsapp, resumen_diario: cfg.resumen_diario, hora_resumen: cfg.hora_resumen || "7:30",
    };
  }
  function calcularSemaforo(status, fechaEnvio, proximo, R) {
    const H = parseD(hoyTxt());
    if (!ABIERTAS.includes(status)) return [PRE_ENVIO.includes(status) ? "⚪ Sin enviar" : "", 0];
    if (!fechaEnvio) return ["⚪ Sin enviar", 0];
    const dias = diffDays(H, parseD(fechaEnvio));
    const vencido = proximo && diffDays(parseD(proximo), H) < 0;
    if (dias > R.amarillo || vencido) return ["🔴 Rojo", dias];
    if (dias > R.verde) return ["🟡 Amarillo", dias];
    return ["🟢 Verde", dias];
  }
  // Producto estándar de Frappe CRM ⇄ línea de la oferta MTI
  const adicionalDe = (x) => ({ linea: x.linea || "", tipo: x.tipo || "Cobro adicional", cantidad: +x.cantidad || 0, valor_unitario: +x.valor_unitario || 0, valor: +x.valor || 0, descripcion: x.descripcion || "" });
  function filaALinea(p) {
    return {
      name: p.name, idx: p.idx, tipo: p.mti_tipo || "Equipo", equipo: p.product_code || "", incluir: p.mti_incluir === 0 || p.mti_incluir === "0" ? 0 : 1,
      descripcion: p.mti_descripcion || (p.product_code ? "" : p.product_name || ""),
      modalidad: p.mti_modalidad || "Día", cantidad: p.qty || 0, horas_jornada: p.mti_horas_jornada || 0, jornada: p.mti_jornada || "Diurna",
      movilizacion: p.mti_movilizacion, valor_adicional: p.mti_valor_adicional || 0, valor_total: p.amount || p.net_amount || 0,
      prog_desde: p.mti_prog_desde || "", prog_hasta: p.mti_prog_hasta || "", prog_hora_inicio: p.mti_prog_hora_inicio || "",
      prog_hora_fin: p.mti_prog_hora_fin || "", prog_dias: p.mti_prog_dias || "", prog_operador: p.mti_prog_operador || "", prog_notas: p.mti_prog_notas || "",
    };
  }
  function lineaAFila(l) {
    const total = Math.round(l.valor_total || 0);
    const qty = l.modalidad === "Global" ? 1 : (l.cantidad || 1);
    const fila = {
      product_code: (l.equipo || "").trim() || null, product_name: (l.equipo || "").trim() || (l.descripcion || "").trim() || "Servicio",
      qty, rate: qty ? total / qty : total, amount: total, net_amount: total, discount_percentage: 0, discount_amount: 0,
      mti_tipo: l.tipo || "Equipo", mti_descripcion: l.descripcion || "", mti_modalidad: l.modalidad || "Día",
      mti_horas_jornada: l.horas_jornada || 0, mti_jornada: l.jornada || "Diurna", mti_movilizacion: l.movilizacion ? 1 : 0,
      mti_valor_adicional: Math.round(l.valor_adicional || 0), mti_incluir: l.incluir === 0 ? 0 : 1,
    };
    CAMPOS_PROG.forEach((k) => (fila["mti_" + k] = l[k] || null));
    if (l.name) fila.name = l.name;
    return fila;
  }

  // ---------- Carga escalable (≈1.500 ofertas por año)
  // Se cargan todas las ofertas abiertas y las cerradas (ejecutadas, perdidas, canceladas) creadas desde
  // el 1 de enero del año anterior. Los años más antiguos se piden solo cuando alguien los elige en un filtro.
  // Después de cada acción se refresca solo la oferta tocada, no todo.
  const desdeInicial = () => `${new Date().getFullYear() - 1}-01-01`;
  const CAMPOS_TAREA = ["name", "title", "assigned_to", "due_date", "priority", "status", "reference_docname", "description", "modified"];
  const incluida = (l) => l.incluir !== 0;
  function prepararDeal(d, x, R, H0) {
    const s = calcularSemaforo(d.status, d.mti_fecha_envio, d.mti_proximo_contacto, R);
    d.semaforo = s[0]; d.dias = s[1];
    d.lineasTodas = (x.lin[d.name] || []).sort((a, b) => a.idx - b.idx).map(filaALinea);
    d.lineas = d.lineasTodas.filter(incluida);
    d.trabajos = (x.trab[d.name] || []).sort((a, b) => a.idx - b.idx);
    d.contacto = x.ct[d.name] ? x.ct[d.name].full_name || "" : "";
    d.telefono = x.ct[d.name] ? x.ct[d.name].mobile_no || "" : "";
    d.ultima_nota = String(x.nota[d.name] || "").replace(/<[^>]+>/g, " ").trim();
    d.adicionales = (x.adc[d.name] || []).sort((a, b) => a.idx - b.idx).map(adicionalDe);
    d.valor_final = +d.mti_valor_final || +d.deal_value || 0;
    d.desglose = (x.dg[d.name] || []).sort((a, b) => a.idx - b.idx).map((y) => ({ concepto: y.concepto || "", valor: +y.valor || 0, nota: y.nota || "" }));
    // desde cuándo está en la etapa actual (registro estándar de cambios de etapa de Frappe CRM)
    const ult = (x.lg[d.name] || []).sort((a, b) => a.idx - b.idx).slice(-1)[0];
    d.desde_etapa = ult && ult.from === d.status && !ult.to ? ult.from_date : d.modified;
    d.dias_etapa = Math.max(0, diffDays(H0, parseD(d.desde_etapa)) || 0);
    return d;
  }
  const agrupar = (arr) => { const m = {}; (arr || []).forEach((x) => { (m[x.parent] = m[x.parent] || []).push(x); }); return m; };
  async function hijosDeOfertas(nombres) {
    const [productos, trabajos, contactos, desgloses, adicionales, logs] = await Promise.all([
      intentar(() => hijosDe("CRM Products", CAMPOS_PRODUCTO, nombres), []),
      intentar(() => hijosDe("MTI Trabajo", ["parent", "idx", ...CAMPOS_TRABAJO], nombres), []),
      intentar(() => hijosDe("CRM Contacts", ["parent", "full_name", "mobile_no", "email"], nombres, [["is_primary", "=", 1]]), []),
      intentar(() => hijosDe("MTI Desglose", ["parent", "idx", "concepto", "valor", "nota"], nombres), []),
      intentar(() => hijosDe("MTI Adicional", ["parent", "idx", "linea", "tipo", "cantidad", "valor_unitario", "valor", "descripcion"], nombres), []),
      // solo la etapa actual (la fila del registro que aún no tiene "a"): basta para saber hace cuánto está en ella
      intentar(() => hijosDe("CRM Status Change Log", ["parent", "idx", "from", "from_date", "to"], nombres, [["to", "is", "not set"]]), []),
    ]);
    const ct = {};
    contactos.forEach((c) => (ct[c.parent] = c));
    return { lin: agrupar(productos), trab: agrupar(trabajos), dg: agrupar(desgloses), adc: agrupar(adicionales), lg: agrupar(logs), ct, nota: {} };
  }

  async function cargarDatos() {
    const usuario = (await http.get("/api/method/frappe.auth.get_logged_user")).message;
    const desde = S.desde || desdeInicial();
    const hace120 = masDias(hoyTxt(), -120);
    const [roles, abiertas, cerradas, primera, notas, usuarios, estados, motivos, equipos, catalogo, clientes, cfg, tareas] = await Promise.all([
      intentar(() => metodo("frappe.core.doctype.user.user.get_current_user_roles"), []),
      listar(DT, CAMPOS_LISTA, [["status", "not in", CERRADAS]], "creation desc"),
      listar(DT, CAMPOS_LISTA, [["status", "in", CERRADAS], ["creation", ">=", desde]], "creation desc"),
      intentar(() => listar(DT, ["creation"], null, "creation asc", 1), []),
      // la última nota solo se usa en solicitudes recientes (visitas por agendar)
      intentar(() => listar("Comment", ["reference_name", "content"], [["reference_doctype", "=", DT], ["comment_type", "=", "Comment"], ["creation", ">=", hace120]], "creation asc"), []),
      intentar(() => metodo("crm.api.session.get_users"), []),
      listar("CRM Deal Status", ["name", "color", "type", "position"], null, "position asc"),
      intentar(() => listar("CRM Lost Reason", ["name"]), []),
      intentar(() => listar("CRM Product", ["name", "product_name", "mti_categoria", "mti_capacidad"], [["disabled", "=", 0]], "name asc"), []),
      intentar(() => listar("MTI Catalogo", ["name", "tipo", "nombre", "categoria"], [["activo", "=", 1]], "nombre asc"), []),
      intentar(() => listar("CRM Organization", ["name", ...CAMPOS_CLIENTE], null, "name asc"), []),
      intentar(() => leerDoc("MTI Configuracion", "MTI Configuracion"), {}),
      intentar(() => listar("CRM Task", CAMPOS_TAREA, [["status", "not in", ["Done", "Canceled"]]], "due_date asc"), []),
    ]);
    const vistos = new Set();
    const deals = [...abiertas, ...cerradas].filter((d) => (vistos.has(d.name) ? false : vistos.add(d.name)))
      .sort((a, b) => String(b.creation).localeCompare(String(a.creation)));
    const x = await hijosDeOfertas(deals.map((d) => d.name));
    notas.forEach((n) => (x.nota[n.reference_name] = n.content));
    const listaUsuarios = [].concat(...(usuarios || []).map((u) => (Array.isArray(u) ? u : [u]))).filter((u) => u && u.name);
    const yo = listaUsuarios.find((u) => u.name === usuario) || { full_name: (await intentar(() => metodo("frappe.client.get_value", { doctype: "User", filters: { name: usuario }, fieldname: "full_name" }), {})).full_name || usuario };
    let perfiles = [];
    if (usuario === "Administrator" || roles.includes("System Manager")) perfiles = ["comercial", "proyectos", "logistica"];
    else Object.keys(ROL_PERFIL).forEach((r) => { if (roles.includes(r)) perfiles.push(ROL_PERFIL[r]); });
    const R = reglasDe(cfg);
    const etapa = {}; deals.forEach((d) => (etapa[d.name] = d.status));
    const H0 = parseD(hoyTxt());
    deals.forEach((d) => prepararDeal(d, x, R, H0));
    const p0 = parseD((primera[0] || {}).creation);
    return {
      usuario, nombre: yo.full_name || usuario, perfiles, hoy: hoyTxt(), ahora: ahoraTxt(),
      admin: usuario === "Administrator" || roles.includes("System Manager"),
      desde, primerAnio: p0 ? p0.getFullYear() : new Date().getFullYear(),
      usuarios: [...new Map(listaUsuarios.map((u) => [u.name, { name: u.name, full_name: u.full_name || u.name }])).values()],
      estados, motivos_perdida: motivos.map((m) => m.name),
      catalogo: catalogoDe(equipos, catalogo),
      clientes, reglas: R, cfg,
      empresa: { nombre: cfg.empresa_nombre || "", nit: cfg.empresa_nit || "", formato: cfg.formato_codigo || "",
        primero: cfg.clausula_primero || "", finales: cfg.clausulas_finales || "", pie: cfg.pie_pagina || "" },
      cotizaciones: deals, tareas: tareas.filter((t) => !tareaVencida(t, etapa[t.reference_docname])),
    };
  }
  const catalogoDe = (equipos, catalogo) => [
    ...equipos.map((e) => ({ name: e.name, tipo: "Equipo", nombre: e.name, categoria: e.mti_categoria || "", capacidad: e.mti_capacidad || 0 })),
    ...catalogo.map((c) => ({ name: c.name, tipo: c.tipo, nombre: c.nombre, categoria: c.categoria || "", capacidad: 0 })),
  ];

  // Vuelve a leer una sola oferta (y lo que cuelga de ella) después de una acción: mucho más liviano que recargar todo
  async function refrescarOferta(name, conClientes) {
    const [filas, x, tareas, nota, equipos, catalogo, clientes] = await Promise.all([
      listar(DT, CAMPOS_LISTA, [["name", "=", name]]),
      hijosDeOfertas([name]),
      intentar(() => listar("CRM Task", CAMPOS_TAREA, [["reference_doctype", "=", DT], ["reference_docname", "=", name], ["status", "not in", ["Done", "Canceled"]]], "due_date asc"), []),
      intentar(() => listar("Comment", ["reference_name", "content"], [["reference_doctype", "=", DT], ["reference_name", "=", name], ["comment_type", "=", "Comment"]], "creation desc", 1), []),
      conClientes ? intentar(() => listar("CRM Product", ["name", "product_name", "mti_categoria", "mti_capacidad"], [["disabled", "=", 0]], "name asc"), null) : null,
      conClientes ? intentar(() => listar("MTI Catalogo", ["name", "tipo", "nombre", "categoria"], [["activo", "=", 1]], "nombre asc"), null) : null,
      conClientes ? intentar(() => listar("CRM Organization", ["name", ...CAMPOS_CLIENTE], null, "name asc"), null) : null,
    ]);
    const D = S.data;
    D.hoy = hoyTxt(); D.ahora = ahoraTxt();
    D.cotizaciones = D.cotizaciones.filter((c) => c.name !== name);
    D.tareas = (D.tareas || []).filter((t) => t.reference_docname !== name);
    if (filas[0]) {
      nota.forEach((n) => (x.nota[n.reference_name] = n.content));
      const d = prepararDeal(filas[0], x, D.reglas, parseD(hoyTxt()));
      D.cotizaciones.push(d);
      D.cotizaciones.sort((a, b) => String(b.creation).localeCompare(String(a.creation)));
      D.tareas = D.tareas.concat(tareas.filter((t) => !tareaVencida(t, d.status)));
    }
    if (equipos && catalogo) D.catalogo = catalogoDe(equipos, catalogo);
    if (clientes) D.clientes = clientes;
  }

  // Si se elige un año anterior a lo cargado, se traen esas ofertas (una sola vez)
  async function asegurarAnio(anio) {
    const y = parseInt(anio, 10);
    if (!y || !S.data || `${y}-01-01` >= S.data.desde) return false;
    S.desde = `${y}-01-01`;
    toast(`Cargando las ofertas desde ${y}…`);
    await cargar(false);
    return true;
  }

  async function cargarOferta(name) {
    const r = await http.get("/api/method/frappe.desk.form.load.getdoc", { doctype: DT, name });
    const doc = (r.docs || [])[0];
    if (!doc) throw new Error("Oferta no encontrada");
    const info = r.docinfo || {};
    const R = (S.data && S.data.reglas) || reglasDe({});
    const s = calcularSemaforo(doc.status, doc.mti_fecha_envio, doc.mti_proximo_contacto, R);
    let contacto = null;
    (doc.contacts || []).forEach((c) => { if (c.is_primary || !contacto) contacto = { nombre: c.full_name, movil: c.mobile_no, email: c.email }; });
    const cliente = ((S.data && S.data.clientes) || []).find((c) => c.name === doc.organization) || null;
    const tareas = await intentar(() => listar("CRM Task", ["name", "title", "assigned_to", "status", "due_date", "priority"],
      [["reference_doctype", "=", DT], ["reference_docname", "=", name]], "creation desc"), []);
    let versiones = [];
    try { versiones = JSON.parse(doc.mti_versiones || "[]"); } catch (e) { versiones = []; }
    return {
      ...doc, semaforo: s[0], dias: s[1], contacto, cliente, tareas, versiones,
      lineasTodas: (doc.products || []).map(filaALinea),
      lineas: (doc.products || []).map(filaALinea).filter(incluida),
      adicionales: (doc.mti_adicionales || []).map(adicionalDe),
      valor_final: +doc.mti_valor_final || +doc.deal_value || 0,
      desglose: (doc.mti_desglose || []).map((x) => ({ concepto: x.concepto || "", valor: +x.valor || 0, nota: x.nota || "" })),
      trabajos: (doc.mti_trabajos || []).map((t) => ({ name: t.name, idx: t.idx, ...Object.fromEntries(CAMPOS_TRABAJO.map((k) => [k, t[k]])) })),
      etapas: (doc.status_change_log || []).map((e) => ({ de: e.from, a: e.to, desde: e.from_date, hasta: e.to_date, por: e.log_owner })),
      seguimientos: (info.comments || []).slice().sort((a, b) => String(a.creation).localeCompare(String(b.creation)))
        .map((c) => ({ name: c.name, content: c.content, creation: c.creation, owner: c.owner, comment_by: c.comment_by || c.owner })),
      adjuntos: info.attachments || [],
    };
  }

  // ---------- reglas que antes estaban en el Server Script "Antes de guardar"
  function derivar(doc, cambios, previo) {
    const set = (k, v) => { if (doc[k] !== v) { doc[k] = v; cambios[k] = v; } };
    const filas = doc.products || [];
    const enOferta = (p) => !(p.mti_incluir === 0 || p.mti_incluir === "0");
    if (filas.length) {
      // el total comercial es la suma de los servicios seleccionados para la oferta final
      const total = filas.filter(enOferta).reduce((s, p) => s + (+p.amount || 0), 0);
      set("total", total); set("net_total", total); set("deal_value", total);
    }
    // Adicionales del servicio (horas/días extra, otros cobros) → valor final consolidado
    const ad = doc.mti_adicionales || [];
    const sumaAd = ad.reduce((t, a) => t + (+a.valor || 0), 0);
    set("mti_valor_adicionales", sumaAd);
    set("mti_valor_final", (+doc.deal_value || 0) + sumaAd);
    // Calificación del cliente (reporte diario): promedio de las preguntas con número
    const notas = CALIF.map(([k]) => parseInt(doc[k], 10)).filter((n) => n >= 1 && n <= 10);
    set("mti_cal_promedio", notas.length ? Math.round((notas.reduce((t, n) => t + n, 0) / notas.length) * 10) / 10 : 0);
    const equipos = [];
    filas.filter(enOferta).forEach((p) => { const n = p.product_code || p.mti_descripcion || p.product_name; if (n && !equipos.includes(n)) equipos.push(n); });
    set("mti_equipo", equipos.join(", "));
    const tr = doc.mti_trabajos || [];
    if (tr.length) {
      set("mti_altura", Math.max(0, ...tr.map((t) => +t.altura || 0)));
      set("mti_radio", Math.max(0, ...tr.map((t) => +t.radio || 0)));
      set("mti_peso", Math.max(0, ...tr.map((t) => +t.peso || 0)));
    }
    const inicio = filas.filter(enOferta).map((p) => p.mti_prog_desde).filter(Boolean).sort()[0] || null;
    set("mti_fecha_servicio", inicio);
    set("mti_codigo", String(doc.name || "").replace(/^OF-/, "") + ((doc.mti_version || 0) > 0 ? "." + doc.mti_version : ""));
    const cfg = S.data.cfg || {}, H = hoyTxt();
    if (previo !== undefined && doc.status !== previo) {
      if (doc.status === "Cotización enviada") {
        if (!doc.mti_fecha_envio) set("mti_fecha_envio", H);
        if (!doc.mti_proximo_contacto) set("mti_proximo_contacto", masDias(H, cfg.dias_proximo_contacto || 3));
        if (!doc.mti_vigencia) set("mti_vigencia", masDias(doc.mti_fecha_envio, cfg.dias_vigencia || 15));
      }
      if (["Análisis de Proyectos", "En modificación"].includes(doc.status) && !doc.mti_resp_proyectos && cfg.proyectos_default) set("mti_resp_proyectos", cfg.proyectos_default);
      if (["Enviada a Logística", "Programada"].includes(doc.status) && !doc.mti_resp_logistica && cfg.logistica_default) set("mti_resp_logistica", cfg.logistica_default);
      if (doc.status === "Análisis de Proyectos" && ["Programada", "Pendiente de información"].includes(doc.mti_estado_visita)) set("mti_estado_visita", "Realizada");
      if (doc.status === "Ejecutada" && !doc.mti_fecha_ejecucion) set("mti_fecha_ejecucion", H);
    }
    const completo = ["ubicacion", "altura", "radio", "peso", "restricciones", "fotos"].every((k) => doc["mti_chk_" + k]);
    if (doc.mti_requiere_visita && doc.mti_fecha_visita && doc.mti_estado_visita !== "Realizada") {
      const paso_ = parseD(doc.mti_fecha_visita) <= new Date();
      if (paso_ && !completo) set("mti_estado_visita", "Pendiente de información");
      else if (!paso_ && ["", null, undefined, "Por agendar"].includes(doc.mti_estado_visita)) set("mti_estado_visita", "Programada");
    }
    if (doc.mti_requiere_visita && !doc.mti_fecha_visita && ["Solicitud recibida", "Visita técnica"].includes(doc.status)) set("mti_estado_visita", "Por agendar");
    set("mti_semaforo", calcularSemaforo(doc.status, doc.mti_fecha_envio, doc.mti_proximo_contacto, S.data.reglas)[0]);
  }

  async function asegurarEquipo(nombre) {
    nombre = (nombre || "").trim();
    if (!nombre) return;
    const ya = (S.data.catalogo || []).find((x) => x.tipo === "Equipo" && x.nombre === nombre);
    if (ya) return;
    if (await existe("CRM Product", nombre)) { await intentar(() => editarDoc("CRM Product", nombre, { disabled: 0 })); return; }
    await crearDoc("CRM Product", { product_code: nombre, product_name: nombre, mti_categoria: /grúa/i.test(nombre) ? "Grúa" : "Otro" });
  }
  async function alCatalogo(tipo, nombre, categoria) {
    nombre = (nombre || "").trim();
    if (!nombre) return;
    if (tipo === "Equipo") return asegurarEquipo(nombre);
    const ex = await listar("MTI Catalogo", ["name", "activo"], [["tipo", "=", tipo], ["nombre", "=", nombre]]);
    if (ex.length) { if (!ex[0].activo) await editarDoc("MTI Catalogo", ex[0].name, { activo: 1 }); return; }
    await crearDoc("MTI Catalogo", { tipo, nombre, categoria: categoria || "", activo: 1 });
  }
  async function asegurarCliente(nombre, datos) {
    nombre = (nombre || "").trim();
    if (!nombre) return;
    const cambios = {};
    CAMPOS_CLIENTE.forEach((k) => { if (datos && k in datos) cambios[k] = datos[k]; });
    if (await existe("CRM Organization", nombre)) { if (Object.keys(cambios).length) await editarDoc("CRM Organization", nombre, cambios); }
    else await crearDoc("CRM Organization", { organization_name: nombre, ...cambios });
  }
  async function asegurarContacto(org, cli) {
    const nombre = ((cli && cli.mti_contacto) || "").trim();
    if (!nombre) return null;
    const [first, ...resto] = nombre.split(" ");
    const last = resto.join(" ");
    const ex = await listar("Contact", ["name"], [["first_name", "=", first], ["last_name", "=", last], ["company_name", "=", org]]);
    if (ex.length) return ex[0].name;
    const ct = await crearDoc("Contact", {
      first_name: first, last_name: last, company_name: org,
      phone_nos: cli.mti_telefono ? [{ phone: cli.mti_telefono, is_primary_mobile_no: 1 }] : [],
      email_ids: cli.mti_email ? [{ email_id: cli.mti_email, is_primary: 1 }] : [],
    });
    return ct.name;
  }
  const comentar = (name, canal, texto) => metodo("frappe.desk.form.utils.add_comment", {
    reference_doctype: DT, reference_name: name, content: `[${canal}] ${texto}`, comment_email: S.data.usuario, comment_by: S.data.nombre,
  });
  function tareaVencida(t, estado) {
    const pre = String(t.title || "").split(" · ")[0];
    return !!(estado && VIGENTE[pre] && !VIGENTE[pre].includes(estado));
  }

  // Cierra las tareas automáticas de la oferta que ya no corresponden (por etapa o por prefijo)
  async function cerrarTareas(name, estado, prefijos) {
    const abiertas = await intentar(() => listar("CRM Task", ["name", "title"], [["reference_doctype", "=", DT], ["reference_docname", "=", name], ["status", "not in", ["Done", "Canceled"]]]), []);
    const vencida = (t) => (prefijos && prefijos.includes(String(t.title || "").split(" · ")[0])) || tareaVencida(t, estado);
    await Promise.all(abiertas.filter(vencida).map((t) => intentar(() => editarDoc("CRM Task", t.name, { status: "Done" }))));
  }

  // Abre la oferta, aplica los cambios con las mismas reglas de siempre y la guarda con la API estándar
  async function conOferta(name, fn) {
    const doc = await leerDoc(DT, name);
    const previo = doc.status;
    const cambios = {};
    const set = (k, v) => { doc[k] = v; cambios[k] = v; };
    const aplicar = (v) => Object.keys(v || {}).forEach((k) => { if (EDITABLES.includes(k)) set(k, v[k]); });
    const extra = (await fn(doc, set, aplicar)) || {};
    if (cambios.products) doc.products = cambios.products;
    if (cambios.mti_trabajos) doc.mti_trabajos = cambios.mti_trabajos;
    derivar(doc, cambios, previo);
    const guardado = await editarDoc(DT, name, cambios);
    await cerrarTareas(name, guardado.status);
    return { doc: guardado, previo, ...extra };
  }
  function ponerLineas(doc, set, nuevas) { set("products", nuevas.map(lineaAFila)); }
  function ponerTrabajos(doc, set, nuevos) {
    set("mti_trabajos", nuevos.map((t) => { const x = {}; CAMPOS_TRABAJO.forEach((k) => (x[k] = t[k] || (["altura", "radio", "peso"].includes(k) ? 0 : ""))); if (t.name) x.name = t.name; return x; }));
  }
  function fotoVersion(doc) {
    return {
      version: doc.mti_version || 0, codigo: doc.mti_codigo || doc.name, fecha_envio: doc.mti_fecha_envio || "", total: +doc.deal_value || 0,
      lineas: (doc.products || []).map(filaALinea).map((l) => ({ tipo: l.tipo, equipo: l.equipo, descripcion: l.descripcion, modalidad: l.modalidad,
        cantidad: l.cantidad, horas_jornada: l.horas_jornada, jornada: l.jornada, movilizacion: l.movilizacion, valor_adicional: l.valor_adicional, valor_total: l.valor_total, incluir: l.incluir })),
      registrado: ahoraTxt(), por: S.data.usuario,
    };
  }

  async function ejecutar(datos) {
    const accion_ = datos.accion, v = datos.valores || {}, H = hoyTxt(), cfg = S.data.cfg || {};
    if (!PERMISOS[accion_]) throw new Error("Acción no reconocida");
    if (!PERMISOS[accion_].some(es)) throw new Error(`Tu perfil (${(S.data.perfiles || []).join(", ") || "sin perfil MTI"}) no permite esta acción`);
    const falla = (m) => { throw new Error(m); };

    if (accion_ === "crear") {
      const org = (v.organization || "").trim();
      if (!org) falla("El cliente es obligatorio");
      const cli = datos.cliente || {};
      await asegurarCliente(org, cli);
      const contacto = await asegurarContacto(org, cli);
      if (v.mti_servicio) await alCatalogo("Servicio", v.mti_servicio);
      const nuevo = { naming_series: SERIE, status: "Solicitud recibida", currency: "COP", deal_owner: S.data.usuario,
        contacts: contacto ? [{ contact: contacto, is_primary: 1 }] : [] };
      Object.keys(v).forEach((k) => { if (EDITABLES.includes(k)) nuevo[k] = v[k]; });
      const d = await crearDoc(DT, nuevo);
      const cambios = {};
      derivar(d, cambios);
      if (Object.keys(cambios).length) await editarDoc(DT, d.name, cambios);
      if (v.nota) await comentar(d.name, v.source || "Registro", v.nota);
      return { name: d.name };
    }
    if (accion_ === "reglas") {
      const campos = ["verde_hasta", "amarillo_hasta", "dias_proximo_contacto", "dias_vigencia"];
      const nuevo = {};
      campos.forEach((k) => { if (k in v) nuevo[k] = v[k]; });
      if ((nuevo.amarillo_hasta || 0) <= (nuevo.verde_hasta || 0)) falla("El límite amarillo debe ser mayor que el verde");
      await editarDoc("MTI Configuracion", "MTI Configuracion", nuevo);
      // Las automatizaciones del semáforo usan los mismos días (solo si el usuario puede editarlas)
      let flujos = true;
      for (const [titulo, dias] of [["MTI · Semáforo amarillo", nuevo.verde_hasta + 1], ["MTI · Semáforo rojo: sin respuesta", nuevo.amarillo_hasta + 1]]) {
        const ok = await intentar(async () => { const f = await listar("Automation Flow", ["name"], [["title", "=", titulo]]); if (f.length) await editarDoc("Automation Flow", f[0].name, { date_offset: dias }); return true; }, false);
        flujos = flujos && ok;
      }
      return { aviso: flujos ? "" : "Las tareas automáticas del semáforo las ajusta el administrador en Configuración → Automatizaciones" };
    }
    if (accion_ === "catalogo") {
      if (datos.op === "agregar") {
        const nombre = (datos.nombre || "").trim();
        if (!nombre) falla("Escribe el nombre");
        if (datos.tipo === "Equipo") {
          if (await existe("CRM Product", nombre)) await editarDoc("CRM Product", nombre, { disabled: 0, mti_categoria: datos.categoria || "Grúa", mti_capacidad: datos.capacidad || 0 });
          else await crearDoc("CRM Product", { product_code: nombre, product_name: nombre, mti_categoria: datos.categoria || "Grúa", mti_capacidad: datos.capacidad || 0 });
        } else {
          await alCatalogo(datos.tipo, nombre, datos.categoria);
          const ex = await listar("MTI Catalogo", ["name"], [["tipo", "=", datos.tipo], ["nombre", "=", nombre]]);
          if (ex.length) await editarDoc("MTI Catalogo", ex[0].name, { categoria: datos.categoria || "" });
        }
      } else if (datos.op === "quitar") {
        const x = (S.data.catalogo || []).find((c) => c.name === datos.name);
        if (x && x.tipo === "Equipo") await editarDoc("CRM Product", x.name, { disabled: 1 });
        else await editarDoc("MTI Catalogo", datos.name, { activo: 0 });
      }
      return {};
    }
    if (accion_ === "eliminar_cliente") {
      if (!esAdmin()) falla("Solo el administrador del sistema puede eliminar clientes");
      const nombre = String(datos.name || "");
      if (String(datos.confirmar || "").trim().toUpperCase() !== "ELIMINAR") falla("Escribe ELIMINAR para confirmar");
      if (!(await existe("CRM Organization", nombre))) falla("Cliente no encontrado");
      // Frappe no deja borrar un cliente que tenga ofertas enlazadas: se revisa antes para dar un mensaje claro
      const ofertas = await listar(DT, ["name"], [["organization", "=", nombre]], null, 1);
      if (ofertas.length) falla("El cliente tiene ofertas registradas: elimina primero sus ofertas o déjalo como está");
      if (datos.contactos) {
        const cts = await intentar(() => listar("Contact", ["name"], [["company_name", "=", nombre]]), []);
        for (const c of cts) await intentar(() => http.send("DELETE", `/api/resource/Contact/${enc(c.name)}`));
      }
      await http.send("DELETE", `/api/resource/${enc("CRM Organization")}/${enc(nombre)}`);
      return { eliminado: true };
    }
    if (accion_ === "cliente") {
      if (!(await existe("CRM Organization", datos.name))) falla("Cliente no encontrado");
      await asegurarCliente(datos.name, v);
      return {};
    }
    if (accion_ === "cliente_nuevo") {
      const nombre = (datos.nombre || "").trim();
      if (!nombre) falla("Escribe el nombre del cliente");
      if (await existe("CRM Organization", nombre)) falla("Ya existe un cliente con ese nombre");
      await asegurarCliente(nombre, v);
      await asegurarContacto(nombre, v);
      return { name: nombre };
    }

    const name = datos.name;
    if (accion_ === "guardar") {
      const r = await conOferta(name, async (doc, set, aplicar) => {
        if (fijada(doc)) {
          // Cotización aprobada: solo se pueden cambiar los datos para Logística
          // (los demás campos se ignoran: no se guardan aunque vengan en la petición)
          if ("lineas" in datos || "trabajos" in datos || "seleccion" in datos) falla("La cotización ya fue aprobada y quedó fijada: no se pueden cambiar equipos, valores ni condiciones. Lo que cambie en el servicio se registra como adicional.");
          Object.keys(v).forEach((k) => { if (!NO_FIJOS.includes(k)) delete v[k]; });
        }
        if (v.organization) await asegurarCliente(v.organization);
        aplicar(v);
        if ("lineas" in datos) { for (const l of datos.lineas || []) await asegurarEquipo(l.equipo); ponerLineas(doc, set, datos.lineas || []); }
        if ("trabajos" in datos) ponerTrabajos(doc, set, datos.trabajos || []);
        if ("seleccion" in datos && !("lineas" in datos)) {
          // Comercial elige, de todo lo cotizado, qué servicios van en la oferta final (sin crear versión)
          const sel = {};
          (datos.seleccion || []).forEach((x) => (sel[x.name] = x.incluir ? 1 : 0));
          set("products", (doc.products || []).map((p) => ({ ...p, mti_incluir: p.name in sel ? sel[p.name] : (p.mti_incluir === 0 ? 0 : 1) })));
        }
        if (v.mti_servicio) await alCatalogo("Servicio", v.mti_servicio);
      });
      if ("seleccion" in datos && ABIERTAS.includes(r.doc.status)) {
        const filas = r.doc.products || [], n = filas.filter((x) => x.mti_incluir !== 0).length;
        await comentar(name, "Interno", `Servicios de la oferta: ${n} de ${filas.length} seleccionados · total ${money0(r.doc.deal_value)}`);
      }
      if (datos.cliente && r.doc.organization) await asegurarCliente(r.doc.organization, datos.cliente);
      return { name };
    }
    if (accion_ === "estado") {
      const nuevo = datos.estado;
      if (!["Solicitud recibida", "Visita técnica", "Análisis de Proyectos", "Cotización preparada", "Seguimiento", "Aprobada", "Perdida"].includes(nuevo))
        falla("Ese cambio de etapa se hace con su botón (Enviar, Logística o Programación)");
      await conOferta(name, (doc, set, aplicar) => {
        if (fijada(doc)) falla("La cotización ya fue aprobada y quedó fijada: no puede volver a etapas anteriores. Si el cliente desiste, usa «Cancelar servicio».");
        if (nuevo === "Perdida") { set("lost_reason", datos.motivo || "Other"); set("lost_notes", datos.nota || (datos.motivo ? "" : "Sin detalle")); }
        aplicar(v);
        set("status", nuevo);
      });
      if (datos.nota && nuevo !== "Perdida") await comentar(name, "Interno", datos.nota);
      return { name };
    }
    if (accion_ === "espera") {
      const motivo = String(datos.motivo || "").trim();
      if (!motivo) falla("Escribe por qué la oferta queda en espera");
      await conOferta(name, (doc, set) => {
        if (!puedeEspera(doc)) falla("Esta oferta no se puede poner en espera desde tu perfil");
        set("mti_estado_previo", doc.status); set("mti_motivo_espera", motivo); set("mti_fecha_espera", H);
        set("mti_retomar_el", datos.retomar || null); set("status", "En espera");
      });
      await comentar(name, "En espera", motivo + (datos.retomar ? ` · retomar el ${dmy(datos.retomar)}` : ""));
      return { name };
    }
    if (accion_ === "reanudar") {
      let destino = "";
      await conOferta(name, (doc, set) => {
        if (doc.status !== "En espera") falla("La oferta no está en espera");
        destino = PIPE.includes(doc.mti_estado_previo) && !CON_MOTIVO.includes(doc.mti_estado_previo) ? doc.mti_estado_previo : "Solicitud recibida";
        set("status", destino); set("mti_retomar_el", null);
      });
      await comentar(name, "Reanudada", `Vuelve a ${destino}${datos.nota ? ": " + datos.nota : ""}`);
      return { name, aviso: `Oferta reanudada en ${destino}` };
    }
    if (accion_ === "motivo") {
      await conOferta(name, (doc, set) => {
        if (doc.status === "En espera") { set("mti_motivo_espera", String(datos.motivo || "").trim()); if ("retomar" in datos) set("mti_retomar_el", datos.retomar || null); }
        else if (doc.status === "Perdida") { if (datos.razon) set("lost_reason", datos.razon); set("lost_notes", String(datos.motivo || "").trim()); }
        else if (doc.status === "Cancelada") set("lost_notes", String(datos.motivo || "").trim());
        else falla("Solo las ofertas en espera, perdidas o canceladas tienen motivo");
      });
      return { name };
    }
    if (accion_ === "oferta_texto") {
      const html = datos.html ? limpiarHTML(String(datos.html)) : "";
      if (html.length > 250000) falla("El documento es demasiado largo para guardarlo");
      await editarDoc(DT, name, html
        ? { mti_oferta_html: html, mti_oferta_base: datos.base || "", mti_oferta_editada: ahoraTxt(), mti_oferta_editor: S.data.usuario }
        : { mti_oferta_html: null, mti_oferta_base: null, mti_oferta_editada: null, mti_oferta_editor: null });
      return { name };
    }
    if (accion_ === "eliminar") {
      if (!esAdmin()) falla("Solo el administrador del sistema puede eliminar ofertas");
      const doc = await leerDoc(DT, name);
      if (String(datos.confirmar || "").trim() !== codigo(doc)) falla(`Escribe ${codigo(doc)} para confirmar`);
      // primero lo que está enlazado a la oferta (notificaciones, tareas, notas, llamadas); comentarios y adjuntos los borra Frappe
      const borrar = (dt, n) => http.send("DELETE", `/api/resource/${enc(dt)}/${enc(n)}`);
      const enlazados = {};
      for (const dt of ["CRM Task", "FCRM Note", "CRM Call Log"])
        enlazados[dt] = await intentar(() => listar(dt, ["name"], [["reference_doctype", "=", DT], ["reference_docname", "=", name]]), []);
      // registros de las Automatizaciones de Frappe que corrieron sobre la oferta
      const corridas = await intentar(() => listar("Automation Run", ["name"], [["reference_doctype", "=", DT], ["reference_name", "=", name]]), []);
      const avisos = [
        ...(await intentar(() => listar("CRM Notification", ["name"], [["reference_doctype", "=", DT], ["reference_name", "=", name]]), [])),
        ...(enlazados["CRM Task"].length ? await intentar(() => listar("CRM Notification", ["name"], [["notification_type_doctype", "=", "CRM Task"], ["notification_type_doc", "in", enlazados["CRM Task"].map((t) => t.name)]]), []) : []),
      ];
      for (const n of [...new Set(avisos.map((x) => x.name))]) await borrar("CRM Notification", n);
      for (const r of corridas) await borrar("Automation Run", r.name);
      for (const dt of Object.keys(enlazados)) for (const r of enlazados[dt]) await borrar(dt, r.name);
      await http.send("DELETE", `/api/resource/${enc(DT)}/${enc(name)}`);
      return { name, eliminada: true };
    }
    if (accion_ === "adicionales") {
      await conOferta(name, (doc, set) => {
        if (!["Programada", "En ejecución", "Ejecutada"].includes(doc.status)) falla("Los adicionales se registran cuando el servicio está programado, en ejecución o ejecutado");
        set("mti_adicionales", (datos.filas || []).filter((r) => String(r.linea || "").trim() && (+r.valor || 0) !== 0).map((r) => ({
          linea: String(r.linea).trim(), tipo: r.tipo || "Cobro adicional", cantidad: +r.cantidad || 0,
          valor_unitario: Math.round(+r.valor_unitario || 0), valor: Math.round(+r.valor || 0), descripcion: String(r.descripcion || "").trim() })));
      });
      return { name };
    }
    if (accion_ === "calificacion") {
      await conOferta(name, (doc, set) => {
        if (!["En ejecución", "Ejecutada"].includes(doc.status)) falla("La calificación del cliente se registra al terminar el servicio");
        CALIF.forEach(([k]) => { if (k in (datos.valores || {})) set(k, datos.valores[k] || ""); });
        ["mti_reporte_diario", "mti_recibido_por", "mti_obs_cliente"].forEach((k) => { if (k in (datos.valores || {})) set(k, datos.valores[k] || ""); });
        if (datos.reporte_foto) set("mti_reporte_foto", datos.reporte_foto);
      });
      return { name };
    }
    if (accion_ === "diagrama") {
      await conOferta(name, (doc, set) => {
        if (fijada(doc)) falla("La cotización ya fue aprobada y quedó fijada");
        set("mti_diagrama", datos.url || "");
      });
      return { name };
    }
    if (accion_ === "desglose") {
      await conOferta(name, (doc, set) => {
        if (!["En ejecución", "Ejecutada"].includes(doc.status)) falla("El desglose se registra cuando el servicio está en ejecución o ejecutado");
        set("mti_desglose", (datos.filas || []).filter((r) => String(r.concepto || "").trim())
          .map((r) => ({ concepto: String(r.concepto).trim(), valor: Math.round(+r.valor || 0), nota: String(r.nota || "").trim() })));
      });
      return { name };
    }
    if (accion_ === "enviar") {
      const r = await conOferta(name, (doc, set) => {
        if (!(doc.products || []).length && !doc.deal_value) falla("Agrega al menos una línea con equipo y valor antes de enviar la oferta");
        const reenvio = doc.status === "En modificación" || (doc.mti_version || 0) > 0;
        set("mti_aprobo_envio", S.data.usuario); set("mti_fecha_envio", H);
        set("mti_proximo_contacto", masDias(H, cfg.dias_proximo_contacto || 3)); set("mti_vigencia", masDias(H, cfg.dias_vigencia || 15));
        set("status", "Cotización enviada");
        return { reenvio };
      });
      await comentar(name, "Envío", r.reenvio ? `Versión ${r.doc.mti_codigo} enviada al cliente` : "Oferta enviada al cliente");
      return { name };
    }
    if (accion_ === "modificar") {
      const tipo = datos.tipo || "Comercial", motivo = (datos.motivo || "").trim();
      if (!motivo) falla("Escribe qué pidió el cliente");
      await conOferta(name, (doc, set) => {
        if (!ABIERTAS.includes(doc.status)) falla("Solo se puede renegociar una oferta enviada");
        let versiones = [];
        try { versiones = JSON.parse(doc.mti_versiones || "[]"); } catch (e) { versiones = []; }
        versiones.push({ ...fotoVersion(doc), tipo, motivo });
        set("mti_versiones", JSON.stringify(versiones));
        set("mti_version", (doc.mti_version || 0) + 1);
        set("mti_tipo_ajuste", tipo); set("mti_motivo_ajuste", motivo);
        set("mti_fecha_envio", null); set("mti_proximo_contacto", null);
        set("status", "En modificación");
      });
      await comentar(name, "Ajuste", `${tipo}: ${motivo}`);
      return { name };
    }
    if (accion_ === "ajuste_listo") {
      await conOferta(name, (doc, set) => { if (doc.status !== "En modificación") falla("La oferta no está en modificación"); set("status", "Cotización preparada"); });
      await comentar(name, "Proyectos", "Ajuste técnico terminado" + (datos.nota ? ": " + datos.nota : ""));
      return { name };
    }
    if (accion_ === "seguimiento") {
      await comentar(name, datos.canal || "Llamada", datos.nota || "Contacto realizado");
      await conOferta(name, (doc, set) => {
        set("mti_ultimo_contacto", H);
        set("mti_proximo_contacto", masDias(H, parseInt(datos.dias || 3, 10)));
        if (doc.status === "Cotización enviada") set("status", "Seguimiento");
      });
      await cerrarTareas(name, null, ["Seguimiento", "Sin respuesta"]);
      return { name };
    }
    if (accion_ === "posponer") {
      await conOferta(name, (doc, set) => {
        if (datos.que === "visita") { const f = parseD(doc.mti_fecha_visita); if (f) set("mti_fecha_visita", `${ymd(addDays(f, 1))} ${p2(f.getHours())}:${p2(f.getMinutes())}:00`); }
        else set("mti_proximo_contacto", masDias(H, 1));
      });
      return { name };
    }
    if (accion_ === "agendar") {
      if (v.mti_tecnico) await alCatalogo("Personal", v.mti_tecnico, "Técnico de visitas");
      await conOferta(name, (doc, set, aplicar) => {
        aplicar(v);
        set("mti_requiere_visita", 1);
        if (["", null, undefined, "Por agendar", "No requerida"].includes(doc.mti_estado_visita)) set("mti_estado_visita", "Programada");
        if (doc.status === "Solicitud recibida") set("status", "Visita técnica");
      });
      return { name };
    }
    if (accion_ === "checklist") {
      if (v.mti_tecnico) await alCatalogo("Personal", v.mti_tecnico, "Técnico de visitas");
      await conOferta(name, (doc, set, aplicar) => {
        aplicar(v);
        const t1 = datos.trabajo1;
        if (t1) {
          const trs = (doc.mti_trabajos || []).map((t) => ({ ...t }));
          if (!trs.length) trs.push({ descripcion: doc.mti_servicio || "Trabajo principal" });
          ["altura", "radio", "peso"].forEach((k) => { if (k in t1) trs[0][k] = +t1[k] || 0; });
          ponerTrabajos(doc, set, trs);
        }
        const completo = ["ubicacion", "altura", "radio", "peso", "restricciones", "fotos"].every((k) => doc["mti_chk_" + k]);
        if (datos.enviar) {
          if (!completo) falla("Faltan datos del checklist: la visita no se puede enviar incompleta a Proyectos");
          set("mti_estado_visita", "Realizada");
          set("status", "Análisis de Proyectos");
        } else if (!completo && doc.mti_fecha_visita && parseD(doc.mti_fecha_visita) <= new Date()) set("mti_estado_visita", "Pendiente de información");
      });
      return { name };
    }
    if (accion_ === "sin_visita") {
      await conOferta(name, (doc, set) => { set("mti_requiere_visita", 0); set("mti_estado_visita", "No requerida"); set("status", "Análisis de Proyectos"); });
      return { name };
    }
    if (accion_ === "enviar_logistica") {
      await conOferta(name, (doc, set, aplicar) => {
        if (doc.status !== "Aprobada") falla("Solo se envían a Logística las ofertas aprobadas");
        aplicar(v);
        if (!doc.mti_fecha_solicitada) falla("Indica la fecha que solicitó el cliente");
        if (!doc.mti_ubicacion) falla("Indica la dirección del servicio");
        set("status", "Enviada a Logística");
      });
      return { name };
    }
    if (accion_ === "programar") {
      for (const p of datos.lineas || []) { if (p.equipo) await asegurarEquipo(p.equipo); if (p.prog_operador) await alCatalogo("Personal", p.prog_operador, "Operador"); }
      const r = await conOferta(name, (doc, set) => {
        if (!LOGISTICA.includes(doc.status)) falla("Esta oferta no está pendiente de programación");
        const era = doc.status;
        let reprogramada = false, primera = null;
        const filas = (doc.products || []).map((x) => ({ ...x }));
        (datos.lineas || []).forEach((p) => {
          const i = (parseInt(p.idx, 10) || 0) - 1;
          if (i < 0 || i >= filas.length) return;
          const fila = filas[i];
          if (era !== "Enviada a Logística" && String(fila.mti_prog_desde || "") !== String(p.prog_desde || "")) reprogramada = true;
          CAMPOS_PROG.forEach((k) => { if (k in p) fila["mti_" + k] = p[k] || null; });
          if (p.equipo) { fila.product_code = p.equipo; fila.product_name = p.equipo; }
          if (fila.mti_prog_desde && (!primera || String(fila.mti_prog_desde) < String(primera))) primera = fila.mti_prog_desde;
        });
        if (!primera) falla("Indica al menos la fecha de inicio de un equipo");
        set("products", filas);
        if (reprogramada) set("mti_reprogramaciones", (doc.mti_reprogramaciones || 0) + 1);
        if (era === "Enviada a Logística") set("status", "Programada");
        return { era, reprogramada, primera };
      });
      const nota = datos.nota ? " · " + datos.nota : "";
      const fecha = dmy(r.primera);
      await comentar(name, "Logística", r.reprogramada ? `Reprogramado: inicia ${fecha}${nota}` : r.era === "Enviada a Logística" ? `Programado: inicia ${fecha}${nota}` : `Programación actualizada${nota}`);
      const cambio = r.reprogramada || (r.doc.mti_fecha_solicitada && String(r.primera) !== String(r.doc.mti_fecha_solicitada));
      if (cambio && r.doc.deal_owner) {
        const titulo = "Fecha del servicio cambió · " + (r.doc.mti_codigo || name);
        const ya = await intentar(() => listar("CRM Task", ["name"], [["title", "=", titulo], ["status", "not in", ["Done", "Canceled"]]]), []);
        if (!ya.length) await intentar(() => crearDoc("CRM Task", { title: titulo, assigned_to: r.doc.deal_owner, status: "Todo", priority: "Medium",
          due_date: ahoraTxt(), reference_doctype: DT, reference_docname: name,
          description: `<p>Logística programó el servicio de ${esc(r.doc.organization || "")} para el ${fecha} (el cliente pidió ${dmy(r.doc.mti_fecha_solicitada)}). Confirmar con el cliente.</p>` }));
      }
      return { name, aviso_comercial: !!cambio };
    }
    if (accion_ === "iniciar") {
      await conOferta(name, (doc, set) => { if (doc.status !== "Programada") falla("Solo se inician servicios programados"); set("status", "En ejecución"); });
      await comentar(name, "Logística", "Inicia el servicio" + (datos.nota ? ": " + datos.nota : ""));
      return { name };
    }
    if (accion_ === "ejecutar") {
      await conOferta(name, (doc, set) => {
        if (!["Programada", "En ejecución"].includes(doc.status)) falla("Solo se marcan como ejecutados los servicios programados o en ejecución");
        set("mti_fecha_ejecucion", datos.fecha || H); set("status", "Ejecutada");
        const vv = datos.valores || {};
        [...CALIF.map((x) => x[0]), "mti_reporte_diario", "mti_recibido_por", "mti_obs_cliente"].forEach((k) => { if (k in vv) set(k, vv[k] || ""); });
        if (datos.reporte_foto) set("mti_reporte_foto", datos.reporte_foto);
      });
      await comentar(name, "Logística", "Servicio ejecutado" + (datos.nota ? ": " + datos.nota : ""));
      return { name };
    }
    if (accion_ === "cancelar") {
      const motivo = (datos.motivo || "").trim();
      if (!motivo) falla("Escribe el motivo de la cancelación");
      await conOferta(name, (doc, set) => {
        if (!["Aprobada", "Enviada a Logística", "Programada"].includes(doc.status)) falla("Solo se cancelan servicios aprobados que aún no se ejecutan");
        set("lost_reason", "Servicio cancelado por el cliente"); set("lost_notes", motivo); set("status", "Cancelada");
      });
      return { name };
    }
    falla("Acción no reconocida");
  }

  // Acceso para soporte y pruebas: las mismas acciones de la interfaz (Frappe aplica los permisos)
  window.mtiApp = { ejecutar, cargarDatos, cargarOferta, recargar: () => cargar(true) };
  const api = {
    get: (m, p) => (m === "mti_datos" ? cargarDatos() : cargarOferta(p.name)),
    post: (m, data) => ejecutar(data),
  };
  // Acciones que solo tocan una oferta: después se refresca únicamente esa oferta
  const PARCIAL = ["guardar", "estado", "espera", "reanudar", "motivo", "enviar", "modificar", "ajuste_listo", "seguimiento", "posponer",
    "agendar", "checklist", "sin_visita", "enviar_logistica", "programar", "iniciar", "ejecutar", "cancelar", "desglose", "adicionales",
    "calificacion", "diagrama", "oferta_texto"];
  async function accion(data, ok) {
    try {
      const r = await api.post("mti_accion", data);
      if (r && r.aviso) toast(r.aviso); else if (ok) toast(ok);
      if (r && r.name && PARCIAL.includes(data.accion)) await refrescar(r.name, data.accion === "guardar");
      else await cargar(true);
      return r;
    } catch (e) { toast(e.message, true); throw e; }
  }
  async function refrescar(name, conClientes) {
    try {
      await refrescarOferta(name, conClientes);
      // lo que cambió esta persona no se le anuncia como cambio de otro
      const d = S.data.cotizaciones.find((x) => x.name === name);
      if (S.vigia && d && d.modified) S.vigia.propias[name] = String(d.modified);
    } catch (e) { S.data = await api.get("mti_datos"); if (S.vigia) marcasVigia(); }
    const h = location.hash || "";
    if (S.ficha && S.ficha.name === name && (h.startsWith("#/cotizacion/") || h.startsWith("#/imprimir/"))) setFicha(await api.get("mti_cotizacion", { name }));
    render();
  }
  async function cargar(refrescarFicha) {
    S.data = await api.get("mti_datos");
    if (S.vigia) marcasVigia();
    const h = location.hash || "";
    if (S.ficha && refrescarFicha && (h.startsWith("#/cotizacion/") || h.startsWith("#/imprimir/"))) setFicha(await api.get("mti_cotizacion", { name: S.ficha.name }));
    render();
  }

  function toast(msg, err) {
    document.querySelectorAll(".mti-toast").forEach((t) => t.remove());
    const t = document.createElement("div");
    t.className = "mti-toast" + (err ? " err" : "");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), err ? 5200 : 2600);
  }

  function modal(titulo, cuerpo, botones, ancho) {
    const bg = document.createElement("div");
    bg.className = "mti-modal-bg";
    bg.innerHTML = `<div class="mti-modal ${ancho || ""}" id="mti-app-modal"><h3>${esc(titulo)}</h3><div class="body">${cuerpo}</div><div class="ft"></div></div>`;
    const ft = bg.querySelector(".ft");
    const cerrar = () => bg.remove();
    (botones || []).forEach((b) => {
      const el = document.createElement("button");
      el.className = "mti-btn " + (b.cls || "");
      el.textContent = b.t;
      el.onclick = async () => {
        if (!b.fn) return cerrar();
        el.disabled = true;
        try { const r = await b.fn(bg); if (r !== false) cerrar(); else el.disabled = false; } catch (e) { el.disabled = false; }
      };
      ft.appendChild(el);
    });
    bg.addEventListener("mousedown", (e) => { if (e.target === bg) cerrar(); });
    root().appendChild(bg);
    const primero = bg.querySelector("input:not([type=checkbox]):not([type=radio]),select,textarea");
    if (primero) primero.focus();
    return bg;
  }
  const val = (el, sel) => { const x = el.querySelector(sel); return x ? (x.type === "checkbox" ? (x.checked ? 1 : 0) : x.value.trim()) : ""; };
  const opts = (arr, sel, vacio) => (vacio !== undefined ? `<option value="">${esc(vacio)}</option>` : "") +
    arr.map((o) => { const v = typeof o === "string" ? o : o.v; const t = typeof o === "string" ? o : o.t; return `<option value="${esc(v)}" ${String(v) === String(sel) ? "selected" : ""}>${esc(t)}</option>`; }).join("");
  function formatearDinero(el) {
    const n = parseMoney(el.value);
    el.value = n ? n.toLocaleString("es-CO") : "";
  }

  // ------------------------------------------------------------------ alertas (menú y pantalla)
  const claveHecho = () => "mti-alertas-" + S.data.hoy;
  function hechos() { try { return JSON.parse(localStorage.getItem(claveHecho()) || "[]"); } catch (e) { return []; } }
  function marcarHecho(id) { try { const h = hechos(); h.push(id); localStorage.setItem(claveHecho(), JSON.stringify(h)); } catch (e) { /* sin almacenamiento */ } }

  // Áreas cuyas alertas ve el usuario: las de sus perfiles; Gerencia las ve todas (solo consulta)
  const AREAS = [
    ["comercial", "Comercial", "Que ninguna cotización se quede sin enviar, sin seguimiento o sin pasar a Logística"],
    ["proyectos", "Análisis de Proyectos", "Que ninguna solicitud se quede sin solución técnica ni sin devolver a Comercial"],
    ["logistica", "Logística", "Que ningún servicio aprobado se quede sin programar, iniciar, cerrar ni sin desglose del precio"],
  ];
  const areasVisibles = () => (verTodo() ? AREAS.map((x) => x[0]) : AREAS.map((x) => x[0]).filter(es));
  function construirAlertas(soloMias) {
    const d = S.data, H = hoy(), out = [], yo = d.usuario;
    const manana = addDays(H, 1);
    const areas = soloMias ? AREAS.map((x) => x[0]).filter(es) : areasVisibles();
    const C = areas.includes("comercial"), P = areas.includes("proyectos"), L = areas.includes("logistica");
    const nDias = (n) => `${n} día${n === 1 ? "" : "s"}`;
    const add = (area, x) => out.push({ area, ...x, id: area + "-" + x.id });
    d.cotizaciones.forEach((c) => {
      const cls = semClase(c.semaforo), cod = codigo(c), de = c.dias_etapa || 0;
      if (C) {
        // seguimiento de ofertas enviadas
        if (ABIERTAS.includes(c.status) && cls === "rojo") add("comercial", { id: "rojo-" + c.name, sev: 0, color: "rojo", c, tipo: "seg", t: `${cod} lleva ${c.dias} días sin respuesta`, s: `${c.organization || ""} · último contacto ${dm(c.mti_ultimo_contacto || c.mti_fecha_envio)}` });
        else if (ABIERTAS.includes(c.status) && c.mti_proximo_contacto && diffDays(parseD(c.mti_proximo_contacto), H) <= 0) add("comercial", { id: "hoy-" + c.name, sev: 1, color: "amarillo", c, tipo: "seg", t: `Contactar hoy: ${c.organization} (${cod})`, s: `Enviada hace ${nDias(c.dias)} · ${c.mti_servicio || ""}` });
        if (ABIERTAS.includes(c.status) && c.mti_vigencia && diffDays(parseD(c.mti_vigencia), H) < 0) add("comercial", { id: "vig-" + c.name, sev: 2, color: "amarillo", c, tipo: "abrir", t: `Vigencia vencida: ${cod} · ${c.organization}`, s: `Venció el ${dm(c.mti_vigencia)}; confirmar si el cliente sigue interesado` });
        // solicitudes y visitas
        if (c.status === "Solicitud recibida" && c.mti_requiere_visita && !c.mti_fecha_visita && de >= LIMITES.solicitud) add("comercial", { id: "sol-" + c.name, sev: de > LIMITES.solicitud ? 0 : 1, color: de > LIMITES.solicitud ? "rojo" : "amarillo", c, tipo: "visita", t: `Agendar visita: ${c.organization} (${cod})`, s: `Solicitud recibida hace ${nDias(de)} y aún sin visita técnica` });
        const fv = parseD(c.mti_fecha_visita);
        if (fv && c.mti_estado_visita !== "Realizada" && c.mti_requiere_visita && !CON_MOTIVO.includes(c.status)) {
          const ck = checklist(c);
          if (diffDays(fv, manana) === 0) add("comercial", { id: "vis-" + c.name, sev: 2, color: "amarillo", c, tipo: "visita", t: `Visita mañana ${hm(c.mti_fecha_visita)} · ${c.organization}`, s: `${c.mti_tecnico ? "Técnico: " + c.mti_tecnico : "Sin técnico asignado"} · confirmar con el cliente` });
          if (estadoVisita(c) === "pendiente") add("comercial", { id: "ck-" + c.name, sev: 1, color: "amarillo", c, tipo: "checklist", t: `Visita ${c.organization}: falta ${ck.faltan.map((x) => x.split(" ")[0].toLowerCase()).join(", ")}`, s: "Completar el checklist para enviarla a Proyectos" });
        }
        // cotizaciones listas que no se han enviado
        if (c.status === "Cotización preparada") add("comercial", { id: "prep-" + c.name, sev: de > LIMITES.preparada ? 0 : 2, color: de > LIMITES.preparada ? "rojo" : "verde", c, tipo: "abrir", t: `${cod} lista para enviar al cliente${de ? " · hace " + nDias(de) : ""}`, s: `${c.organization} · ${money(c.deal_value) || "sin valor"} · Proyectos ya terminó el análisis` });
        if (c.status === "En modificación" && c.mti_tipo_ajuste !== "Técnico") add("comercial", { id: "ajc-" + c.name, sev: 1, color: "amarillo", c, tipo: "abrir", t: `Ajustar y reenviar ${cod}`, s: `${c.organization} · ${c.mti_motivo_ajuste || ""}` });
        if (c.status === "Aprobada") add("comercial", { id: "apr-" + c.name, sev: de > LIMITES.aprobada ? 0 : 2, color: de > LIMITES.aprobada ? "rojo" : "verde", c, tipo: "abrir", t: `${cod} aprobada: enviar a Logística${de ? " · hace " + nDias(de) : ""}`, s: `${c.organization} · ${money(c.deal_value)}` });
        // en espera
        if (c.status === "En espera") {
          const ret = parseD(c.mti_retomar_el), dE = Math.max(0, diffDays(H, parseD(c.mti_fecha_espera)) || 0);
          if (ret && diffDays(ret, H) <= 0) add("comercial", { id: "esp-" + c.name, sev: 1, color: "amarillo", c, tipo: "abrir", t: `Retomar oferta en espera: ${cod} · ${c.organization}`, s: `Se acordó retomarla el ${dm(c.mti_retomar_el)} · ${c.mti_motivo_espera || ""}` });
          else if (!ret && dE > LIMITES.espera) add("comercial", { id: "espv-" + c.name, sev: 3, color: "amarillo", c, tipo: "abrir", t: `${cod} lleva ${dE} días en espera`, s: `${c.organization} · ${c.mti_motivo_espera || ""} · ¿reanudar o marcar perdida?` });
        }
      }
      if (P) {
        if (c.status === "Análisis de Proyectos") {
          const listo = (c.lineas || []).length && (c.deal_value || 0) > 0;
          if (listo) add("proyectos", { id: "dev-" + c.name, sev: de > LIMITES.proyectos ? 0 : 1, color: de > LIMITES.proyectos ? "rojo" : "verde", c, tipo: "abrir", t: `Devolver ${cod} a Comercial: ya tiene equipos y valores`, s: `${c.organization} · ${money(c.deal_value)} · marcar "Análisis terminado" para que Comercial la envíe` });
          else add("proyectos", { id: "ana-" + c.name, sev: de > LIMITES.proyectos ? 0 : 2, color: de > LIMITES.proyectos ? "rojo" : "amarillo", c, tipo: "abrir", t: `Definir solución técnica de ${cod}${de ? " · hace " + nDias(de) : ""}`, s: `${c.organization} · ${c.mti_servicio || ""} · faltan equipos y valores` });
        }
        if (c.status === "En modificación" && c.mti_tipo_ajuste === "Técnico") add("proyectos", { id: "ajt-" + c.name, sev: 0, color: "rojo", c, tipo: "abrir", t: `Ajuste técnico pedido por el cliente · ${cod}${de ? " · hace " + nDias(de) : ""}`, s: `${c.organization} · ${c.mti_motivo_ajuste || ""}` });
      }
      if (L) {
        const fechas = (c.lineas || []).map((l) => parseD(l.prog_desde)).filter(Boolean).sort((a, b) => a - b);
        const ini = fechas[0], fin = (c.lineas || []).map((l) => parseD(l.prog_hasta || l.prog_desde)).filter(Boolean).sort((a, b) => b - a)[0];
        if (c.status === "Enviada a Logística") {
          const sol = parseD(c.mti_fecha_solicitada), urge = sol && diffDays(sol, H) <= 2;
          add("logistica", { id: "log-" + c.name, sev: urge || de > LIMITES.porprog ? 0 : 1, color: urge || de > LIMITES.porprog ? "rojo" : "amarillo", c, tipo: "programar", t: `Programar servicio de ${cod} · ${c.organization}${de ? " · espera hace " + nDias(de) : ""}`, s: `${urge ? "⚠ " : ""}Solicitado para ${dm(c.mti_fecha_solicitada)} ${c.mti_hora_solicitada || ""} · ${(c.lineas || []).map((l) => l.equipo || l.descripcion).filter(Boolean).join(", ")}` });
        }
        if (c.status === "Programada" && ini) {
          const dI = diffDays(ini, H);
          if (dI < 0) add("logistica", { id: "atr-" + c.name, sev: 0, color: "rojo", c, tipo: "programar", t: `${cod} debía iniciar el ${dm(ini)}: iniciar o reprogramar`, s: `${c.organization} · sigue en Programada` });
          else if (dI === 0) add("logistica", { id: "shoy-" + c.name, sev: 0, color: "rojo", c, tipo: "programar", t: `Servicio hoy: ${c.organization} (${cod})`, s: "Marcar inicio de ejecución cuando el equipo llegue" });
          else if (dI === 1) add("logistica", { id: "sman-" + c.name, sev: 2, color: "amarillo", c, tipo: "programar", t: `Servicio mañana: ${c.organization} (${cod})`, s: "Confirmar operador, movilización y permisos" });
        }
        // desglose del precio de trabajos recién ejecutados (lo registra Logística al cerrar el servicio)
        if (c.status === "Ejecutada" && !(c.desglose || []).length && c.mti_fecha_ejecucion && diffDays(H, parseD(c.mti_fecha_ejecucion)) <= LIMITES.desglose)
          add("logistica", { id: "dg-" + c.name, sev: 3, color: "verde", c, tipo: "abrir", t: `Registrar el desglose del precio de ${cod}`, s: `${c.organization} · ejecutada el ${dm(c.mti_fecha_ejecucion)} · ${money(c.valor_final || c.deal_value)}` });
        if (c.status === "En ejecución" && fin && diffDays(fin, H) < 0) add("logistica", { id: "fin-" + c.name, sev: 1, color: "amarillo", c, tipo: "programar", t: `Cerrar ${cod}: el servicio terminó el ${dm(fin)}`, s: `${c.organization} · marcar como ejecutado para que cuente en Históricos` });
      }
    });
    if (C) {
      (d.tareas || []).filter((t) => (soloLectura() || t.assigned_to === yo) && /^Fecha del servicio cambió/.test(t.title || "")).forEach((t) => {
        const c = d.cotizaciones.find((x) => x.name === t.reference_docname);
        if (c) add("comercial", { id: "fch-" + t.name, sev: 1, color: "amarillo", c, tipo: "abrir", t: `Logística cambió la fecha de ${codigo(c)} · ${c.organization}`, s: String(t.description || "").replace(/<[^>]+>/g, " ").trim() });
      });
    }
    const h = hechos();
    return out.filter((a) => !h.includes(a.id)).sort((a, b) => a.sev - b.sev || (b.c.dias_etapa || 0) - (a.c.dias_etapa || 0));
  }

  // ------------------------------------------------------------------ marco general
  const TODOS = ["comercial", "proyectos", "logistica", "gerencia"];
  const TABS = [
    ["tablero", "Tablero", TODOS],
    ["pipeline", "Pipeline", ["comercial", "proyectos", "gerencia"]],
    ["visitas", "Visitas", ["comercial", "proyectos", "gerencia"]],
    ["programacion", "Programación", ["logistica", "proyectos", "gerencia"]],
    ["historicos", "Históricos", ["proyectos", "gerencia"]],
    ["buscar", "Buscar trabajos", TODOS],
    ["alertas", "Alertas", TODOS],
    ["clientes", "Clientes", ["comercial", "proyectos", "gerencia"]],
    ["catalogos", "Catálogos", ["comercial", "proyectos", "logistica", "gerencia"]],
  ];
  const tabsVisibles = () => TABS.filter((t) => t[2].some(es));
  function inicio() {
    if (soloLectura()) return "historicos";
    if (soloLogistica()) return "programacion";
    return "tablero";
  }
  function perfilTxt() {
    const n = { comercial: "Comercial", proyectos: "Proyectos", logistica: "Logística", gerencia: "Gerencia · solo lectura" };
    return (S.data.perfiles || []).map((p) => n[p]).join(" + ") || "Sin perfil MTI";
  }

  function shell(activo, contenido) {
    const mias = soloLectura() ? [] : construirAlertas(true), n = mias.length;
    S.alVistas = new Set(mias.map((a) => a.id));
    document.title = (n ? `(${n}) ` : "") + "MTI · Ofertas";
    const tab = (h, t) => `<a href="#/${h}" class="${activo === h ? "on" : ""}">${t}${h === "alertas" && n ? ` <span class="mti-badge">${n}</span>` : ""}</a>`;
    return `
      <header class="mti-top no-print">
        <div class="mti-brand"><span class="mti-logo"><img src="${LOGO}" alt="MTI"></span><span>Grúas <small>· Ofertas</small></span></div>
        <nav class="mti-nav">${tabsVisibles().map((t) => tab(t[0], t[1])).join("")}</nav>
        <div class="mti-top-r">
          <a href="/crm" target="_blank" title="Respaldo: correos, notas e historial completo">CRM ↗</a>
          <span class="who"><b>${esc(S.data.nombre)}</b><small>${esc(perfilTxt())}</small></span><span class="mti-avatar" title="${esc(S.data.nombre)}">${iniciales(S.data.nombre)}</span>
          <button class="mti-salir" data-salir title="Cerrar sesión">Salir ⎋</button>
        </div>
      </header>
      <div class="mti-page ${["pipeline", "programacion"].includes(activo) ? "wide" : ""}">${contenido}</div>`;
  }

  function render() {
    if (!S.data) return;
    const h = location.hash || "#/" + inicio();
    const [, vista, arg] = h.split("/");
    // una pestaña que el perfil no tiene (p. ej. Históricos para Comercial) lleva a su inicio
    const tab = TABS.find((t) => t[0] === vista);
    if (tab && !tab[2].some(es)) { location.hash = "#/" + inicio(); return; }
    let html = "";
    if (vista === "cotizacion" && arg) html = shell("tablero", vFicha());
    else if (vista === "imprimir" && arg) html = shell("tablero", vImprimir());
    else if (vista === "pipeline") html = shell("pipeline", vPipeline());
    else if (vista === "visitas") html = shell("visitas", vVisitas());
    else if (vista === "programacion") html = shell("programacion", vProgramacion());
    else if (vista === "historicos") html = shell("historicos", vHistoricos());
    else if (vista === "buscar") html = shell("buscar", vBuscar());
    else if (vista === "alertas") html = shell("alertas", vAlertas());
    else if (vista === "clientes") html = shell("clientes", vClientes());
    else if (vista === "catalogos") html = shell("catalogos", vCatalogos());
    else html = shell("tablero", vTablero());
    const act = document.activeElement;
    const foco = act && act.id;
    let pos = null;
    try { pos = act && act.selectionStart; } catch (e) { pos = null; }
    root().innerHTML = html;
    if (foco) { const el = document.getElementById(foco); if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) { /* no aplica */ } } }
    enlazar(vista || "");
  }

  async function ir() {
    const [, vista, arg] = (location.hash || "#/" + inicio()).split("/");
    if ((vista === "cotizacion" || vista === "imprimir") && arg) {
      const name = decodeURIComponent(arg);
      if (!S.ficha || S.ficha.name !== name) {
        const pg = root().querySelector(".mti-page");
        if (pg) pg.innerHTML = '<div class="mti-cargando">Cargando oferta…</div>';
        try { setFicha(await api.get("mti_cotizacion", { name })); } catch (e) { toast(e.message, true); location.hash = "#/" + inicio(); return; }
      }
    } else { S.ficha = null; S.edit = null; }
    render();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ TABLERO
  function filtradas() {
    const f = S.filtros, H = hoy(), q = f.q.toLowerCase();
    const L = lunes(H), Fin = addDays(L, 7);
    return S.data.cotizaciones.filter((c) => {
      if (soloLogistica() && !["Aprobada", ...LOGISTICA, "Ejecutada"].includes(c.status)) return false;
      if (q && !`${codigo(c)} ${c.organization} ${c.mti_servicio} ${c.contacto} ${c.mti_equipo}`.toLowerCase().includes(q)) return false;
      if (f.estado && c.status !== f.estado) return false;
      if (f.cliente && c.organization !== f.cliente) return false;
      if (f.servicio && c.mti_servicio !== f.servicio) return false;
      if (f.equipo && !(c.lineas || []).some((l) => l.equipo === f.equipo)) return false;
      if (f.anio && String(anioDe(c)) !== String(f.anio)) return false;
      if (f.mes !== "" && f.mes != null && String(mesDe(c)) !== String(f.mes)) return false;
      if (f.vencidas && semClase(c.semaforo) !== "rojo") return false;
      if (f.cerradas && !f.estado && CERRADAS.includes(c.status)) return false;
      if (f.kpi === "activas" && !ABIERTAS.includes(c.status)) return false;
      if (f.kpi === "hoy" && !(ABIERTAS.includes(c.status) && c.mti_proximo_contacto && diffDays(parseD(c.mti_proximo_contacto), H) <= 0)) return false;
      if (f.kpi === "analisis" && !(c.status === "Análisis de Proyectos" || c.status === "En modificación")) return false;
      if (f.kpi === "visitas") { const v = parseD(c.mti_fecha_visita); if (!v || v < L || v >= Fin) return false; }
      if (f.kpi === "porprog" && c.status !== "Enviada a Logística") return false;
      if (f.kpi === "programadas" && c.status !== "Programada") return false;
      if (f.kpi === "ejecucion" && c.status !== "En ejecución") return false;
      if (f.kpi === "ejecmes") { const e = parseD(c.mti_fecha_ejecucion); if (c.status !== "Ejecutada" || !e || e.getMonth() !== H.getMonth() || e.getFullYear() !== H.getFullYear()) return false; }
      return true;
    }).sort((a, b) => {
      const peso = (c) => ({ rojo: 0, amarillo: 1, verde: 2 }[semClase(c.semaforo)] ?? 3);
      return peso(a) - peso(b) || (b.dias - a.dias) || PIPE.indexOf(a.status) - PIPE.indexOf(b.status) || String(b.name).localeCompare(String(a.name));
    });
  }

  function kpis() {
    const H = hoy(), L = lunes(H), Fin = addDays(L, 7), C = S.data.cotizaciones;
    if (soloLogistica()) {
      return [
        ["porprog", "Por programar", C.filter((c) => c.status === "Enviada a Logística").length, "pink"],
        ["programadas", "Programadas", C.filter((c) => c.status === "Programada").length],
        ["ejecucion", "En ejecución", C.filter((c) => c.status === "En ejecución").length],
        ["ejecmes", "Ejecutadas este mes", C.filter((c) => { const e = parseD(c.mti_fecha_ejecucion); return c.status === "Ejecutada" && e && e.getMonth() === H.getMonth() && e.getFullYear() === H.getFullYear(); }).length],
      ];
    }
    return [
      ["activas", "Enviadas activas", C.filter((c) => ABIERTAS.includes(c.status)).length],
      ["hoy", "Por contactar hoy", C.filter((c) => ABIERTAS.includes(c.status) && c.mti_proximo_contacto && diffDays(parseD(c.mti_proximo_contacto), H) <= 0).length, "pink"],
      ["analisis", "En análisis o ajuste (Proyectos)", C.filter((c) => c.status === "Análisis de Proyectos" || c.status === "En modificación").length],
      ["visitas", "Visitas esta semana", C.filter((c) => { const v = parseD(c.mti_fecha_visita); return v && v >= L && v < Fin; }).length],
    ];
  }

  function aniosDisponibles() {
    const actual = hoy().getFullYear();
    const y0 = Math.min(S.data.primerAnio || actual, ...S.data.cotizaciones.map(anioDe).filter(Boolean));
    const out = [];
    for (let y = actual; y >= y0; y--) out.push(String(y));
    return out;
  }
  const anioDesde = () => parseInt(String(S.data.desde || "").slice(0, 4), 10) || hoy().getFullYear();
  const hayAnteriores = () => (S.data.primerAnio || anioDesde()) < anioDesde();
  const clientesNombres = () => [...new Set([...(S.data.clientes || []).map((c) => c.name), ...S.data.cotizaciones.map((c) => c.organization)])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const equiposNombres = () => [...new Set([...catNombres("Equipo"), ...S.data.cotizaciones.flatMap((c) => (c.lineas || []).map((l) => l.equipo))])].filter(Boolean).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const serviciosNombres = () => [...new Set([...catNombres("Servicio"), ...S.data.cotizaciones.map((c) => c.mti_servicio)])].filter(Boolean).sort((a, b) => a.localeCompare(b));

  function cabeceraLista(activo) {
    const f = S.filtros;
    const card = ([id, t, n, extra]) => `<button class="mti-card mti-kpi ${extra || ""} ${f.kpi === id ? "on" : ""}" data-kpi="${id}"><div class="t">${t}</div><div class="n">${n}</div></button>`;
    const estados = soloLogistica() ? ["Aprobada", ...LOGISTICA, "Ejecutada"] : PIPE;
    return `
      <div class="mti-head">
        <h1 class="mti-h1">${activo === "pipeline" ? "Pipeline de ofertas" : "Tablero de ofertas"}</h1>
        <input class="mti-in mti-search" id="mti-q" placeholder="Buscar oferta, cliente, equipo…" value="${esc(f.q)}">
        ${es("comercial") ? `<button class="mti-btn dark" data-act="nueva">+ Nueva oferta</button>` : ""}
      </div>
      <div class="mti-kpis">${kpis().map(card).join("")}</div>
      <div class="mti-filters">
        <div class="mti-field"><label class="mti-lbl">Estado</label><select class="mti-sel" id="mti-f-estado">${opts(estados, f.estado, "Todos")}</select></div>
        <div class="mti-field"><label class="mti-lbl">Cliente</label><select class="mti-sel" id="mti-f-cliente">${opts(clientesNombres(), f.cliente, "Todos")}</select></div>
        <div class="mti-field"><label class="mti-lbl">Equipo</label><select class="mti-sel" id="mti-f-equipo">${opts(equiposNombres(), f.equipo, "Todos")}</select></div>
        <div class="mti-field"><label class="mti-lbl">Servicio</label><select class="mti-sel" id="mti-f-servicio">${opts(serviciosNombres(), f.servicio, "Todos")}</select></div>
        <div class="mti-field sm"><label class="mti-lbl">Año</label><select class="mti-sel" id="mti-f-anio">${opts(aniosDisponibles(), f.anio, "Todos")}</select></div>
        <div class="mti-field sm"><label class="mti-lbl" title="Mes de envío, de ejecución o de registro">Mes</label><select class="mti-sel" id="mti-f-mes">${opts(MESES_L.map((m, i) => ({ v: String(i), t: m })), f.mes, "Todos")}</select></div>
        <label class="mti-chk"><input type="checkbox" id="mti-f-venc" ${f.vencidas ? "checked" : ""}> Solo vencidas</label>
        <label class="mti-chk" title="Ejecutadas, perdidas y canceladas"><input type="checkbox" id="mti-f-cerr" ${f.cerradas ? "checked" : ""}> Ocultar cerradas</label>
        <div class="mti-viewtabs">${soloLogistica() ? "" : `<a href="#/tablero" class="${activo === "tablero" ? "on" : ""}">Lista</a><a href="#/pipeline" class="${activo === "pipeline" ? "on" : ""}">Pipeline</a>`}</div>
      </div>`;
  }

  function leyenda() {
    const r = S.data.reglas;
    return `<div class="mti-legend">Leyenda:
      <span>${dot("Verde")} 0–${r.verde} días</span>
      <span>${dot("Amarillo")} ${r.verde + 1}–${r.amarillo} días</span>
      <span>${dot("Rojo")} +${r.amarillo} días o contacto vencido</span>
      <span>${dot("Sin enviar")} aún no enviada</span></div>`;
  }

  function vTablero() {
    const L = filtradas();
    const total = L.reduce((s, c) => s + (c.deal_value || 0), 0);
    const rows = L.map((c) => {
      const p = proxTxt(c);
      const enviada = ABIERTAS.includes(c.status) && c.mti_fecha_envio ? `${c.dias} ${c.dias === 1 ? "día" : "días"}` : "—";
      const btn = ABIERTAS.includes(c.status) && es("comercial") ? `<button class="mti-btn sm" data-seg="${esc(c.name)}">Seguimiento</button>` : `<button class="mti-btn sm">Ver</button>`;
      return `<tr data-open="${esc(c.name)}">
        <td>${dot(c.semaforo)}</td>
        <td class="mti-code">${esc(codigo(c))}</td>
        <td>${esc(c.organization)}</td>
        <td>${esc(c.mti_servicio || "")}</td>
        <td class="mti-eq">${esc(c.mti_equipo || "—")}</td>
        <td class="mti-num">${money(c.deal_value) || "—"}</td>
        <td>${pill(c.status)}${CON_MOTIVO.includes(c.status) && motivoDe(c) ? `<div class="mti-motivo" title="${esc(motivoDe(c))}">${esc(motivoDe(c))}</div>` : ""}</td>
        <td class="${semClase(c.semaforo) === "rojo" ? "mti-bold" : ""}">${enviada}</td>
        <td class="${p.cls}">${p.t}</td>
        <td style="text-align:right">${btn}</td></tr>`;
    }).join("");
    return `${cabeceraLista("tablero")}
      <div class="mti-card mti-table-wrap">
        <table class="mti-table"><thead><tr><th style="width:46px">Sem.</th><th>Oferta</th><th>Cliente</th><th>Servicio</th><th>Equipos</th><th class="mti-num">Valor</th><th>Estado</th><th>Enviada hace</th><th>Próx. contacto</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="10" class="mti-empty">No hay ofertas con estos filtros.</td></tr>`}</tbody>
        ${L.length ? `<tfoot><tr><td colspan="5">${L.length} oferta${L.length > 1 ? "s" : ""}</td><td class="mti-num"><b>${money0(total)}</b></td><td colspan="4" class="mti-muted">valor total antes de IVA</td></tr></tfoot>` : ""}</table>
      </div>${leyenda()}`;
  }

  // ------------------------------------------------------------------ PIPELINE
  function vPipeline() {
    const L = filtradas();
    const cols = PIPE.map((st) => {
      if (S.filtros.cerradas && CERRADAS.includes(st) && S.filtros.estado !== st) return "";
      const items = L.filter((c) => c.status === st);
      const suma = items.reduce((s, c) => s + (c.deal_value || 0), 0);
      const cards = items.map((c) => {
        const p = proxTxt(c);
        return `<div class="mti-kcard" data-card="${esc(c.name)}">
          <div class="top">${dot(c.semaforo)}<span class="mti-code">${esc(codigo(c))}</span>${c.dias && ABIERTAS.includes(c.status) ? `<span class="mti-muted" style="margin-left:auto">${c.dias} d</span>` : ""}</div>
          <div class="cli">${esc(c.organization)}</div>
          <div class="sv">${esc(c.mti_servicio || "")}${c.mti_equipo ? " · " + esc(c.mti_equipo) : ""}</div>
          ${CON_MOTIVO.includes(c.status) && motivoDe(c) ? `<div class="mot" title="${esc(motivoDe(c))}">${c.status === "En espera" ? "⏸ " : ""}${esc(motivoDe(c))}</div>` : ""}
          <div class="ft"><span>${money(c.deal_value) || "&nbsp;"}</span><span class="${p.cls}">${p.t !== "—" ? "Próx: " + p.t : esc(corto(c.deal_owner))}</span></div>
        </div>`;
      }).join("");
      return `<div class="mti-col" data-col="${esc(st)}"><div class="mti-col-h">${pill(st)}<span class="n">${items.length}</span></div>${suma ? `<div class="mti-col-sum">${money(suma)}</div>` : ""}${cards}</div>`;
    }).join("");
    return `${cabeceraLista("pipeline")}<div class="mti-board">${cols}</div>
      <div class="mti-legend">Haz clic en una tarjeta para abrir la oferta y cambiar su etapa con los botones de la ficha. Las etapas de Logística se mueven desde Programación.</div>`;
  }

  async function moverA(name, estado) {
    const c = S.data.cotizaciones.find((x) => x.name === name);
    if (!c || c.status === estado) return;
    if (estado === "En espera") return puedeEspera(c) ? modalEspera(name) : toast("Esta oferta no se puede poner en espera desde tu perfil", true);
    if (c.status === "En espera" && estado === c.mti_estado_previo) return accion({ accion: "reanudar", name });
    if (estado === "Perdida") return modalPerdida(name);
    if (estado === "Cancelada") return modalCancelar(name);
    if (estado === "Visita técnica" && !c.mti_fecha_visita) return modalAgendar(name);
    if (estado === "Cotización enviada") return accion({ accion: "enviar", name }, `${codigo(c)} enviada al cliente`);
    if (estado === "En modificación") { await abrirFicha(name); return modalModificar(S.ficha); }
    if (estado === "Enviada a Logística") { if (c.status !== "Aprobada") return toast("Primero debe estar aprobada", true); await abrirFicha(name); return modalLogistica(S.ficha); }
    if (["Programada", "En ejecución", "Ejecutada"].includes(estado)) return toast("Estas etapas las mueve Logística desde Programación", true);
    await accion({ accion: "estado", name, estado }, `${codigo(c)} → ${estado}`);
  }
  async function abrirFicha(name) {
    if (!S.ficha || S.ficha.name !== name) setFicha(await api.get("mti_cotizacion", { name }));
  }

  // ------------------------------------------------------------------ FICHA (edición)
  const CAMPOS_EDIT = ["organization", "source", "mti_servicio", "mti_ubicacion", "mti_restricciones", "mti_observaciones",
    "mti_fecha_solicitada", "mti_hora_solicitada", "mti_contacto_sitio", "mti_tel_sitio", "mti_notas_logistica"];
  const CAMPOS_CLI = ["mti_nit", "mti_direccion", "mti_contacto", "mti_telefono", "mti_email"];
  function setFicha(f) {
    S.ficha = f;
    const campos = {};
    CAMPOS_EDIT.forEach((k) => (campos[k] = f[k] || ""));
    const cli = {};
    CAMPOS_CLI.forEach((k) => (cli[k] = (f.cliente && f.cliente[k]) || ""));
    S.edit = {
      dirty: false, campos, cliente: cli,
      lineas: (f.lineasTodas || f.lineas || []).map((l) => ({ ...l })),
      trabajos: (f.trabajos || []).map((t) => ({ ...t })),
      desglose: desgloseInicial(f),
      adicionales: (f.adicionales || []).map((a) => ({ ...a })),
      cierre: Object.fromEntries([...CALIF.map((x) => x[0]), "mti_reporte_diario", "mti_recibido_por", "mti_obs_cliente"].map((k) => [k, f[k] || ""])),
    };
  }
  // Desglose del precio: el guardado o, si aún no hay, una propuesta con los equipos y valores de la oferta
  function desgloseInicial(f) {
    if ((f.desglose || []).length) return f.desglose.map((r) => ({ ...r }));
    const filas = [];
    (f.lineas || []).forEach((l) => {
      const k = l.equipo || l.descripcion || (l.tipo === "Transporte" ? "Transporte" : "Otro");
      const ya = filas.find((r) => r.concepto === k);
      if (ya) ya.valor += l.valor_total || 0; else filas.push({ concepto: k, valor: l.valor_total || 0, nota: "" });
    });
    (f.trabajos || []).forEach((t) => { if (t.equipo && !filas.some((r) => r.concepto === t.equipo)) filas.push({ concepto: t.equipo, valor: 0, nota: "" }); });
    (f.adicionales || []).forEach((a) => {
      const ya = filas.find((r) => r.concepto === a.linea);
      if (ya) { ya.valor += a.valor || 0; ya.nota = [ya.nota, `incluye ${a.tipo.toLowerCase()}`].filter(Boolean).join(" · "); }
      else filas.push({ concepto: a.linea, valor: a.valor || 0, nota: a.tipo });
    });
    return filas.length ? filas : [{ concepto: "", valor: +f.valor_final || +f.deal_value || 0, nota: "" }];
  }
  // Horas/días adicionales u otros cobros después de realizado el servicio → valor final consolidado
  function panelAdicionales(f) {
    if (!["Programada", "En ejecución", "Ejecutada"].includes(f.status)) return "";
    const ed = (es("comercial") || es("logistica")) && !soloLectura(), dis = ed ? "" : "disabled";
    const filas = S.edit.adicionales || [];
    const lineas = [...new Set((f.lineas || []).map((l) => l.equipo || l.descripcion).filter(Boolean))];
    const tipos = [...new Set(Object.values(TIPOS_ADIC)), "Cobro adicional"];
    const suma = filas.reduce((t, r) => t + (+r.valor || 0), 0), aprobado = +f.deal_value || 0;
    const rows = filas.map((r, i) => {
      const cobro = r.tipo === "Cobro adicional";
      return `<tr>
        <td><input class="mti-in" id="ad-l-${i}" data-ad="${i}" data-k="linea" list="dl-ad" value="${esc(r.linea)}" placeholder="Equipo o concepto" ${dis}></td>
        <td><select class="mti-sel" id="ad-t-${i}" data-ad="${i}" data-k="tipo" ${dis}>${opts(tipos, r.tipo)}</select></td>
        <td><input class="mti-in mti-num" id="ad-c-${i}" data-ad="${i}" data-k="cantidad" value="${cobro ? "" : r.cantidad || ""}" placeholder="${cobro ? "—" : "0"}" ${cobro ? "disabled" : dis}></td>
        <td><input class="mti-in mti-num" id="ad-u-${i}" data-ad="${i}" data-k="valor_unitario" value="${!cobro && r.valor_unitario ? Math.round(r.valor_unitario).toLocaleString("es-CO") : ""}" placeholder="${cobro ? "—" : "0"}" ${cobro ? "disabled" : dis}></td>
        <td><input class="mti-in mti-num" id="ad-v-${i}" data-ad="${i}" data-k="valor" value="${r.valor ? Math.round(r.valor).toLocaleString("es-CO") : ""}" placeholder="0" ${cobro ? dis : "disabled"}></td>
        <td><input class="mti-in" id="ad-d-${i}" data-ad="${i}" data-k="descripcion" value="${esc(r.descripcion)}" placeholder="Motivo (ej. 2 h por demora del cliente)" ${dis}></td>
        <td>${ed ? `<a href="javascript:void(0)" class="mti-x" data-ad-del="${i}" title="Quitar">✕</a>` : ""}</td></tr>`;
    }).join("");
    return `<div class="mti-card mti-desglose" id="mti-adicionales">
      <div class="mti-card-h"><span>Adicionales del servicio</span><span class="mti-hint">${(f.adicionales || []).length ? "Guardados" : "Ninguno registrado"}</span></div>
      <div class="cuerpo"><p class="mti-muted sm" style="margin:0 0 10px">Si en la ejecución hubo horas, días u otras unidades adicionales (según la modalidad cotizada) o un cobro extra por otro motivo, regístralo aquí antes de marcar ejecutado. Se suma al valor aprobado para el consolidado final.</p>
      ${filas.length ? `<table class="mti-table compact"><thead><tr><th>Equipo / concepto</th><th>Tipo</th><th class="mti-num" style="width:80px">Cant.</th><th class="mti-num" style="width:130px">Valor unidad</th><th class="mti-num" style="width:140px">Valor</th><th>Motivo</th><th style="width:28px"></th></tr></thead><tbody>${rows}</tbody></table>` : ""}
      ${datalist("dl-ad", lineas)}
      <div class="mti-consol"><span>Valor aprobado <b>${money0(aprobado)}</b></span><span>+ Adicionales <b>${money0(suma)}</b></span><span class="tot">= Valor final consolidado <b>${money0(aprobado + suma)}</b></span></div>
      ${ed ? `<div class="mti-row" style="margin-top:10px"><button class="mti-btn sm" data-act="ad-unidad">+ Horas / días adicionales</button><button class="mti-btn sm" data-act="ad-cobro">+ Cobro adicional</button><button class="mti-btn sm dark" data-act="ad-guardar" style="margin-left:auto">Guardar adicionales</button></div>` : ""}
    </div></div>`;
  }
  // Calificación del cliente y datos del reporte diario (formato MTI-CL-FR-001)
  const NOTAS = ["", "NA", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1"];
  function camposCierre(c, dis, pre) {
    return `<div class="mti-g3">
        <div class="mti-field"><label class="mti-lbl">N.º reporte diario</label><input class="mti-in" id="${pre}-rep" data-ci="mti_reporte_diario" value="${esc(c.mti_reporte_diario || "")}" placeholder="Ej. 6095" ${dis}></div>
        <div class="mti-field"><label class="mti-lbl">Vo. Bo. recibido por (cliente)</label><input class="mti-in" id="${pre}-rec" data-ci="mti_recibido_por" value="${esc(c.mti_recibido_por || "")}" placeholder="Nombre de quien firma" ${dis}></div>
        <div class="mti-field"><label class="mti-lbl">Comentario del cliente</label><input class="mti-in" id="${pre}-obs" data-ci="mti_obs_cliente" value="${esc(c.mti_obs_cliente || "")}" ${dis}></div>
      </div>
      <div class="mti-lbl" style="margin:6px 0 6px">Calificación del cliente (10 = excelente, 1 = deficiente, NA = no aplica)</div>
      <div class="mti-calif">${CALIF.map(([k, t]) => `<label><span>${esc(t)}</span><select class="mti-sel" id="${pre}-${k}" data-ci="${k}" ${dis}>${opts(NOTAS, String(c[k] || ""))}</select></label>`).join("")}</div>`;
  }
  function panelCierre(f) {
    if (!["En ejecución", "Ejecutada"].includes(f.status)) return "";
    const ed = (es("comercial") || es("logistica")) && !soloLectura(), dis = ed ? "" : "disabled";
    const prom = +f.mti_cal_promedio || 0;
    return `<div class="mti-card mti-desglose" id="mti-cierre">
      <div class="mti-card-h"><span>Reporte diario y calificación del cliente</span><span class="mti-hint">${prom ? `Promedio <b>${String(prom).replace(".", ",")}</b> / 10` : "Sin calificación"}</span></div>
      <div class="cuerpo">
      ${camposCierre(S.edit.cierre || {}, dis, "ci")}
      <div class="mti-row" style="margin-top:10px">
        <span class="mti-lbl" style="margin:0">Foto del reporte firmado:</span>
        ${f.mti_reporte_foto ? `<a class="mti-link" href="${esc(f.mti_reporte_foto)}" target="_blank">📎 Ver reporte</a>` : `<span class="mti-muted sm">sin foto</span>`}
        ${ed ? `<label class="mti-btn sm">${f.mti_reporte_foto ? "Reemplazar" : "⬆ Subir foto"}<input type="file" id="mti-rep-up" accept="image/*,.pdf" hidden></label>
        <button class="mti-btn sm dark" data-act="ci-guardar" style="margin-left:auto">Guardar reporte y calificación</button>` : ""}
      </div>
    </div></div>`;
  }
  function panelDesglose(f) {
    if (!["En ejecución", "Ejecutada"].includes(f.status)) return "";
    const ed = (es("comercial") || es("logistica")) && !soloLectura();
    const filas = S.edit.desglose || [], total = +f.valor_final || +f.deal_value || 0;
    const suma = filas.reduce((t, r) => t + (+r.valor || 0), 0), dif = total - suma;
    const guardado = (f.desglose || []).length > 0;
    const dis = ed ? "" : "disabled";
    const conceptos = [...new Set([...equiposNombres(), "Transporte", "Movilización", "Operador", "Aparejador", "Horas adicionales"])];
    const rows = filas.map((r, i) => `<tr>
        <td><input class="mti-in" id="dg-c-${i}" data-dg="${i}" data-k="concepto" list="dl-dg" value="${esc(r.concepto)}" placeholder="Equipo o concepto" ${dis}></td>
        <td><input class="mti-in mti-num" id="dg-v-${i}" data-dg="${i}" data-k="valor" value="${r.valor ? Math.round(r.valor).toLocaleString("es-CO") : ""}" placeholder="0" ${dis}></td>
        <td><input class="mti-in" id="dg-n-${i}" data-dg="${i}" data-k="nota" value="${esc(r.nota || "")}" placeholder="Nota (opcional)" ${dis}></td>
        <td>${ed ? `<a href="javascript:void(0)" class="mti-x" data-dg-del="${i}" title="Quitar">✕</a>` : ""}</td></tr>`).join("");
    const estadoTxt = Math.abs(dif) < 1 ? `<span class="mti-ok">✓ Cuadra con el valor final</span>`
      : `<span class="mti-ko">${dif > 0 ? "Faltan" : "Sobran"} ${money0(Math.abs(dif))} frente al valor final</span>`;
    return `<div class="mti-card mti-desglose" id="mti-desglose">
      <div class="mti-card-h"><span>Desglose del precio (para históricos)</span><span class="mti-hint">${guardado ? "Guardado" : "Pendiente · propuesta según la oferta"}</span></div>
      <div class="cuerpo"><p class="mti-muted sm" style="margin:0 0 10px">La oferta se cotiza con un precio unificado. Al terminar el trabajo se reparte el <b>valor final</b> (aprobado + adicionales) entre cada equipo o concepto para que los históricos muestren cuánto produjo cada uno.</p>
      <table class="mti-table compact"><thead><tr><th>Equipo / concepto</th><th class="mti-num" style="width:150px">Valor</th><th>Nota</th><th style="width:28px"></th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td><b>Suma</b></td><td class="mti-num"><b>${money0(suma)}</b></td><td colspan="2">${estadoTxt} <span class="mti-muted">· valor final ${money0(total)}</span></td></tr></tfoot></table>
      ${datalist("dl-dg", conceptos)}
      ${ed ? `<div class="mti-row" style="margin-top:10px"><button class="mti-btn sm" data-act="dg-add">+ Agregar concepto</button><button class="mti-btn sm" data-act="dg-oferta">Volver a la propuesta de la oferta</button><button class="mti-btn sm dark" data-act="dg-guardar" style="margin-left:auto">Guardar desglose</button></div>` : ""}
    </div></div>`;
  }
  function puedeEditar(seccion, f) {
    const st = f.status;
    if (soloLectura()) return false;
    if (seccion === "valores") return (es("comercial") || es("proyectos")) && PRE_ENVIO.includes(st);
    if (seccion === "tecnica") return (es("comercial") || es("proyectos")) && (PRE_ENVIO.includes(st) || ABIERTAS.includes(st));
    if (seccion === "datos") return es("comercial") && !CERRADAS.includes(st) && !fijada(f);
    if (seccion === "logistica") return es("comercial") && ["Aprobada", "Enviada a Logística"].includes(st);
    // elegir qué servicios cotizados van en la oferta final: hasta que el cliente la aprueba
    if (seccion === "seleccion") return (es("comercial") || (es("proyectos") && PRE_ENVIO.includes(st))) && (PRE_ENVIO.includes(st) || ABIERTAS.includes(st)) && !fijada(f);
    return false;
  }
  function marcarSucio() {
    if (!S.edit) return;
    S.edit.dirty = true;
    const d = root().querySelector("#mti-dirty");
    if (d) d.style.display = "flex";
    const t = root().querySelector("#mti-total");
    if (t) t.textContent = money0(S.edit.lineas.filter(incluida).reduce((s, l) => s + (l.valor_total || 0), 0));
  }
  async function guardarFicha(silencioso) {
    const f = S.ficha, e = S.edit;
    const datos = { accion: "guardar", name: f.name, valores: e.campos, cliente: e.cliente };
    if (puedeEditar("valores", f)) datos.lineas = e.lineas;
    else if (puedeEditar("seleccion", f)) datos.seleccion = e.lineas.filter((l) => l.name).map((l) => ({ name: l.name, incluir: l.incluir === 0 ? 0 : 1 }));
    if (puedeEditar("tecnica", f)) datos.trabajos = e.trabajos;
    await accion(datos, silencioso ? "" : "Cambios guardados");
  }

  function pasos(f) {
    const st = f.status;
    const defs = [
      ["Solicitud", ["Solicitud recibida"]], ["Visita técnica", ["Visita técnica"]], ["Análisis Proyectos", ["Análisis de Proyectos"]],
      ["Preparada", ["Cotización preparada"]], ["Enviada", ["Cotización enviada", "En modificación"]], ["Seguimiento", ["Seguimiento"]],
      ["Aprobada", ["Aprobada", "Perdida"]], ["Logística", ["Enviada a Logística", "Cancelada"]], ["Programada", ["Programada", "En ejecución"]],
      ["Ejecutada", ["Ejecutada"]],
    ];
    let cur = defs.findIndex((d) => d[1].includes(st));
    if (st === "En espera") cur = Math.max(0, defs.findIndex((d) => d[1].includes(f.mti_estado_previo)));
    if (st === "Cancelada") { const prev = (f.etapas || []).filter((e) => e.a === "Cancelada").map((e) => e.de)[0]; cur = prev === "Programada" ? 8 : prev === "Aprobada" ? 6 : 7; }
    const curCls = ABIERTAS.includes(st) ? semClase(f.semaforo) : st === "En modificación" ? "purple" : st === "En espera" ? "hold" : ["Perdida", "Cancelada"].includes(st) ? "lost" : "navy";
    const fechaDe = (estados) => { const e = (f.etapas || []).filter((x) => estados.includes(x.de)).slice(-1)[0]; return e ? e.desde : null; };
    const seg = (f.seguimientos || []).filter((s) => !/^\s*\[(Envío|Ajuste|Logística|Proyectos|Interno)\]/.test(String(s.content || "").replace(/<[^>]+>/g, ""))).length;
    return defs.map(([label, estados], i) => {
      let cls = i < cur ? "done" : i === cur ? "cur " + curCls : "fut";
      let lbl = label, sub = "";
      if (i === 1 && !f.mti_requiere_visita && !fechaDe(estados)) { cls = i < cur ? "skip" : "fut"; sub = "No requerida"; }
      if (i === cur && st === "En modificación") { lbl = `Modificación .${f.mti_version}`; sub = f.mti_tipo_ajuste || ""; }
      if (i === cur && st === "Perdida") { lbl = "Perdida"; sub = f.lost_reason || ""; }
      if (i === cur && st === "Cancelada") { lbl = "Cancelada"; }
      if (i === cur && st === "En espera") { lbl = "En espera"; sub = f.mti_fecha_espera ? "desde " + dm(f.mti_fecha_espera) : ""; }
      if (i === cur && st === "En ejecución") { lbl = "En ejecución"; }
      const fecha = fechaDe(estados);
      if (!sub) {
        if (cls.startsWith("fut")) sub = "—";
        else if (i === 4 && f.mti_version) sub = `${dm(fecha)} · v.${f.mti_version}`;
        else if (i === 5) sub = [dm(fecha), seg ? `${seg} contacto${seg > 1 ? "s" : ""}` : ""].filter((x) => x && x !== "—").join(" · ");
        else if (i === 9 && f.mti_fecha_ejecucion) sub = dm(f.mti_fecha_ejecucion);
        else sub = fecha ? dm(fecha) : "";
      }
      const icono = cls === "done" ? "✓" : cls.includes("lost") ? "✕" : cls.includes("hold") ? "❚❚" : "";
      return `<div class="mti-step ${cls}"><div class="c">${icono}</div><div class="l">${esc(lbl)}</div><div class="s">${esc(sub)}</div></div>`;
    }).join("");
  }

  function historial(f) {
    const items = [];
    (f.seguimientos || []).forEach((s) => {
      const txt = String(s.content || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
      const m = txt.match(/^\[([^\]]+)\]\s*(.*)$/);
      const canal = m ? m[1] : "";
      const cuerpo = (m ? m[2] : txt).replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, a, b, c) => `${c}/${b}/${a}`);
      const quien = s.comment_by && !/^(Envío|Seguimiento)$/.test(canal) ? ` <span class="mti-muted">· ${esc(corto(s.owner) || s.comment_by)}</span>` : "";
      items.push({ f: s.creation, html: m ? `<b>${esc(canal)}:</b> ${esc(cuerpo)}${quien}` : esc(cuerpo), cls: canal === "Ajuste" ? "ajuste" : canal === "Logística" ? "logi" : "" });
    });
    (f.etapas || []).forEach((e, i) => {
      if (i === 0) items.push({ f: e.desde, html: `Solicitud registrada · <i>${esc(e.de)}</i>`, cls: "etapa" });
      else {
        const prev = (f.etapas || [])[i - 1];
        items.push({ f: e.desde, html: `Etapa → <i>${esc(e.de)}</i>${prev && prev.por ? " · " + esc(corto(prev.por)) : ""}`, cls: "etapa" });
      }
    });
    items.sort((a, b) => (parseD(a.f) || 0) - (parseD(b.f) || 0));
    const ultimo = (f.seguimientos || []).slice(-1)[0];
    let gap = "";
    if (ABIERTAS.includes(f.status)) {
      const ref = parseD(ultimo ? ultimo.creation : f.mti_fecha_envio);
      if (ref) { const n = diffDays(hoy(), ref); if (n > 0) gap = `<li class="gap">… sin contacto desde hace ${n} día${n > 1 ? "s" : ""}</li>`; }
    }
    return items.map((i) => `<li class="${i.cls}"><span class="d">${dm(i.f)}</span><span>${i.html}</span></li>`).join("") + gap;
  }

  // Quién puede poner una oferta en espera y desde qué etapas
  function fechaAprobada(f) { const e = (f.etapas || []).filter((x) => x.de === "Aprobada").slice(-1)[0]; return e ? e.desde : null; }
  function puedeEspera(c) {
    const st = c.status;
    return (es("comercial") && [...PRE_ENVIO, ...ABIERTAS, "Aprobada", "Enviada a Logística", "Programada"].includes(st))
      || (es("proyectos") && ["Análisis de Proyectos", "En modificación"].includes(st))
      || (es("logistica") && ["Enviada a Logística", "Programada"].includes(st));
  }
  function motivoDe(c) {
    if (c.status === "En espera") return c.mti_motivo_espera || "";
    if (c.status === "Perdida") return [c.lost_reason, c.lost_notes].filter(Boolean).join(" · ");
    if (c.status === "Cancelada") return c.lost_notes || "";
    return "";
  }

  function botonesEtapa(f) {
    const st = f.status, b = [], C = es("comercial"), P = es("proyectos"), L = es("logistica");
    const verN = f.mti_version ? `versión ${codigo(f)}` : "";
    if (C && st === "Solicitud recibida") {
      b.push(`<button class="mti-btn" data-act="sin-visita">Sin visita → Proyectos</button>`);
      b.push(`<button class="mti-btn navy" data-act="agendar">Agendar visita técnica</button>`);
    }
    if (C && st === "Visita técnica") b.push(`<button class="mti-btn navy" data-act="ir-visita">Abrir checklist de la visita →</button>`);
    if ((P || C) && st === "Análisis de Proyectos") b.push(`<button class="mti-btn navy" data-act="estado" data-estado="Cotización preparada">✓ Análisis terminado (Proyectos)</button>`);
    if ((P || C) && st === "En modificación" && f.mti_tipo_ajuste === "Técnico") b.push(`<button class="mti-btn navy" data-act="ajuste-listo">✓ Ajuste técnico terminado (Proyectos)</button>`);
    if (C && st === "Cotización preparada") b.push(`<button class="mti-btn navy" data-act="enviar">${f.mti_version ? "Enviar " + verN + " al cliente" : "Marcar como enviada al cliente"}</button>`);
    if (C && st === "En modificación" && f.mti_tipo_ajuste !== "Técnico") b.push(`<button class="mti-btn navy" data-act="enviar">Enviar ${verN} al cliente</button>`);
    if (C && ABIERTAS.includes(st)) {
      b.push(`<button class="mti-btn purple" data-act="modificar">↺ Cliente pide cambios</button>`);
      b.push(`<button class="mti-btn ok" data-act="aprobada">✓ Marcar aprobada</button>`);
    }
    if (!soloLectura() && puedeEspera(f)) b.push(`<button class="mti-btn hold" data-act="espera">⏸ Poner en espera</button>`);
    if (esAdmin()) b.push(`<button class="mti-btn ko" data-act="eliminar" title="Solo administrador">🗑 Eliminar oferta</button>`);
    if (st === "En espera" && (C || P || L)) b.push(`<button class="mti-btn navy" data-act="reanudar">▶ Reanudar (vuelve a ${esc(f.mti_estado_previo || "Solicitud recibida")})</button>`);
    if (C && (ABIERTAS.includes(st) || PRE_ENVIO.includes(st) || st === "En espera")) b.push(`<button class="mti-btn ko" data-act="perdida">✕ Marcar perdida</button>`);
    if (C && st === "Aprobada") b.push(`<button class="mti-btn navy" data-act="logistica">Enviar a Logística →</button>`);
    if ((C || L) && ["Aprobada", "Enviada a Logística", "Programada"].includes(st)) b.push(`<button class="mti-btn ko" data-act="cancelar">Cancelar servicio</button>`);
    if (L && LOGISTICA.includes(st)) b.push(`<button class="mti-btn navy" data-act="ir-prog">${st === "Enviada a Logística" ? "Programar en Logística →" : "Ver en Programación →"}</button>`);
    if (C && st === "Perdida") b.push(`<button class="mti-btn" data-act="estado" data-estado="Seguimiento">Reabrir oferta</button>`);
    return b.join("");
  }

  function tablaLineas(f) {
    const e = S.edit, ed = puedeEditar("valores", f), sel = puedeEditar("seleccion", f);
    const eqs = equiposNombres();
    const filas = e.lineas.map((l, i) => {
      const dis = ed ? "" : "disabled";
      const u = unidad(l.modalidad, 1);
      const inc = l.incluir !== 0;
      return `<tr class="${inc ? "" : "no-inc"}">
        <td class="sel"><input type="checkbox" data-inc="${i}" ${inc ? "checked" : ""} ${sel ? "" : "disabled"} title="${inc ? "Va en la oferta al cliente" : "No va en la oferta al cliente"}"></td>
        <td><input class="mti-in xs" data-l="${i}.equipo" list="dl-eq" value="${esc(l.equipo || "")}" placeholder="${l.tipo === "Otro" ? "Equipo (opcional)" : "Equipo"}" ${dis}>
            <div class="mti-ldesc"><select class="mti-sel xs" data-l="${i}.tipo" ${dis}>${opts(["Equipo", "Transporte", "Otro"], l.tipo || "Equipo")}</select><input class="mti-in xs" data-l="${i}.descripcion" value="${esc(l.descripcion || "")}" placeholder="Descripción para la oferta (opcional)" ${dis}></div></td>
        <td><select class="mti-sel xs" data-l="${i}.modalidad" data-rr="1" ${dis}>${opts(MODALIDADES, l.modalidad || "Día")}</select></td>
        <td>${l.modalidad === "Global" ? `<span class="mti-muted">—</span>` : `<input class="mti-in xs c" data-l="${i}.cantidad" data-n="1" value="${num(l.cantidad)}" ${dis}><div class="u">${unidad(l.modalidad, l.cantidad)}</div>`}</td>
        <td>${l.modalidad === "Global" ? `<span class="mti-muted">—</span>` : `<div class="mti-jor"><input class="mti-in xs c" data-l="${i}.horas_jornada" data-n="1" value="${l.horas_jornada || ""}" ${dis}><span>h</span><select class="mti-sel xs" data-l="${i}.jornada" ${dis}>${opts(JORNADAS, l.jornada || "Diurna")}</select></div>`}</td>
        <td>${l.modalidad === "Global" ? `<span class="mti-muted">—</span>` : `<input class="mti-in xs r" data-l="${i}.valor_adicional" data-m="1" value="${l.valor_adicional ? Math.round(l.valor_adicional).toLocaleString("es-CO") : ""}" placeholder="por ${u}" ${dis}>`}</td>
        <td><input class="mti-in xs r b" data-l="${i}.valor_total" data-m="1" value="${l.valor_total ? Math.round(l.valor_total).toLocaleString("es-CO") : ""}" ${dis}></td>
        <td>${ed ? `<button class="mti-x" data-del-l="${i}" title="Quitar línea">✕</button>` : ""}</td>
      </tr><tr class="sub ${inc ? "" : "no-inc"}"><td></td><td colspan="7">${inc ? "" : "<b>No va en la oferta</b> · "}${esc(duracionTexto(l))}${l.movilizacion ? " · incluye movilización" : ""}${l.prog_desde ? ` · <b>programado ${dm(l.prog_desde)}${l.prog_hasta && l.prog_hasta !== l.prog_desde ? "–" + dm(l.prog_hasta) : ""}</b>` : ""}</td></tr>`;
    }).join("");
    const total = e.lineas.filter(incluida).reduce((s, l) => s + (l.valor_total || 0), 0);
    const nInc = e.lineas.filter(incluida).length;
    return `<div class="mti-card mti-lines">
      <div class="mti-card-h"><span>Equipos y valores</span>${ed ? "" : PRE_ENVIO.includes(f.status) ? "" : `<span class="mti-hint">${ABIERTAS.includes(f.status) && es("comercial") ? "Para cambiar valores o condiciones usa <b>↺ Cliente pide cambios</b> (crea la versión ." + ((f.mti_version || 0) + 1) + ")" : "Solo lectura"}</span>`}</div>
      ${e.lineas.length ? `<div class="mti-selhint">✓ Marca los servicios que van en la oferta final al cliente${sel ? "" : " (ya no se puede cambiar)"}. El total es solo para Comercial: <b>no se imprime</b> en la oferta.</div>` : ""}
      <div class="mti-scroll"><table class="mti-ltable"><thead><tr><th style="width:34px" title="Va en la oferta al cliente">✓</th><th>Equipo / descripción</th><th style="width:104px">Modalidad</th><th style="width:72px">Cantidad</th><th style="width:162px">Jornada</th><th style="width:122px">Valor unidad adic.</th><th style="width:132px">Valor total</th><th style="width:30px"></th></tr></thead>
      <tbody>${filas || `<tr><td colspan="8" class="mti-empty sm">Aún no hay equipos en la oferta${ed ? ": agrega el primero." : "."}</td></tr>`}</tbody></table></div>
      <div class="mti-lines-ft">${ed ? `<button class="mti-btn sm" data-add-l="Equipo">+ Agregar equipo</button><button class="mti-btn sm" data-add-l="Transporte">+ Agregar transporte</button>` : ""}
        <div class="tot">${e.lineas.length > nInc ? `${nInc} de ${e.lineas.length} servicios · ` : ""}Total seleccionado antes de IVA <b id="mti-total">${money0(total)}</b><div class="mti-muted sm">Vista comercial: no aparece en la oferta al cliente</div></div></div>
      ${datalist("dl-eq", eqs)}
    </div>`;
  }

  function tablaTrabajos(f) {
    const e = S.edit, ed = puedeEditar("tecnica", f), dis = ed ? "" : "disabled";
    const filas = e.trabajos.map((t, i) => `<div class="mti-trab">
      <div class="n">${ROMANOS[i] || i + 1}</div>
      <div class="cuerpo">
        <textarea class="mti-in xs" rows="1" data-t="${i}.descripcion" placeholder="Qué se va a hacer (ej. desmontaje de chimenea de 24 m)" ${dis}>${esc(t.descripcion || "")}</textarea>
        <div class="mti-trab-g">
          <label>Equipo<input class="mti-in xs" data-t="${i}.equipo" list="dl-eq2" value="${esc(t.equipo || "")}" ${dis}></label>
          <label>Altura (m)<input class="mti-in xs c" data-t="${i}.altura" data-n="1" value="${num(t.altura)}" ${dis}></label>
          <label>Radio (m)<input class="mti-in xs c" data-t="${i}.radio" data-n="1" value="${num(t.radio)}" ${dis}></label>
          <label>Peso (t)<input class="mti-in xs c" data-t="${i}.peso" data-n="1" value="${num(t.peso)}" ${dis}></label>
          <label class="w">Especificaciones<input class="mti-in xs" data-t="${i}.especificaciones" value="${esc(t.especificaciones || "")}" placeholder="Configuración, contrapeso, terreno…" ${dis}></label>
        </div>
      </div>
      ${ed ? `<button class="mti-x" data-del-t="${i}" title="Quitar trabajo">✕</button>` : ""}
    </div>`).join("");
    return `<div class="mti-card mti-lines">
      <div class="mti-card-h"><span>Trabajo a ejecutar</span><a class="mti-link" href="javascript:void(0)" data-act="similares">🔍 Buscar trabajos similares</a></div>
      <div class="mti-trabs">${filas || `<div class="mti-empty sm">Sin trabajos registrados.</div>`}</div>
      ${ed ? `<div class="mti-lines-ft"><button class="mti-btn sm" data-add-t="1">+ Agregar trabajo</button></div>` : ""}
      <div class="mti-g2 pad">
        <div class="mti-field"><label class="mti-lbl">Restricciones del sitio</label><input class="mti-in" data-e="mti_restricciones" value="${esc(e.campos.mti_restricciones)}" ${dis}></div>
        <div class="mti-field"><label class="mti-lbl">Observaciones técnicas (Proyectos)</label><input class="mti-in" data-e="mti_observaciones" value="${esc(e.campos.mti_observaciones)}" ${dis}></div>
      </div>
      ${bloqueDiagrama(f)}
      ${datalist("dl-eq2", equiposNombres())}
    </div>`;
  }
  // Diagrama / plan de izaje de Compu Crane (imagen o PDF) que sube Proyectos
  function bloqueDiagrama(f) {
    const url = f.mti_diagrama || "", esImg = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
    const ed = (es("proyectos") || es("comercial")) && !soloLectura() && !fijada(f);
    const vista = !url ? `<div class="mti-muted sm">Aún no se ha subido el diagrama.</div>`
      : esImg ? `<a href="${esc(url)}" target="_blank" title="Ver en tamaño completo"><img class="mti-diag-img" src="${esc(url)}" alt="Diagrama Compu Crane"></a>`
      : `<a class="mti-btn sm" href="${esc(url)}" target="_blank">📄 Ver diagrama (${esc(url.split("/").pop())})</a>`;
    return `<div class="mti-diag pad">
      <div class="mti-lbl">Diagrama de izaje · Compu Crane</div>
      <div class="mti-diag-b">${vista}
        ${ed ? `<label class="mti-btn sm">${url ? "Reemplazar" : "⬆ Subir diagrama (imagen o PDF)"}<input type="file" id="mti-diag-up" accept="image/*,.pdf" hidden></label>${url ? `<a class="mti-link" href="javascript:void(0)" data-act="diag-quitar">Quitar</a>` : ""}` : ""}
      </div></div>`;
  }

  function panelVersiones(f) {
    const vs = f.versiones || [];
    if (!vs.length) return "";
    const actual = { codigo: codigo(f), total: (f.lineas || []).reduce((s, l) => s + (l.valor_total || 0), 0), lineas: f.lineas || [], fecha_envio: f.mti_fecha_envio, actual: true };
    const todas = [...vs, actual];
    const filas = todas.map((v, i) => {
      const prev = i > 0 ? todas[i - 1] : null;
      const dif = prev ? v.total - prev.total : 0;
      const inc = (arr) => (arr || []).filter((l) => l.incluir !== 0);
      const cambios = prev ? inc(v.lineas).map((l, k) => {
        const p = inc(prev.lineas)[k];
        if (!p) return `+ ${esc(lineaCorta(l))}`;
        const c = [];
        if (p.cantidad !== l.cantidad || p.modalidad !== l.modalidad) c.push(`${num(p.cantidad)} → ${num(l.cantidad)} ${unidad(l.modalidad, l.cantidad)}`);
        if ((p.valor_total || 0) !== (l.valor_total || 0)) c.push(`${money0(p.valor_total)} → ${money0(l.valor_total)}`);
        if ((p.valor_adicional || 0) !== (l.valor_adicional || 0)) c.push(`adicional ${money0(p.valor_adicional)} → ${money0(l.valor_adicional)}`);
        return c.length ? `${esc(l.equipo || l.descripcion || "")}: ${esc(c.join(" · "))}` : "";
      }).filter(Boolean).join("<br>") : "";
      const motivo = !v.actual && v.motivo ? v.motivo : i > 0 && todas[i - 1].motivo ? todas[i - 1].motivo : "";
      return `<div class="mti-ver ${v.actual ? "act" : ""}">
        <div class="h"><b>${esc(v.codigo)}</b>${v.actual ? ` <span class="mti-pill c-purple sm">actual</span>` : ""}<span class="r">${money0(v.total)}${prev && dif ? ` <span class="${dif < 0 ? "baja" : "sube"}">(${dif < 0 ? "−" : "+"}${money0(Math.abs(dif)).replace("$ ", "$")})</span>` : ""}</span></div>
        <div class="s">${v.fecha_envio ? "Enviada " + dm(v.fecha_envio) : v.actual ? "Sin enviar aún" : ""}${i > 0 && motivo ? ` · <i>${esc((todas[i - 1].tipo || "") + ": " + motivo)}</i>` : ""}</div>
        ${cambios ? `<div class="c">${cambios}</div>` : ""}
      </div>`;
    }).join("");
    return `<div class="mti-sec-t" style="font-size:15px;margin-top:16px">Versiones de la oferta</div><div class="mti-card mti-vers">${filas}</div>`;
  }

  function panelLogistica(f) {
    const e = S.edit;
    if (!GANADAS.includes(f.status) && f.status !== "Cancelada") return "";
    const ed = puedeEditar("logistica", f), dis = ed ? "" : "disabled";
    const progs = (f.lineas || []).filter((l) => l.prog_desde);
    return `<div class="mti-card mti-logi">
      <div class="mti-card-h"><span>Logística</span>${pill(f.status)}</div>
      <div class="mti-g2 pad">
        <div class="mti-field"><label class="mti-lbl">Fecha solicitada por el cliente</label><input class="mti-in" type="date" data-e="mti_fecha_solicitada" value="${esc(e.campos.mti_fecha_solicitada || "")}" ${dis}></div>
        <div class="mti-field"><label class="mti-lbl">Hora</label><input class="mti-in" type="time" data-e="mti_hora_solicitada" value="${esc(e.campos.mti_hora_solicitada || "")}" ${dis}></div>
        <div class="mti-field"><label class="mti-lbl">Contacto en sitio</label><input class="mti-in" data-e="mti_contacto_sitio" value="${esc(e.campos.mti_contacto_sitio || "")}" ${dis}></div>
        <div class="mti-field"><label class="mti-lbl">Teléfono en sitio</label><input class="mti-in" data-e="mti_tel_sitio" value="${esc(e.campos.mti_tel_sitio || "")}" ${dis}></div>
      </div>
      <div class="pad"><div class="mti-field"><label class="mti-lbl">Notas para Logística</label><input class="mti-in" data-e="mti_notas_logistica" value="${esc(e.campos.mti_notas_logistica || "")}" ${dis}></div></div>
      ${progs.length ? `<div class="mti-progs">${progs.map((l) => `<div><b>${esc(l.equipo || l.descripcion)}</b> · ${dm(l.prog_desde)}${l.prog_hasta && l.prog_hasta !== l.prog_desde ? "–" + dm(l.prog_hasta) : ""} · ${esc(l.prog_hora_inicio || "")}${l.prog_hora_fin ? "–" + esc(l.prog_hora_fin) : ""} · ${esc(l.prog_dias || "")}${l.prog_operador ? " · " + esc(l.prog_operador) : ""}</div>`).join("")}${f.mti_reprogramaciones ? `<div class="mti-muted">Reprogramada ${f.mti_reprogramaciones} ${f.mti_reprogramaciones > 1 ? "veces" : "vez"}</div>` : ""}${f.mti_fecha_ejecucion ? `<div class="mti-okmsg">Ejecutada el ${dmy(f.mti_fecha_ejecucion)}</div>` : ""}</div>` : ""}
    </div>`;
  }

  function vFicha() {
    const f = S.ficha, e = S.edit;
    if (!f || !e) return '<div class="mti-cargando">Cargando…</div>';
    let derecha = "";
    if (ABIERTAS.includes(f.status)) derecha = `${dot(f.semaforo)} <span>${f.dias} día${f.dias === 1 ? "" : "s"} sin respuesta</span>`;
    else derecha = pill(f.status);
    const edD = puedeEditar("datos", f), dis = edD ? "" : "disabled";
    const adj = (f.adjuntos || []).map((a) => `<a href="${esc(a.file_url)}" target="_blank">📎 ${esc(a.file_name)}</a>`).join("") || `<div class="mti-muted">Sin adjuntos</div>`;
    const fotos = (f.adjuntos || []).filter((a) => /\.(jpe?g|png|webp|heic)$/i.test(a.file_name || "")).length;
    const tareas = (f.tareas || []).map((t) => `<div class="t ${t.status === "Done" ? "done" : ""}"><span>${t.status === "Done" ? "✓" : "○"}</span><span>${esc(t.title)}</span><span class="who">${esc(corto(t.assigned_to))} · ${dm(t.due_date)}</span></div>`).join("");
    let banner = "";
    const editarMot = (es("comercial") || es("logistica")) && !soloLectura() ? ` <a class="mti-link" href="javascript:void(0)" data-act="motivo">✎ Editar motivo</a>` : "";
    if (f.status === "Perdida") banner = `<div class="mti-banner lost">Oferta perdida · Motivo: <b>${esc(f.lost_reason || "")}</b>${f.lost_notes ? " · " + esc(f.lost_notes) : ""}${editarMot}</div>`;
    else if (f.status === "Cancelada") banner = `<div class="mti-banner lost">Servicio cancelado · Motivo: <b>${esc(f.lost_notes || "sin detalle")}</b>${editarMot}</div>`;
    else if (fijada(f) && f.status !== "En espera") banner = `<div class="mti-banner lock">🔒 Cotización aprobada${fechaAprobada(f) ? " el " + dmy(fechaAprobada(f)) : ""}: equipos, valores y condiciones quedaron fijados. Si cambia algo en el servicio, se registra como <b>adicional</b>.</div>`;
    else if (f.status === "En espera") banner = `<div class="mti-banner hold">⏸ En espera desde el ${dmy(f.mti_fecha_espera)} (estaba en <b>${esc(f.mti_estado_previo || "—")}</b>) · Motivo: <b>${esc(f.mti_motivo_espera || "sin detalle")}</b>${f.mti_retomar_el ? ` · Retomar el <b>${dmy(f.mti_retomar_el)}</b>` : ""}${(es("comercial") || es("proyectos") || es("logistica")) && !soloLectura() ? ` <a class="mti-link" href="javascript:void(0)" data-act="motivo">✎ Editar</a>` : ""}</div>`;
    else if (f.status === "En modificación") banner = `<div class="mti-banner mod">Renegociación <b>${f.mti_tipo_ajuste === "Técnico" ? "técnica" : "comercial"}</b> · versión ${esc(codigo(f))}: ${esc(f.mti_motivo_ajuste || "")}<br><small>${f.mti_tipo_ajuste === "Técnico" ? "Proyectos revisa el cambio y luego Comercial envía la nueva versión." : "Comercial ajusta las líneas y envía la nueva versión."}</small></div>`;
    else if (f.status === "Enviada a Logística") banner = `<div class="mti-banner won">Enviada a Logística · pendiente de programación por ${esc(nombreU(f.mti_resp_logistica) || "Logística")}.</div>`;
    else if (f.status === "Ejecutada") banner = `<div class="mti-banner won">Servicio ejecutado el ${dmy(f.mti_fecha_ejecucion)}.</div>`;
    const cli = e.cliente;
    return `
      <div class="mti-fhead">
        <a class="mti-btn" href="#/${soloLogistica() ? "programacion" : "tablero"}">←</a>
        <h1 class="mti-h1"><span class="mti-muted" style="font-weight:600">Oferta</span> ${esc(codigo(f))} · ${esc(f.organization || "")}</h1>
        <div class="r">${derecha}<a class="mti-btn sm" href="#/imprimir/${encodeURIComponent(f.name)}">🖨 Oferta para imprimir</a></div>
      </div>
      ${banner}
      <div class="mti-card mti-stepper"><div class="mti-steps">${pasos(f)}</div></div>
      <div class="mti-fgrid">
        <div>
          <div class="mti-sec-t">Datos de la oferta</div>
          <div class="mti-field"><label class="mti-lbl">Cliente</label><input class="mti-in" data-e="organization" list="dl-cli" value="${esc(e.campos.organization)}" ${dis}>${datalist("dl-cli", clientesNombres())}</div>
          <div class="mti-g2">
            <div class="mti-field"><label class="mti-lbl">NIT</label><input class="mti-in" data-c="mti_nit" value="${esc(cli.mti_nit)}" ${dis}></div>
            <div class="mti-field"><label class="mti-lbl">Teléfono</label><input class="mti-in" data-c="mti_telefono" value="${esc(cli.mti_telefono)}" ${dis}></div>
          </div>
          <div class="mti-field"><label class="mti-lbl">Contacto</label><input class="mti-in" data-c="mti_contacto" value="${esc(cli.mti_contacto || (f.contacto && f.contacto.nombre) || "")}" ${dis}></div>
          <div class="mti-field"><label class="mti-lbl">Correo</label><input class="mti-in" data-c="mti_email" value="${esc(cli.mti_email || (f.contacto && f.contacto.email) || "")}" ${dis}></div>
          <div class="mti-field"><label class="mti-lbl">Dirección del cliente</label><input class="mti-in" data-c="mti_direccion" value="${esc(cli.mti_direccion)}" ${dis}></div>
          <div class="mti-sep"></div>
          <div class="mti-field"><label class="mti-lbl">Servicio</label><input class="mti-in" data-e="mti_servicio" list="dl-srv" value="${esc(e.campos.mti_servicio)}" ${dis}>${datalist("dl-srv", serviciosNombres())}</div>
          <div class="mti-field"><label class="mti-lbl">Lugar de prestación del servicio</label><input class="mti-in" data-e="mti_ubicacion" value="${esc(e.campos.mti_ubicacion)}" ${dis}></div>
          <div class="mti-g2">
            <div class="mti-field"><label class="mti-lbl">Canal de entrada</label><select class="mti-sel" data-e="source" ${dis}>${opts(FUENTES, e.campos.source, "—")}</select></div>
            <div class="mti-field"><label class="mti-lbl">Vigencia</label><input class="mti-in" readonly value="${f.mti_vigencia ? "hasta " + dmy(f.mti_vigencia) : "se fija al enviar"}"></div>
          </div>
          <div class="mti-muted mti-auto">Comercial: <b>${esc(nombreU(f.deal_owner) || "—")}</b>${f.mti_aprobo_envio ? ` · Envió: <b>${esc(nombreU(f.mti_aprobo_envio))}</b>` : ""}${f.mti_resp_proyectos && ["Análisis de Proyectos", "En modificación", "Cotización preparada"].includes(f.status) ? ` · Proyectos: <b>${esc(nombreU(f.mti_resp_proyectos))}</b>` : ""}</div>
          <div class="mti-files"><div class="h">Adjuntos${fotos ? ` · Fotos visita (${fotos})` : ""}</div>${adj}${soloLectura() ? "" : `<label>+ Subir archivo o foto<input type="file" id="mti-upload" multiple></label>`}</div>
        </div>
        <div>
          ${tablaLineas(f)}
          ${panelAdicionales(f)}
          ${panelCierre(f)}
          ${panelDesglose(f)}
          ${tablaTrabajos(f)}
        </div>
      </div>
      <div class="mti-fgrid b">
        <div>
          <div class="mti-sec-t">Historial</div>
          <div class="mti-card mti-hist"><ul>${historial(f)}</ul></div>
          ${panelVersiones(f)}
        </div>
        <div>
          ${ABIERTAS.includes(f.status) && es("comercial") ? `
          <div class="mti-follow" id="mti-registrar">
            <div class="mti-sec-t">+ Registrar seguimiento</div>
            <div class="mti-row" style="align-items:flex-end">
              <div class="mti-field" style="width:170px"><label class="mti-lbl">Canal</label><select class="mti-sel" id="mti-canal">${opts(CANALES, "Llamada")}</select></div>
              <div class="mti-field" style="width:170px"><label class="mti-lbl">Próximo contacto en</label><select class="mti-sel" id="mti-dias">${opts([1, 2, 3, 5, 7, 10].map((n) => ({ v: String(n), t: `${n} día${n > 1 ? "s" : ""}` })), String(S.data.reglas.dias_proximo || 3))}</select></div>
            </div>
            <div class="mti-field"><label class="mti-lbl">Nota</label><input class="mti-in" id="mti-nota" placeholder="Qué dijo el cliente…"></div>
            <button class="mti-btn dark" data-act="seguimiento">Guardar</button>
          </div>` : ""}
          ${panelLogistica(f)}
          ${tareas ? `<div class="mti-sec-t" style="font-size:15px">Tareas y traspasos</div><div class="mti-card mti-tasks">${tareas}</div>` : ""}
          <div class="mti-actions">${botonesEtapa(f)}</div>
          <div class="mti-actions" style="margin-top:10px"><a class="mti-muted" href="/crm/deals/${encodeURIComponent(f.name)}" target="_blank">Ver correos, notas y actividad completa en el CRM ↗</a></div>
        </div>
      </div>
      <div class="mti-dirty" id="mti-dirty" style="display:${e.dirty ? "flex" : "none"}"><span>Cambios sin guardar</span><div class="mti-row"><button class="mti-btn sm ghost" data-act="descartar">Descartar</button><button class="mti-btn sm" data-act="guardar">Guardar cambios</button></div></div>`;
  }

  // ------------------------------------------------------------------ IMPRESIÓN (formato MTI-CL-FR-002)
  function fechaLarga(d) { return d ? `${MESES_L[d.getMonth()]} ${p2(d.getDate())} de ${d.getFullYear()}` : "—"; }
  // Plantilla de la oferta al cliente (sin totales: el total es solo para la vista comercial)
  const LOGO_TOKEN = "{{MTI_LOGO}}";
  function plantillaOferta(f) {
    const E = S.data.empresa || {}, cli = f.cliente || {};
    const elab = parseD(f.mti_fecha_envio) || hoy();
    const vig = parseD(f.mti_vigencia) || addDays(elab, S.data.reglas.dias_vigencia || 15);
    const lineas = f.lineas || [];
    const conAdic = lineas.some((l) => l.modalidad !== "Global");
    const filas = lineas.map((l) => {
      if (l.modalidad === "Global" || l.tipo === "Transporte" && !l.valor_adicional) {
        return `<tr><td colspan="${conAdic ? 4 : 2}" class="desc">${esc(l.descripcion || l.equipo)}${l.modalidad !== "Global" ? ` (${num(l.cantidad)} ${unidad(l.modalidad, l.cantidad)})` : ""}</td><td class="r">${money0(l.valor_total)}=<br><small>Antes de IVA</small></td></tr>`;
      }
      return `<tr><td><b>${esc(l.descripcion ? l.descripcion.replace(/^./, (x) => x.toUpperCase()) : l.equipo)}</b>${l.descripcion && l.equipo ? `<br><small>${esc(l.equipo)}</small>` : ""}</td>
        <td>${esc(duracionTexto(l))}</td><td>${l.movilizacion ? "Incluido en el total" : "No incluido"}</td>
        <td class="r">${money0(l.valor_adicional)}=<br><small>${unidad(l.modalidad, 1)} adicional</small></td><td class="r">${money0(l.valor_total)}=<br><small>Antes de IVA</small></td></tr>`;
    }).join("");
    const trabajos = (f.trabajos || []).map((t, i) => {
      const partes = [];
      if (t.radio) partes.push(`a un radio de ${num(t.radio)} metros`);
      if (t.altura) partes.push(`una altura de ${num(t.altura)} m`);
      if (t.peso) partes.push(`un peso de ${num(t.peso)} toneladas`);
      const desc = String(t.descripcion || "").replace(/^Trabajo\s+[IVX]+:\s*/i, "");
      return `<b>Trabajo ${ROMANOS[i] || i + 1}:</b> ${esc(desc)}${partes.length ? ", trabajando " + partes.join(", ").replace(/, ([^,]*)$/, " y $1") : ""}${t.especificaciones ? ` (${esc(t.especificaciones)})` : ""}.`;
    }).join(" ");
    const parrafos = (txt) => String(txt || "").split(/\n+/).filter(Boolean).map((p) => `<p>${esc(p).replace(/^([^.]+\.\s*[A-ZÁÉÍÓÚÑ ]+\.)/, "<b>$1</b>")}</p>`).join("");
    return `
        <div class="pt-head"><div class="pt-logo"><img src="${LOGO_TOKEN}" alt="MTI"></div><div class="pt-emp"><b>${esc(E.nombre)}</b><br>NIT. ${esc(E.nit)}</div><div class="pt-cod">${esc(E.formato)}</div></div>
        <table class="pt-cli">
          <tr><td><b>Cliente:</b> ${esc(f.organization)}</td><td class="c"><b>Fecha elaboración</b><br>${fechaLarga(elab)}</td><td class="c of" rowspan="2"><b>Oferta Mercantil No.</b><div class="n">${esc(codigo(f))}</div></td></tr>
          <tr><td><b>Dirección:</b> ${esc(cli.mti_direccion || f.mti_ubicacion || "")}</td><td class="c"><b>Fecha de vigencia oferta</b><br>${fechaLarga(vig)}</td></tr>
          <tr><td colspan="3">${[["Email", cli.mti_email || (f.contacto && f.contacto.email)], ["NIT", cli.mti_nit], ["Tel", cli.mti_telefono || (f.contacto && f.contacto.movil)]].filter((x) => x[1]).map((x) => `<b>${x[0]}:</b> ${esc(x[1])}`).join(" &nbsp; · &nbsp; ")}</td></tr>
        </table>
        <p>Por medio de la presente ponemos a consideración de <b>${esc(String(f.organization || "").toUpperCase())}</b>, en adelante el CONTRATANTE, la presente oferta mercantil por parte de ${esc(E.nombre)} en adelante “LA EMPRESA”.</p>
        <p><b>Primero.</b> ${esc(E.primero)}</p>
        <p><b>Segundo. LUGAR DE PRESTACIÓN DEL SERVICIO:</b> ${esc(f.mti_ubicacion || "")}</p>
        <table class="pt-items"><thead><tr>${conAdic ? "<th>Equipo</th><th>Duración</th><th>Transporte</th><th>Valor unidad adicional</th>" : "<th colspan='2'>Descripción</th>"}<th>Valor total (incluye movilización)</th></tr></thead>
          <tbody>${filas || `<tr><td colspan="5" class="c">Sin líneas</td></tr>`}</tbody></table>
        ${(f.adicionales || []).length ? `<table class="pt-items"><thead><tr><th colspan="3">ADICIONALES DEL SERVICIO EJECUTADO</th><th>Cantidad</th><th>Valor</th></tr></thead><tbody>${f.adicionales.map((a) => `<tr><td colspan="3">${esc(a.linea)} · ${esc(a.tipo)}${a.descripcion ? " · " + esc(a.descripcion) : ""}</td><td class="c">${a.tipo === "Cobro adicional" ? "—" : esc(String(a.cantidad))}</td><td class="r">${money0(a.valor)}</td></tr>`).join("")}</tbody></table>` : ""}
        ${trabajos ? `<div class="pt-trab"><div class="t">TRABAJO A EJECUTAR</div><p>${trabajos} En todo caso sin exceder la capacidad de la grúa según tablas de carga.</p></div>` : ""}
        ${parrafos(E.finales)}
        <div class="pt-firmas"><div>Atentamente,<div class="linea"></div><b>${esc(nombreU(f.deal_owner))}</b><br>Departamento Comercial</div><div>Acepto,<div class="linea"></div>Nombre, firma y sello autorizados</div></div>
        <div class="pt-pie">${esc(E.pie).replace(/\n/g, "<br>")}</div>
        ${f.mti_diagrama && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(f.mti_diagrama) ? `<div class="pt-anexo"><div class="t">ANEXO · PLAN DE IZAJE (COMPU CRANE)</div><img src="${esc(f.mti_diagrama)}" alt="Plan de izaje"></div>` : ""}`;
  }
  // Huella corta de la plantilla: avisa si la oferta cambió después de editar el texto
  function hashTxt(t) { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + "." + t.length; }
  // Limpia el HTML editado: sin scripts, eventos ni enlaces peligrosos
  function limpiarHTML(html) {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const raiz = doc.body.firstElementChild;
    raiz.querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button,textarea,select").forEach((n) => n.remove());
    raiz.querySelectorAll("*").forEach((n) => {
      [...n.attributes].forEach((a) => {
        const k = a.name.toLowerCase(), v = String(a.value || "").trim().toLowerCase();
        if (k.startsWith("on") || k === "contenteditable" || k === "srcdoc") n.removeAttribute(a.name);
        else if ((k === "href" || k === "src") && !(v.startsWith("http") || v.startsWith("/") || v.startsWith("{{") || v.startsWith("data:image/") || v.startsWith("#"))) n.removeAttribute(a.name);
      });
    });
    return raiz.innerHTML.split(LOGO).join(LOGO_TOKEN);
  }
  const conLogo = (html) => String(html || "").split(LOGO_TOKEN).join(LOGO);
  function puedeEditarTexto() { return es("comercial") || esAdmin(); }
  function vImprimir() {
    const f = S.ficha;
    if (!f) return '<div class="mti-cargando">Cargando…</div>';
    const E = S.data.empresa || {};
    const plantilla = plantillaOferta(f), base = hashTxt(plantilla);
    if (!S.imp || S.imp.name !== f.name) S.imp = { name: f.name, sucio: false, html: null };
    const guardado = f.mti_oferta_html || "";
    const html = S.imp.sucio && S.imp.html != null ? S.imp.html : guardado || plantilla;
    const ed = puedeEditarTexto();
    const desactualizada = guardado && f.mti_oferta_base && f.mti_oferta_base !== base;
    const aviso = S.imp.sucio ? `<b>Texto modificado sin guardar.</b>`
      : guardado ? `Texto editado por ${esc(nombreU(f.mti_oferta_editor))}${f.mti_oferta_editada ? " el " + esc(dmy(f.mti_oferta_editada) + " " + hm(f.mti_oferta_editada)) : ""}.`
      : `Plantilla ${esc(E.formato)} con los datos de la oferta.`;
    return `
      <div class="mti-print-bar no-print">
        <a class="mti-btn" href="#/cotizacion/${encodeURIComponent(f.name)}">← Volver a la ficha</a>
        <span class="mti-muted">${aviso} ${ed ? "Haz clic sobre el documento para editar el texto antes de imprimir." : "Revisa antes de enviar."}</span>
        <button class="mti-btn dark" data-act="imprimir">Imprimir / Guardar PDF</button>
      </div>
      ${desactualizada ? `<div class="mti-print-warn no-print">⚠ Los datos de la oferta cambiaron después de editar este texto (equipos, valores o condiciones). Revisa el documento o usa <b>Restablecer plantilla</b> para generarlo de nuevo con los datos actuales.</div>` : ""}
      ${ed ? `<div class="mti-doc-tools no-print">
        <button class="mti-btn sm" data-fmt="bold" title="Negrita"><b>N</b></button>
        <button class="mti-btn sm" data-fmt="italic" title="Cursiva"><i>K</i></button>
        <button class="mti-btn sm" data-fmt="underline" title="Subrayado"><u>S</u></button>
        <button class="mti-btn sm" data-fmt="insertUnorderedList" title="Lista">• Lista</button>
        <span class="sep"></span>
        <button class="mti-btn sm" data-fila="mas" title="Agregar una fila debajo de la fila donde está el cursor">+ Fila</button>
        <button class="mti-btn sm" data-fila="menos" title="Quitar la fila donde está el cursor">− Fila</button>
        <span class="sep"></span>
        <button class="mti-btn sm dark" data-act="texto-guardar" ${S.imp.sucio ? "" : "disabled"}>Guardar texto</button>
        ${guardado || S.imp.sucio ? `<button class="mti-btn sm" data-act="texto-plantilla">Restablecer plantilla</button>` : ""}
      </div>` : ""}
      <div class="mti-print ${ed ? "editable" : ""}" id="mti-doc" ${ed ? 'contenteditable="true" spellcheck="true"' : ""}>${conLogo(html)}</div>`;
  }
  function enlazarImprimir(R) {
    const f = S.ficha, doc = R.querySelector("#mti-doc");
    const b = R.querySelector("[data-act='imprimir']");
    if (b) b.onclick = () => window.print();
    if (!f || !doc || !doc.isContentEditable) return;
    const sucio = () => {
      S.imp.html = doc.innerHTML;
      if (!S.imp.sucio) {
        S.imp.sucio = true;
        const g = R.querySelector("[data-act='texto-guardar']"); if (g) g.disabled = false;
        const m = R.querySelector(".mti-print-bar .mti-muted"); if (m) m.innerHTML = "<b>Texto modificado sin guardar.</b> Guarda el texto para que quede igual la próxima vez.";
      }
    };
    doc.addEventListener("input", sucio);
    R.querySelectorAll("[data-fmt]").forEach((x) => (x.onmousedown = (ev) => { ev.preventDefault(); document.execCommand(x.dataset.fmt, false, null); sucio(); }));
    R.querySelectorAll("[data-fila]").forEach((x) => (x.onmousedown = (ev) => {
      ev.preventDefault();
      const sel = window.getSelection(), nodo = sel && sel.anchorNode;
      const tr = nodo && (nodo.nodeType === 1 ? nodo : nodo.parentElement).closest("#mti-doc tr");
      if (!tr) return toast("Pon el cursor dentro de una fila de la tabla", true);
      if (x.dataset.fila === "menos") tr.remove();
      else { const n = tr.cloneNode(true); n.querySelectorAll("td,th").forEach((c) => (c.innerHTML = "&nbsp;")); tr.after(n); }
      sucio();
    }));
    const on = (sel, fn) => R.querySelectorAll(sel).forEach((x) => (x.onclick = fn));
    on("[data-act='texto-guardar']", async () => {
      await accion({ accion: "oferta_texto", name: f.name, html: doc.innerHTML, base: hashTxt(plantillaOferta(S.ficha)) }, "Texto de la oferta guardado");
      S.imp = { name: f.name, sucio: false, html: null }; render();
    });
    on("[data-act='texto-plantilla']", async () => {
      if (!window.confirm("¿Volver a la plantilla con los datos actuales de la oferta? Se pierden los cambios hechos al texto.")) return;
      S.imp = { name: f.name, sucio: false, html: null };
      if (f.mti_oferta_html) await accion({ accion: "oferta_texto", name: f.name, html: "" }, "Oferta restablecida desde la plantilla");
      else render();
    });
  }

  // ------------------------------------------------------------------ VISITAS
  function visitas() { return S.data.cotizaciones.filter((c) => c.mti_fecha_visita && c.mti_requiere_visita); }
  function porAgendar() { return S.data.cotizaciones.filter((c) => c.mti_requiere_visita && !c.mti_fecha_visita && ["Solicitud recibida", "Visita técnica"].includes(c.status)); }
  function evento(c, extra) {
    const ev = estadoVisita(c);
    const ciudad = (c.mti_ubicacion || "").split(",")[0];
    return `<div class="mti-ev ev-${ev} ${S.visitaSel === c.name ? "sel" : ""}" data-vis="${esc(c.name)}" ${extra || ""}>
      <b>${ev === "realizada" ? "✓ " : ""}${esc(ciudad || c.organization)}</b>${esc(ev === "pendiente" ? "falta info" : c.organization)}</div>`;
  }
  function vVisitas() {
    const H = hoy();
    const L = addDays(lunes(H), 7 * S.semana);
    const dias = [0, 1, 2, 3, 4].map((i) => addDays(L, i));
    const V = visitas();
    if (!S.visitaSel) {
      const enSemana = V.filter((c) => { const d = parseD(c.mti_fecha_visita); return d >= L && d < addDays(L, 7); });
      const pref = enSemana.find((c) => estadoVisita(c) === "pendiente") || enSemana.find((c) => estadoVisita(c) === "programada") || enSemana[0];
      S.visitaSel = pref ? pref.name : null;
    }
    const HI = 7, HF = 18, PX = 46;
    let cal; S.calAncho = false;
    if (S.modoCal === "semana") {
      const cab = `<div></div>` + dias.map((d) => `<div class="${diffDays(d, H) === 0 ? "hoy" : ""}">${DIAS[d.getDay()]} ${d.getDate()}${diffDays(d, H) === 0 ? " · hoy" : ""}</div>`).join("");
      const horas = `<div class="mti-hours">${Array.from({ length: HF - HI }, (_, i) => `<div>${i % 2 === 1 ? ((HI + i) > 12 ? (HI + i - 12) : HI + i) + ":00" : ""}</div>`).join("")}</div>`;
      const carriles = [];
      const cols = dias.map((d) => {
        // visitas que se cruzan en hora se reparten en columnas lado a lado (como un calendario de Google)
        const DUR = 1.45;
        const delDia = V.filter((c) => diffDays(parseD(c.mti_fecha_visita), d) === 0)
          .map((c) => { const f = parseD(c.mti_fecha_visita); return { c, ini: Math.max(0, f.getHours() + f.getMinutes() / 60 - HI) }; })
          .sort((a, b) => a.ini - b.ini || String(a.c.name).localeCompare(b.c.name));
        let grupo = [], finGrupo = -1;
        const cerrarGrupo = () => { const n = Math.max(...grupo.map((x) => x.carril)) + 1; grupo.forEach((x) => (x.n = n)); grupo = []; };
        delDia.forEach((x) => {
          if (grupo.length && x.ini >= finGrupo) cerrarGrupo();
          const ocupados = grupo.filter((y) => y.ini + DUR > x.ini).map((y) => y.carril);
          let k = 0; while (ocupados.includes(k)) k++;
          x.carril = k; grupo.push(x); finGrupo = Math.max(finGrupo, x.ini + DUR);
        });
        if (grupo.length) cerrarGrupo();
        carriles.push(Math.max(1, ...delDia.map((x) => x.n)));
        const evs = delDia.map((x) => evento(x.c, `style="top:${x.ini * PX + 3}px;height:${PX * DUR}px;left:calc(5px + (100% - 10px) * ${x.carril} / ${x.n});right:auto;width:calc((100% - 10px) / ${x.n} - ${x.n > 1 ? 3 : 0}px)" data-n="${x.n}"`)).join("");
        return `<div class="mti-day ${diffDays(d, H) === 0 ? "hoy" : ""}" style="height:${(HF - HI) * PX}px">${evs}</div>`;
      }).join("");
      // el día con visitas cruzadas se ensancha (mín. 96 px por visita); si no cabe, el calendario se desplaza a lo ancho
      S.calAncho = 58 + carriles.reduce((t, n) => t + (n > 1 ? n * 96 : 110), 0) > 880;
      const plantilla = `grid-template-columns:58px ${carriles.map((n) => `minmax(${n > 1 ? n * 96 : 110}px, ${n}fr)`).join(" ")}`;
      cal = `<div class="mti-cal"><div class="mti-cal-in"><div class="mti-cal-h" style="${plantilla}">${cab}</div><div class="mti-cal-b" style="${plantilla}">${horas}${cols}</div></div></div>`;
    } else {
      const base = new Date(H.getFullYear(), H.getMonth() + S.mes, 1);
      const ini = lunes(base);
      const celdas = Array.from({ length: 42 }, (_, i) => addDays(ini, i));
      cal = `<div class="mti-month">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => `<div class="h">${d}</div>`).join("")}${celdas.map((d) => `<div class="d ${d.getMonth() !== base.getMonth() ? "out" : ""} ${diffDays(d, H) === 0 ? "hoy" : ""}">${d.getDate()}${V.filter((c) => diffDays(parseD(c.mti_fecha_visita), d) === 0).map((c) => evento(c)).join("")}</div>`).join("")}</div>`;
    }
    const rango = S.modoCal === "semana" ? `${dias[0].getDate()} ${MESES[dias[0].getMonth()]} – ${dias[4].getDate()} ${MESES[dias[4].getMonth()]}`
      : (() => { const b = new Date(H.getFullYear(), H.getMonth() + S.mes, 1); return `${MESES[b.getMonth()]} ${b.getFullYear()}`; })();
    const pa = porAgendar().map((c) => {
      const nota = (c.ultima_nota || "").replace(/^\[[^\]]+\]\s*/, "") || (c.mti_ubicacion ? "llamar para fijar fecha" : "esperando dirección");
      return `<label class="it" data-agendar="${esc(c.name)}"><input type="checkbox"> <span><b>${esc(codigo(c))}</b> · ${esc(c.organization)} — ${esc(nota)}</span></label>`;
    }).join("") || `<div class="mti-muted">No hay solicitudes pendientes de visita.</div>`;
    return `
      <div class="mti-head">
        <h1 class="mti-h1">Visitas técnicas</h1>
        <div class="mti-weeknav"><button class="mti-btn" data-nav="-1">‹</button><button class="mti-btn rango" data-nav="0">${rango}</button><button class="mti-btn" data-nav="1">›</button></div>
        <div class="mti-seg"><a href="javascript:void(0)" data-modo="semana" class="${S.modoCal === "semana" ? "on" : ""}">Semana</a><a href="javascript:void(0)" data-modo="mes" class="${S.modoCal === "mes" ? "on" : ""}">Mes</a></div>
        ${es("comercial") ? `<button class="mti-btn dark" data-act="agendar">+ Agendar visita</button>` : ""}
      </div>
      <div class="mti-vgrid ${S.modoCal === "semana" && S.calAncho ? "ancho" : ""}">
        <div>
          <div class="mti-card" style="padding:6px">${cal}</div>
          <div class="mti-chips"><span class="mti-chip ev-realizada">realizada</span><span class="mti-chip ev-programada">programada</span><span class="mti-chip ev-pendiente">pendiente de info</span></div>
          <div class="mti-card mti-pend"><div class="mti-sec-t" style="font-size:15px">Por agendar (solicitudes sin visita)</div>${pa}</div>
        </div>
        <div>${panelVisita()}</div>
      </div>`;
  }

  function panelVisita() {
    const c = S.data.cotizaciones.find((x) => x.name === S.visitaSel);
    if (!c) return `<div class="mti-card mti-panel"><div class="mti-muted">Selecciona una visita del calendario.</div></div>`;
    const f = parseD(c.mti_fecha_visita);
    const t1 = (c.trabajos || [])[0] || {};
    const ck = checklist(c);
    const ro = !es("comercial") && !es("proyectos");
    const filas = CHECKS.map(([k, label, campo, tipo, u]) => {
      const marcado = c["mti_chk_" + k] ? "checked" : "";
      if (tipo === "fotos") return `<div class="mti-ck full"><input type="checkbox" data-ck="${k}" ${marcado}><span>${label}</span></div>
        <div class="mti-vfotos">${ro ? "" : `<label class="mti-btn sm">📷 Subir fotos de la visita<input type="file" id="mti-vis-up" accept="image/*" multiple hidden></label>`}
        <a class="mti-link" href="#/cotizacion/${encodeURIComponent(c.name)}">Ver fotos en la ficha →</a></div>`;
      const v = campo.startsWith("t:") ? t1[campo.slice(2)] : c[campo];
      return `<div class="mti-ck"><input type="checkbox" data-ck="${k}" ${marcado}><span>${label}</span>
        <input class="mti-in" data-ckv="${campo}" ${tipo === "num" ? 'inputmode="decimal"' : ""} value="${esc(tipo === "num" ? (v ? num(v) : "") : v || "")}" placeholder="${u || "dato"}"></div>`;
    }).join("");
    const realizada = c.mti_estado_visita === "Realizada";
    return `<div class="mti-card mti-panel">
      <p class="ttl">Visita · ${esc(c.organization)}</p>
      <div class="mti-muted" style="margin:2px 0 12px">${f ? `${DIAS[f.getDay()]} ${f.getDate()} ${MESES[f.getMonth()]} · ${hm(c.mti_fecha_visita)}` : "Sin fecha"} · <a href="#/cotizacion/${encodeURIComponent(c.name)}"><b>${esc(codigo(c))}</b></a></div>
      <div class="mti-field"><label class="mti-lbl">Realiza la visita</label><input class="mti-in" id="mti-tec" list="mti-tecs" value="${esc(c.mti_tecnico || "")}" placeholder="Técnico MTI">${datalist("mti-tecs", cat("Personal").filter((p) => p.categoria !== "Conductor").map((p) => p.nombre))}</div>
      <div class="mti-sec-t" style="font-size:15px;margin-top:6px">Checklist de levantamiento</div>
      ${filas}
      ${realizada ? `<div class="mti-okmsg">Visita realizada y enviada a Proyectos</div>` : ck.completo ? `<div class="mti-okmsg">Checklist completo: lista para Proyectos</div>` : `<div class="mti-warn">Faltan ${ck.faltan.length} dato${ck.faltan.length > 1 ? "s" : ""}: la visita queda en rojo</div>`}
      <div class="mti-sep"></div>
      <div class="mti-tg"><label class="mti-toggle"><input type="checkbox" id="mti-rec" ${c.mti_recordar_visita ? "checked" : ""}><span></span></label> Recordarme 1 día antes</div>
      ${ro ? "" : `<div class="mti-row" style="margin-top:14px">
        <button class="mti-btn" data-act="guardar-ck">Guardar avance</button>
        <button class="mti-btn dark" style="flex:1" data-act="enviar-ck" ${!ck.completo || realizada ? "disabled" : ""}>Completar y enviar a Proyectos</button>
      </div>`}
    </div>`;
  }

  function leerChecklist() {
    const p = root().querySelector(".mti-panel");
    const v = {}, t1 = {};
    p.querySelectorAll("[data-ck]").forEach((el) => { v["mti_chk_" + el.dataset.ck] = el.checked ? 1 : 0; });
    p.querySelectorAll("[data-ckv]").forEach((el) => {
      const k = el.dataset.ckv;
      if (k.startsWith("t:")) t1[k.slice(2)] = parseNum(el.value); else v[k] = el.value;
    });
    v.mti_tecnico = val(p, "#mti-tec");
    v.mti_recordar_visita = val(p, "#mti-rec");
    return { valores: v, trabajo1: t1 };
  }

  // ------------------------------------------------------------------ PROGRAMACIÓN (Logística)
  function programados() {
    // cada línea programada genera un bloque por cada día que trabaja (según su frecuencia) en su horario
    const out = [];
    const hora = (t, def) => {
      const m = String(t || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/i);
      if (!m) return def;
      let h = +m[1] + (+m[2] || 0) / 60;
      const ap = (m[3] || "").toLowerCase().replace(/[.\s]/g, "");
      if (ap === "pm" && h < 12) h += 12;
      if (ap === "am" && h >= 12) h -= 12;
      return h;
    };
    S.data.cotizaciones.forEach((c) => {
      if (!["Programada", "En ejecución", "Ejecutada"].includes(c.status)) return;
      (c.lineas || []).forEach((l) => {
        const d = parseD(l.prog_desde);
        if (!d) return;
        let h = parseD(l.prog_hasta) || d;
        if (h < d) h = d;
        const frec = l.prog_dias || "Lunes a viernes";
        const h1 = hora(l.prog_hora_inicio, 7);
        let h2 = hora(l.prog_hora_fin, Math.min(24, h1 + 8));
        const noche = h2 <= h1; // turno que pasa de medianoche (p. ej. 18:00 a 01:30)
        const fin = noche ? 24 : h2;
        for (let x = new Date(d); x <= h; x = addDays(x, 1)) {
          const dow = x.getDay();
          const trabaja = frec === "Todos los días" || (frec === "Lunes a sábado" ? dow !== 0 : dow !== 0 && dow !== 6) || +x === +d;
          if (!trabaja) continue;
          out.push({ c, l, dia: new Date(x), h1, h2: fin, noche, equipo: l.equipo || l.descripcion || "Sin equipo" });
        }
      });
    });
    // conflicto: el mismo equipo en dos ofertas distintas, el mismo día y a horas que se cruzan
    out.forEach((a) => {
      a.conflicto = a.c.status !== "Ejecutada" && out.some((b) => b !== a && b.c.name !== a.c.name && b.equipo === a.equipo && b.c.status !== "Ejecutada"
        && +b.dia === +a.dia && a.h1 < b.h2 && b.h1 < a.h2);
    });
    return out;
  }
  function rangoProg() {
    const H = hoy();
    if (S.prog.modo === "semana") { const ini = addDays(lunes(H), 7 * S.prog.semana); return { ini, dias: Array.from({ length: 7 }, (_, i) => addDays(ini, i)) }; }
    const ini = new Date(H.getFullYear(), H.getMonth() + S.prog.mes, 1);
    const n = new Date(ini.getFullYear(), ini.getMonth() + 1, 0).getDate();
    return { ini, dias: Array.from({ length: n }, (_, i) => addDays(ini, i)) };
  }
  const hhmm = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  function bloqueProg(p, estilo) {
    const cls = p.c.status === "Ejecutada" ? "ejec" : p.c.status === "En ejecución" ? "curso" : "prog";
    const horario = `${esc(p.l.prog_hora_inicio || hhmm(p.h1))}–${esc(p.l.prog_hora_fin || hhmm(p.h2))}${p.noche ? " (+1)" : ""}`;
    const tit = [codigo(p.c), p.c.organization, p.equipo, horario.replace(/&[^;]+;/g, ""), p.l.prog_operador].filter(Boolean).join(" · ");
    return `<div class="mti-pev ${cls} ${p.conflicto ? "conf" : ""} ${S.prog.sel === p.c.name ? "sel" : ""}" data-psel="${esc(p.c.name)}" ${estilo || ""} title="${esc(tit)}">
      <b>${p.conflicto ? "⚠ " : ""}${esc(p.equipo)}</b><span class="cli">${esc(p.c.organization || "")}</span><span>${horario} · ${esc(codigo(p.c))}</span>${p.l.prog_operador ? `<span>👷 ${esc(p.l.prog_operador)}</span>` : ""}</div>`;
  }
  function vProgramacion() {
    const H = hoy(), C = S.data.cotizaciones;
    const { dias } = rangoProg();
    const ini = dias[0], fin = dias[dias.length - 1];
    const P = programados();
    const enRango = P.filter((p) => p.dia >= ini && p.dia <= fin);
    const mes = S.prog.modo === "mes";
    let cal;
    if (!mes) {
      // Semana: columnas = días, filas = horas. Los trabajos que coinciden en horario se ponen lado a lado.
      const PX = 46;
      const HI = Math.max(0, Math.min(6, ...enRango.map((p) => Math.floor(p.h1))));
      const HF = Math.min(24, Math.max(19, ...enRango.map((p) => Math.ceil(p.h2))));
      const carriles = [];
      const cols = dias.map((d) => {
        const delDia = enRango.filter((p) => +p.dia === +d).sort((a, b) => a.h1 - b.h1 || b.h2 - a.h2 || a.equipo.localeCompare(b.equipo));
        let grupo = [], finG = -1;
        const cerrar = () => { const n = Math.max(...grupo.map((x) => x.carril)) + 1; grupo.forEach((x) => (x.n = n)); grupo = []; };
        delDia.forEach((x) => {
          if (grupo.length && x.h1 >= finG) cerrar();
          const ocup = grupo.filter((y) => y.h2 > x.h1).map((y) => y.carril);
          let k = 0; while (ocup.includes(k)) k++;
          x.carril = k; grupo.push(x); finG = Math.max(finG, x.h2);
        });
        if (grupo.length) cerrar();
        carriles.push(Math.max(1, ...delDia.map((x) => x.n || 1)));
        const bloques = delDia.map((x) => bloqueProg(x, `style="top:${(x.h1 - HI) * PX + 2}px;height:${Math.max(0.75, x.h2 - x.h1) * PX - 4}px;left:calc(4px + (100% - 8px) * ${x.carril} / ${x.n});width:calc((100% - 8px) / ${x.n} - ${x.n > 1 ? 3 : 0}px)"`)).join("");
        return `<div class="mti-day ${diffDays(d, H) === 0 ? "hoy" : ""}" style="height:${(HF - HI) * PX}px">${bloques}</div>`;
      }).join("");
      const plantilla = `grid-template-columns:56px ${carriles.map((n) => `minmax(${n * 100}px, ${n}fr)`).join(" ")}`;
      const cab = `<div></div>` + dias.map((d) => `<div class="${diffDays(d, H) === 0 ? "hoy" : ""}">${DIAS[d.getDay()]} ${d.getDate()}${diffDays(d, H) === 0 ? " · hoy" : ""}</div>`).join("");
      const horas = `<div class="mti-hours">${Array.from({ length: HF - HI }, (_, i) => `<div>${hhmm(HI + i)}</div>`).join("")}</div>`;
      cal = `<div class="mti-cal mti-pcal"><div class="mti-cal-in"><div class="mti-cal-h" style="${plantilla}">${cab}</div><div class="mti-cal-b" style="${plantilla}">${horas}${cols}</div></div></div>`;
    } else {
      const base = ini, primero = addDays(base, -((base.getDay() + 6) % 7));
      const celdas = Array.from({ length: 42 }, (_, i) => addDays(primero, i));
      cal = `<div class="mti-month mti-pmonth">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => `<div class="h">${d}</div>`).join("")}${celdas.map((d) => {
        const del = P.filter((p) => +p.dia === +d).sort((a, b) => a.h1 - b.h1);
        return `<div class="d ${d.getMonth() !== base.getMonth() ? "out" : ""} ${diffDays(d, H) === 0 ? "hoy" : ""}">${d.getDate()}${del.map((p) => `<div class="mti-pchip ${p.c.status === "Ejecutada" ? "ejec" : p.c.status === "En ejecución" ? "curso" : "prog"} ${p.conflicto ? "conf" : ""}" data-psel="${esc(p.c.name)}" title="${esc(codigo(p.c) + " · " + p.c.organization)}">${esc(p.l.prog_hora_inicio || hhmm(p.h1))} ${p.conflicto ? "⚠ " : ""}${esc(p.equipo)} · ${esc(p.c.organization || "")}</div>`).join("")}</div>`;
      }).join("")}</div>`;
    }
    const rango = mes ? `${MESES_L[ini.getMonth()]} ${ini.getFullYear()}` : `${ini.getDate()} ${MESES[ini.getMonth()]} – ${fin.getDate()} ${MESES[fin.getMonth()]}`;
    const porProg = C.filter((c) => c.status === "Enviada a Logística").sort((a, b) => (parseD(a.mti_fecha_solicitada) || 0) - (parseD(b.mti_fecha_solicitada) || 0));
    const kp = [
      ["Por programar", porProg.length, "pink"],
      ["Programadas", C.filter((c) => c.status === "Programada").length],
      ["En ejecución", C.filter((c) => c.status === "En ejecución").length],
      ["Ejecutadas este mes", C.filter((c) => { const e = parseD(c.mti_fecha_ejecucion); return c.status === "Ejecutada" && e && e.getMonth() === H.getMonth() && e.getFullYear() === H.getFullYear(); }).length],
    ];
    const conflictos = [...new Set(enRango.filter((p) => p.conflicto).map((p) => `${p.equipo} (${dm(p.dia)})`))];
    const tarjetas = porProg.map((c) => `<div class="mti-pp ${S.prog.sel === c.name ? "sel" : ""}" data-psel="${esc(c.name)}">
        <div class="h"><span class="mti-code">${esc(codigo(c))}</span><b>${esc(c.organization)}</b><span class="f">${c.mti_fecha_solicitada ? "📅 " + dm(c.mti_fecha_solicitada) + " " + esc(c.mti_hora_solicitada || "") : ""}</span></div>
        <div class="s">${esc(c.mti_servicio || "")} · ${esc((c.lineas || []).map(lineaCorta).join(" + "))}</div>
        <div class="s">📍 ${esc(c.mti_ubicacion || "—")}</div>
        ${es("logistica") ? `<button class="mti-btn sm navy" data-programar="${esc(c.name)}">Programar</button>` : ""}
      </div>`).join("") || `<div class="mti-muted" style="padding:6px 2px">No hay servicios pendientes de programar.</div>`;
    return `
      <div class="mti-head">
        <h1 class="mti-h1">Programación de trabajos</h1>
        <div class="mti-weeknav"><button class="mti-btn" data-pnav="-1">‹</button><button class="mti-btn rango" data-pnav="0">${rango}</button><button class="mti-btn" data-pnav="1">›</button></div>
        <div class="mti-seg"><a href="javascript:void(0)" data-pmodo="semana" class="${!mes ? "on" : ""}">Semana</a><a href="javascript:void(0)" data-pmodo="mes" class="${mes ? "on" : ""}">Mes</a></div>
      </div>
      <div class="mti-kpis">${kp.map(([t, n, x]) => `<div class="mti-card mti-kpi static ${x || ""}"><div class="t">${t}</div><div class="n">${n}</div></div>`).join("")}</div>
      ${conflictos.length ? `<div class="mti-banner lost">⚠ Equipo programado dos veces a la misma hora: <b>${esc(conflictos.join(", "))}</b>. Revisa los bloques marcados.</div>` : ""}
      <div class="mti-pgrid">
        <div>
          <div class="mti-card mti-ppwrap"><div class="mti-sec-t" style="font-size:15px">Por programar <span class="mti-badge">${porProg.length}</span></div><div class="mti-pplist">${tarjetas}</div></div>
          <div class="mti-card" style="padding:6px">${cal}</div>
          <div class="mti-chips"><span class="mti-chip bar-prog">programado</span><span class="mti-chip bar-curso">en ejecución</span><span class="mti-chip bar-ejec">ejecutado</span><span class="mti-chip bar-conf">⚠ mismo equipo a la misma hora</span></div>
        </div>
        <div>${panelProg()}</div>
      </div>`;
  }

  function panelProg() {
    const c = S.data.cotizaciones.find((x) => x.name === S.prog.sel);
    if (!c) return `<div class="mti-card mti-panel"><div class="mti-muted">Selecciona un servicio del calendario o de “Por programar” para ver su ficha de trabajo.</div></div>`;
    const L = es("logistica");
    const lineas = (c.lineas || []).map((l) => `<div class="mti-pl"><b>${esc(l.equipo || l.descripcion || "")}</b><span>${esc(l.modalidad === "Global" ? "Servicio global" : num(l.cantidad) + " " + unidad(l.modalidad, l.cantidad) + " · " + (l.horas_jornada || "") + " h " + (l.jornada || "").toLowerCase())}</span>
      ${l.prog_desde ? `<span class="ok">📅 ${dm(l.prog_desde)}${l.prog_hasta && l.prog_hasta !== l.prog_desde ? "–" + dm(l.prog_hasta) : ""} · ${esc(l.prog_hora_inicio || "")}${l.prog_hora_fin ? "–" + esc(l.prog_hora_fin) : ""} · ${esc(l.prog_dias || "")}${l.prog_operador ? " · 👷 " + esc(l.prog_operador) : ""}</span>` : `<span class="mti-muted">Sin programar</span>`}</div>`).join("");
    const acts = [];
    if (L && c.status === "Enviada a Logística") acts.push(`<button class="mti-btn navy" data-programar="${esc(c.name)}">Programar</button>`);
    if (L && ["Programada", "En ejecución"].includes(c.status)) acts.push(`<button class="mti-btn" data-programar="${esc(c.name)}">${c.status === "Programada" ? "Reprogramar / editar" : "Editar programación"}</button>`);
    if (L && c.status === "Programada") acts.push(`<button class="mti-btn navy" data-pact="iniciar" data-n="${esc(c.name)}">▶ Iniciar ejecución</button>`);
    if (L && ["Programada", "En ejecución"].includes(c.status)) acts.push(`<button class="mti-btn ok" data-pact="ejecutar" data-n="${esc(c.name)}">✓ Marcar ejecutado</button>`);
    if (L && ["Enviada a Logística", "Programada"].includes(c.status)) acts.push(`<button class="mti-btn ko" data-pact="cancelar" data-n="${esc(c.name)}">Cancelar</button>`);
    return `<div class="mti-card mti-panel">
      <div class="mti-row" style="justify-content:space-between"><span class="mti-code">${esc(codigo(c))}</span>${pill(c.status)}</div>
      <p class="ttl" style="margin-top:6px">${esc(c.organization)}</p>
      <div class="mti-kv">
        <div><span>Servicio</span><b>${esc(c.mti_servicio || "—")}</b></div>
        <div><span>Fecha solicitada</span><b>${c.mti_fecha_solicitada ? dmy(c.mti_fecha_solicitada) : "—"} ${esc(c.mti_hora_solicitada || "")}</b></div>
        <div><span>Dirección</span><b>${esc(c.mti_ubicacion || "—")}</b></div>
        <div><span>Contacto en sitio</span><b>${esc(c.mti_contacto_sitio || "—")}${c.mti_tel_sitio ? " · " + esc(c.mti_tel_sitio) : ""}</b></div>
        ${c.mti_notas_logistica ? `<div><span>Notas</span><b>${esc(c.mti_notas_logistica)}</b></div>` : ""}
        ${c.mti_fecha_ejecucion ? `<div><span>Ejecutado</span><b>${dmy(c.mti_fecha_ejecucion)}</b></div>` : ""}
      </div>
      <div class="mti-sec-t" style="font-size:14px;margin:12px 0 6px">Equipos</div>
      ${lineas || `<div class="mti-muted">Sin líneas</div>`}
      <div class="mti-row" style="margin-top:14px">${acts.join("")}</div>
      <div class="mti-row" style="margin-top:12px">
        <a class="mti-btn" href="#/cotizacion/${encodeURIComponent(c.name)}">📄 Ver ficha técnica</a>
        ${(es("logistica") || es("comercial")) && ["Programada", "En ejecución", "Ejecutada"].includes(c.status) ? `<a class="mti-btn" href="#/cotizacion/${encodeURIComponent(c.name)}/adicionales">＋ Agregar adicionales</a>` : ""}
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ HISTÓRICOS
  function vHistoricos() {
    const H = hoy(), h = S.hist;
    const anio = h.anio || String(H.getFullYear());
    const anios = aniosDisponibles();
    const coincide = (c) => (!h.cliente || c.organization === h.cliente) && (!h.servicio || c.mti_servicio === h.servicio) && (!h.equipo || (c.lineas || []).some((l) => l.equipo === h.equipo));
    // Con desglose registrado, el valor de cada equipo sale del desglose; si no, de las líneas de la oferta
    const valorDe = (c) => {
      if (!h.equipo) return c.valor_final || c.deal_value || 0;
      if ((c.desglose || []).length) return c.desglose.filter((r) => r.concepto === h.equipo).reduce((t, r) => t + (r.valor || 0), 0);
      return (c.lineas || []).filter((l) => l.equipo === h.equipo).reduce((t, l) => t + (l.valor_total || 0), 0)
        + (c.adicionales || []).filter((a) => a.linea === h.equipo).reduce((t, a) => t + (a.valor || 0), 0);
    };
    const ejec = S.data.cotizaciones.filter((c) => c.status === "Ejecutada" && c.mti_fecha_ejecucion && String(parseD(c.mti_fecha_ejecucion).getFullYear()) === anio && coincide(c));
    const conDg = ejec.filter((c) => (c.desglose || []).length).length;
    const total = ejec.reduce((s, c) => s + valorDe(c), 0);
    const totalAd = ejec.reduce((t, c) => t + (+c.mti_valor_adicionales || 0), 0);
    const calif = ejec.map((c) => +c.mti_cal_promedio || 0).filter((n) => n > 0);
    const califProm = calif.length ? (calif.reduce((t, n) => t + n, 0) / calif.length).toFixed(1).replace(".", ",") : "—";
    const enviadas = S.data.cotizaciones.filter((c) => c.mti_fecha_envio || GANADAS.includes(c.status) || ["Perdida", "Cancelada"].includes(c.status)).filter((c) => String(anioDe(c)) === anio && coincide(c));
    const ganadas = enviadas.filter((c) => GANADAS.includes(c.status)).length, perdidas = enviadas.filter((c) => ["Perdida", "Cancelada"].includes(c.status)).length;
    const tasa = ganadas + perdidas ? Math.round((100 * ganadas) / (ganadas + perdidas)) : 0;
    const porMes = Array.from({ length: 12 }, (_, m) => {
      const L = ejec.filter((c) => parseD(c.mti_fecha_ejecucion).getMonth() === m);
      const eqs = {};
      L.forEach((c) => (c.lineas || []).forEach((l) => { if (l.equipo) eqs[l.equipo] = (eqs[l.equipo] || 0) + 1; }));
      const top = Object.entries(eqs).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]).join(", ");
      return { m, n: L.length, v: L.reduce((s, c) => s + valorDe(c), 0), top };
    });
    const maxV = Math.max(1, ...porMes.map((x) => x.v));
    const filasMes = porMes.map((x) => {
      const futuro = String(H.getFullYear()) === anio && x.m > H.getMonth();
      return `<tr class="${h.mes === x.m ? "on" : ""} ${futuro ? "fut" : ""}" data-hmes="${x.m}"><td>${MESES_L[x.m]}</td><td class="mti-num">${x.n || (futuro ? "" : "0")}</td><td class="mti-num">${x.v ? money(x.v) : futuro ? "" : "$ 0"}</td><td class="barra"><div style="width:${(100 * x.v) / maxV}%"></div></td><td class="mti-muted sm">${esc(x.top)}</td></tr>`;
    }).join("");
    const porEq = {};
    ejec.forEach((c) => {
      const usaDg = (c.desglose || []).length > 0;
      (c.lineas || []).forEach((l) => {
        const k = l.equipo || (l.tipo === "Otro" ? "Otros servicios" : l.descripcion) || "—";
        if (h.equipo && k !== h.equipo) return;
        const e = (porEq[k] = porEq[k] || { n: new Set(), v: 0, uso: {} });
        e.n.add(c.name);
        if (!usaDg) e.v += l.valor_total || 0;
        if (l.modalidad !== "Global") e.uso[l.modalidad] = (e.uso[l.modalidad] || 0) + (l.cantidad || 0);
      });
      if (!usaDg) (c.adicionales || []).forEach((a) => {
        const k = a.linea || "—";
        if (h.equipo && k !== h.equipo) return;
        const e = (porEq[k] = porEq[k] || { n: new Set(), v: 0, uso: {} });
        e.n.add(c.name); e.v += a.valor || 0;
      });
      if (usaDg) c.desglose.forEach((r) => {
        const k = r.concepto || "—";
        if (h.equipo && k !== h.equipo) return;
        const e = (porEq[k] = porEq[k] || { n: new Set(), v: 0, uso: {} });
        e.n.add(c.name); e.v += r.valor || 0;
      });
    });
    const filasEq = Object.entries(porEq).sort((a, b) => b[1].v - a[1].v).map(([k, e]) => `<tr data-heq="${esc(k)}" class="${h.equipo === k ? "on" : ""}"><td><b>${esc(k)}</b></td><td class="mti-num">${e.n.size}</td><td class="mti-muted sm">${MODALIDADES.filter((m) => e.uso[m]).map((m) => num(e.uso[m]) + " " + unidad(m, e.uso[m])).join(" · ") || "—"}</td><td class="mti-num">${money0(e.v)}</td></tr>`).join("");
    const porCli = {};
    ejec.forEach((c) => { const e = (porCli[c.organization] = porCli[c.organization] || { n: 0, v: 0, ult: null }); e.n++; e.v += valorDe(c); const d = parseD(c.mti_fecha_ejecucion); if (!e.ult || d > e.ult) e.ult = d; });
    const filasCli = Object.entries(porCli).sort((a, b) => b[1].v - a[1].v).map(([k, e]) => `<tr data-hcli="${esc(k)}" class="${h.cliente === k ? "on" : ""}"><td><b>${esc(k)}</b></td><td class="mti-num">${e.n}</td><td class="mti-num">${money0(e.v)}</td><td class="mti-muted">${dm(e.ult)}</td></tr>`).join("");
    const lista = (h.mes != null ? ejec.filter((c) => parseD(c.mti_fecha_ejecucion).getMonth() === h.mes) : ejec).sort((a, b) => parseD(b.mti_fecha_ejecucion) - parseD(a.mti_fecha_ejecucion));
    const dgTxt = (c) => (c.desglose || []).length ? c.desglose.map((r) => `${esc(r.concepto)} ${money(r.valor) || "$ 0"}`).join(" · ") : `<span class="mti-ko">pendiente</span>`;
    const filasL = lista.map((c) => `<tr data-open="${esc(c.name)}"><td>${dmy(c.mti_fecha_ejecucion)}</td><td class="mti-code">${esc(codigo(c))}</td><td>${esc(c.organization)}</td><td>${esc(c.mti_servicio || "")}</td><td class="mti-eq">${esc(c.mti_equipo || "")}</td><td class="mti-eq">${dgTxt(c)}</td><td class="mti-num">${money0(valorDe(c))}</td></tr>`).join("");
    const chip = (k, t) => (h[k] ? `<span class="mti-fchip">${esc(t)}: <b>${esc(h[k])}</b><a href="javascript:void(0)" data-hclr="${k}">✕</a></span>` : "");
    return `
      <div class="mti-head"><h1 class="mti-h1">Históricos de trabajos ejecutados</h1>
        <button class="mti-btn" data-act="csv">⬇ Exportar CSV</button></div>
      <div class="mti-filters">
        <div class="mti-field sm"><label class="mti-lbl">Año</label><select class="mti-sel" id="h-anio">${opts(anios, anio)}</select></div>
        <div class="mti-field"><label class="mti-lbl">Equipo</label><select class="mti-sel" id="h-equipo">${opts(equiposNombres(), h.equipo, "Todos")}</select></div>
        <div class="mti-field"><label class="mti-lbl">Cliente</label><select class="mti-sel" id="h-cliente">${opts(clientesNombres(), h.cliente, "Todos")}</select></div>
        <div class="mti-field"><label class="mti-lbl">Servicio</label><select class="mti-sel" id="h-servicio">${opts(serviciosNombres(), h.servicio, "Todos")}</select></div>
        <div class="mti-fchips">${chip("equipo", "Equipo")}${chip("cliente", "Cliente")}${chip("servicio", "Servicio")}</div>
      </div>
      <div class="mti-kpis">
        <div class="mti-card mti-kpi static"><div class="t">Trabajos ejecutados ${anio}</div><div class="n">${ejec.length}</div></div>
        <div class="mti-card mti-kpi static"><div class="t">Valor consolidado ${h.equipo ? "(" + esc(h.equipo) + ")" : ""}</div><div class="n money">${money0(total)}</div><div class="mti-muted sm">antes de IVA · incluye ${money0(totalAd)} de adicionales</div></div>
        <div class="mti-card mti-kpi static"><div class="t">Promedio por trabajo</div><div class="n money">${money0(ejec.length ? total / ejec.length : 0)}</div></div>
        <div class="mti-card mti-kpi static"><div class="t">Tasa de aprobación ${anio}</div><div class="n">${tasa} %</div><div class="mti-muted sm">${ganadas} aprobadas · ${perdidas} perdidas o canceladas</div></div>
        <div class="mti-card mti-kpi static"><div class="t">Satisfacción de clientes</div><div class="n">${califProm}${calif.length ? '<span class="mti-muted sm"> / 10</span>' : ""}</div><div class="mti-muted sm">${calif.length} de ${ejec.length} trabajos calificados</div></div>
      </div>
      <div class="mti-hgrid">
        <div class="mti-card mti-table-wrap"><div class="mti-card-h"><span>Mes a mes</span><span class="mti-hint">Clic en un mes para ver sus trabajos</span></div>
          <table class="mti-table compact"><thead><tr><th>Mes</th><th class="mti-num">Trabajos</th><th class="mti-num">Valor</th><th style="width:28%"></th><th>Equipos más usados</th></tr></thead><tbody>${filasMes}</tbody>
          <tfoot><tr><td><b>Total</b></td><td class="mti-num"><b>${ejec.length}</b></td><td class="mti-num"><b>${money0(total)}</b></td><td colspan="2"></td></tr></tfoot></table></div>
        <div>
          <div class="mti-card mti-table-wrap"><div class="mti-card-h"><span>Por equipo</span><span class="mti-hint" title="Los trabajos sin desglose usan los valores de la oferta">${conDg} de ${ejec.length} con desglose de precio</span></div>
            <table class="mti-table compact"><thead><tr><th>Equipo</th><th class="mti-num">Trabajos</th><th>Uso</th><th class="mti-num">Valor</th></tr></thead><tbody>${filasEq || `<tr><td colspan="4" class="mti-empty sm">Sin datos</td></tr>`}</tbody></table></div>
          <div class="mti-card mti-table-wrap" style="margin-top:16px"><div class="mti-card-h"><span>Por cliente</span></div>
            <table class="mti-table compact"><thead><tr><th>Cliente</th><th class="mti-num">Trabajos</th><th class="mti-num">Valor</th><th>Último</th></tr></thead><tbody>${filasCli || `<tr><td colspan="4" class="mti-empty sm">Sin datos</td></tr>`}</tbody></table></div>
        </div>
      </div>
      <div class="mti-card mti-table-wrap" style="margin-top:18px"><div class="mti-card-h"><span>Trabajos ejecutados ${h.mes != null ? "en " + MESES_L[h.mes] : anio} (${lista.length})</span>${h.mes != null ? `<a class="mti-link" href="javascript:void(0)" data-hmes="">Ver todo el año</a>` : ""}</div>
        <table class="mti-table compact"><thead><tr><th>Fecha</th><th>Oferta</th><th>Cliente</th><th>Servicio</th><th>Equipos</th><th>Desglose del precio</th><th class="mti-num">Valor</th></tr></thead><tbody>${filasL || `<tr><td colspan="7" class="mti-empty sm">Sin trabajos ejecutados con estos filtros.</td></tr>`}</tbody></table></div>`;
  }
  function exportarCSV() {
    const h = S.hist, anio = h.anio || String(hoy().getFullYear());
    const filas = S.data.cotizaciones.filter((c) => c.status === "Ejecutada" && c.mti_fecha_ejecucion && String(parseD(c.mti_fecha_ejecucion).getFullYear()) === anio)
      .filter((c) => (!h.cliente || c.organization === h.cliente) && (!h.servicio || c.mti_servicio === h.servicio) && (!h.equipo || (c.lineas || []).some((l) => l.equipo === h.equipo)));
    const q = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
    const csv = ["Fecha ejecución;Oferta;Cliente;Servicio;Equipos;Modalidades;Desglose del precio;Valor aprobado;Adicionales;Valor final antes de IVA;Calificación cliente"].concat(filas.map((c) => [dmy(c.mti_fecha_ejecucion), codigo(c), c.organization, c.mti_servicio, c.mti_equipo, (c.lineas || []).map(lineaCorta).join(" + "),
      (c.desglose || []).map((r) => `${r.concepto}: ${Math.round(r.valor || 0)}`).join(" | "), Math.round(c.deal_value || 0), Math.round(+c.mti_valor_adicionales || 0),
      Math.round(c.valor_final || c.deal_value || 0), c.mti_cal_promedio ? String(c.mti_cal_promedio).replace(".", ",") : ""].map(q).join(";"))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `mti-trabajos-ejecutados-${anio}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Exportación de clientes (solo Proyectos, Gerencia y administrador)
  function exportarClientes() {
    if (!verTodo()) return toast("Tu perfil no permite exportar clientes", true);
    const st = {};
    S.data.cotizaciones.forEach((c) => {
      const x = (st[c.organization] = st[c.organization] || { n: 0, abiertas: 0, ejecutadas: 0, ejec: 0, ult: null, cal: [] });
      x.n++;
      if (!CERRADAS.includes(c.status)) x.abiertas++;
      if (c.status === "Ejecutada") { x.ejecutadas++; x.ejec += c.valor_final || c.deal_value || 0; if (+c.mti_cal_promedio) x.cal.push(+c.mti_cal_promedio); }
      const f = c.mti_fecha_envio || c.creation;
      if (f && (!x.ult || String(f) > String(x.ult))) x.ult = f;
    });
    const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const csv = ["Cliente;NIT;Dirección;Contacto;Teléfono;Correo;Ofertas;Abiertas;Ejecutadas;Valor ejecutado;Calificación promedio;Última oferta"]
      .concat((S.data.clientes || []).map((c) => {
        const x = st[c.name] || { n: 0, abiertas: 0, ejecutadas: 0, ejec: 0, ult: null, cal: [] };
        return [c.name, c.mti_nit, c.mti_direccion, c.mti_contacto, c.mti_telefono, c.mti_email, x.n, x.abiertas, x.ejecutadas, Math.round(x.ejec),
          x.cal.length ? (x.cal.reduce((t, n) => t + n, 0) / x.cal.length).toFixed(1).replace(".", ",") : "", x.ult ? dmy(x.ult) : ""].map(q).join(";");
      })).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `mti-clientes-${ymd(hoy())}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ------------------------------------------------------------------ BUSCAR TRABAJOS (búsqueda técnica)
  function filasBusqueda() {
    const b = S.busq, q = b.q.toLowerCase().trim();
    const rango = (v, mn, mx) => { const x = v || 0; if (mn !== "" && x < parseNum(mn)) return false; if (mx !== "" && x > parseNum(mx)) return false; return true; };
    const out = [];
    S.data.cotizaciones.forEach((c) => {
      if (b.cliente && c.organization !== b.cliente) return;
      if (b.servicio && c.mti_servicio !== b.servicio) return;
      if (b.anio && String(anioDe(c)) !== b.anio) return;
      if (b.modalidad && !(c.lineas || []).some((l) => l.modalidad === b.modalidad)) return;
      if (b.estado === "ejecutadas" && c.status !== "Ejecutada") return;
      if (b.estado === "aprobadas" && !GANADAS.includes(c.status)) return;
      if (b.estado === "enviadas" && !ABIERTAS.includes(c.status) && c.status !== "En modificación") return;
      if (b.estado === "perdidas" && !["Perdida", "Cancelada"].includes(c.status)) return;
      const trabajos = (c.trabajos || []).length ? c.trabajos : [{ descripcion: c.mti_servicio, equipo: "", altura: c.mti_altura, radio: c.mti_radio, peso: c.mti_peso, especificaciones: "" }];
      trabajos.forEach((t) => {
        const eqT = t.equipo || "";
        if (b.equipo && eqT !== b.equipo && !(c.lineas || []).some((l) => l.equipo === b.equipo)) return;
        if (!rango(t.altura, b.amin, b.amax) || !rango(t.radio, b.rmin, b.rmax) || !rango(t.peso, b.pmin, b.pmax)) return;
        if (q) {
          const txt = `${codigo(c)} ${c.organization} ${c.mti_servicio} ${t.descripcion} ${t.especificaciones} ${eqT} ${c.mti_equipo} ${c.mti_restricciones} ${c.mti_observaciones} ${c.mti_ubicacion}`.toLowerCase();
          if (!q.split(/\s+/).every((w) => txt.includes(w))) return;
        }
        if (b.ref && b.ref.name === c.name && b.ref.idx === t.idx) return;
        out.push({ c, t });
      });
    });
    return out.sort((a, b) => (parseD(b.c.mti_fecha_ejecucion || b.c.mti_fecha_envio || b.c.creation) || 0) - (parseD(a.c.mti_fecha_ejecucion || a.c.mti_fecha_envio || a.c.creation) || 0));
  }
  function vBuscar() {
    const b = S.busq;
    const R = filasBusqueda();
    const ofertas = new Set(R.map((r) => r.c.name)).size;
    const filas = R.slice(0, 300).map(({ c, t }) => {
      const mods = [...new Set((c.lineas || []).map((l) => l.modalidad))].join(", ");
      return `<tr data-open="${esc(c.name)}">
        <td class="mti-code">${esc(codigo(c))}</td><td>${dm(c.mti_fecha_ejecucion || c.mti_fecha_envio || c.creation)}<small class="mti-muted"> ${anioDe(c) || ""}</small></td>
        <td>${esc(c.organization)}</td><td class="mti-trtxt">${esc(t.descripcion || "—")}${t.especificaciones ? `<small>${esc(t.especificaciones)}</small>` : ""}</td>
        <td class="mti-eq">${esc(t.equipo || c.mti_equipo || "—")}</td><td class="mti-num">${t.altura ? num(t.altura) + " m" : "—"}</td><td class="mti-num">${t.radio ? num(t.radio) + " m" : "—"}</td><td class="mti-num">${t.peso ? num(t.peso) + " t" : "—"}</td>
        <td>${esc(mods)}</td><td class="mti-num">${money(c.deal_value) || "—"}</td><td>${pill(c.status)}</td></tr>`;
    }).join("");
    const inp = (id, k, ph, w) => `<input class="mti-in" id="${id}" data-b="${k}" value="${esc(b[k])}" placeholder="${ph}" inputmode="decimal" style="width:${w || 76}px">`;
    return `
      <div class="mti-head"><h1 class="mti-h1">Buscar trabajos</h1><span class="mti-muted">Encuentra cotizaciones de trabajos parecidos por parámetros técnicos</span></div>
      ${b.ref ? `<div class="mti-banner mod">Trabajos parecidos a <b>${esc(b.ref.codigo)}</b> · ${esc(b.ref.texto)} (±25 %) <a href="javascript:void(0)" class="mti-link" data-act="limpiar-b" style="margin-left:10px">Quitar filtros</a></div>` : ""}
      <div class="mti-card mti-bfil">
        <div class="mti-field grow"><label class="mti-lbl">Texto (trabajo, especificaciones, lugar…)</label><input class="mti-in" id="b-q" data-b="q" value="${esc(b.q)}" placeholder="Ej. chimenea, transformador, cubierta…"></div>
        <div class="mti-field"><label class="mti-lbl">Cliente</label><select class="mti-sel" data-b="cliente" id="b-cli">${opts(clientesNombres(), b.cliente, "Todos")}</select></div>
        <div class="mti-field sm"><label class="mti-lbl">Año</label><select class="mti-sel" data-b="anio" id="b-anio">${opts(aniosDisponibles(), b.anio, "Todos")}</select></div>
        <div class="mti-field"><label class="mti-lbl">Equipo</label><select class="mti-sel" data-b="equipo" id="b-eq">${opts(equiposNombres(), b.equipo, "Todos")}</select></div>
        <div class="mti-field"><label class="mti-lbl">Servicio</label><select class="mti-sel" data-b="servicio" id="b-srv">${opts(serviciosNombres(), b.servicio, "Todos")}</select></div>
        <div class="mti-field sm"><label class="mti-lbl">Modalidad</label><select class="mti-sel" data-b="modalidad" id="b-mod">${opts(MODALIDADES, b.modalidad, "Todas")}</select></div>
        <div class="mti-field"><label class="mti-lbl">Estado</label><select class="mti-sel" data-b="estado" id="b-est">${opts([{ v: "ejecutadas", t: "Ejecutadas" }, { v: "aprobadas", t: "Aprobadas y en curso" }, { v: "enviadas", t: "Enviadas / en negociación" }, { v: "perdidas", t: "Perdidas o canceladas" }], b.estado, "Todas")}</select></div>
        <div class="mti-rng"><label class="mti-lbl">Altura (m)</label><div>${inp("b-amin", "amin", "mín")}–${inp("b-amax", "amax", "máx")}</div></div>
        <div class="mti-rng"><label class="mti-lbl">Radio (m)</label><div>${inp("b-rmin", "rmin", "mín")}–${inp("b-rmax", "rmax", "máx")}</div></div>
        <div class="mti-rng"><label class="mti-lbl">Peso (t)</label><div>${inp("b-pmin", "pmin", "mín")}–${inp("b-pmax", "pmax", "máx")}</div></div>
        <button class="mti-btn" data-act="limpiar-b">Limpiar</button>
      </div>
      <div class="mti-muted" style="margin:12px 2px">${R.length} trabajo${R.length === 1 ? "" : "s"} en ${ofertas} oferta${ofertas === 1 ? "" : "s"}${R.length > 300 ? " (se muestran 300)" : ""}
        ${hayAnteriores() ? ` · busca en las ofertas desde ${anioDesde()} <a href="javascript:void(0)" class="mti-link" data-act="b-anteriores" style="margin-left:6px">Buscar también en años anteriores (desde ${S.data.primerAnio})</a>` : ""}</div>
      <div class="mti-card mti-table-wrap"><table class="mti-table compact"><thead><tr><th>Oferta</th><th>Fecha</th><th>Cliente</th><th>Trabajo</th><th>Equipo</th><th class="mti-num">Altura</th><th class="mti-num">Radio</th><th class="mti-num">Peso</th><th>Modalidad</th><th class="mti-num">Valor oferta</th><th>Estado</th></tr></thead>
      <tbody>${filas || `<tr><td colspan="11" class="mti-empty">No hay trabajos con estos parámetros. Prueba ampliando los rangos.</td></tr>`}</tbody></table></div>`;
  }
  function buscarSimilares(f) {
    const t = (S.edit && S.edit.trabajos.find((x) => x.altura || x.radio || x.peso)) || (f.trabajos || [])[0] || {};
    const r = (v) => (v ? [String(Math.round(v * 0.75 * 10) / 10).replace(".", ","), String(Math.round(v * 1.25 * 10) / 10).replace(".", ",")] : ["", ""]);
    const [amin, amax] = r(t.altura), [rmin, rmax] = r(t.radio), [pmin, pmax] = r(t.peso);
    const partes = [t.altura ? `altura ${num(t.altura)} m` : "", t.radio ? `radio ${num(t.radio)} m` : "", t.peso ? `peso ${num(t.peso)} t` : ""].filter(Boolean);
    S.busq = { q: "", cliente: "", anio: "", equipo: "", servicio: "", modalidad: "", estado: "", amin, amax, rmin, rmax, pmin, pmax,
      ref: { name: f.name, idx: t.idx, codigo: codigo(f), texto: partes.join(", ") || "sin datos técnicos" } };
    location.hash = "#/buscar";
    // los trabajos parecidos se buscan en todo el historial
    if (hayAnteriores()) asegurarAnio(S.data.primerAnio);
  }

  // ------------------------------------------------------------------ CLIENTES (CRM Organization estándar)
  function vClientes() {
    const q = (S.cli.q || "").toLowerCase();
    const st = {};
    S.data.cotizaciones.forEach((c) => {
      const x = (st[c.organization] = st[c.organization] || { n: 0, abiertas: 0, ejec: 0, ult: null });
      x.n++;
      if (!CERRADAS.includes(c.status)) x.abiertas++;
      if (c.status === "Ejecutada") x.ejec += c.valor_final || c.deal_value || 0;
      const f = c.mti_fecha_envio || c.creation;
      if (f && (!x.ult || String(f) > String(x.ult))) x.ult = f;
    });
    const lista = (S.data.clientes || []).filter((c) => !q || `${c.name} ${c.mti_nit || ""} ${c.mti_contacto || ""} ${c.mti_email || ""}`.toLowerCase().includes(q));
    const C = es("comercial");
    const filas = lista.map((c) => {
      const x = st[c.name] || { n: 0, abiertas: 0, ejec: 0, ult: null };
      return `<tr data-cli-ver="${esc(c.name)}">
        <td><b>${esc(c.name)}</b>${c.mti_nit ? `<div class="mti-muted sm">NIT ${esc(c.mti_nit)}</div>` : ""}</td>
        <td>${esc(c.mti_contacto || "")}${c.mti_telefono ? `<div class="mti-muted sm">${esc(c.mti_telefono)}</div>` : ""}</td>
        <td>${esc(c.mti_email || "")}</td><td>${esc(c.mti_direccion || "")}</td>
        <td class="mti-num">${x.n}${x.abiertas ? ` <span class="mti-muted sm">(${x.abiertas} abierta${x.abiertas === 1 ? "" : "s"})</span>` : ""}</td>
        ${verTodo() ? `<td class="mti-num">${money(x.ejec) || "—"}</td>` : ""}<td class="mti-muted">${x.ult ? dm(x.ult) : "—"}</td>
        <td style="text-align:right;white-space:nowrap">${C ? `<button class="mti-btn sm" data-cli-oferta="${esc(c.name)}">+ Oferta</button> <button class="mti-btn sm" data-cli="${esc(c.name)}">Editar</button>` : ""}${esAdmin() ? ` <button class="mti-btn sm ko" data-cli-del="${esc(c.name)}" title="Eliminar cliente (solo administrador)">🗑</button>` : ""}</td></tr>`;
    }).join("");
    return `
      <div class="mti-head">
        <h1 class="mti-h1">Clientes</h1>
        <input class="mti-in mti-search" id="cli-q" placeholder="Buscar cliente, NIT o contacto…" value="${esc(S.cli.q)}">
        ${C ? `<a class="mti-btn" href="/crm/data-import" target="_blank" title="Importación estándar de Frappe CRM desde Excel o CSV">Importar desde Excel ↗</a>
        <button class="mti-btn dark" data-act="cli-nuevo">+ Nuevo cliente</button>` : ""}
        ${verTodo() ? `<button class="mti-btn" data-act="cli-exportar" title="Descarga todos los clientes con sus datos y su historial en un archivo que abre Excel">⬇ Exportar clientes</button>` : ""}
      </div>
      <div class="mti-card mti-table-wrap">
        <table class="mti-table"><thead><tr><th>Cliente</th><th>Contacto</th><th>Correo</th><th>Dirección</th><th class="mti-num">Ofertas</th>${verTodo() ? '<th class="mti-num">Ejecutado</th>' : ""}<th>Última</th><th></th></tr></thead>
        <tbody>${filas || `<tr><td colspan="8" class="mti-empty">${q ? "Ningún cliente coincide con la búsqueda." : "Aún no hay clientes. Créalos con <b>+ Nuevo cliente</b> o impórtalos desde Excel."}</td></tr>`}</tbody></table>
      </div>
      <p class="mti-muted sm" style="margin:12px 4px 0">${lista.length} cliente${lista.length === 1 ? "" : "s"} · Los clientes son las Organizaciones estándar de Frappe CRM: también se ven y editan en el CRM. Clic en un cliente para ver sus ofertas.
        ${hayAnteriores() ? `<br>Ofertas y última fecha contadas desde ${anioDesde()} (las de años anteriores se cargan al elegir ese año en Históricos o Buscar).` : ""}</p>`;
  }
  function modalClienteNuevo() {
    modal("Nuevo cliente", `
      <div class="mti-field"><label class="mti-lbl">Nombre o razón social *</label><input class="mti-in" id="cn-nombre" placeholder="Ej. Constructora Andina SAS"></div>
      ${camposCliente("cn")}`,
    [{ t: "Cancelar" }, { t: "Crear cliente", cls: "dark", fn: async (m) => {
      const nombre = val(m, "#cn-nombre");
      if (!nombre) { toast("Escribe el nombre del cliente", true); return false; }
      await accion({ accion: "cliente_nuevo", nombre, valores: leerCliente(m, "cn") }, `Cliente “${nombre}” creado`);
    } }]);
  }
  function modalEliminarCliente(nombre) {
    const n = S.data.cotizaciones.filter((c) => c.organization === nombre).length;
    modal("Eliminar cliente", `
      <div class="mti-banner lost" style="margin:0 0 12px">Se borrará el cliente <b>${esc(nombre)}</b>${n ? "" : " de la lista de clientes del CRM"}.</div>
      ${n ? `<p style="margin:0 0 12px">Este cliente tiene <b>${n} oferta${n === 1 ? "" : "s"}</b> registrada${n === 1 ? "" : "s"}. Para no perder el historial, Frappe no deja borrar un cliente con ofertas: elimina antes sus ofertas o déjalo como está.</p>`
        : `<p class="mti-muted sm" style="margin:0 0 12px">Solo se pueden eliminar clientes sin ofertas (también se revisan los años anteriores). Si fue un error, el administrador puede recuperarlo en <b>Frappe → Documentos eliminados</b> (<code>/app/deleted-document</code>).</p>
      <label class="mti-check" style="margin:0 0 12px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="dc-contactos" checked> Eliminar también sus contactos</label>
      <div class="mti-field"><label class="mti-lbl">Para confirmar, escribe <b>ELIMINAR</b></label><input class="mti-in" id="dc-conf" autocomplete="off"></div>`}`,
    n ? [{ t: "Cerrar" }] : [{ t: "Cancelar" }, { t: "🗑 Eliminar cliente", cls: "ko", fn: async (m) => {
      const conf = val(m, "#dc-conf");
      if (conf.trim().toUpperCase() !== "ELIMINAR") { toast("Escribe ELIMINAR para confirmar", true); return false; }
      try { await ejecutar({ accion: "eliminar_cliente", name: nombre, confirmar: conf, contactos: val(m, "#dc-contactos") ? 1 : 0 }); } catch (e) { toast(e.message, true); return false; }
      S.data.clientes = (S.data.clientes || []).filter((c) => c.name !== nombre);
      toast(`Cliente “${nombre}” eliminado`);
      render();
    } }]);
  }
  function enlazarClientes(R) {
    R.querySelectorAll("[data-cli-del]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); modalEliminarCliente(b.dataset.cliDel); }));
    const q = R.querySelector("#cli-q");
    if (q) q.oninput = () => { S.cli.q = q.value; render(); };
    R.querySelectorAll("[data-act='cli-nuevo']").forEach((b) => (b.onclick = modalClienteNuevo));
    R.querySelectorAll("[data-act='cli-exportar']").forEach((b) => (b.onclick = exportarClientes));
    R.querySelectorAll("[data-cli]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); modalCliente(b.dataset.cli); }));
    R.querySelectorAll("[data-cli-oferta]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); modalNueva(b.dataset.cliOferta); }));
    R.querySelectorAll("tr[data-cli-ver]").forEach((tr) => (tr.onclick = () => {
      S.filtros = { ...S.filtros, cliente: tr.dataset.cliVer, cerradas: false, kpi: "", estado: "", q: "" };
      location.hash = "#/tablero";
    }));
  }

  // ------------------------------------------------------------------ CATÁLOGOS
  function vCatalogos() {
    const tabs = [["Equipo", "Equipos"], ["Personal", "Personal (técnicos y operadores)"], ["Servicio", "Servicios"]];
    if (!tabs.some((x) => x[0] === S.cat)) S.cat = "Equipo";
    const t = S.cat;
    let cuerpo = "";
      const lista = cat(t).slice().sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "") || a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
      const usos = {};
      S.data.cotizaciones.forEach((c) => {
        if (t === "Equipo") (c.lineas || []).forEach((l) => { if (l.equipo) usos[l.equipo] = (usos[l.equipo] || 0) + 1; });
        if (t === "Servicio" && c.mti_servicio) usos[c.mti_servicio] = (usos[c.mti_servicio] || 0) + 1;
        if (t === "Personal") { if (c.mti_tecnico) usos[c.mti_tecnico] = (usos[c.mti_tecnico] || 0) + 1; (c.lineas || []).forEach((l) => { if (l.prog_operador) usos[l.prog_operador] = (usos[l.prog_operador] || 0) + 1; }); }
      });
      const catOpts = t === "Equipo" ? CAT_EQUIPO : t === "Personal" ? CAT_PERSONAL : null;
      cuerpo = `${soloLectura() ? "" : `<div class="mti-catadd">
          <input class="mti-in" id="cat-nombre" placeholder="${t === "Equipo" ? "Ej. Grúa 60 t" : t === "Personal" ? "Nombre y apellido" : "Ej. Montaje de cubierta"}">
          ${catOpts ? `<select class="mti-sel" id="cat-cat">${opts(catOpts, catOpts[0])}</select>` : ""}
          ${t === "Equipo" ? `<input class="mti-in" id="cat-cap" placeholder="Capacidad (t)" inputmode="decimal" style="width:130px">` : ""}
          <button class="mti-btn dark" data-act="cat-add">Agregar</button></div>`}
        <table class="mti-table compact"><thead><tr><th>Nombre</th>${catOpts ? "<th>" + (t === "Equipo" ? "Tipo" : "Cargo") + "</th>" : ""}${t === "Equipo" ? `<th class="mti-num">Capacidad</th>` : ""}<th class="mti-num">Usos</th><th></th></tr></thead><tbody>
        ${lista.map((x) => `<tr><td><b>${esc(x.nombre)}</b></td>${catOpts ? `<td>${esc(x.categoria || "")}</td>` : ""}${t === "Equipo" ? `<td class="mti-num">${x.capacidad ? num(x.capacidad) + " t" : "—"}</td>` : ""}<td class="mti-num">${usos[x.nombre] || 0}</td><td style="text-align:right">${soloLectura() ? "" : `<button class="mti-btn sm ko" data-cat-del="${esc(x.name)}" data-nom="${esc(x.nombre)}">Quitar</button>`}</td></tr>`).join("") || `<tr><td colspan="5" class="mti-empty sm">Sin registros.</td></tr>`}</tbody></table>
        <p class="mti-muted sm" style="margin:10px 4px 0">También se agregan solos: si escribes un ${t === "Equipo" ? "equipo" : t === "Personal" ? "técnico u operador" : "servicio"} nuevo en una oferta, queda guardado para la próxima vez. “Quitar” lo oculta de las listas sin borrar el histórico.${t === "Equipo" ? " Los equipos son los Productos estándar de Frappe CRM." : ""}</p>`;
    return `
      <div class="mti-head"><h1 class="mti-h1">Catálogos</h1></div>
      <div class="mti-tabs">${tabs.map(([k, l]) => `<a href="javascript:void(0)" data-cat="${k}" class="${t === k ? "on" : ""}">${l}</a>`).join("")}</div>
      <div class="mti-card mti-table-wrap mti-catbox">${cuerpo}</div>`;
  }

  // ------------------------------------------------------------------ ALERTAS
  function vAlertas() {
    const H = hoy(), r = S.data.reglas;
    const A = construirAlertas();
    const areas = areasVisibles();
    if (!areas.includes(S.alArea)) S.alArea = areas.find(es) || areas[0];
    const ro = soloLectura();
    const botones = (a) => {
      const n = esc(a.c.name);
      if (ro || !es(a.area)) return `<button class="mti-btn sm" data-al="abrir" data-n="${n}">Abrir</button>`;
      if (a.tipo === "seg") return `<button class="mti-btn sm" data-al="contactar" data-n="${n}">Contactar</button><button class="mti-btn sm" data-al="posponer" data-n="${n}">Posponer 1 día</button><button class="mti-btn sm dark" data-al="registrar" data-n="${n}" data-id="${a.id}">Hecho</button>`;
      if (a.tipo === "visita") return `<button class="mti-btn sm" data-al="ver-visita" data-n="${n}">Ver visita</button>${a.c.mti_fecha_visita ? `<button class="mti-btn sm" data-al="posponer-visita" data-n="${n}" data-id="${a.id}">Posponer 1 día</button>` : ""}<button class="mti-btn sm dark" data-al="hecho" data-id="${a.id}">Hecho</button>`;
      if (a.tipo === "checklist") return `<button class="mti-btn sm" data-al="ver-visita" data-n="${n}">Completar</button><button class="mti-btn sm dark" data-al="hecho" data-id="${a.id}">Hecho</button>`;
      if (a.tipo === "programar") return `<button class="mti-btn sm" data-al="ir-prog" data-n="${n}">Abrir en Programación</button><button class="mti-btn sm dark" data-al="hecho" data-id="${a.id}">Hecho</button>`;
      return `<button class="mti-btn sm" data-al="abrir" data-n="${n}">Abrir</button><button class="mti-btn sm dark" data-al="hecho" data-id="${a.id}">Hecho</button>`;
    };
    const tarjeta = (a) => `<div class="mti-card mti-alert ${a.color}"><div class="h">${dot(a.color === "rojo" ? "Rojo" : a.color === "verde" ? "Verde" : "Amarillo")}${esc(a.t)}</div><div class="sub">${esc(a.s)}</div><div class="mti-row">${botones(a)}</div></div>`;
    const cuenta = (k) => A.filter((a) => a.area === k).length;
    const rojas = (k) => A.filter((a) => a.area === k && a.color === "rojo").length;
    const pestanas = AREAS.filter((x) => areas.includes(x[0])).map(([k, t]) =>
      `<button class="mti-atab ${S.alArea === k ? "on" : ""}" data-alarea="${k}">${t} <span class="mti-badge ${rojas(k) ? "" : "soft"}">${cuenta(k)}</span></button>`).join("");
    const area = AREAS.find((x) => x[0] === S.alArea) || AREAS[0];
    const lista = A.filter((a) => a.area === area[0]);
    const grupos = [["rojo", "Atrasadas · atender primero"], ["amarillo", "Para hoy"], ["verde", "Listas para el siguiente paso"]]
      .map(([col, tit]) => { const g = lista.filter((a) => a.color === col); return g.length ? `<div class="mti-agrupo ${col}">${tit} (${g.length})</div>${g.map(tarjeta).join("")}` : ""; }).join("")
      || `<div class="mti-card mti-empty">🎉 ${area[1]} no tiene pendientes hoy.</div>`;
    const C = es("comercial");
    return `
      <div class="mti-head"><h1 class="mti-h1">Alertas por área</h1><span class="mti-muted">${DIAS[H.getDay()].toLowerCase()} ${H.getDate()} ${MESES[H.getMonth()]}${ro ? " · solo consulta" : !es(S.alArea) ? " · consulta (otra área)" : ""}</span></div>
      <div class="mti-atabs">${pestanas}</div>
      <div class="mti-agrid">
        <div><div class="mti-aintro">${esc(area[2])}.</div>${grupos}</div>
        ${es("comercial") || ro ? `<div class="mti-card mti-panel" id="mti-reglas">
          <div class="mti-sec-t">Reglas del semáforo</div>
          <div class="mti-rule">${dot("Verde")} Verde: de 0 a <input class="mti-in" type="number" min="0" id="mti-r-v" value="${r.verde}" ${C ? "" : "disabled"}> días</div>
          <div class="mti-rule">${dot("Amarillo")} Amarillo: hasta <input class="mti-in" type="number" min="1" id="mti-r-a" value="${r.amarillo}" ${C ? "" : "disabled"}> días</div>
          <div class="mti-rule">${dot("Rojo")} Rojo: más de <span id="mti-r-txt">${r.amarillo}</span> días o contacto vencido</div>
          <div class="mti-rule">📄 Vigencia de la oferta: <input class="mti-in" type="number" min="1" id="mti-r-vig" value="${r.dias_vigencia}" ${C ? "" : "disabled"}> días</div>
          ${C ? `<button class="mti-btn dark" style="margin-top:14px" data-act="reglas">Guardar reglas</button>` : ""}
          <p class="mti-muted" style="font-size:12px;margin:12px 0 0">Las alertas también se crean como tareas asignadas en el CRM.</p>
        </div>` : ""}
      </div>`;
  }

  // ------------------------------------------------------------------ modales
  function camposCliente(prefijo, c) {
    c = c || {};
    return `<div class="mti-g2"><div class="mti-field"><label class="mti-lbl">NIT</label><input class="mti-in" id="${prefijo}-nit" value="${esc(c.mti_nit || "")}"></div>
      <div class="mti-field"><label class="mti-lbl">Contacto</label><input class="mti-in" id="${prefijo}-ct" value="${esc(c.mti_contacto || "")}" placeholder="Nombre y apellido"></div></div>
      <div class="mti-g2"><div class="mti-field"><label class="mti-lbl">Teléfono</label><input class="mti-in" id="${prefijo}-tel" value="${esc(c.mti_telefono || "")}" placeholder="310…"></div>
      <div class="mti-field"><label class="mti-lbl">Correo</label><input class="mti-in" id="${prefijo}-mail" type="email" value="${esc(c.mti_email || "")}"></div></div>
      <div class="mti-field"><label class="mti-lbl">Dirección del cliente</label><input class="mti-in" id="${prefijo}-dir" value="${esc(c.mti_direccion || "")}"></div>`;
  }
  const leerCliente = (m, p) => ({ mti_nit: val(m, `#${p}-nit`), mti_contacto: val(m, `#${p}-ct`), mti_telefono: val(m, `#${p}-tel`), mti_email: val(m, `#${p}-mail`), mti_direccion: val(m, `#${p}-dir`) });

  function modalNueva(clientePre) {
    const m = modal("Nueva oferta", `
      <div class="mti-field"><label class="mti-lbl">Cliente *</label><input class="mti-in" id="n-org" list="n-orgs" placeholder="Empresa (si ya existe, se cargan sus datos)">${datalist("n-orgs", clientesNombres())}</div>
      <div id="n-cli">${camposCliente("n")}</div>
      <div class="mti-sep"></div>
      <div class="mti-g2"><div class="mti-field"><label class="mti-lbl">Servicio</label><input class="mti-in" id="n-srv" list="n-srvs" placeholder="Ej. Izaje">${datalist("n-srvs", serviciosNombres())}</div>
      <div class="mti-field"><label class="mti-lbl">Canal de entrada</label><select class="mti-sel" id="n-src">${opts(FUENTES, "WhatsApp")}</select></div></div>
      <div class="mti-field"><label class="mti-lbl">Lugar de prestación del servicio</label><input class="mti-in" id="n-ubi" placeholder="Dirección o municipio de la obra"></div>
      <div class="mti-field"><label class="mti-lbl">Nota inicial</label><input class="mti-in" id="n-nota" placeholder="Qué pidió el cliente"></div>
      <div class="mti-tg"><label class="mti-toggle"><input type="checkbox" id="n-vis" checked><span></span></label> Requiere visita técnica</div>
      <p class="mti-muted sm" style="margin:8px 0 0">Comercial responsable: <b>${esc(S.data.nombre)}</b> (quien registra la oferta).</p>`,
    [{ t: "Cancelar" }, { t: "Crear oferta", cls: "dark", fn: async (m) => {
      const org = val(m, "#n-org");
      if (!org) { toast("El cliente es obligatorio", true); return false; }
      const r = await accion({ accion: "crear", cliente: leerCliente(m, "n"), valores: {
        organization: org, source: val(m, "#n-src"), mti_servicio: val(m, "#n-srv"), mti_ubicacion: val(m, "#n-ubi"), nota: val(m, "#n-nota"),
        mti_requiere_visita: val(m, "#n-vis"), mti_estado_visita: val(m, "#n-vis") ? "Por agendar" : "No requerida",
      } }, "Oferta creada");
      location.hash = "#/cotizacion/" + encodeURIComponent(r.name);
    } }]);
    const org = m.querySelector("#n-org");
    if (typeof clientePre === "string" && clientePre) { org.value = clientePre; setTimeout(() => org.dispatchEvent(new Event("change")), 0); }
    org.addEventListener("change", () => {
      const c = (S.data.clientes || []).find((x) => x.name === org.value.trim());
      if (!c) return;
      m.querySelector("#n-cli").innerHTML = camposCliente("n", c);
      const ubi = m.querySelector("#n-ubi");
      if (!ubi.value && c.mti_direccion) ubi.value = c.mti_direccion;
      toast("Cliente existente: datos cargados");
    });
  }

  function modalAgendar(preName) {
    const cand = S.data.cotizaciones.filter((c) => ["Solicitud recibida", "Visita técnica"].includes(c.status) || c.name === preName);
    const c0 = cand.find((c) => c.name === preName) || cand[0];
    const f0 = c0 && c0.mti_fecha_visita ? parseD(c0.mti_fecha_visita) : addDays(hoy(), 1);
    modal("Agendar visita técnica", `
      <div class="mti-field"><label class="mti-lbl">Oferta</label><select class="mti-sel" id="a-cot">${opts(cand.map((c) => ({ v: c.name, t: `${codigo(c)} · ${c.organization}` })), c0 ? c0.name : "")}</select></div>
      <div class="mti-g2"><div class="mti-field"><label class="mti-lbl">Fecha</label><input class="mti-in" type="date" id="a-fecha" value="${ymd(f0)}"></div>
      <div class="mti-field"><label class="mti-lbl">Hora</label><input class="mti-in" type="time" id="a-hora" value="${c0 && c0.mti_fecha_visita ? hm(c0.mti_fecha_visita).padStart(5, "0") : "08:00"}"></div></div>
      <div class="mti-field"><label class="mti-lbl">Técnico que realiza la visita</label><input class="mti-in" id="a-tec" list="a-tecs" value="${esc((c0 && c0.mti_tecnico) || "")}">${datalist("a-tecs", cat("Personal").filter((p) => p.categoria === "Técnico de visitas").map((p) => p.nombre))}</div>
      <div class="mti-tg"><label class="mti-toggle"><input type="checkbox" id="a-rec" checked><span></span></label> Recordarme 1 día antes</div>
`,
    [{ t: "Cancelar" }, { t: "Agendar", cls: "dark", fn: async (m) => {
      const name = val(m, "#a-cot");
      if (!name || !val(m, "#a-fecha")) { toast("Selecciona la oferta y la fecha", true); return false; }
      await accion({ accion: "agendar", name, valores: {
        mti_fecha_visita: `${val(m, "#a-fecha")} ${val(m, "#a-hora") || "08:00"}:00`, mti_tecnico: val(m, "#a-tec"),
        mti_recordar_visita: val(m, "#a-rec"),
      } }, "Visita agendada");
      S.visitaSel = name;
      const d = parseD(val(m, "#a-fecha"));
      S.semana = Math.round(diffDays(lunes(d), lunes(hoy())) / 7);
      S.modoCal = "semana";
      location.hash = "#/visitas";
      render();
    } }]);
  }

  function modalPerdida(name) {
    const c = S.data.cotizaciones.find((x) => x.name === name) || { name };
    modal(`Marcar ${codigo(c)} como perdida`, `
      <div class="mti-field"><label class="mti-lbl">Motivo *</label><select class="mti-sel" id="p-mot">${opts((S.data.motivos_perdida || []).filter((m) => m !== "Servicio cancelado por el cliente"), "", "Seleccionar motivo")}</select></div>
      <div class="mti-field"><label class="mti-lbl">Detalle</label><input class="mti-in" id="p-nota" placeholder="Ej. eligió otro proveedor por precio"></div>`,
    [{ t: "Cancelar" }, { t: "Marcar perdida", cls: "dark", fn: async (m) => {
      const motivo = val(m, "#p-mot");
      if (!motivo) { toast("Selecciona un motivo", true); return false; }
      await accion({ accion: "estado", name, estado: "Perdida", motivo, nota: val(m, "#p-nota") }, `${codigo(c)} marcada como perdida`);
    } }]);
  }

  function modalEspera(name) {
    const c = S.data.cotizaciones.find((x) => x.name === name) || { name };
    modal(`Poner ${codigo(c)} en espera`, `
      <p style="margin:0 0 10px">La oferta sale del flujo activo sin perderse. Cuando se reanude vuelve a <b>${esc(c.status || "")}</b>.</p>
      <div class="mti-field"><label class="mti-lbl">¿Por qué queda en espera? *</label><textarea class="mti-in" id="e-mot" rows="3" placeholder="Ej. el cliente aplaza la obra hasta enero por permisos"></textarea></div>
      <div class="mti-field" style="max-width:220px"><label class="mti-lbl">Retomar el (opcional)</label><input class="mti-in" type="date" id="e-ret"></div>
      <p class="mti-muted sm" style="margin:6px 0 0">Si pones fecha, ese día le llega a Comercial la alerta para retomarla.</p>`,
    [{ t: "Volver" }, { t: "Poner en espera", cls: "dark", fn: async (m) => {
      const motivo = val(m, "#e-mot");
      if (!motivo) { toast("Escribe el motivo", true); return false; }
      await accion({ accion: "espera", name, motivo, retomar: val(m, "#e-ret") }, `${codigo(c)} quedó en espera`);
    } }]);
  }

  function modalMotivo(f) {
    const espera = f.status === "En espera", perdida = f.status === "Perdida";
    const actual = espera ? f.mti_motivo_espera : f.lost_notes;
    modal(`Motivo · ${codigo(f)} (${f.status})`, `
      ${perdida ? `<div class="mti-field"><label class="mti-lbl">Motivo</label><select class="mti-sel" id="m-raz">${opts((S.data.motivos_perdida || []).filter((m) => m !== "Servicio cancelado por el cliente"), f.lost_reason || "")}</select></div>` : ""}
      <div class="mti-field"><label class="mti-lbl">${perdida ? "Detalle" : "Motivo"}</label><textarea class="mti-in" id="m-mot" rows="4">${esc(actual || "")}</textarea></div>
      ${espera ? `<div class="mti-field" style="max-width:220px"><label class="mti-lbl">Retomar el</label><input class="mti-in" type="date" id="m-ret" value="${esc(f.mti_retomar_el || "")}"></div>` : ""}`,
    [{ t: "Cancelar" }, { t: "Guardar", cls: "dark", fn: async (m) => {
      const datos = { accion: "motivo", name: f.name, motivo: val(m, "#m-mot") };
      if (perdida) datos.razon = val(m, "#m-raz");
      if (espera) datos.retomar = val(m, "#m-ret");
      await accion(datos, "Motivo actualizado");
    } }]);
  }

  function modalCancelar(name) {
    const c = S.data.cotizaciones.find((x) => x.name === name) || { name };
    modal(`Cancelar el servicio ${codigo(c)}`, `
      <p style="margin:0 0 10px">El cliente había aprobado la oferta. Se marca como <b>Cancelada</b> y se cierran las tareas pendientes.</p>
      <div class="mti-field"><label class="mti-lbl">Motivo *</label><input class="mti-in" id="c-mot" placeholder="Ej. el cliente aplazó la obra"></div>`,
    [{ t: "Volver" }, { t: "Cancelar servicio", cls: "ko", fn: async (m) => {
      const motivo = val(m, "#c-mot");
      if (!motivo) { toast("Escribe el motivo", true); return false; }
      await accion({ accion: "cancelar", name, motivo }, "Servicio cancelado");
    } }]);
  }

  function modalRegistro(name, alertaId) {
    const c = S.data.cotizaciones.find((x) => x.name === name) || { name };
    modal(`Registrar contacto · ${codigo(c)}`, `
      <div class="mti-g2"><div class="mti-field"><label class="mti-lbl">Canal</label><select class="mti-sel" id="r-canal">${opts(CANALES, "Llamada")}</select></div>
      <div class="mti-field"><label class="mti-lbl">Próximo contacto en</label><select class="mti-sel" id="r-dias">${opts([1, 2, 3, 5, 7, 10].map((n) => ({ v: String(n), t: `${n} día${n > 1 ? "s" : ""}` })), String(S.data.reglas.dias_proximo || 3))}</select></div></div>
      <div class="mti-field"><label class="mti-lbl">Nota</label><input class="mti-in" id="r-nota" placeholder="Qué dijo el cliente…"></div>`,
    [{ t: "Cancelar" }, { t: "Guardar", cls: "dark", fn: async (m) => {
      await accion({ accion: "seguimiento", name, canal: val(m, "#r-canal"), dias: val(m, "#r-dias"), nota: val(m, "#r-nota") }, "Seguimiento registrado");
      if (alertaId) marcarHecho(alertaId);
      render();
    } }]);
  }

  function modalModificar(f) {
    const base = String(f.name).replace(/^OF-/, "");
    const sig = `${base}.${(f.mti_version || 0) + 1}`;
    modal(`El cliente pide cambios · ${codigo(f)}`, `
      <p style="margin:0 0 12px">La versión <b>${esc(codigo(f))}</b> (${money0(f.deal_value)}) queda guardada en el historial y se crea la <b>${esc(sig)}</b> sobre la misma oferta, sin crear una nueva.</p>
      <div class="mti-radio">
        <label><input type="radio" name="m-tipo" value="Comercial" checked><span><b>Comercial</b><small>Precio, días u horas, condiciones de pago o de servicio. La ajusta Comercial y la reenvía.</small></span></label>
        <label><input type="radio" name="m-tipo" value="Técnico"><span><b>Técnico</b><small>Cambia peso, altura, radio, equipo o alcance. Vuelve a Proyectos (${esc(nombreU(f.mti_resp_proyectos) || "Proyectos")}).</small></span></label>
      </div>
      <div class="mti-field" style="margin-top:12px"><label class="mti-lbl">¿Qué pidió el cliente? *</label><textarea class="mti-in" rows="3" id="m-mot" placeholder="Ej. pide 3 días en lugar de 2 y mejorar el valor del día adicional"></textarea></div>`,
    [{ t: "Cancelar" }, { t: `Crear versión ${sig}`, cls: "purple", fn: async (m) => {
      const tipo = (m.querySelector("input[name=m-tipo]:checked") || {}).value || "Comercial";
      const motivo = val(m, "#m-mot");
      if (!motivo) { toast("Escribe qué pidió el cliente", true); return false; }
      await accion({ accion: "modificar", name: f.name, tipo, motivo }, `Versión ${sig} creada`);
      if (!location.hash.startsWith("#/cotizacion/")) location.hash = "#/cotizacion/" + encodeURIComponent(f.name);
    } }]);
  }

  function modalLogistica(f) {
    const lineas = (f.lineas || []).map((l) => `<li>${esc(lineaCorta(l))}</li>`).join("");
    modal(`Enviar a Logística · ${codigo(f)}`, `
      <p style="margin:0 0 10px">${esc(nombreU(S.data.cotizaciones.find((x) => x.name === f.name)?.mti_resp_logistica) || "Logística")} recibe la ficha del trabajo y define fechas, horario, frecuencia y operador.</p>
      <div class="mti-card" style="padding:12px 14px;font-size:13px;line-height:1.6;margin-bottom:12px">
        <b>${esc(f.organization)}</b> · ${esc(f.mti_servicio || "—")}<ul style="margin:6px 0 0 18px;padding:0">${lineas || "<li>Sin equipos</li>"}</ul></div>
      <div class="mti-g2"><div class="mti-field"><label class="mti-lbl">Fecha que solicitó el cliente *</label><input class="mti-in" type="date" id="l-fecha" value="${esc(f.mti_fecha_solicitada || "")}"></div>
      <div class="mti-field"><label class="mti-lbl">Hora</label><input class="mti-in" type="time" id="l-hora" value="${esc(f.mti_hora_solicitada || "07:00")}"></div></div>
      <div class="mti-field"><label class="mti-lbl">Dirección del servicio *</label><input class="mti-in" id="l-dir" value="${esc(f.mti_ubicacion || "")}"></div>
      <div class="mti-g2"><div class="mti-field"><label class="mti-lbl">Contacto en sitio</label><input class="mti-in" id="l-ct" value="${esc(f.mti_contacto_sitio || (f.cliente && f.cliente.mti_contacto) || "")}"></div>
      <div class="mti-field"><label class="mti-lbl">Teléfono en sitio</label><input class="mti-in" id="l-tel" value="${esc(f.mti_tel_sitio || (f.cliente && f.cliente.mti_telefono) || "")}"></div></div>
      <div class="mti-field"><label class="mti-lbl">Notas para Logística</label><input class="mti-in" id="l-notas" value="${esc(f.mti_notas_logistica || "")}" placeholder="Permisos, horario de ingreso, SST…"></div>`,
    [{ t: "Cancelar" }, { t: "Enviar a Logística →", cls: "navy", fn: async (m) => {
      if (!val(m, "#l-fecha") || !val(m, "#l-dir")) { toast("La fecha solicitada y la dirección son obligatorias", true); return false; }
      await accion({ accion: "enviar_logistica", name: f.name, valores: {
        mti_fecha_solicitada: val(m, "#l-fecha"), mti_hora_solicitada: val(m, "#l-hora"), mti_ubicacion: val(m, "#l-dir"),
        mti_contacto_sitio: val(m, "#l-ct"), mti_tel_sitio: val(m, "#l-tel"), mti_notas_logistica: val(m, "#l-notas"),
      } }, "Enviada a Logística");
    } }], "ancho");
  }

  function conflictosDe(name, equipo, desde, hasta) {
    const d = parseD(desde), h = parseD(hasta) || d;
    if (!d || !equipo) return [];
    return programados().filter((p) => p.c.name !== name && p.equipo === equipo && p.c.status !== "Ejecutada" && d <= p.hasta && p.desde <= h);
  }
  function modalProgramar(name) {
    const c = S.data.cotizaciones.find((x) => x.name === name);
    if (!c) return;
    const reprog = c.status !== "Enviada a Logística";
    const filas = (c.lineas || []).map((l, i) => {
      const desde = l.prog_desde || c.mti_fecha_solicitada || ymd(addDays(hoy(), 1));
      const frec = l.prog_dias || "Lunes a viernes";
      const hasta = l.prog_hasta || calcHasta(desde, l, frec);
      const hi = l.prog_hora_inicio || c.mti_hora_solicitada || "07:00";
      const hf = l.prog_hora_fin || horaMas(hi, l.modalidad === "Hora" ? l.cantidad : l.horas_jornada || 10);
      return `<div class="mti-prow" data-pi="${i}">
        <div class="h"><b>${esc(l.equipo || l.descripcion || "Línea " + (i + 1))}</b><span class="mti-muted">${esc(l.modalidad === "Global" ? "servicio global" : num(l.cantidad) + " " + unidad(l.modalidad, l.cantidad) + " · " + (l.horas_jornada || "") + " h " + (l.jornada || "").toLowerCase())}</span></div>
        <div class="g">
          <label>Equipo<input class="mti-in" data-p="equipo" list="pg-eq" value="${esc(l.equipo || "")}"></label>
          <label>Desde<input class="mti-in" type="date" data-p="prog_desde" value="${esc(ymd(parseD(desde)))}"></label>
          <label>Hasta<input class="mti-in" type="date" data-p="prog_hasta" value="${esc(hasta ? ymd(parseD(hasta)) : "")}"></label>
          <label>Inicio<input class="mti-in" type="time" data-p="prog_hora_inicio" value="${esc(hi)}"></label>
          <label>Fin<input class="mti-in" type="time" data-p="prog_hora_fin" value="${esc(hf)}"></label>
          <label>Frecuencia<select class="mti-sel" data-p="prog_dias">${opts(FRECUENCIAS, frec)}</select></label>
          <label class="w">Operador / conductor<input class="mti-in" data-p="prog_operador" list="pg-op" value="${esc(l.prog_operador || "")}" placeholder="Del catálogo de personal"></label>
        </div>
        <div class="conf"></div>
      </div>`;
    }).join("");
    const m = modal(`${reprog ? "Reprogramar" : "Programar"} · ${codigo(c)} · ${c.organization}`, `
      <div class="mti-kv inline"><div><span>Solicitado</span><b>${c.mti_fecha_solicitada ? dmy(c.mti_fecha_solicitada) : "—"} ${esc(c.mti_hora_solicitada || "")}</b></div><div><span>Dirección</span><b>${esc(c.mti_ubicacion || "—")}</b></div><div><span>Contacto en sitio</span><b>${esc(c.mti_contacto_sitio || "—")} ${esc(c.mti_tel_sitio || "")}</b></div></div>
      ${filas}
      <div class="mti-field" style="margin-top:10px"><label class="mti-lbl">${reprog ? "Motivo del cambio (se avisa a Comercial)" : "Nota (opcional)"}</label><input class="mti-in" id="pg-nota" placeholder="${reprog ? "Ej. cliente no tiene permisos listos" : "Ej. movilización el día anterior"}"></div>
      ${datalist("pg-eq", equiposNombres())}${datalist("pg-op", cat("Personal").filter((p) => p.categoria !== "Técnico de visitas").map((p) => p.nombre))}`,
    [{ t: "Cancelar" }, { t: reprog ? "Guardar programación" : "Programar servicio", cls: "navy", fn: async (m) => {
      const lineas = [...m.querySelectorAll("[data-pi]")].map((row) => {
        const o = { idx: (c.lineas[+row.dataset.pi] || {}).idx || +row.dataset.pi + 1 };
        row.querySelectorAll("[data-p]").forEach((el) => (o[el.dataset.p] = el.value.trim()));
        return o;
      });
      if (!lineas.some((l) => l.prog_desde)) { toast("Indica la fecha de inicio", true); return false; }
      const r = await accion({ accion: "programar", name, lineas, nota: val(m, "#pg-nota") }, reprog ? "Programación actualizada" : "Servicio programado");
      if (r && r.aviso_comercial) toast("Programado. Se avisó a Comercial del cambio de fecha frente a lo solicitado.");
      S.prog.sel = name;
      const d = parseD(lineas.find((l) => l.prog_desde).prog_desde);
      S.prog.modo = "semana";
      S.prog.semana = Math.round(diffDays(lunes(d), lunes(hoy())) / 7);
      render();
    } }], "ancho");
    const revisar = (row) => {
      const i = +row.dataset.pi, l = c.lineas[i];
      const g = (k) => row.querySelector(`[data-p='${k}']`);
      const cs = conflictosDe(name, g("equipo").value.trim(), g("prog_desde").value, g("prog_hasta").value);
      row.querySelector(".conf").innerHTML = cs.map((p) => `⚠ ${esc(p.equipo)} ya está programada del ${dm(p.desde)} al ${dm(p.hasta)} para ${esc(p.c.organization)} (${esc(codigo(p.c))})`).join("<br>");
      return l;
    };
    m.querySelectorAll("[data-pi]").forEach((row) => {
      const l = c.lineas[+row.dataset.pi];
      const g = (k) => row.querySelector(`[data-p='${k}']`);
      let tocado = false;
      g("prog_hasta").addEventListener("input", () => (tocado = true));
      const recalcular = () => { if (!tocado) g("prog_hasta").value = calcHasta(g("prog_desde").value, l, g("prog_dias").value); revisar(row); };
      g("prog_desde").addEventListener("change", recalcular);
      g("prog_dias").addEventListener("change", recalcular);
      g("prog_hasta").addEventListener("change", () => revisar(row));
      g("equipo").addEventListener("change", () => revisar(row));
      g("prog_hora_inicio").addEventListener("change", () => { g("prog_hora_fin").value = horaMas(g("prog_hora_inicio").value, l.modalidad === "Hora" ? l.cantidad : l.horas_jornada || 10); });
      revisar(row);
    });
  }

  function modalEjecutar(name) {
    const c = S.data.cotizaciones.find((x) => x.name === name);
    const fin = (c.lineas || []).map((l) => parseD(l.prog_hasta || l.prog_desde)).filter(Boolean).sort((a, b) => b - a)[0];
    const def = fin && fin < hoy() ? fin : hoy();
    const ad = (c.adicionales || []).map((a) => ({ ...a }));
    const original = JSON.stringify(ad);
    const lineas = [...new Set((c.lineas || []).map((l) => l.equipo || l.descripcion).filter(Boolean))];
    const tipos = [...new Set(Object.values(TIPOS_ADIC)), "Cobro adicional"];
    const m = modal(`Servicio ejecutado · ${codigo(c)}`, `
      <div class="mti-row" style="justify-content:flex-end;margin:-4px 0 8px"><a class="mti-btn sm" href="#/cotizacion/${encodeURIComponent(name)}" data-cerrar>📄 Ver ficha técnica</a></div>
      <div class="mti-field"><label class="mti-lbl">Fecha de ejecución (cuenta para los históricos)</label><input class="mti-in" type="date" id="e-fecha" value="${ymd(def)}"></div>
      <div class="mti-field"><label class="mti-lbl">Observaciones</label><input class="mti-in" id="e-nota" placeholder="Ej. sin novedades"></div>
      <div class="mti-lbl" style="margin-bottom:6px"><b>Adicionales del servicio</b> <span class="mti-muted">(horas, días u otros cobros extra)</span></div>
      <div id="ej-ad"></div>
      <div class="mti-row" style="margin:8px 0 14px"><button class="mti-btn sm" data-ejad="unidad">+ Horas / días adicionales</button><button class="mti-btn sm" data-ejad="cobro">+ Cobro adicional</button></div>
      <div class="mti-lbl" style="margin-bottom:6px"><b>Reporte diario del cliente</b></div>
      ${camposCierre(c, "", "ej")}
      <div class="mti-field" style="margin-top:8px"><label class="mti-lbl">Foto del reporte firmado (opcional)</label><input class="mti-in" type="file" id="ej-foto" accept="image/*,.pdf"></div>`,
    [{ t: "Cancelar" }, { t: "✓ Marcar ejecutado", cls: "ok", fn: async (mm) => {
      const filas = ad.filter((r) => String(r.linea || "").trim());
      if (filas.some((r) => !(+r.valor))) { toast("Cada adicional necesita un valor (cantidad × valor unidad, o el valor del cobro)", true); return false; }
      try { if (JSON.stringify(filas) !== original) await ejecutar({ accion: "adicionales", name, filas }); } catch (err) { toast(err.message, true); return false; }
      const valores = {};
      mm.querySelectorAll("[data-ci]").forEach((el) => (valores[el.dataset.ci] = el.value));
      let reporte_foto = "", res = { antes: 0, despues: 0, comprimidas: 0 };
      const fi = mm.querySelector("#ej-foto");
      if (fi && fi.files && fi.files[0]) reporte_foto = (await subirArchivo(fi.files[0], name, { campo: "mti_reporte_foto" }, res)).file_url || "";
      await accion({ accion: "ejecutar", name, fecha: val(mm, "#e-fecha"), nota: val(mm, "#e-nota"), valores, reporte_foto }, avisoSubida(res, "Servicio ejecutado"));
    } }], "ancho");
    const caja = m.querySelector("#ej-ad");
    const pintar = () => {
      const suma = ad.reduce((t, r) => t + (+r.valor || 0), 0);
      caja.innerHTML = (ad.length ? `<table class="mti-table compact mti-ejad"><thead><tr><th>Equipo / concepto</th><th>Tipo</th><th class="mti-num">Cant.</th><th class="mti-num">Valor unidad</th><th class="mti-num">Valor</th><th>Motivo</th><th></th></tr></thead><tbody>${ad.map((r, i) => {
        const cobro = r.tipo === "Cobro adicional";
        return `<tr><td><input class="mti-in" data-i="${i}" data-k="linea" list="dl-ejad" value="${esc(r.linea)}"></td>
          <td><select class="mti-sel" data-i="${i}" data-k="tipo">${opts(tipos, r.tipo)}</select></td>
          <td><input class="mti-in mti-num" data-i="${i}" data-k="cantidad" value="${cobro ? "" : r.cantidad || ""}" ${cobro ? "disabled" : ""}></td>
          <td><input class="mti-in mti-num" data-i="${i}" data-k="valor_unitario" value="${!cobro && r.valor_unitario ? Math.round(r.valor_unitario).toLocaleString("es-CO") : ""}" ${cobro ? "disabled" : ""}></td>
          <td><input class="mti-in mti-num" data-i="${i}" data-k="valor" value="${r.valor ? Math.round(r.valor).toLocaleString("es-CO") : ""}" ${cobro ? "" : "disabled"}></td>
          <td><input class="mti-in" data-i="${i}" data-k="descripcion" value="${esc(r.descripcion)}" placeholder="Motivo"></td>
          <td><a href="javascript:void(0)" class="mti-x" data-del="${i}">✕</a></td></tr>`;
      }).join("")}</tbody></table>${datalist("dl-ejad", lineas)}` : `<div class="mti-muted sm">Sin adicionales.</div>`)
        + `<div class="mti-consol" style="margin-top:8px"><span>Valor aprobado <b>${money0(c.deal_value)}</b></span><span>+ Adicionales <b>${money0(suma)}</b></span><span class="tot">= Final <b>${money0((+c.deal_value || 0) + suma)}</b></span></div>`;
      caja.querySelectorAll("[data-k]").forEach((el) => (el.onchange = () => {
        const r = ad[+el.dataset.i], k = el.dataset.k;
        r[k] = ["valor", "valor_unitario"].includes(k) ? parseMoney(el.value) : k === "cantidad" ? parseFloat(String(el.value).replace(",", ".")) || 0 : el.value;
        const l = (c.lineas || []).find((x) => (x.equipo || x.descripcion) === r.linea);
        if (k === "linea" && r.tipo !== "Cobro adicional" && l) { r.tipo = TIPOS_ADIC[l.modalidad] || "Horas adicionales"; r.valor_unitario = l.valor_adicional || r.valor_unitario; }
        // si se elige otra unidad distinta a la cotizada, el valor por unidad lo escribe el usuario
        if (k === "tipo" && r.tipo !== "Cobro adicional") r.valor_unitario = l && TIPOS_ADIC[l.modalidad] === r.tipo ? l.valor_adicional || 0 : 0;
        if (r.tipo === "Cobro adicional") { r.cantidad = 0; r.valor_unitario = 0; } else r.valor = Math.round((+r.cantidad || 0) * (+r.valor_unitario || 0));
        pintar();
      }));
      caja.querySelectorAll("[data-del]").forEach((el) => (el.onclick = () => { ad.splice(+el.dataset.del, 1); pintar(); }));
    };
    m.querySelectorAll("[data-ejad]").forEach((b) => (b.onclick = () => {
      if (b.dataset.ejad === "cobro") ad.push({ linea: "Otro", tipo: "Cobro adicional", cantidad: 0, valor_unitario: 0, valor: 0, descripcion: "" });
      else { const l = (c.lineas || []).find((x) => x.equipo) || (c.lineas || [])[0] || {}; ad.push({ linea: l.equipo || l.descripcion || "", tipo: TIPOS_ADIC[l.modalidad] || "Horas adicionales", cantidad: 1, valor_unitario: l.valor_adicional || 0, valor: l.valor_adicional || 0, descripcion: "" }); }
      pintar();
    }));
    const ir = m.querySelector("[data-cerrar]");
    if (ir) ir.onclick = () => m.remove();
    pintar();
  }

  function modalEliminar(f) {
    const cod = codigo(f);
    modal(`Eliminar oferta ${cod}`, `
      <div class="mti-banner lost" style="margin:0 0 12px">Se borrará la oferta <b>${esc(cod)} · ${esc(f.organization || "")}</b> con sus tareas, notas, comentarios y archivos adjuntos. Dejará de aparecer en el Tablero, el Pipeline y los Históricos.</div>
      <p class="mti-muted sm" style="margin:0 0 12px">Si fue un error, el administrador puede recuperarla en <b>Frappe → Documentos eliminados</b> (<code>/app/deleted-document</code>). El número ${esc(cod)} no se vuelve a usar.</p>
      <div class="mti-field"><label class="mti-lbl">Para confirmar, escribe <b>${esc(cod)}</b></label><input class="mti-in" id="del-conf" autocomplete="off"></div>`,
    [{ t: "Cancelar" }, { t: "🗑 Eliminar definitivamente", cls: "ko", fn: async (m) => {
      const conf = val(m, "#del-conf");
      if (conf !== cod) { toast(`Escribe ${cod} para confirmar`, true); return false; }
      try { await ejecutar({ accion: "eliminar", name: f.name, confirmar: conf }); } catch (e) { toast(e.message, true); return false; }
      S.ficha = null; S.edit = null;
      location.hash = "#/tablero";
      toast(`Oferta ${cod} eliminada`);
      await cargar();
    } }]);
  }

  function modalCliente(nombre) {
    const c = (S.data.clientes || []).find((x) => x.name === nombre) || { name: nombre };
    modal(`Cliente · ${nombre}`, camposCliente("cl", c),
      [{ t: "Cancelar" }, { t: "Guardar", cls: "dark", fn: async (m) => { await accion({ accion: "cliente", name: nombre, valores: leerCliente(m, "cl") }, "Cliente actualizado"); } }]);
  }

  // ------------------------------------------------------------------ eventos
  function enlazar(vista) {
    const R = root();
    R.querySelectorAll("[data-act='nueva']").forEach((b) => (b.onclick = () => modalNueva()));
    const q = R.querySelector("#mti-q");
    if (q) q.oninput = () => { S.filtros.q = q.value; render(); };
    const bind = (id, k, chk) => { const el = R.querySelector(id); if (el) el.onchange = () => { S.filtros[k] = chk ? el.checked : el.value; render(); }; };
    bind("#mti-f-estado", "estado"); bind("#mti-f-cliente", "cliente"); bind("#mti-f-equipo", "equipo"); bind("#mti-f-servicio", "servicio");
    const fa = R.querySelector("#mti-f-anio");
    if (fa) fa.onchange = async () => { S.filtros.anio = fa.value; if (!(await asegurarAnio(fa.value))) render(); };
    bind("#mti-f-mes", "mes"); bind("#mti-f-venc", "vencidas", true); bind("#mti-f-cerr", "cerradas", true);
    R.querySelectorAll("[data-kpi]").forEach((b) => (b.onclick = () => {
      S.filtros.kpi = S.filtros.kpi === b.dataset.kpi ? "" : b.dataset.kpi;
      if (b.dataset.kpi === "visitas" && S.filtros.kpi) { S.filtros.kpi = ""; location.hash = "#/visitas"; return; }
      if (S.filtros.kpi === "ejecmes") S.filtros.cerradas = false;
      render();
    }));
    R.querySelectorAll("tr[data-open]").forEach((tr) => (tr.onclick = (e) => {
      const seg = e.target.closest("[data-seg]");
      location.hash = "#/cotizacion/" + encodeURIComponent(tr.dataset.open) + (seg ? "/seguir" : "");
    }));
    // Pipeline: solo consulta; la etapa se cambia con los botones de la ficha (no se arrastra)
    R.querySelectorAll(".mti-kcard").forEach((c) => {
      c.onclick = () => (location.hash = "#/cotizacion/" + encodeURIComponent(c.dataset.card));
    });
    if (vista === "cotizacion") enlazarFicha(R);
    if (vista === "imprimir") enlazarImprimir(R);
    if (vista === "visitas") enlazarVisitas(R);
    if (vista === "programacion") enlazarProg(R);
    if (vista === "historicos") enlazarHist(R);
    if (vista === "buscar") enlazarBuscar(R);
    if (vista === "alertas") enlazarAlertas(R);
    if (vista === "clientes") enlazarClientes(R);
    if (vista === "catalogos") enlazarCatalogos(R);
  }

  function enlazarFicha(R) {
    const f = S.ficha, e = S.edit;
    if (!f || !e) return;
    if ((location.hash || "").endsWith("/adicionales")) {
      if (!(e.adicionales || []).length && ["Programada", "En ejecución", "Ejecutada"].includes(f.status)) {
        const l = (f.lineas || []).find((x) => x.equipo) || (f.lineas || [])[0] || {};
        e.adicionales.push({ linea: l.equipo || l.descripcion || "", tipo: TIPOS_ADIC[l.modalidad] || "Horas adicionales", cantidad: 1, valor_unitario: l.valor_adicional || 0, valor: l.valor_adicional || 0, descripcion: "" });
      }
      history.replaceState(null, "", "#/cotizacion/" + encodeURIComponent(f.name));
      render();
      setTimeout(() => { const box = root().querySelector("#mti-adicionales"); if (box) { box.scrollIntoView({ behavior: "smooth", block: "start" }); box.classList.add("resalta"); } }, 80);
      return;
    }
    if ((location.hash || "").endsWith("/seguir")) {
      const box = R.querySelector("#mti-registrar");
      if (box) setTimeout(() => { box.scrollIntoView({ behavior: "smooth", block: "center" }); const n = R.querySelector("#mti-nota"); if (n) n.focus(); }, 60);
      history.replaceState(null, "", "#/cotizacion/" + encodeURIComponent(f.name));
    }
    // edición: cada campo escribe en S.edit
    R.querySelectorAll("[data-e]").forEach((el) => (el.oninput = el.onchange = () => {
      e.campos[el.dataset.e] = el.value;
      if (el.dataset.e === "organization") {
        const c = (S.data.clientes || []).find((x) => x.name === el.value.trim());
        if (c) { CAMPOS_CLI.forEach((k) => (e.cliente[k] = c[k] || "")); marcarSucio(); render(); return; }
      }
      marcarSucio();
    }));
    R.querySelectorAll("[data-c]").forEach((el) => (el.oninput = () => { e.cliente[el.dataset.c] = el.value; marcarSucio(); }));
    const enFila = (lista, attr) => R.querySelectorAll(`[${attr}]`).forEach((el) => {
      const [i, k] = el.getAttribute(attr).split(".");
      const fila = lista[+i];
      el.oninput = el.onchange = (ev) => {
        if (el.dataset.m) { fila[k] = parseMoney(el.value); if (ev.type === "change") formatearDinero(el); }
        else if (el.dataset.n) fila[k] = parseNum(el.value);
        else fila[k] = el.value;
        marcarSucio();
        if (el.dataset.rr || (k === "tipo" && ev.type === "change")) render();
        else if (["cantidad", "horas_jornada", "jornada"].includes(k)) {
          const sub = el.closest("tr") && el.closest("tr").nextElementSibling;
          if (sub && sub.classList.contains("sub")) sub.children[1].textContent = (fila.incluir === 0 ? "No va en la oferta · " : "") + duracionTexto(fila) + (fila.movilizacion ? " · incluye movilización" : "");
        }
      };
    });
    enFila(e.lineas, "data-l");
    // casilla: el servicio va (o no) en la oferta final al cliente
    R.querySelectorAll("[data-inc]").forEach((el) => (el.onchange = () => {
      const fila = e.lineas[+el.dataset.inc];
      if (!fila) return;
      fila.incluir = el.checked ? 1 : 0;
      if (!e.lineas.some(incluida)) { fila.incluir = 1; el.checked = true; return toast("La oferta debe llevar al menos un servicio", true); }
      marcarSucio(); render();
    }));
    enFila(e.trabajos, "data-t");
    R.querySelectorAll("[data-add-l]").forEach((b) => (b.onclick = () => {
      const t = b.dataset.addL;
      e.lineas.push(t === "Transporte" ? { tipo: "Transporte", equipo: "", descripcion: "", modalidad: "Global", cantidad: 1, horas_jornada: 10, jornada: "Diurna", movilizacion: 1, valor_adicional: 0, valor_total: 0 }
        : { tipo: "Equipo", equipo: "", descripcion: "", modalidad: "Día", cantidad: 1, horas_jornada: 10, jornada: "Diurna", movilizacion: 1, valor_adicional: 0, valor_total: 0 });
      marcarSucio(); render();
    }));
    R.querySelectorAll("[data-del-l]").forEach((b) => (b.onclick = () => { e.lineas.splice(+b.dataset.delL, 1); marcarSucio(); render(); }));
    R.querySelectorAll("[data-add-t]").forEach((b) => (b.onclick = () => { e.trabajos.push({ descripcion: "", equipo: "", altura: 0, radio: 0, peso: 0, especificaciones: "" }); marcarSucio(); render(); }));
    R.querySelectorAll("[data-del-t]").forEach((b) => (b.onclick = () => { e.trabajos.splice(+b.dataset.delT, 1); marcarSucio(); render(); }));
    R.querySelectorAll("textarea[data-t]").forEach((t) => { const ajustar = () => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; }; ajustar(); t.addEventListener("input", ajustar); });

    const on = (sel, fn) => R.querySelectorAll(sel).forEach((b) => (b.onclick = fn));
    const conGuardado = (fn) => async (ev) => { if (e.dirty) await guardarFicha(true); return fn(ev); };
    on("[data-act='guardar']", () => guardarFicha());
    on("[data-act='descartar']", () => { setFicha(f); render(); });
    on("[data-act='seguimiento']", async () => { await accion({ accion: "seguimiento", name: f.name, canal: val(R, "#mti-canal"), dias: val(R, "#mti-dias"), nota: val(R, "#mti-nota") }, "Seguimiento registrado"); });
    on("[data-act='estado']", conGuardado(async (ev) => { const estado = ev.target.dataset.estado; await accion({ accion: "estado", name: f.name, estado }, `${codigo(f)} → ${estado}`); }));
    on("[data-act='enviar']", conGuardado(async () => { await accion({ accion: "enviar", name: f.name }, `Oferta ${codigo(S.ficha)} enviada al cliente`); }));
    on("[data-act='ajuste-listo']", conGuardado(async () => { await accion({ accion: "ajuste_listo", name: f.name }, "Ajuste técnico terminado: vuelve a Comercial"); }));
    on("[data-act='modificar']", () => modalModificar(f));
    on("[data-act='aprobada']", async () => { await accion({ accion: "estado", name: f.name, estado: "Aprobada" }, "¡Oferta aprobada!"); });
    on("[data-act='perdida']", () => modalPerdida(f.name));
    on("[data-act='espera']", conGuardado(() => modalEspera(f.name)));
    on("[data-act='reanudar']", async () => { await accion({ accion: "reanudar", name: f.name }); });
    on("[data-act='eliminar']", () => modalEliminar(f));
    on("[data-act='motivo']", () => modalMotivo(f));
    // Desglose del precio
    R.querySelectorAll("[data-dg]").forEach((el) => (el.onchange = () => {
      const r = S.edit.desglose[+el.dataset.dg];
      if (!r) return;
      r[el.dataset.k] = el.dataset.k === "valor" ? parseMoney(el.value) : el.value;
      render();
    }));
    R.querySelectorAll("[data-dg-del]").forEach((el) => (el.onclick = () => { S.edit.desglose.splice(+el.dataset.dgDel, 1); render(); }));
    on("[data-act='dg-add']", () => { S.edit.desglose.push({ concepto: "", valor: 0, nota: "" }); render(); });
    on("[data-act='dg-oferta']", () => { S.edit.desglose = desgloseInicial({ ...f, desglose: [] }); render(); });
    on("[data-act='dg-guardar']", async () => {
      const filas = S.edit.desglose.filter((r) => String(r.concepto || "").trim());
      if (!filas.length) return toast("Agrega al menos un equipo o concepto", true);
      const suma = filas.reduce((t, r) => t + (+r.valor || 0), 0), total = +f.valor_final || +f.deal_value || 0;
      if (Math.abs(suma - total) >= 1 && !window.confirm(`La suma del desglose (${money0(suma)}) no es igual al valor de la oferta (${money0(total)}). ¿Guardar de todas formas?`)) return;
      await accion({ accion: "desglose", name: f.name, filas }, "Desglose guardado");
    });
    // Adicionales del servicio
    const recalcAd = (r) => { if (r.tipo !== "Cobro adicional") r.valor = Math.round((+r.cantidad || 0) * (+r.valor_unitario || 0)); };
    R.querySelectorAll("[data-ad]").forEach((el) => (el.onchange = () => {
      const r = S.edit.adicionales[+el.dataset.ad];
      if (!r) return;
      const k = el.dataset.k;
      r[k] = ["valor", "valor_unitario"].includes(k) ? parseMoney(el.value) : k === "cantidad" ? parseFloat(String(el.value).replace(",", ".")) || 0 : el.value;
      if (k === "linea" || k === "tipo") {
        const l = (f.lineas || []).find((x) => (x.equipo || x.descripcion) === r.linea);
        if (k === "linea" && l && r.tipo !== "Cobro adicional") { r.tipo = TIPOS_ADIC[l.modalidad] || "Horas adicionales"; r.valor_unitario = l.valor_adicional || r.valor_unitario; }
        if (k === "tipo" && r.tipo !== "Cobro adicional") r.valor_unitario = l && TIPOS_ADIC[l.modalidad] === r.tipo ? l.valor_adicional || 0 : 0;
        if (r.tipo === "Cobro adicional") { r.cantidad = 0; r.valor_unitario = 0; }
      }
      recalcAd(r); render();
    }));
    R.querySelectorAll("[data-ad-del]").forEach((el) => (el.onclick = () => { S.edit.adicionales.splice(+el.dataset.adDel, 1); render(); }));
    on("[data-act='ad-unidad']", () => {
      const l = (f.lineas || []).find((x) => x.equipo) || (f.lineas || [])[0] || {};
      S.edit.adicionales.push({ linea: l.equipo || l.descripcion || "", tipo: TIPOS_ADIC[l.modalidad] || "Horas adicionales", cantidad: 1, valor_unitario: l.valor_adicional || 0, valor: l.valor_adicional || 0, descripcion: "" });
      render();
    });
    on("[data-act='ad-cobro']", () => { S.edit.adicionales.push({ linea: "Otro", tipo: "Cobro adicional", cantidad: 0, valor_unitario: 0, valor: 0, descripcion: "" }); render(); });
    on("[data-act='ad-guardar']", async () => {
      const filas = S.edit.adicionales.filter((r) => String(r.linea || "").trim());
      if (filas.some((r) => !(+r.valor))) return toast("Cada adicional necesita un valor (cantidad × valor unidad, o el valor del cobro)", true);
      await accion({ accion: "adicionales", name: f.name, filas }, "Adicionales guardados");
    });
    // Reporte diario y calificación
    R.querySelectorAll("#mti-cierre [data-ci]").forEach((el) => (el.onchange = () => { S.edit.cierre[el.dataset.ci] = el.value; }));
    on("[data-act='ci-guardar']", async () => { await accion({ accion: "calificacion", name: f.name, valores: S.edit.cierre }, "Reporte y calificación guardados"); });
    const subirYAsignar = async (input, campo, accionDatos, aviso, opc) => {
      const file = input.files && input.files[0];
      if (!file) return;
      const res = { antes: 0, despues: 0, comprimidas: 0 };
      try {
        const up2 = await subirArchivo(file, f.name, { campo, ...(opc || {}) }, res);
        await accion({ ...accionDatos(up2.file_url || ""), name: f.name }, avisoSubida(res, aviso));
      } catch (err) { toast(err.message, true); }
    };
    const repUp = R.querySelector("#mti-rep-up");
    if (repUp) repUp.onchange = () => subirYAsignar(repUp, "mti_reporte_foto", (url) => ({ accion: "calificacion", valores: S.edit.cierre, reporte_foto: url }), "Reporte subido");
    // Diagrama Compu Crane: se guarda con más resolución para que se lean las medidas
    const diagUp = R.querySelector("#mti-diag-up");
    if (diagUp) diagUp.onchange = () => subirYAsignar(diagUp, "mti_diagrama", (url) => ({ accion: "diagrama", url }), "Diagrama subido", { max: 2400, calidad: 0.88 });
    on("[data-act='diag-quitar']", async () => { await accion({ accion: "diagrama", name: f.name, url: "" }, "Diagrama quitado"); });
    on("[data-act='cancelar']", () => modalCancelar(f.name));
    on("[data-act='logistica']", conGuardado(() => modalLogistica(S.ficha)));
    on("[data-act='agendar']", () => modalAgendar(f.name));
    on("[data-act='sin-visita']", async () => { await accion({ accion: "sin_visita", name: f.name }, "Enviada a Proyectos sin visita"); });
    on("[data-act='ir-visita']", () => irAVisita(f.name));
    on("[data-act='ir-prog']", () => { S.prog.sel = f.name; location.hash = "#/programacion"; });
    on("[data-act='similares']", () => buscarSimilares(f));
    const up = R.querySelector("#mti-upload");
    if (up) up.onchange = async () => {
      const res = { antes: 0, despues: 0, comprimidas: 0 };
      try { for (const file of up.files) await subirArchivo(file, f.name, {}, res); } catch (err) { toast(err.message, true); return; }
      const fotos = [...up.files].some((x) => /^image\//.test(x.type));
      if (fotos && !f.mti_chk_fotos) await api.post("mti_accion", { accion: "checklist", name: f.name, valores: { mti_chk_fotos: 1 } }).catch(() => {});
      toast(avisoSubida(res, "Archivo subido"));
      await cargar(true);
    };
  }

  // Fotos: se reducen en el navegador antes de subirlas (lado mayor 1600 px, JPEG 80 %).
  // Una foto de celular de 3–5 MB queda en ≈ 250–400 KB y se sigue viendo bien para el levantamiento.
  const FOTO_MAX = 1600, FOTO_CALIDAD = 0.8, FOTO_MIN_BYTES = 350 * 1024;
  const mb = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
  // TODA subida de archivos pasa por aquí: las imágenes se comprimen antes de enviarse a Frappe
  async function subirArchivo(original, name, opc, res) {
    const file = await comprimirFoto(original, opc.max, opc.calidad);
    if (res && file !== original) { res.comprimidas++; res.antes += original.size; res.despues += file.size; }
    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("doctype", "CRM Deal");
    fd.append("docname", name);
    fd.append("is_private", "1");
    if (opc.campo) fd.append("fieldname", opc.campo);
    const r = await fetch("/api/method/upload_file", { method: "POST", body: fd, credentials: "same-origin", headers: { "X-Frappe-CSRF-Token": csrf(), Accept: "application/json" } });
    const j = await leerRespuesta(r);
    return (j && j.message) || {};
  }
  const avisoSubida = (res, base) => (res.comprimidas ? `${base} · ${res.comprimidas} imagen${res.comprimidas > 1 ? "es" : ""} reducida${res.comprimidas > 1 ? "s" : ""} de ${mb(res.antes)} a ${mb(res.despues)}` : base);
  async function comprimirFoto(file, max, calidad) {
    max = max || FOTO_MAX; calidad = calidad || FOTO_CALIDAD;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size < FOTO_MIN_BYTES || typeof createImageBitmap !== "function") return file;
    try {
      const img = await createImageBitmap(file, { imageOrientation: "from-image" });
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); // fondo blanco para PNG con transparencia
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      if (img.close) img.close();
      const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", calidad));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
    } catch (e) { return file; } // si el navegador no puede leerla (p. ej. HEIC), se sube tal cual
  }

  function irAVisita(name) {
    const c = S.data.cotizaciones.find((x) => x.name === name);
    S.visitaSel = name;
    S.modoCal = "semana";
    if (c && c.mti_fecha_visita) S.semana = Math.round(diffDays(lunes(parseD(c.mti_fecha_visita)), lunes(hoy())) / 7);
    location.hash = "#/visitas";
    if (c && !c.mti_fecha_visita) modalAgendar(name);
  }

  function enlazarVisitas(R) {
    R.querySelectorAll("[data-vis]").forEach((e) => (e.onclick = () => { S.visitaSel = e.dataset.vis; render(); }));
    R.querySelectorAll("[data-nav]").forEach((b) => (b.onclick = () => {
      const n = +b.dataset.nav;
      if (S.modoCal === "semana") S.semana = n === 0 ? 0 : S.semana + n; else S.mes = n === 0 ? 0 : S.mes + n;
      S.visitaSel = null; render();
    }));
    R.querySelectorAll("[data-modo]").forEach((b) => (b.onclick = () => { S.modoCal = b.dataset.modo; render(); }));
    R.querySelectorAll("[data-act='agendar']").forEach((b) => (b.onclick = () => modalAgendar()));
    R.querySelectorAll("[data-agendar]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); if (es("comercial")) modalAgendar(b.dataset.agendar); }));
    const p = R.querySelector(".mti-panel");
    if (!p) return;
    p.querySelectorAll("[data-ckv]").forEach((inp) => (inp.oninput = () => {
      const k = CHECKS.find((x) => x[2] === inp.dataset.ckv)[0];
      const box = p.querySelector(`[data-ck='${k}']`);
      if (box) box.checked = inp.value.trim() !== "" && inp.value !== "0";
      actualizarAviso(p);
    }));
    p.querySelectorAll("[data-ck]").forEach((b) => (b.onchange = () => actualizarAviso(p)));
    const name = S.visitaSel;
    const g = p.querySelector("[data-act='guardar-ck']");
    if (g) g.onclick = async () => { const x = leerChecklist(); await accion({ accion: "checklist", name, valores: x.valores, trabajo1: x.trabajo1 }, "Avance guardado"); };
    const s = p.querySelector("[data-act='enviar-ck']");
    if (s) s.onclick = async () => { const x = leerChecklist(); await accion({ accion: "checklist", name, enviar: 1, valores: x.valores, trabajo1: x.trabajo1 }, `${codigo(S.data.cotizaciones.find((c) => c.name === name) || { name })} enviada a Proyectos`); };
    // Fotos del levantamiento: se suben (comprimidas) desde la misma visita y marcan el punto "Fotos"
    const vu = p.querySelector("#mti-vis-up");
    if (vu) vu.onchange = async () => {
      if (!vu.files || !vu.files.length) return;
      const x = leerChecklist();
      const res = { antes: 0, despues: 0, comprimidas: 0 };
      try { for (const file of vu.files) await subirArchivo(file, name, {}, res); } catch (err) { toast(err.message, true); return; }
      x.valores.mti_chk_fotos = 1;
      await accion({ accion: "checklist", name, valores: x.valores, trabajo1: x.trabajo1 }, avisoSubida(res, `${vu.files.length} foto${vu.files.length > 1 ? "s" : ""} subida${vu.files.length > 1 ? "s" : ""} a la visita`));
    };
  }

  function actualizarAviso(p) {
    const total = p.querySelectorAll("[data-ck]").length;
    const ok = p.querySelectorAll("[data-ck]:checked").length;
    const faltan = total - ok;
    const msg = p.querySelector(".mti-warn, .mti-okmsg");
    if (msg && !msg.textContent.includes("realizada")) {
      msg.className = faltan ? "mti-warn" : "mti-okmsg";
      msg.textContent = faltan ? `Faltan ${faltan} dato${faltan > 1 ? "s" : ""}: la visita queda en rojo` : "Checklist completo: lista para Proyectos";
      const s = p.querySelector("[data-act='enviar-ck']");
      if (s) s.disabled = faltan > 0;
    }
  }

  function enlazarProg(R) {
    R.querySelectorAll("[data-psel]").forEach((e) => (e.onclick = (ev) => { if (ev.target.closest("[data-programar]")) return; S.prog.sel = e.dataset.psel; render(); }));
    R.querySelectorAll("[data-programar]").forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); modalProgramar(b.dataset.programar); }));
    R.querySelectorAll("[data-pnav]").forEach((b) => (b.onclick = () => {
      const n = +b.dataset.pnav;
      if (S.prog.modo === "semana") S.prog.semana = n === 0 ? 0 : S.prog.semana + n; else S.prog.mes = n === 0 ? 0 : S.prog.mes + n;
      render();
    }));
    R.querySelectorAll("[data-pmodo]").forEach((b) => (b.onclick = () => { S.prog.modo = b.dataset.pmodo; render(); }));
    R.querySelectorAll("[data-pact]").forEach((b) => (b.onclick = async () => {
      const n = b.dataset.n, t = b.dataset.pact;
      if (t === "iniciar") await accion({ accion: "iniciar", name: n }, "Servicio en ejecución");
      if (t === "ejecutar") modalEjecutar(n);
      if (t === "cancelar") modalCancelar(n);
    }));
  }

  function enlazarHist(R) {
    const h = S.hist;
    const b = (id, k) => { const el = R.querySelector(id); if (el) el.onchange = () => { h[k] = el.value; h.mes = null; render(); }; };
    const ha = R.querySelector("#h-anio");
    if (ha) ha.onchange = async () => { h.anio = ha.value; h.mes = null; if (!(await asegurarAnio(ha.value))) render(); };
    b("#h-equipo", "equipo"); b("#h-cliente", "cliente"); b("#h-servicio", "servicio");
    R.querySelectorAll("[data-hmes]").forEach((tr) => (tr.onclick = () => { const m = tr.dataset.hmes; h.mes = m === "" || +m === h.mes ? null : +m; render(); }));
    R.querySelectorAll("[data-heq]").forEach((tr) => (tr.onclick = () => { h.equipo = h.equipo === tr.dataset.heq ? "" : tr.dataset.heq; render(); }));
    R.querySelectorAll("[data-hcli]").forEach((tr) => (tr.onclick = () => { h.cliente = h.cliente === tr.dataset.hcli ? "" : tr.dataset.hcli; render(); }));
    R.querySelectorAll("[data-hclr]").forEach((a) => (a.onclick = () => { h[a.dataset.hclr] = ""; render(); }));
    const csv = R.querySelector("[data-act='csv']");
    if (csv) csv.onclick = exportarCSV;
  }

  function enlazarBuscar(R) {
    R.querySelectorAll("[data-b]").forEach((el) => {
      const ev = el.tagName === "SELECT" ? "onchange" : "oninput";
      el[ev] = async () => { S.busq[el.dataset.b] = el.value; if (el.dataset.b === "anio" && (await asegurarAnio(el.value))) return; render(); };
    });
    R.querySelectorAll("[data-act='b-anteriores']").forEach((b) => (b.onclick = () => asegurarAnio(S.data.primerAnio)));
    R.querySelectorAll("[data-act='limpiar-b']").forEach((b) => (b.onclick = () => { S.busq = { q: "", cliente: "", anio: "", equipo: "", servicio: "", modalidad: "", estado: "", amin: "", amax: "", rmin: "", rmax: "", pmin: "", pmax: "", ref: null }; render(); }));
  }

  function enlazarCatalogos(R) {
    R.querySelectorAll("[data-cat]").forEach((a) => (a.onclick = () => { S.cat = a.dataset.cat; render(); }));
    const add = R.querySelector("[data-act='cat-add']");
    if (add) {
      const inp = R.querySelector("#cat-nombre");
      const go = async () => {
        const nombre = inp.value.trim();
        if (!nombre) { toast("Escribe el nombre", true); return; }
        await accion({ accion: "catalogo", op: "agregar", tipo: S.cat, nombre, categoria: val(R, "#cat-cat"), capacidad: parseNum(val(R, "#cat-cap")) }, `“${nombre}” agregado`);
      };
      add.onclick = go;
      inp.onkeydown = (e) => { if (e.key === "Enter") go(); };
    }
    R.querySelectorAll("[data-cat-del]").forEach((b) => (b.onclick = () => {
      modal("Quitar del catálogo", `<p style="margin:0">¿Quitar <b>${esc(b.dataset.nom)}</b> de las listas? Las ofertas que ya lo usan no cambian.</p>`,
        [{ t: "Cancelar" }, { t: "Quitar", cls: "ko", fn: async () => { await accion({ accion: "catalogo", op: "quitar", name: b.dataset.catDel }, "Quitado del catálogo"); } }]);
    }));
    R.querySelectorAll("[data-cli]").forEach((b) => (b.onclick = () => modalCliente(b.dataset.cli)));
  }

  function enlazarAlertas(R) {
    R.querySelectorAll("[data-alarea]").forEach((b) => (b.onclick = () => { S.alArea = b.dataset.alarea; render(); }));
    R.querySelectorAll("[data-al]").forEach((b) => (b.onclick = async () => {
      const t = b.dataset.al, n = b.dataset.n, id = b.dataset.id;
      if (t === "contactar") location.hash = "#/cotizacion/" + encodeURIComponent(n) + "/seguir";
      else if (t === "abrir") location.hash = "#/cotizacion/" + encodeURIComponent(n);
      else if (t === "ir-prog") { S.prog.sel = n; location.hash = "#/programacion"; }
      else if (t === "ver-visita") irAVisita(n);
      else if (t === "posponer") await accion({ accion: "posponer", name: n }, "Próximo contacto: mañana");
      else if (t === "posponer-visita") await accion({ accion: "posponer", name: n, que: "visita" }, "Visita movida 1 día");
      else if (t === "registrar") modalRegistro(n, id);
      else if (t === "hecho") { marcarHecho(id); render(); }
    }));
    const v = R.querySelector("#mti-r-v"), a = R.querySelector("#mti-r-a"), txt = R.querySelector("#mti-r-txt");
    if (a) a.oninput = () => (txt.textContent = a.value);
    const g = R.querySelector("[data-act='reglas']");
    if (g) g.onclick = async () => {
      await accion({ accion: "reglas", valores: {
        verde_hasta: parseInt(v.value, 10), amarillo_hasta: parseInt(a.value, 10), dias_vigencia: parseInt(val(R, "#mti-r-vig"), 10) || 15,
      } }, "Reglas guardadas: el semáforo se recalculó");
    };
  }

  // ------------------------------------------------------------------ inicio
  // Cerrar sesión (cierre estándar de Frappe) y volver a la pantalla de ingreso
  document.addEventListener("click", async (e) => {
    if (!e.target.closest || !e.target.closest("[data-salir]")) return;
    try { await fetch("/api/method/logout", { method: "POST", headers: { "X-Frappe-CSRF-Token": csrf() }, credentials: "same-origin" }); } catch (err) { /* igual sale */ }
    location.href = "/login?redirect-to=/mti";
  });

  async function iniciar() {
    const r = root();
    if (!r) return;
    try {
      S.data = await api.get("mti_datos");
    } catch (e) {
      r.innerHTML = `<div class="mti-page" style="max-width:520px;padding-top:90px"><div class="mti-card" style="padding:28px;text-align:center">
        <div class="mti-logo grande"><img src="${LOGO}" alt="MTI"></div>
        <h2 style="margin:0 0 8px;font-size:20px">Inicia sesión para ver las ofertas</h2>
        <p class="mti-muted">${e.status === 403 || e.status === 401 ? "Necesitas una cuenta del CRM." : esc(e.message)}</p>
        <a class="mti-btn dark" href="/login?redirect-to=/mti">Iniciar sesión</a></div></div>`;
      return;
    }
    window.addEventListener("hashchange", () => {
      if (S.imp && S.imp.sucio && !(location.hash || "").startsWith("#/imprimir/")) {
        if (!window.confirm("Hay cambios sin guardar en el texto de la oferta. ¿Salir sin guardar?")) { history.replaceState(null, "", "#/imprimir/" + encodeURIComponent(S.imp.name)); return; }
        S.imp = null;
      }
      if (S.edit && S.edit.dirty && !(location.hash || "").includes(encodeURIComponent(S.ficha.name)) && !window.confirm("Hay cambios sin guardar en la oferta. ¿Salir sin guardar?")) {
        history.replaceState(null, "", "#/cotizacion/" + encodeURIComponent(S.ficha.name));
        return;
      }
      ir();
    });
    window.addEventListener("beforeunload", (e) => { if ((S.edit && S.edit.dirty) || (S.imp && S.imp.sucio)) { e.preventDefault(); e.returnValue = ""; } });
    await ir();
    iniciarVigia();
  }

  // ------------------------------------------------------------------ cambios en vivo
  // Cada 30 segundos pregunta a Frappe si alguna oferta o tarea cambió desde la última vez (consulta mínima)
  // y actualiza solo esas ofertas: Tablero, Alertas y contador sin recargar la página.
  const VIGIA_MS = 30000, VIGIA_COMPLETA = 60; // cada 30 s; recarga completa silenciosa cada 60 vueltas (≈30 min)
  const maxMod = (arr) => (arr || []).reduce((m, x) => (x && x.modified && String(x.modified) > m ? String(x.modified) : m), "");
  function marcasVigia() {
    const d = maxMod(S.data.cotizaciones) || "2000-01-01 00:00:00";
    S.vigia = { deal: d, tarea: maxMod(S.data.tareas) || d, vueltas: 0, pendiente: false, dia: S.data.hoy, propias: {} };
  }
  function iniciarVigia() {
    marcasVigia();
    setInterval(() => vigiar(false), VIGIA_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) vigiar(false); });
    window.mtiApp.vigiar = () => vigiar(true);
  }
  const ocupado = () => {
    const a = document.activeElement;
    return !!document.querySelector(".mti-modal-bg") || (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable));
  };
  const enFicha = () => /^#\/(cotizacion|imprimir)\//.test(location.hash || "");
  // Vuelve a dibujar sin estorbar: en la ficha o con un campo en uso, solo actualiza el contador y avisa
  function renderVivo(cambiadas) {
    const abierta = S.ficha && cambiadas.includes(S.ficha.name);
    if (enFicha()) {
      actualizarContador();
      if (abierta) avisoFichaCambio();
      return;
    }
    if (ocupado()) {
      actualizarContador();
      if (!S.vigia.pendiente) {
        S.vigia.pendiente = true;
        const al = () => { document.removeEventListener("focusout", al); setTimeout(() => { if (S.vigia.pendiente && !ocupado() && !enFicha()) { S.vigia.pendiente = false; const y = window.scrollY; render(); window.scrollTo(0, y); } }, 50); };
        document.addEventListener("focusout", al);
      }
      return;
    }
    S.vigia.pendiente = false;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }
  function actualizarContador() {
    const mias = soloLectura() ? [] : construirAlertas(true), n = mias.length;
    document.title = (n ? `(${n}) ` : "") + "MTI · Ofertas";
    const a = root().querySelector('.mti-nav a[href="#/alertas"]');
    if (a) a.innerHTML = `Alertas${n ? ` <span class="mti-badge">${n}</span>` : ""}`;
    return mias;
  }
  function avisoFichaCambio() {
    if (root().querySelector("#mti-vivo")) return;
    const pg = root().querySelector(".mti-page");
    if (!pg) return;
    const div = document.createElement("div");
    div.id = "mti-vivo"; div.className = "mti-vivo no-print";
    div.innerHTML = `<span>🔄 Otra persona actualizó esta oferta.</span>${(S.edit && S.edit.dirty) || (S.imp && S.imp.sucio) ? '<span class="mti-muted sm">Guarde o descarte sus cambios para ver la versión nueva.</span>' : '<button class="mti-btn sm dark" data-vivo="ver">Ver cambios</button>'}`;
    pg.prepend(div);
    const b = div.querySelector("[data-vivo]");
    if (b) b.onclick = async () => { try { setFicha(await api.get("mti_cotizacion", { name: S.ficha.name })); render(); } catch (e) { toast(e.message, true); } };
  }
  let vigiando = false;
  async function vigiar(forzar) {
    if (vigiando || !S.data || !S.vigia || (document.hidden && !forzar)) return;
    vigiando = true;
    try {
      const antes = new Set(S.alVistas || []);
      const v = S.vigia;
      v.vueltas++;
      // cambio de día o recarga completa periódica (ofertas eliminadas, clientes, catálogos, notas)
      if (hoyTxt() !== v.dia || (v.vueltas >= VIGIA_COMPLETA && !enFicha() && !ocupado())) {
        S.data = await api.get("mti_datos");
        marcasVigia();
        renderVivo([]);
      } else {
        const [ofs, tas] = await Promise.all([
          listar(DT, ["name", "modified"], [["modified", ">", v.deal]], "modified asc", 100),
          intentar(() => listar("CRM Task", ["name", "reference_docname", "modified"], [["reference_doctype", "=", DT], ["modified", ">", v.tarea]], "modified asc", 100), []),
        ]);
        if (!ofs.length && !tas.length) return;
        v.deal = maxMod(ofs) || v.deal;
        v.tarea = maxMod(tas) || v.tarea;
        const deOtros = ofs.filter((o) => !(v.propias[o.name] && String(o.modified) <= v.propias[o.name])).map((o) => o.name);
        const nombres = [...new Set([...deOtros, ...tas.map((t) => t.reference_docname).filter(Boolean)])];
        if (!nombres.length) return;
        if (nombres.length > 25) { S.data = await api.get("mti_datos"); marcasVigia(); }
        else for (const n of nombres) await refrescarOferta(n, false);
        renderVivo(deOtros);
      }
      // alertas nuevas para mis áreas → aviso
      const ahora = enFicha() || ocupado() ? actualizarContador() : (soloLectura() ? [] : construirAlertas(true));
      if (enFicha() || ocupado()) S.alVistas = new Set(ahora.map((a) => a.id));
      const nuevas = ahora.filter((a) => !antes.has(a.id));
      if (nuevas.length && antes.size + nuevas.length > 0) {
        toast(nuevas.length === 1 ? `🔔 Nueva alerta: ${nuevas[0].t}` : `🔔 ${nuevas.length} alertas nuevas en ${[...new Set(nuevas.map((a) => (AREAS.find((x) => x[0] === a.area) || [])[1]))].join(", ")}`);
      }
    } catch (e) {
      /* sin conexión o sesión vencida: se intenta de nuevo en la siguiente vuelta */
    } finally { vigiando = false; }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
