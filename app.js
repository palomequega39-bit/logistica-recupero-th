let ordenes = [];
let filtradas = [];
let indiceSeleccionado = -1;
let sortField = null;
let ordenAsc = true;
let seleccionados = new Set(); // Para guardar los IDs de las órdenes seleccionadas
const ODOO_BASE_URL = "https://technohealth.odoo.com/web";
const ODOO_ID_OFFSET = 3;
const ODOO_QUERY = "cids=1&menu_id=531&action=799&model=sale.order&view_type=form"

/* =========================
   RECUPERO - ESTADOS
   El botón de cada fila cicla en este orden.
========================= */
const ESTADOS_RECUPERO = [
  { key: "no_pedido",     label: "No Pedido"    },
  { key: "completo",      label: "Completo"     },
  { key: "faltan",        label: "Faltan cosas" },
  { key: "sin_realizar",  label: "Sin Realizar" }
];

function labelEstadoRecupero(key){
  const e = ESTADOS_RECUPERO.find(e => e.key === key);
  return e ? e.label : ESTADOS_RECUPERO[0].label;
}

function buscarOrdenPorId(ordenId){
  return ordenes.find(o => o.Orden === ordenId);
}

/* =========================
   RECUPERO - HISTORIAL PERSISTENTE POR N° DE ORDEN (localStorage)
   Objetivo: que el estado de recupero de una orden (Nº X) se recuerde
   aunque cargues un CSV/Excel distinto más adelante (ej. una versión
   actualizada del mismo listado). A diferencia del "respaldo de sesión"
   de más abajo, ESTE historial NO se borra al cargar un archivo nuevo.
   Vive solo en este navegador (no es un backend ni la nube), así que
   no se comparte entre computadoras.
========================= */
const HISTORIAL_KEY_ESTADOS = "recuperoTH_historialEstados_v1";

function cargarHistorialEstados(){
  try{
    return JSON.parse(localStorage.getItem(HISTORIAL_KEY_ESTADOS)) || {};
  }catch(e){
    console.warn("Historial de estados corrupto, se descarta:", e);
    return {};
  }
}

function actualizarHistorialEstado(ordenId, estadoKey){
  try{
    const historial = cargarHistorialEstados();
    historial[ordenId] = estadoKey;
    localStorage.setItem(HISTORIAL_KEY_ESTADOS, JSON.stringify(historial));
  }catch(e){
    console.warn("No se pudo guardar el historial de estados:", e);
  }
}

function borrarHistorialEstados(){
  if(!confirm("¿Borrar el historial de estados de recupero guardado en este navegador? Esta acción no se puede deshacer.")) return;
  localStorage.removeItem(HISTORIAL_KEY_ESTADOS);
  alert("Historial de estados borrado.");
}

/* =========================
   SECRETARÍA
   Lista de valores abierta: cualquier operario puede agregar una
   Secretaría nueva desde el propio select de la fila ("+ Agregar nueva...").
   La asignación por orden funciona EXACTAMENTE igual que el Estado de
   Recupero: se guarda por Nº de Orden, sobrevive a cargar un archivo
   nuevo, y se sincroniza en vivo entre dispositivos vía Firebase.
========================= */
const SECRETARIAS_LISTA_KEY = "recuperoTH_listaSecretarias_v1";
const HISTORIAL_KEY_SECRETARIA = "recuperoTH_historialSecretaria_v1";

let listaSecretarias = [];          // lista compartida de valores disponibles
let secretariasRef = null;          // ref de Firebase para la lista
let secretariaPorOrdenRef = null;   // ref de Firebase para la asignación por orden
let secretariaRemotaCache = {};     // último snapshot remoto, para aplicar al cargar un archivo nuevo

function cargarListaSecretariasLocal(){
  try{ return JSON.parse(localStorage.getItem(SECRETARIAS_LISTA_KEY)) || []; }
  catch(e){ console.warn("Lista de secretarías corrupta, se descarta:", e); return []; }
}

function guardarListaSecretariasLocal(lista){
  try{ localStorage.setItem(SECRETARIAS_LISTA_KEY, JSON.stringify(lista)); }
  catch(e){ console.warn("No se pudo guardar la lista de secretarías:", e); }
}

listaSecretarias = cargarListaSecretariasLocal();

function cargarHistorialSecretaria(){
  try{ return JSON.parse(localStorage.getItem(HISTORIAL_KEY_SECRETARIA)) || {}; }
  catch(e){ console.warn("Historial de secretarías corrupto, se descarta:", e); return {}; }
}

function actualizarHistorialSecretaria(ordenId, nombre){
  try{
    const historial = cargarHistorialSecretaria();
    if(nombre) historial[ordenId] = nombre; else delete historial[ordenId];
    localStorage.setItem(HISTORIAL_KEY_SECRETARIA, JSON.stringify(historial));
  }catch(e){ console.warn("No se pudo guardar el historial de secretarías:", e); }
}

/**
 * Agrega una Secretaría nueva a la lista compartida (si no existe ya,
 * sin distinguir mayúsculas/minúsculas) y la sincroniza a Firebase.
 */
function agregarSecretaria(nombre){
  const limpio = (nombre || "").trim();
  if(!limpio) return;

  const yaExiste = listaSecretarias.some(s => s.toLowerCase() === limpio.toLowerCase());
  if(!yaExiste){
    listaSecretarias.push(limpio);
    listaSecretarias.sort((a,b) => a.localeCompare(b));
    guardarListaSecretariasLocal(listaSecretarias);
    actualizarSelectsSecretaria();
  }

  if(firebaseListo && secretariasRef){
    secretariasRef.push(limpio).catch(e => console.warn("No se pudo sincronizar la nueva Secretaría:", e));
  }
}

function publicarSecretariaRemota(ordenId, nombre){
  if(!firebaseListo || !secretariaPorOrdenRef) return;
  secretariaPorOrdenRef.child(ordenId).set({
    secretaria: nombre,
    ts: firebase.database.ServerValue.TIMESTAMP
  }).catch(e => console.warn("No se pudo sincronizar la Secretaría en la nube:", e));
}

/**
 * Asigna una Secretaría a una orden (en memoria + DOM visible + historial
 * local), sin importar si vino de un click local o de una actualización
 * remota de otro dispositivo.
 */
function aplicarCambioSecretaria(ordenId, nombre, { publicarRemoto = false } = {}){
  const orden = buscarOrdenPorId(ordenId);

  actualizarHistorialSecretaria(ordenId, nombre);

  if(orden){
    orden.Secretaria = nombre || "";
    const sel = document.querySelector(`.select-secretaria[data-id="${CSS.escape(ordenId)}"]`);
    if(sel) sel.value = orden.Secretaria;
  }

  if(publicarRemoto) publicarSecretariaRemota(ordenId, nombre);
}

/** Maneja el cambio del select de Secretaría de una fila, incluida la opción "+ Agregar nueva...". */
function manejarCambioSecretariaSelect(selectEl, ordenId){
  const valor = selectEl.value;

  if(valor === "__nueva__"){
    const nombre = prompt("Nombre de la nueva Secretaría:");
    const limpio = (nombre || "").trim();
    if(!limpio){
      const orden = buscarOrdenPorId(ordenId);
      selectEl.value = (orden && orden.Secretaria) || "";
      return;
    }
    agregarSecretaria(limpio);
    aplicarCambioSecretaria(ordenId, limpio, { publicarRemoto: true });
    return;
  }

  aplicarCambioSecretaria(ordenId, valor, { publicarRemoto: true });
}

/** Arma las <option> del select de Secretaría, con la actual ya seleccionada. */
function opcionesSecretariaHTML(seleccionActual){
  const actual = seleccionActual || "";
  const opciones = listaSecretarias.map(s =>
    `<option value="${s}" ${s === actual ? "selected" : ""}>${s}</option>`
  ).join("");
  return `<option value="" ${!actual ? "selected" : ""}>— Sin asignar —</option>${opciones}<option value="__nueva__">+ Agregar nueva…</option>`;
}

/** Refresca las <option> de todos los selects de Secretaría visibles y del filtro, sin perder la selección de cada uno. */
function actualizarSelectsSecretaria(){
  document.querySelectorAll(".select-secretaria").forEach(sel => {
    const orden = buscarOrdenPorId(sel.dataset.id);
    sel.innerHTML = opcionesSecretariaHTML(orden ? orden.Secretaria : sel.value);
  });
  fillSecretariaFiltro();
}

/* =========================
   RECUPERO - SINCRONIZACIÓN EN VIVO ENTRE DISPOSITIVOS (Firebase)
   Objetivo: que al tocar el botón de Recupero en una computadora, el
   cambio se vea al instante en las otras (celular, notebook, etc.).
   Requiere que /firebase-config.js tenga las credenciales del proyecto
   de Firebase (ver instrucciones en ese archivo). Si no está configurado,
   la app sigue funcionando igual que antes, solo que sin sincronizar.
========================= */
let firebaseListo = false;
let estadosRemotosRef = null;
let estadosRemotosCache = {}; // último snapshot conocido de Firebase, para aplicarlo también al cargar un archivo nuevo

function inicializarSyncRemoto(){
  const indicador = document.getElementById("syncStatus");

  if (typeof FIREBASE_CONFIG === "undefined" || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === "TU_API_KEY") {
    console.warn("Firebase no está configurado (ver firebase-config.js). La sincronización en vivo está desactivada.");
    if (indicador) { indicador.textContent = "⚪ Sync no configurada"; indicador.title = "Completá firebase-config.js para activar la sincronización entre dispositivos"; }
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    estadosRemotosRef = firebase.database().ref("estadosRecupero");
    firebaseListo = true;

    // Estado de conexión (path especial de Firebase RTDB)
    firebase.database().ref(".info/connected").on("value", snap => {
      const conectado = snap.val() === true;
      if (indicador) {
        indicador.textContent = conectado ? "🟢 Sincronizado" : "🔴 Sin conexión";
        indicador.title = conectado
          ? "Los cambios de estado se comparten en vivo con los otros dispositivos"
          : "Sin conexión a la nube: los cambios se guardan localmente y se sincronizan al reconectar";
      }
    });

    // Escuchamos TODOS los cambios remotos (de cualquier dispositivo) en vivo
    estadosRemotosRef.on("value", snapshot => {
      const remoto = snapshot.val() || {};
      estadosRemotosCache = remoto;
      Object.keys(remoto).forEach(ordenId => {
        aplicarCambioEstado(ordenId, remoto[ordenId].estado, { publicarRemoto: false });
      });

      // 🔴 Subimos automáticamente los estados que ya teníamos guardados
      // localmente (ej. cargados antes de terminar de configurar Firebase)
      // y que todavía no están en la nube. Así no se pierden ni hay que
      // volver a cargarlos a mano.
      const historialLocalEstados = cargarHistorialEstados();
      Object.keys(historialLocalEstados).forEach(ordenId => {
        if(!remoto[ordenId]) publicarEstadoRemoto(ordenId, historialLocalEstados[ordenId]);
      });
    });

    // --- Secretaría: lista compartida ---
    secretariasRef = firebase.database().ref("secretarias");
    secretariasRef.on("value", snapshot => {
      const val = snapshot.val() || {};
      const remotas = Object.values(val).filter(Boolean);

      // 🔴 FIX: antes esto pisaba directamente la lista local con la
      // remota. Si la remota llegaba vacía (recién conectado Firebase),
      // borraba las secretarías que ya tenías cargadas localmente. Ahora
      // fusionamos ambas listas en vez de pisar.
      const localesNoSubidas = listaSecretarias.filter(local =>
        !remotas.some(r => r.toLowerCase() === local.toLowerCase())
      );

      listaSecretarias = [...new Set([...remotas, ...localesNoSubidas])].sort((a,b) => a.localeCompare(b));
      guardarListaSecretariasLocal(listaSecretarias);
      actualizarSelectsSecretaria();

      // Subimos automáticamente a Firebase las que todavía no estaban ahí
      localesNoSubidas.forEach(nombre => secretariasRef.push(nombre));
    });

    // --- Secretaría: asignación por orden ---
    secretariaPorOrdenRef = firebase.database().ref("secretariaPorOrden");
    secretariaPorOrdenRef.on("value", snapshot => {
      const remoto = snapshot.val() || {};
      secretariaRemotaCache = remoto;
      Object.keys(remoto).forEach(ordenId => {
        aplicarCambioSecretaria(ordenId, remoto[ordenId].secretaria, { publicarRemoto: false });
      });

      // 🔴 Igual que con los estados: subimos automáticamente las
      // asignaciones por orden que ya teníamos guardadas localmente y
      // todavía no están en la nube.
      const historialLocalSecretaria = cargarHistorialSecretaria();
      Object.keys(historialLocalSecretaria).forEach(ordenId => {
        if(!remoto[ordenId]) publicarSecretariaRemota(ordenId, historialLocalSecretaria[ordenId]);
      });
    });
  } catch (e) {
    console.warn("No se pudo inicializar la sincronización remota:", e);
    if (indicador) { indicador.textContent = "🔴 Error de sync"; }
  }
}

function publicarEstadoRemoto(ordenId, estadoKey){
  if (!firebaseListo || !estadosRemotosRef) return;
  estadosRemotosRef.child(ordenId).set({
    estado: estadoKey,
    ts: firebase.database.ServerValue.TIMESTAMP
  }).catch(e => console.warn("No se pudo sincronizar el estado en la nube:", e));
}

/**
 * Aplica un estado de recupero a una orden (en memoria + DOM visible + chip
 * de detalle + historial local), sin importar si vino de un click local o
 * de una actualización remota de otro dispositivo. Si publicarRemoto es
 * true, además lo empuja a Firebase para que lo vean los demás.
 */
function aplicarCambioEstado(ordenId, estadoKey, { publicarRemoto = false } = {}){
  const orden = buscarOrdenPorId(ordenId);

  // Igual guardamos en el historial local aunque la orden no esté cargada
  // ahora mismo, para que aparezca correcta si se carga más tarde.
  actualizarHistorialEstado(ordenId, estadoKey);

  if (orden) {
    orden.EstadoRecupero = estadoKey;

    const checkbox = document.querySelector(`.check-orden[data-id="${CSS.escape(ordenId)}"]`);
    const fila = checkbox ? checkbox.closest(".fila") : null;
    if (fila) {
      const esFav = fila.classList.contains("favorito");
      fila.className = `fila ${esFav ? 'favorito' : ''} recupero-${estadoKey}`;
      const btn = fila.querySelector(".btn-recupero");
      if (btn) {
        btn.className = `btn-recupero estado-${estadoKey}`;
        btn.textContent = labelEstadoRecupero(estadoKey);
      }
    }

    if (indiceSeleccionado >= 0 && filtradas[indiceSeleccionado] && filtradas[indiceSeleccionado].Orden === ordenId) {
      mostrar(orden);
    }

    guardarBackupEstados();
    actualizarLabelsInformativos();
  }

  if (publicarRemoto) publicarEstadoRemoto(ordenId, estadoKey);
}

/* =========================
   RECUPERO - RESPALDO AUTOMÁTICO (localStorage)
   Objetivo: que un refresh accidental del navegador no borre
   una sesión de recupero en curso. NO es un backend ni la nube:
   vive solo en este navegador y se borra al cargar un archivo nuevo.
========================= */
const BACKUP_KEY_DATOS = "recuperoTH_backup_datos_v1";
const BACKUP_KEY_ESTADOS = "recuperoTH_backup_estados_v1";
const BACKUP_KEY_META = "recuperoTH_backup_meta_v1";

let nombreArchivoActual = "";

function guardarBackupDatos(dataCruda){
  try{
    localStorage.setItem(BACKUP_KEY_DATOS, JSON.stringify(dataCruda));
    localStorage.setItem(BACKUP_KEY_META, JSON.stringify({
      archivo: nombreArchivoActual || "archivo sin nombre",
      fecha: new Date().toLocaleString("es-AR")
    }));
  }catch(e){
    console.warn("No se pudo guardar el respaldo local (datos):", e);
  }
}

function guardarBackupEstados(){
  try{
    const mapaEstados = {};
    ordenes.forEach(o=>{
      mapaEstados[o.Orden] = {
        EstadoRecupero: o.EstadoRecupero
      };
    });
    localStorage.setItem(BACKUP_KEY_ESTADOS, JSON.stringify(mapaEstados));
  }catch(e){
    console.warn("No se pudo guardar el respaldo local (estados):", e);
  }
}

function borrarBackup(){
  localStorage.removeItem(BACKUP_KEY_DATOS);
  localStorage.removeItem(BACKUP_KEY_ESTADOS);
  localStorage.removeItem(BACKUP_KEY_META);
}

function ocultarBackupBanner(){
  const banner = document.getElementById("backupBanner");
  if(banner) banner.classList.add("hidden");
}

function intentarRestaurarBackup(){
  const dataCruda = localStorage.getItem(BACKUP_KEY_DATOS);
  if(!dataCruda) return;

  const banner = document.getElementById("backupBanner");
  const info = document.getElementById("backupBannerInfo");
  if(!banner || !info) return;

  let metaObj = {};
  try{ metaObj = JSON.parse(localStorage.getItem(BACKUP_KEY_META)) || {}; }catch(e){ metaObj = {}; }

  info.textContent = `⚠ Hay una sesión de recupero sin exportar (${metaObj.archivo || "archivo"}, cargada ${metaObj.fecha || ""}). ¿Restaurarla?`;
  banner.classList.remove("hidden");
}


function restaurarBackup(){
  const dataCrudaTxt = localStorage.getItem(BACKUP_KEY_DATOS);
  const estadosTxt = localStorage.getItem(BACKUP_KEY_ESTADOS);
  if(!dataCrudaTxt){ ocultarBackupBanner(); return; }

  let data, mapaEstados;
  try{
    data = JSON.parse(dataCrudaTxt);
    mapaEstados = estadosTxt ? JSON.parse(estadosTxt) : {};
  }catch(e){
    console.warn("Respaldo local corrupto, se descarta:", e);
    borrarBackup();
    ocultarBackupBanner();
    return;
  }

  let metaObj = {};
  try{ metaObj = JSON.parse(localStorage.getItem(BACKUP_KEY_META)) || {}; }catch(e){ metaObj = {}; }
  nombreArchivoActual = metaObj.archivo || "Sesión restaurada";

  procesar(data);

  // Reaplicamos los estados y observaciones que estaban guardados
  ordenes.forEach(o=>{
    if(mapaEstados[o.Orden]){
      o.EstadoRecupero = mapaEstados[o.Orden].EstadoRecupero || "no_pedido";
    }
  });
  guardarBackupEstados();

  document.getElementById("fileName").textContent = nombreArchivoActual;
  document.getElementById("fileStatus").classList.remove("hidden");

  aplicarFiltros();
  actualizarLabelsInformativos();
  ocultarBackupBanner();
}

function descartarBackup(){
  borrarBackup();
  ocultarBackupBanner();
}

/* =========================
   INIT
========================= */


document.getElementById("buscadorGlobal")
  .addEventListener("input", aplicarFiltros);

inicializarSyncRemoto();

// Dentro de app.js, donde configures los eventos:
document.getElementById("btnExportarPDF").onclick = () => {
    exportarDetallePDF(filtradas, seleccionados);
};
document.getElementById("btnExportarPDFv2").onclick = () => {
    exportarDetallePDFv2(filtradas, seleccionados);
};
document.getElementById("btnExportarWhatsApp").onclick = () => {
    exportarMensajeWhatsApp(filtradas, seleccionados);
};

/* =========================
   MODAL DE FILTROS
========================= */

const modalFiltros = document.getElementById("modalFiltros");

function abrirModalFiltros(){
  modalFiltros.classList.remove("hidden");
}

function cerrarModalFiltros(){
  modalFiltros.classList.add("hidden");
}

document.getElementById("btnAbrirFiltros").onclick = abrirModalFiltros;
document.getElementById("btnCerrarFiltros").onclick = cerrarModalFiltros;

/* =========================
   PANTALLA COMPLETA
   Oculta la barra del navegador en tablets/celulares mientras se usa
   la app (se sale tocando el mismo botón o con el gesto propio del SO).
========================= */
const btnPantallaCompleta = document.getElementById("btnPantallaCompleta");

function estaEnPantallaCompleta(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function actualizarBotonPantallaCompleta(){
  if(!btnPantallaCompleta) return;
  btnPantallaCompleta.textContent = estaEnPantallaCompleta() ? "⛶ Salir de pantalla completa" : "⛶ Pantalla completa";
}

btnPantallaCompleta.onclick = () => {
  const el = document.documentElement;
  if(!estaEnPantallaCompleta()){
    const solicitar = el.requestFullscreen || el.webkitRequestFullscreen;
    if(solicitar) solicitar.call(el).catch(() => {
      alert("Este navegador no permite pantalla completa automática. Probá 'Agregar a pantalla de inicio' desde el menú del navegador: eso abre la app sin barras.");
    });
  } else {
    const salir = document.exitFullscreen || document.webkitExitFullscreen;
    if(salir) salir.call(document);
  }
};

document.addEventListener("fullscreenchange", actualizarBotonPantallaCompleta);
document.addEventListener("webkitfullscreenchange", actualizarBotonPantallaCompleta);

// Cerrar al hacer click afuera del panel (sobre el fondo oscuro)
modalFiltros.addEventListener("click", e => {
  if(e.target === modalFiltros) cerrarModalFiltros();
});

// Cerrar con la tecla Escape
document.addEventListener("keydown", e => {
  if(e.key === "Escape" && !modalFiltros.classList.contains("hidden")){
    cerrarModalFiltros();
  }
});

/* =========================
   DROPZONE (NUEVO)
========================= */

const dz = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");

dz.addEventListener("dragover", e=>{
  e.preventDefault();
  dz.classList.add("hover");
});

dz.addEventListener("dragleave", ()=>{
  dz.classList.remove("hover");
});

dz.addEventListener("drop", e=>{
  e.preventDefault();
  dz.classList.remove("hover");

  const file = e.dataTransfer.files[0];
  fileInput.files = e.dataTransfer.files;

  handleFile(file);
});

fileInput.addEventListener("change", e=>{
  handleFile(e.target.files[0]);
});

/* =========================
   FILE LOAD
========================= */

function handleFile(file){

  if(!file) return;

  // Un archivo nuevo reinicia todo: se descarta cualquier respaldo previo
  ocultarBackupBanner();
  borrarBackup();
  nombreArchivoActual = file.name;

    limpiarDetalleOrden();
  seleccionados.clear();
  document.getElementById("selectAll").checked = false;

    actualizarLabelsInformativos();
   
  document.getElementById("fileName").textContent = file.name;
  document.getElementById("fileStatus").classList.remove("hidden");

  const ext = file.name.split(".").pop().toLowerCase();

  if(ext === "xlsx" || ext === "xls"){
    leerExcel(file);
  } else {
    // sigue funcionando CSV normal
    Papa.parse(file,{
      header:true,
      delimiter:";",
      skipEmptyLines:true,
      complete: res=>procesar(res.data)
    });
  }
}

/* =========================
   DATA
========================= */

function procesar(data){

  const map = {};

  data.forEach(r=>{

    // 🔴 NORMALIZAR HEADERS (BOM + espacios)
    const limpio = {};
    Object.keys(r).forEach(k=>{
      const key = k.replace(/\uFEFF/g, "").trim();
      limpio[key] = r[k];
    });

    r = limpio;

    if(!r.Orden) return;

    // 🔴 Normalizamos el Nº de Orden (trim) para que el cruce entre exports
    // de distintas personas no falle por un espacio de más al final/inicio.
    r.Orden = r.Orden.toString().trim();

    r.Paciente = (r.Apellido || "") + " " + (r.Nombre || "");
    r.Institucion = r.Institucion || "";
    r.Ciudad = r.Ciudad || "";
    r.Prioridad = r.Prioridad || "";
    r.Devolucion = r.Devolucion || "";
    r.Foja = r.Foja || "";
    r.CI = r.CI || "";
    r.Favorito = (r.Favorito || "").toUpperCase();
   
    if(!map[r.Orden]){
      map[r.Orden] = {...r, detalles:[], EstadoRecupero:"no_pedido"};
    }

    map[r.Orden].detalles.push(r);
  });

  ordenes = Object.values(map);

  // 🔴 Restauramos el estado de recupero de cada orden desde el historial
  // persistente local (si esa orden ya se había trabajado en un archivo anterior)
  const historial = cargarHistorialEstados();
  ordenes.forEach(o=>{
    if(historial[o.Orden]){
      o.EstadoRecupero = historial[o.Orden];
    }
  });

  // 🔴 Si ya tenemos un snapshot de Firebase (llegó antes de cargar este
  // archivo), tiene prioridad por ser la fuente compartida más actualizada.
  ordenes.forEach(o=>{
    if(estadosRemotosCache[o.Orden]){
      o.EstadoRecupero = estadosRemotosCache[o.Orden].estado;
    }
  });

  // 🔴 Igual que el Estado de Recupero: restauramos la Secretaría asignada
  // (historial local primero, Firebase después si ya llegó, con prioridad).
  const historialSecretaria = cargarHistorialSecretaria();
  ordenes.forEach(o=>{
    o.Secretaria = historialSecretaria[o.Orden] || "";
  });
  ordenes.forEach(o=>{
    if(secretariaRemotaCache[o.Orden]){
      o.Secretaria = secretariaRemotaCache[o.Orden].secretaria || "";
    }
  });

  seleccionados.clear();
  document.getElementById("selectAll").checked = false;
  limpiarDetalleOrden();

  guardarBackupDatos(data);
  guardarBackupEstados();

  console.log("Órdenes cargadas:", ordenes.length);

  cargarFiltros();
  aplicarFiltros();
}

/* =========================
   FILTROS
========================= */

function cargarFiltros() {
    fillEstadoRecupero();
    fill("filtroPrioridad", "Prioridad");
    fillSecretariaFiltro();
    fill("filtroCiudad", "Ciudad");
    fill("filtroVendedor", "Vendedor");
    fill("filtroMedico", "Medico");

    document.getElementById("filtroFavorito").innerHTML = `
        <option value="">Todos</option>
        <option value="SI">Solo Favoritos</option>
        <option value="NO">Normales</option>
    `;

    fillBool("filtroDevolucion");
    fillBool("filtroFoja");
    fillBool("filtroCI");
    fillFecha();
    cargarInstituciones();

    // Escuchar cambios en todos los select y inputs de filtros
    // (tanto los del modal de Filtros como los rápidos de la barra de contadores)
    const controles = document.querySelectorAll('.filters select, .filters input, .quick-filters select');
    controles.forEach(el => {
        el.addEventListener('change', aplicarFiltros);
        if(el.tagName === "INPUT") el.addEventListener('keyup', aplicarFiltros);
    });
   document.getElementById("btnLimpiar").onclick = borrarFiltros;
   document.getElementById("btnBorrarHistorial").onclick = borrarHistorialEstados;
   
}

function fill(id,campo){
  const sel=document.getElementById(id);
  const vals=[...new Set(ordenes.map(o=>o[campo]).filter(Boolean))];

  sel.innerHTML=`<option value="">Todos</option>`+
    vals.map(v=>`<option>${v}</option>`).join("");
}

function fillEstadoRecupero(){
  const sel = document.getElementById("filtroEstadoRecupero");
  sel.innerHTML = `<option value="">Estado: Todos</option>` +
    ESTADOS_RECUPERO.map(e => `<option value="${e.key}">${e.label}</option>`).join("");
}

function fillSecretariaFiltro(){
  const sel = document.getElementById("filtroSecretaria");
  if(!sel) return;
  const actual = sel.value;
  sel.innerHTML = `<option value="">Secretaría: Todas</option>` +
    `<option value="__sin_asignar__">Sin Asignar</option>` +
    listaSecretarias.map(s => `<option value="${s}">${s}</option>`).join("");
  if(actual === "__sin_asignar__" || listaSecretarias.includes(actual)) sel.value = actual;
}

function fillBool(id){
  document.getElementById(id).innerHTML=`
    <option value="">Todos</option>
    <option value="VERDADERO">SI</option>
    <option value="FALSO">NO</option>
  `;
}

function fillFecha(){
  document.getElementById("filtroFecha").innerHTML=`
    <option value="">Fecha CX: Todas</option>
    <option value="realizadas">Realizadas</option>
    <option value="hoy">Hoy</option>
    <option value="pendientes">Sin realizar</option>
  `;
}

/* =========================
   FILTRAR
========================= */

function aplicarFiltros(){
  const f = id => document.getElementById(id).value;
  const texto = document.getElementById("buscadorGlobal").value.toLowerCase();

  const hoy = new Date();
  hoy.setHours(0,0,0,0);

  filtradas = ordenes.filter(o => {
    // Filtros de Selección Simple
    if(f("filtroEstadoRecupero") && o.EstadoRecupero !== f("filtroEstadoRecupero")) return false;

    if(f("filtroInstitucion") && o.Institucion !== f("filtroInstitucion")) return false;
    if(f("filtroCiudad") && o.Ciudad !== f("filtroCiudad")) return false;
    if(f("filtroPrioridad") && o.Prioridad !== f("filtroPrioridad")) return false;

    const valorFiltroSecretaria = f("filtroSecretaria");
    if(valorFiltroSecretaria === "__sin_asignar__"){
      if(o.Secretaria) return false;
    } else if(valorFiltroSecretaria && (o.Secretaria || "") !== valorFiltroSecretaria){
      return false;
    }

    if(f("filtroVendedor") && o.Vendedor !== f("filtroVendedor")) return false;
    if(f("filtroMedico") && o.Medico !== f("filtroMedico")) return false;

    // Filtros Booleanos
    if(f("filtroDevolucion") && o.Devolucion !== f("filtroDevolucion")) return false;
    if(f("filtroFoja") && o.Foja !== f("filtroFoja")) return false;
    if(f("filtroCI") && o.CI !== f("filtroCI")) return false;
    
    // Filtro Favoritos
    if(f("filtroFavorito")){
       const esFav = (o.Favorito === "FAVORITO" || o.Favorito === "SI");
       if(f("filtroFavorito") === "SI" && !esFav) return false;
       if(f("filtroFavorito") === "NO" && esFav) return false;
    }

    // Filtro de Fechas (CORREGIDO)
    if(f("filtroFecha")){
      // Convertimos DD/MM/YYYY a un objeto Date real para comparar
      const partes = o.FechaCX.split("/");
      if(partes.length !== 3) return false;
      const fechaCX = new Date(partes[2], partes[1] - 1, partes[0]);
      fechaCX.setHours(0,0,0,0);

      if(f("filtroFecha") === "realizadas" && fechaCX >= hoy) return false;
      if(f("filtroFecha") === "hoy" && fechaCX.getTime() !== hoy.getTime()) return false;
      if(f("filtroFecha") === "pendientes" && fechaCX < hoy) return false;
    }

    // Buscador Global
    if(texto){
      const detalleTexto = (o.detalles || []).map(d => `${d.Serie || ""} ${d.Lote || ""} ${d.Producto || ""} ${d.Remito || ""}`).join(" " );
      const combinado = `${o.Orden} ${o.Apellido} ${o.Nombre} ${o.Dni} ${o.ObraSocial} ${o.Institucion} ${detalleTexto}`.toLowerCase();
      if(!combinado.includes(texto)) return false;
    }

    return true;
  });

  indiceSeleccionado = -1;
    limpiarDetalleOrden();
  document.getElementById("selectAll").checked = false;
  seleccionados = new Set([...seleccionados].filter(id => filtradas.some(o => o.Orden === id)));
  renderLista();
   actualizarLabelsInformativos();
}

/* =========================
   LISTA
========================= */

function renderLista(){

  const cont=document.getElementById("ordenesList");
  cont.innerHTML="";

  if(sortField){
    filtradas.sort((a,b)=>{

      let valA, valB;

      if(sortField === "Paciente"){
        valA = (a.Apellido + " " + a.Nombre).toLowerCase();
        valB = (b.Apellido + " " + b.Nombre).toLowerCase();
      }
     else if(sortField === "FechaCX"){
        const pA = (a.FechaCX || "01/01/1900").split("/");
        const pB = (b.FechaCX || "01/01/1900").split("/");
        valA = new Date(pA[2], pA[1]-1, pA[0]);
        valB = new Date(pB[2], pB[1]-1, pB[0]);
      }
      else if(sortField === "EstadoRecupero"){
        valA = ESTADOS_RECUPERO.findIndex(e => e.key === a.EstadoRecupero);
        valB = ESTADOS_RECUPERO.findIndex(e => e.key === b.EstadoRecupero);
      }
      else{
        valA = (a[sortField] || "").toString().toLowerCase();
        valB = (b[sortField] || "").toString().toLowerCase();
      }

      if(valA < valB) return ordenAsc ? -1 : 1;
      if(valA > valB) return ordenAsc ? 1 : -1;
      return 0;
    });

     
  }

  filtradas.forEach((o, i) => {
    const fila = document.createElement("div");
    const esFav = o.Favorito === "FAVORITO" || o.Favorito === "SI";
    fila.className = `fila ${esFav ? 'favorito' : ''} recupero-${o.EstadoRecupero}`;

    // Verificamos si esta orden ya estaba seleccionada
    const estaChequeado = seleccionados.has(o.Orden) ? "checked" : "";

    // IMPORTANTE: El input tipo checkbox DEBE ser el primer elemento 
    fila.innerHTML = `
      <input type="checkbox" class="check-orden" data-id="${o.Orden}" ${estaChequeado} 
             onclick="handleCheck(event, '${o.Orden}')">
      <span>${o.Orden}</span>
      <span title="${o.Apellido} ${o.Nombre}">${o.Apellido} ${o.Nombre}</span>
      <span>${o.Dni}</span>
      <span>${o.ObraSocial}</span>
      <span>${o.FechaCX || ""}</span>
      <span title="${o.Institucion}">${o.Institucion}</span>
      <span>${o.Prioridad}</span>
      <span class="semaforo-celda" title="Certificado de Implante: ${o.CI === 'VERDADERO' ? 'OK' : 'Falta'}"><span class="semaforo-dot ${o.CI === 'VERDADERO' ? 'si' : 'no'}"></span></span>
      <span class="semaforo-celda" title="Foja Quirúrgica: ${o.Foja === 'VERDADERO' ? 'OK' : 'Falta'}"><span class="semaforo-dot ${o.Foja === 'VERDADERO' ? 'si' : 'no'}"></span></span>
      <span class="semaforo-celda" title="Devolución: ${o.Devolucion === 'VERDADERO' ? 'Pendiente' : 'OK'}"><span class="semaforo-dot ${o.Devolucion === 'VERDADERO' ? 'dev-pendiente' : 'dev-ok'}"></span></span>
      <select class="select-secretaria" data-id="${o.Orden}" onclick="event.stopPropagation()" onchange="manejarCambioSecretariaSelect(this, '${o.Orden}')">${opcionesSecretariaHTML(o.Secretaria)}</select>
      <button class="btn-recupero estado-${o.EstadoRecupero}" onclick="cicloEstadoRecupero(event, '${o.Orden}')" title="Click para cambiar el estado de recupero">${labelEstadoRecupero(o.EstadoRecupero)}</button>
      <button class="btn-odoo" onclick="abrirOrdenOdoo(event, '${o.Orden}')" title="Abrir en Odoo">🔗</button>
    `;

    fila.onclick = (e) => {
      // Evitamos que se dispare si se hizo click directamente en el checkbox 
      if (e.target.type !== 'checkbox') {
        indiceSeleccionado = i;
        actualizarSeleccion();
      }
    };

    cont.appendChild(fila);
  });
}
function abrirOrdenOdoo(event, orden) {
  event.stopPropagation();

  const numeroOrden = parseInt((orden || "").replace(/\D/g, ""), 10);
  if (Number.isNaN(numeroOrden)) return;

  const odooId = numeroOrden - ODOO_ID_OFFSET;
  if (odooId <= 0) return;

  const url = `${ODOO_BASE_URL}#id=${odooId}&${ODOO_QUERY}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/* =========================
   RECUPERO - CICLO DE ESTADO
========================= */

function cicloEstadoRecupero(event, ordenId){
  event.stopPropagation();

  const orden = buscarOrdenPorId(ordenId);
  if(!orden) return;

  const idxActual = ESTADOS_RECUPERO.findIndex(e => e.key === orden.EstadoRecupero);
  const idxSiguiente = (idxActual + 1) % ESTADOS_RECUPERO.length;
  const nuevoEstado = ESTADOS_RECUPERO[idxSiguiente].key;

  // publicarRemoto:true → además de actualizar acá, lo empuja a Firebase
  // para que el cambio se vea en vivo en los otros dispositivos.
  aplicarCambioEstado(ordenId, nuevoEstado, { publicarRemoto: true });
}

/* =========================
   SELECCION
========================= */



function actualizarSeleccion() {
    const filas = document.querySelectorAll(".fila");
    
    // Limitar el índice para que no se salga de los bordes
    if (indiceSeleccionado < 0) indiceSeleccionado = 0;
    if (indiceSeleccionado >= filas.length) indiceSeleccionado = filas.length - 1;

    filas.forEach(f => f.classList.remove("active"));

    const fila = filas[indiceSeleccionado];
    if (!fila) return;

    fila.classList.add("active");
    mostrar(filtradas[indiceSeleccionado]);

    // --- SCROLL SINCRONIZADO ---
    const contenedor = document.getElementById("ordenesList");
    
    // Calculamos las posiciones
    const filaTop = fila.offsetTop;
    const filaBottom = filaTop + fila.offsetHeight;
    const contTop = contenedor.scrollTop;
    const contBottom = contTop + contenedor.offsetHeight;

    // Si la fila está arriba de lo visible, scrolleamos hacia arriba
    if (filaTop < contTop) {
        contenedor.scrollTop = filaTop;
    } 
    // Si la fila está abajo de lo visible, scrolleamos hacia abajo
    else if (filaBottom > contBottom) {
        contenedor.scrollTop = filaBottom - contenedor.offsetHeight;
    }
}

/* =========================
   DETALLE
========================= */

function mostrar(o){
  // Verificamos si es favorito para la estrella
  const esFav = (o.Favorito === "FAVORITO" || o.Favorito === "SI");
  const estrellaHtml = esFav ? `<span class="estrella">★</span>` : "";

  // 1. Línea principal: estrella - N° Orden - Paciente - DNI - Obra Social - semáforo C/F/D
  const cabTitulo = document.getElementById("cabeceraTitulo");
  if (cabTitulo) {
    cabTitulo.innerHTML = `
      ${estrellaHtml}
      <span class="ch-orden">${o.Orden}</span>
      <span class="ch-sep">·</span>
      <span class="ch-nombre">${o.Apellido} ${o.Nombre}</span>
      <span class="ch-sep">·</span>
      <span class="ch-dni">DNI ${o.Dni || "-"}</span>
      <span class="ch-sep">·</span>
      <span class="ch-os">${o.ObraSocial || ""}</span>
      <span class="ch-badges">
        <span class="badge-semaforo ${o.CI === 'VERDADERO' ? 'si' : 'no'}" title="Certificado de Implante: ${o.CI === 'VERDADERO' ? 'OK' : 'Falta'}">C</span>
        <span class="badge-semaforo ${o.Foja === 'VERDADERO' ? 'si' : 'no'}" title="Foja Quirúrgica: ${o.Foja === 'VERDADERO' ? 'OK' : 'Falta'}">F</span>
        <span class="badge-semaforo ${o.Devolucion === 'VERDADERO' ? 'dev-pendiente' : 'dev-ok'}" title="Devolución: ${o.Devolucion === 'VERDADERO' ? 'Pendiente' : 'OK'}">D</span>
      </span>
    `;
  }

  const cab = document.getElementById("cabecera");

  // 2. Línea de datos extra, solo lo pedido: Fecha CX - Médico - Solicitante - Expediente
  cab.innerHTML = `
    <div class="campo"><b>Fecha CX:</b> ${o.FechaCX || ""}</div>
    <div class="campo"><b>Médico:</b> ${o.Medico || ""}</div>
    <div class="campo"><b>Solicitante:</b> ${o.MedicoSolicitante || ""}</div>
    <div class="campo"><b>Expte:</b> ${o.Expediente || ""}</div>
  `;

  // 3. Detalle de productos
  const body=document.getElementById("detalleBody");
  body.innerHTML="";

  o.detalles.forEach(d=>{
    body.innerHTML+=`
      <tr>
        <td>${d.Remito||""}</td>
        <td>${d.FechaR||""}</td>
        <td>${d.Producto||""}</td>
        <td>${d.Q||""}</td>
        <td>${d.Lote||""}</td>
        <td>${d.Serie||""}</td>
        <td>${d.Vencimiento||""}</td>
      </tr>
    `;
  });
}

/* =========================
   TAGS
========================= */

function boolTag(val, tipo="normal"){
  const v = (val || "").toUpperCase();

  if(v === "VERDADERO"){
    if(tipo === "dev") return `<span class="tag dev">SI</span>`; // Naranja
    return `<span class="tag si">SI</span>`; // Verde
  }

  if(v === "FALSO") {
    // Si la devolución es NO, ahora usamos el estilo verde (si)
    if(tipo === "dev") return `<span class="tag si">NO</span>`; 
    return `<span class="tag no">NO</span>`; // Rojo para los demás
  }

  return "";
}
/* =========================
   INSTITUCIONES
========================= */

function cargarInstituciones() {
    const input = document.getElementById("filtroInstitucion");
    const lista = document.getElementById("listaInstituciones");

    const valores = [...new Set(ordenes.map(o => o.Institucion).filter(Boolean))];

    const renderInstituciones = (texto = "") => {
        const textoNormalizado = texto.toLowerCase().trim();
        const filtrados = textoNormalizado
            ? valores.filter(v => v.toLowerCase().includes(textoNormalizado))
            : valores;

        lista.innerHTML = filtrados
            .slice(0, 50)
            .map(v => `<div class="item-inst">${v}</div>`)
            .join("");
    };
      input.oninput = () => {
        renderInstituciones(input.value);
    };

    input.onfocus = () => renderInstituciones(input.value);
    input.onclick = () => renderInstituciones(input.value);
    // Al hacer clic en un ítem
    lista.onclick = e => {
        if (e.target.classList.contains("item-inst")) {
            input.value = e.target.textContent;
            lista.innerHTML = ""; // Oculta la lista al seleccionar
            aplicarFiltros();
        }
    };

    // Cerrar con la tecla Escape mientras se escribe en el input
    input.onkeydown = e => {
        if (e.key === "Escape") {
            lista.innerHTML = "";
            input.blur(); // Quita el foco del input
        }
    };
}

/* =========================
   SORT
========================= */

function sortBy(field){

  if(sortField === field){
    ordenAsc = !ordenAsc;
  } else {
    sortField = field;
    ordenAsc = true;
  }

  document.querySelectorAll(".tabla-header span").forEach(s=>{
    s.classList.remove("active","asc","desc");
  });

  document.querySelectorAll(".tabla-header span").forEach(h=>{
    const onclick = h.getAttribute("onclick") || "";
    if(onclick.includes(field)){
      h.classList.add("active");
      h.classList.add(ordenAsc ? "asc" : "desc");
    }
  });

  renderLista();
}

/* =========================
   UI HELPERS (NUEVO)
========================= */

function configurarPlaceholders() {
    const buscadorGlobal = document.getElementById("buscadorGlobal");
    
    // Estos son los campos que definiste en tu función aplicarFiltros()
    const camposPermitidos = ["Orden", "Apellido", "Nombre", "DNI", "Obra Social", "Institución", "N° de Serie", "Lote", "Nombre del Producto", "N° de Remito"];
    
    // Unimos los campos con una coma y los ponemos en el placeholder
    buscadorGlobal.placeholder = "Buscar por: " + camposPermitidos.join(", ") + "...";
}

// Llamamos a la función al cargar el script
configurarPlaceholders();

function leerExcel(file){

  const reader = new FileReader();

  reader.onload = function(e){

    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, {type: "array"});

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convertimos a array plano
    let json = XLSX.utils.sheet_to_json(sheet, {header:1});
   
    // 🔥 acá entra tu magia
    const procesado = preProcesarExcel(json);
     
   // 👇 EXPORTAR DEBUG
   //exportarCSV(procesado);
     
    // Convertimos a CSV
    const csv = Papa.unparse(procesado, {
      delimiter: ";"
    });

    // Volvemos a tu flujo actual.
    Papa.parse(csv,{
      header:true,
      delimiter:";",
      skipEmptyLines:true,
      complete: res=>procesar(res.data)
    });

  };

  reader.readAsArrayBuffer(file);
}

/* ... resto del código anterior ... */

function preProcesarExcel(rows) {
    if (rows.length < 2) return [];

    const datosCrudos = rows.slice(1); 
    let resultadoIntermedio = [];
    let ref = {};

    datosCrudos.forEach((r) => {
        if (r[0] && r[0].toString().trim() !== "") {
            ref = {
                Orden: r[0], 
                Apellido: r[3], 
                Nombre: r[4], 
                Dni: r[5],
                ObraSocial: r[6], 
                FechaCX: r[7], 
                Vendedor: r[12],
                Medico: r[13], 
                MedicoSolicitante: r[14], 
                Foja: r[15],
                Certificado: r[16], 
                Actividades: r[17], 
                Direccion: r[18],
                Ciudad: r[19], 
                Expediente: r[21], 
                Favorito: r[22],
                Devolucion: r[23], 
                Prioridad: r[24]
            };
        }

        let fila = {
            Orden: (r[0] || ref.Orden || "").toString().trim(),
            Remito: r[1],
            FechaR: formatFecha(r[2]),
            Apellido: r[3] || ref.Apellido,
            Nombre: r[4] || ref.Nombre,
            Dni: r[5] || ref.Dni,
            //ObraSocial: r[6] || ref.ObraSocial,
            ObraSocial: normalizarOS_VBA(r[6] || ref.ObraSocial),
            FechaCX: formatFecha(r[7] || ref.FechaCX),
            Producto: r[8],
            Q: r[9], 
            Lote: r[10],
            Serie: r[11],
            Vendedor: r[12] || ref.Vendedor,
            Medico: r[13] || ref.Medico,
            MedicoSolicitante: r[14] || ref.MedicoSolicitante,
            // 🔴 APLICAMOS LA FUNCIÓN bool() AQUÍ PARA NORMALIZAR A VERDADERO/FALSO
            Foja: bool(r[15] || ref.Foja),
            CI: bool(r[16] || ref.Certificado),
            Devolucion: bool(r[23] || ref.Devolucion),
            
            Actividades: r[17] || ref.Actividades,
            Institucion: r[18] || ref.Direccion,
            Ciudad: r[19] || ref.Ciudad,
            Vencimiento: formatFecha(r[20]),
            Expediente: r[21] || ref.Expediente,
            Favorito: r[22] || ref.Favorito,
            Prioridad: r[24] || ref.Prioridad,
            Column1: "" 
        };

        // Lógica de cantidad Q
        if (!fila.Q || fila.Q == 0 || fila.Q.toString().trim() === "") {
            if (!isNaN(fila.Prioridad) && Number(fila.Prioridad) !== 0) {
                fila.Q = fila.Prioridad;
            }
        }

        resultadoIntermedio.push(fila);
    });

    // Agrupamiento por Orden
    const grupos = {};
    resultadoIntermedio.forEach(f => {
        if (!grupos[f.Orden]) grupos[f.Orden] = [];
        grupos[f.Orden].push(f);
    });

    let resultadoFinal = [];
    Object.values(grupos).forEach(bloque => {
        const tieneCantidadValida = bloque.some(f => !isNaN(f.Q) && Number(f.Q) > 0);
        if (tieneCantidadValida) {
            bloque.forEach(f => { 
                if (f.Q && Number(f.Q) > 0) resultadoFinal.push(f); 
            });
        } else {
            resultadoFinal.push(bloque[0]);
        }
    });

    return resultadoFinal;
}

/* ... resto del archivo app.js ... */

function bool(v) {
    if (!v) return "FALSO";
    let s = v.toString().toUpperCase().trim();
    if (s === "VERDADERO" || s === "SI" || s === "1" || s === "TRUE") return "VERDADERO";
    return "FALSO";
}

function formatFecha(v){
  if(!v) return "";

  if(typeof v === "number"){
    const fecha = XLSX.SSF.parse_date_code(v);
    return `${pad(fecha.d)}/${pad(fecha.m)}/${fecha.y}`;
  }

  const d = new Date(v);
  if(!isNaN(d)){
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  }

  return v;
}

function pad(n){
  return n.toString().padStart(2,"0");
}

function normalizarOS_VBA(val) {
    if (!val) return "";
    let texto = val.toString().toUpperCase().trim();

    // Lógica BSC
    if (texto.includes("BSC") || texto.includes("BOSTON SCIENTIFIC")) {
        if (texto.includes("PAMI")) return "Pami - BSC";
        if (texto.includes("OSECAC")) return "Osecac - BSC";
        return "Otra - BSC";
    }
   // Lógica Proper Case (primeras dos palabras)
    let partes = texto.split(" ").filter(p => p.length > 0);
    if (partes.length >= 2) {
        return toProperCase(partes[0]) + " " + toProperCase(partes[1]);
    } else if (partes.length === 1) {
        return toProperCase(partes[0]);
    }
    return texto;
}

function toProperCase(txt) {
    return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
}

function exportarCSV(data, nombre="debug_preprocesado.csv"){

  if(!data || !data.length){
    console.warn("No hay datos para exportar");
    return;
  }

  const csv = Papa.unparse(data, {
    delimiter: ";"
  });

  // UTF-8 con BOM (clave para Excel)
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();

  URL.revokeObjectURL(url);
}

document.addEventListener("keydown", e => {
   if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    if (e.key === "ArrowDown") {
        e.preventDefault(); // Evita que la ventana se mueva
        indiceSeleccionado++;
        actualizarSeleccion();
    }
    if (e.key === "ArrowUp") {
        e.preventDefault(); // Evita que la ventana se mueva
        indiceSeleccionado--;
    }
        actualizarSeleccion();
        if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        toggleCheckOrdenSeleccionada();
    }
});

/* =========================
   CIERRE DE DROPDOWNS GLOBAL
========================= */
document.addEventListener("click", e => {
    const lista = document.getElementById("listaInstituciones");
    const input = document.getElementById("filtroInstitucion");

    // Si el clic no fue dentro del input ni dentro de la lista, la vaciamos
    if (e.target !== input && e.target !== lista) {
        lista.innerHTML = "";
    }
});
function borrarFiltros() {
    // 1. Limpiar inputs de texto
    document.getElementById("buscadorGlobal").value = "";
    document.getElementById("filtroInstitucion").value = "";
    
    // 2. Limpiar todos los select al valor por defecto ("")
    const selects = document.querySelectorAll('.filters select, .quick-filters select');
    selects.forEach(sel => sel.value = "");

    // 3. Resetear variables de ordenamiento si lo deseas
    sortField = null;
    
    // 4. Aplicar los filtros (que ahora están vacíos)
    aplicarFiltros();
}

function limpiarDetalleOrden() {
    const cabTitulo = document.getElementById("cabeceraTitulo");
    if (cabTitulo) cabTitulo.textContent = "Seleccioná una orden de la lista para ver el detalle";

    document.getElementById("cabecera").innerHTML = "";
    document.getElementById("detalleBody").innerHTML = "";
}

function actualizarLabelsInformativos() {
    const cantidadOrdenes = filtradas.length;
    const cantidadProductos = filtradas.reduce((acc, o) => acc + (o.detalles?.length || 0), 0);
    const cantidadFavoritas = filtradas.filter(o => o.Favorito === "FAVORITO" || o.Favorito === "SI").length;
    const cantidadPedidas = filtradas.filter(o => o.EstadoRecupero && o.EstadoRecupero !== "no_pedido").length;
    const cantidadSeleccionadas = seleccionados.size;
    document.getElementById("labelCantidadOrdenes").textContent = cantidadOrdenes;
    document.getElementById("labelCantidadProductos").textContent = cantidadProductos;
    document.getElementById("labelCantidadFavoritas").textContent = cantidadFavoritas;
    document.getElementById("labelCantidadPedidas").textContent = `${cantidadPedidas}/${cantidadOrdenes}`;
    document.getElementById("labelCantidadSeleccionadas").textContent = cantidadSeleccionadas;
}

function toggleSeleccionarTodos(event) {
    const isChecked = event.target.checked;
    const checkboxes = document.querySelectorAll(".check-orden");
    
    seleccionados.clear();
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const ordenId = cb.getAttribute("data-id");
        if (isChecked) seleccionados.add(ordenId);
    });
   actualizarLabelsInformativos();
}

function handleCheck(event, ordenId) {
    event.stopPropagation(); // Evita que se dispare el click de la fila (selección para detalle)
    if (event.target.checked) {
        seleccionados.add(ordenId);
    } else {
        seleccionados.delete(ordenId);
        document.getElementById("selectAll").checked = false;
    }
   actualizarLabelsInformativos();
}

function toggleCheckOrdenSeleccionada() {
    if (indiceSeleccionado < 0 || indiceSeleccionado >= filtradas.length) return;

    const ordenId = filtradas[indiceSeleccionado].Orden;
    const checkbox = document.querySelector(`.check-orden[data-id="${ordenId}"]`);
    if (!checkbox) return;

    checkbox.checked = !checkbox.checked;

    if (checkbox.checked) {
        seleccionados.add(ordenId);
    } else {
        seleccionados.delete(ordenId);
        document.getElementById("selectAll").checked = false;
    }
   actualizarLabelsInformativos();
}

/* =========================
   RECUPERO - CHEQUEO DE RESPALDO AL INICIAR
========================= */
intentarRestaurarBackup();
