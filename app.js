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
  { key: "faltan",        label: "Faltan cosas" }
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
   FAVORITO (toggle manual)
   Antes venía solo del Excel (de solo lectura). Ahora se puede marcar/
   desmarcar a mano desde el detalle de la orden, con el mismo patrón de
   historial local + sincronización en vivo que el resto.
========================= */
const HISTORIAL_KEY_FAVORITO = "recuperoTH_historialFavorito_v1";
let favoritoRef = null;
let favoritoRemotoCache = {};

function cargarHistorialFavorito(){
  try{ return JSON.parse(localStorage.getItem(HISTORIAL_KEY_FAVORITO)) || {}; }
  catch(e){ console.warn("Historial de favoritos corrupto, se descarta:", e); return {}; }
}

function actualizarHistorialFavorito(ordenId, esFav){
  try{
    const historial = cargarHistorialFavorito();
    historial[ordenId] = !!esFav;
    localStorage.setItem(HISTORIAL_KEY_FAVORITO, JSON.stringify(historial));
  }catch(e){ console.warn("No se pudo guardar el historial de favoritos:", e); }
}

function publicarFavoritoRemoto(ordenId, esFav){
  if(!firebaseListo || !favoritoRef) return;
  favoritoRef.child(ordenId).set({
    favorito: !!esFav,
    ts: firebase.database.ServerValue.TIMESTAMP
  }).catch(e => console.warn("No se pudo sincronizar el favorito en la nube:", e));
}

function esOrdenFavorita(o){
  return o.Favorito === "FAVORITO" || o.Favorito === "SI" || o.Favorito === true;
}

/** Aplica el estado de favorito a una orden (memoria + DOM + historial local). */
function aplicarCambioFavorito(ordenId, esFav, { publicarRemoto = false } = {}){
  actualizarHistorialFavorito(ordenId, esFav);

  const orden = buscarOrdenPorId(ordenId);
  if(orden){
    orden.Favorito = esFav ? "FAVORITO" : "";

    // Repintar la card de la lista si está visible
    const fila = document.querySelector(`.fila[data-orden="${CSS.escape(ordenId)}"]`);
    if(fila) fila.classList.toggle("favorito", esFav);

    // Refrescar el detalle si es la orden abierta
    if(indiceSeleccionado >= 0 && filtradas[indiceSeleccionado] && filtradas[indiceSeleccionado].Orden === ordenId){
      mostrar(orden);
    }
    actualizarLabelsInformativos();
  }

  if(publicarRemoto) publicarFavoritoRemoto(ordenId, esFav);
}

/** Click en "Marcar/Quitar como favorito" en el detalle de la orden. */
function toggleFavorito(ordenId){
  const orden = buscarOrdenPorId(ordenId);
  if(!orden) return;
  const nuevoValor = !esOrdenFavorita(orden);
  aplicarCambioFavorito(ordenId, nuevoValor, { publicarRemoto: true });
}

/* =========================
   ESTADO POR PRODUCTO (detalle de cada orden)
   Click en la fila de un producto para marcarlo como "Usado con Sticker"
   (azul), "Para Devolver" (verde), o volver a blanco (ninguno aplica /
   falta algo). Funciona con el mismo patrón que Estado de Recupero y
   Secretaría: se guarda por producto, sobrevive a un archivo nuevo, y
   se sincroniza en vivo entre dispositivos.
   Como el detalle no trae un ID único de Odoo, la "clave" de cada
   producto se arma combinando Nº de Orden + Remito + Producto + Lote +
   Serie (lo suficiente para identificar esa línea puntual).
========================= */
const HISTORIAL_KEY_PRODUCTO = "recuperoTH_historialProductoEstado_v1";
const ESTADOS_PRODUCTO = ["", "sticker", "devolver"]; // ciclo: ninguno → sticker → devolver → ninguno

let productoEstadoRef = null;
let productoEstadoRemotoCache = {};

/** Firebase no admite . # $ [ ] / en las claves; los reemplazamos. */
function sanearClaveFirebase(str){
  const limpio = (str || "").toString().trim().replace(/[.#$\[\]\/]/g, "_");
  return limpio || "x";
}

/** Escapa un valor para insertarlo de forma segura dentro de un atributo HTML (comillas, &, <, >). */
function escapeHtmlAttr(str){
  return (str || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function construirClaveProducto(ordenId, d){
  return [ordenId, d.Remito, d.Producto, d.Lote, d.Serie].map(sanearClaveFirebase).join("__");
}

/**
 * 🔴 FIX: cuando 2 o más productos de la MISMA orden no tienen datos que
 * los distingan (mismo Remito+Producto+Lote+Serie — pasa con el desglose
 * por unidad cuando Odoo no trae series distintas para cada unidad),
 * construirClaveProducto() les daba la MISMA clave. Como el color de cada
 * producto se guarda por clave, tocar uno pintaba a todos los que
 * compartían esa clave. Acá desambiguamos agregando un sufijo a partir
 * de la 2da repetición (la 1ra queda igual que antes, para no romper
 * los colores ya guardados).
 */
function construirClavesProductosOrden(ordenId, detalles){
  const contador = {};
  return (detalles || []).map(d => {
    const base = construirClaveProducto(ordenId, d);
    contador[base] = (contador[base] || 0) + 1;
    return contador[base] === 1 ? base : `${base}__dup${contador[base]}`;
  });
}

function cargarHistorialProducto(){
  try{ return JSON.parse(localStorage.getItem(HISTORIAL_KEY_PRODUCTO)) || {}; }
  catch(e){ console.warn("Historial de estado por producto corrupto, se descarta:", e); return {}; }
}

function actualizarHistorialProducto(clave, estado){
  try{
    const historial = cargarHistorialProducto();
    if(estado) historial[clave] = estado; else delete historial[clave];
    localStorage.setItem(HISTORIAL_KEY_PRODUCTO, JSON.stringify(historial));
  }catch(e){ console.warn("No se pudo guardar el historial de estado por producto:", e); }
}

function publicarProductoEstadoRemoto(clave, estado){
  if(!firebaseListo || !productoEstadoRef) return;
  productoEstadoRef.child(clave).set({
    estado: estado,
    ts: firebase.database.ServerValue.TIMESTAMP
  }).catch(e => {
    console.warn("No se pudo sincronizar el estado del producto en la nube:", e);
    alert("No se pudo guardar este color en la nube (no se va a ver en los otros dispositivos). Revisá la consola (F12) o las reglas de Firebase.\n\nDetalle: " + (e && e.message ? e.message : e));
  });
}

function claseFilaProducto(estado){
  if(estado === "sticker") return "fila-producto-sticker";
  if(estado === "devolver") return "fila-producto-devolver";
  return "";
}

/** Busca la fila de producto por su clave sin usar selectores CSS (más robusto: la descripción del producto puede traer caracteres que rompen un selector armado a mano). */
function buscarFilaProductoPorClave(clave){
  return Array.from(document.querySelectorAll(".fila-producto")).find(tr => tr.dataset.claveProducto === clave) || null;
}

/** Aplica un estado a una fila de producto (DOM + historial local), sin importar si vino de un click local o de otro dispositivo. */
function aplicarCambioProducto(clave, estado, { publicarRemoto = false } = {}){
  actualizarHistorialProducto(clave, estado);

  const fila = buscarFilaProductoPorClave(clave);
  if(fila){
    fila.classList.remove("fila-producto-sticker", "fila-producto-devolver");
    const clase = claseFilaProducto(estado);
    if(clase) fila.classList.add(clase);
  }

  if(publicarRemoto) publicarProductoEstadoRemoto(clave, estado);

  // 🔴 El Estado de Recupero de la orden dueña de este producto se
  // recalcula solo, según cómo quedó el coloreo de todos sus productos.
  const ordenId = clave.split("__")[0];
  recalcularEstadoOrden(ordenId);
}

/** Click en una fila de producto: cicla ninguno → sticker → devolver → ninguno. */
function cicloEstadoProducto(event, clave){
  event.stopPropagation();
  const actual = cargarHistorialProducto()[clave] || "";
  const idx = ESTADOS_PRODUCTO.indexOf(actual);
  const nuevo = ESTADOS_PRODUCTO[(idx + 1) % ESTADOS_PRODUCTO.length];
  aplicarCambioProducto(clave, nuevo, { publicarRemoto: true });
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

    // --- Favorito ---
    favoritoRef = firebase.database().ref("favoritoOrden");
    favoritoRef.on("value", snapshot => {
      const remoto = snapshot.val() || {};
      favoritoRemotoCache = remoto;
      Object.keys(remoto).forEach(ordenId => {
        aplicarCambioFavorito(ordenId, !!(remoto[ordenId] && remoto[ordenId].favorito), { publicarRemoto: false });
      });

      // Subimos automáticamente lo que ya teníamos guardado localmente
      // y todavía no está en la nube (mismo mecanismo que el resto).
      const historialLocalFavorito = cargarHistorialFavorito();
      Object.keys(historialLocalFavorito).forEach(ordenId => {
        if(!remoto[ordenId]) publicarFavoritoRemoto(ordenId, historialLocalFavorito[ordenId]);
      });
    });

    // --- Estado por producto (Usado con Sticker / Para Devolver) ---
    productoEstadoRef = firebase.database().ref("productoEstado");
    productoEstadoRef.on("value", snapshot => {
      const remoto = snapshot.val() || {};
      productoEstadoRemotoCache = remoto;
      Object.keys(remoto).forEach(clave => {
        aplicarCambioProducto(clave, remoto[clave].estado, { publicarRemoto: false });
      });

      // Subimos automáticamente lo que ya teníamos guardado localmente
      // y todavía no está en la nube (mismo mecanismo que Estado/Secretaría).
      const historialLocalProducto = cargarHistorialProducto();
      Object.keys(historialLocalProducto).forEach(clave => {
        if(!remoto[clave]) publicarProductoEstadoRemoto(clave, historialLocalProducto[clave]);
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
    }

    // Si el detalle de esta orden está abierto, mostrar() ya refresca el chip de Recupero ahí
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
   MENÚ (hamburguesa)
========================= */
const menuLateral = document.getElementById("menuLateral");

function abrirMenu(){ menuLateral.classList.remove("hidden"); }
function cerrarMenu(){ menuLateral.classList.add("hidden"); }

document.getElementById("btnMenu").onclick = abrirMenu;
document.getElementById("btnCerrarMenu").onclick = cerrarMenu;
menuLateral.addEventListener("click", e => { if(e.target === menuLateral) cerrarMenu(); });

/* =========================
   VOLVER AL LISTADO (mobile: la lista y el detalle no se ven juntos)
========================= */
document.getElementById("btnVolverListado").onclick = () => {
  document.getElementById("split").classList.remove("detalle-abierto");
};

/* Ícono de calendario junto a los filtros rápidos: enfoca el filtro de Fecha CX */
document.getElementById("btnFechaIcono").onclick = () => {
  document.getElementById("filtroFecha").focus();
};

/* El botón de "Borrar Historial" existe en dos lugares (menú y modal de filtros) */
document.getElementById("btnBorrarHistorial2").onclick = borrarHistorialEstados;

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

  // 🔴 Estado de Recupero AUTOMÁTICO: ya no se asigna a mano. Se calcula
  // según el coloreo de los productos de cada orden (ninguno pintado =
  // No Pedido, todos pintados = Completo, mezcla = Faltan Cosas).
  ordenes.forEach(o=>{
    o.EstadoRecupero = calcularEstadoRecuperoAutomatico(o.Orden, o.detalles);
  });

  // 🔴 Igual que antes: restauramos la Secretaría asignada
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

  // 🔴 Favorito: igual patrón. El historial local/remoto tiene prioridad
  // sobre lo que haya venido en el Excel, porque puede haberse cambiado
  // a mano después de exportar.
  const historialFavorito = cargarHistorialFavorito();
  ordenes.forEach(o=>{
    if(Object.prototype.hasOwnProperty.call(historialFavorito, o.Orden)){
      o.Favorito = historialFavorito[o.Orden] ? "FAVORITO" : "";
    }
  });
  ordenes.forEach(o=>{
    if(favoritoRemotoCache[o.Orden]){
      o.Favorito = favoritoRemotoCache[o.Orden].favorito ? "FAVORITO" : "";
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

const ICONS = {
  apross: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  medico: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  institucion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="21" x2="21" y2="21"/><path d="M5 21V7l7-4 7 4v14"/><line x1="9" y1="9" x2="9" y2="9.01"/><line x1="15" y1="9" x2="15" y2="9.01"/><line x1="9" y1="13" x2="9" y2="13.01"/><line x1="15" y1="13" x2="15" y2="13.01"/><line x1="9" y1="17" x2="9" y2="17.01"/><line x1="15" y1="17" x2="15" y2="17.01"/></svg>`,
  expediente: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  actividades: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  producto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  estrella: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
};

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

  document.getElementById("labelCantidadOrdenesTitulo").textContent = filtradas.length;

  filtradas.forEach((o, i) => {
    const fila = document.createElement("div");
    const esFav = esOrdenFavorita(o);
    fila.className = `fila ${esFav ? 'favorito' : ''} recupero-${o.EstadoRecupero}`;
    fila.dataset.orden = o.Orden;

    const estaChequeado = seleccionados.has(o.Orden) ? "checked" : "";

    fila.innerHTML = `
      <div class="fila-top">
        <input type="checkbox" class="check-orden" data-id="${o.Orden}" ${estaChequeado}
               onclick="handleCheck(event, '${o.Orden}')">
        <span class="fila-orden-num">${o.Orden}</span>
        <span class="fila-titulo-sep">·</span>
        <span class="fila-paciente-inline">${o.Apellido} ${o.Nombre}</span>
        ${esFav ? `<span class="fila-estrella" title="Favorita">${ICONS.estrella}</span>` : ""}
      </div>
      <div class="fila-subtitulo">
        <span>DNI ${o.Dni || "-"}</span>
        ${o.ObraSocial ? `<span class="fila-sep">·</span><span>${o.ObraSocial}</span>` : ""}
        ${o.Prioridad ? `<span class="fila-sep">·</span><span>${o.Prioridad}</span>` : ""}
      </div>
      <div class="fila-bottom-row">
        <div class="fila-semaforo-row">
          <span class="sf-item">CI <span class="semaforo-dot ${o.CI === 'VERDADERO' ? 'si' : 'no'}"></span></span>
          <span class="sf-item">FOJA <span class="semaforo-dot ${o.Foja === 'VERDADERO' ? 'si' : 'no'}"></span></span>
          <span class="sf-item">DEV <span class="semaforo-dot ${o.Devolucion === 'VERDADERO' ? 'dev-pendiente' : 'dev-ok'}"></span></span>
        </div>
        <span class="fila-fecha">${o.FechaCX || ""}</span>
      </div>
    `;

    fila.onclick = (e) => {
      if (e.target.type !== 'checkbox') {
        indiceSeleccionado = i;
        actualizarSeleccion();
        document.getElementById("split").classList.add("detalle-abierto");
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

/**
 * Calcula el Estado de Recupero de una orden según el coloreo de sus
 * productos (ninguno pintado = "no_pedido", todos pintados = "completo",
 * mezcla de pintados y en blanco = "faltan"). Ya no se asigna a mano.
 */
function calcularEstadoRecuperoAutomatico(ordenId, detalles){
  if(!detalles || !detalles.length) return "no_pedido";

  const historialProducto = cargarHistorialProducto();
  let cantidadConColor = 0;

  const claves = construirClavesProductosOrden(ordenId, detalles);
  claves.forEach(clave => {
    if(historialProducto[clave]) cantidadConColor++;
  });

  if(cantidadConColor === 0) return "no_pedido";
  if(cantidadConColor === detalles.length) return "completo";
  return "faltan";
}

/**
 * Recalcula y aplica el Estado de Recupero automático de una orden:
 * actualiza la orden en memoria, la fila visible en la lista, el chip
 * del detalle si está abierto, y lo sincroniza a Firebase.
 */
function recalcularEstadoOrden(ordenId){
  const orden = buscarOrdenPorId(ordenId);
  if(!orden) return;

  const nuevoEstado = calcularEstadoRecuperoAutomatico(ordenId, orden.detalles);
  if(nuevoEstado === orden.EstadoRecupero) return; // sin cambios, no hace falta tocar nada

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
  document.getElementById("detalleVacio").classList.add("hidden");
  document.getElementById("detalleContenido").classList.remove("hidden");

  // 1. Header: N° Orden - Paciente (misma línea) + badges C/F/D + link a Odoo
  document.getElementById("cabeceraOrdenNum").textContent = o.Orden;
  document.getElementById("cabeceraPaciente").textContent = `${o.Apellido} ${o.Nombre}`;

  document.getElementById("cabeceraBadges").innerHTML = `
    <span class="badge-semaforo ${o.CI === 'VERDADERO' ? 'si' : 'no'}" title="Certificado de Implante: ${o.CI === 'VERDADERO' ? 'OK' : 'Falta'}">C</span>
    <span class="badge-semaforo ${o.Foja === 'VERDADERO' ? 'si' : 'no'}" title="Foja Quirúrgica: ${o.Foja === 'VERDADERO' ? 'OK' : 'Falta'}">F</span>
    <span class="badge-semaforo ${o.Devolucion === 'VERDADERO' ? 'dev-pendiente' : 'dev-ok'}" title="Devolución: ${o.Devolucion === 'VERDADERO' ? 'Pendiente' : 'OK'}">D</span>
    <button class="btn-odoo-link" onclick="abrirOrdenOdoo(event, '${o.Orden}')" title="Abrir en Odoo">${ICONS.link}</button>
  `;

  // 2. Subtítulo: Dni, Expte, Fecha CX, Médico (misma línea)
  document.getElementById("cabeceraSubtitulo").innerHTML = `
    <span>DNI ${o.Dni || "-"}</span>
    <span class="detalle-sub-sep">·</span>
    <span>Expte ${o.Expediente || "-"}</span>
    <span class="detalle-sub-sep">·</span>
    <span>${o.FechaCX || "-"}</span>
    <span class="detalle-sub-sep">·</span>
    <span>${o.Medico || "-"}</span>
  `;

  // 3. Datos extra: Hospital, Médico, Solicitante (misma línea)
  const campo = (icon, label, valor) => `
    <div class="campo">
      <span class="campo-icon">${icon}</span>
      <span class="campo-texto"><b>${label}</b><span>${valor || "-"}</span></span>
    </div>`;

  document.getElementById("cabecera").innerHTML =
    campo(ICONS.institucion, "Hospital", o.Institucion) +
    campo(ICONS.medico, "Médico", o.Medico) +
    campo(ICONS.medico, "Solicitante", o.MedicoSolicitante);

  // Actividades, aparte
  document.getElementById("cabeceraActividades").innerHTML = `
    <span class="campo-icon">${ICONS.actividades}</span>
    <span class="campo-texto"><b>Actividades</b><span>${o.Actividades || "-"}</span></span>
  `;

  // 4. Secretaría (editable) + Recupero (automático, solo lectura)
  const selSecretaria = document.getElementById("selectSecretariaDetalle");
  selSecretaria.className = "select-secretaria select-quick";
  selSecretaria.dataset.id = o.Orden;
  selSecretaria.innerHTML = opcionesSecretariaHTML(o.Secretaria);
  selSecretaria.onchange = function(){ manejarCambioSecretariaSelect(this, o.Orden); };

  const chipRecupero = document.getElementById("chipRecuperoDetalle");
  chipRecupero.className = `chip-recupero-detalle estado-${o.EstadoRecupero}`;
  chipRecupero.textContent = labelEstadoRecupero(o.EstadoRecupero);
  chipRecupero.title = "Se calcula solo según el coloreo del detalle de productos";

  // 5. Detalle de productos (tarjetas, clickeables para Sticker/Devolver)
  document.getElementById("cantidadProductosDetalle").textContent = o.detalles.length;
  const cont = document.getElementById("detalleProductos");
  cont.innerHTML = "";

  const historialProducto = cargarHistorialProducto();
  const clavesProductos = construirClavesProductosOrden(o.Orden, o.detalles);

  o.detalles.forEach((d, i)=>{
    const clave = clavesProductos[i];
    const estadoActual = historialProducto[clave] || "";
    const div = document.createElement("div");
    div.className = `fila-producto ${claseFilaProducto(estadoActual)}`;
    div.dataset.claveProducto = clave;
    div.title = "Click para marcar: Usado con Sticker → Para Devolver → Ninguno";
    div.onclick = (e) => cicloEstadoProducto(e, clave);
    div.innerHTML = `
      <span class="producto-icon">${ICONS.producto}</span>
      <div class="producto-info">
        <div class="producto-nombre">${d.Producto || ""}</div>
        <div class="producto-campos">
          <span class="producto-campo"><b>Remito</b><span>${d.Remito || "-"}</span></span>
          <span class="producto-campo"><b>Q</b><span>${d.Q || "-"}</span></span>
          <span class="producto-campo"><b>Lote</b><span>${d.Lote || "-"}</span></span>
          <span class="producto-campo"><b>Serie</b><span>${d.Serie || "-"}</span></span>
          <span class="producto-campo"><b>Vence</b><span>${d.Vencimiento || "-"}</span></span>
        </div>
      </div>
    `;
    cont.appendChild(div);
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
    let filaProductoActual = null; // última fila de producto real, para pegarle las filas de "continuación"

    // Une los tokens (separados por coma) de varias celdas en una sola lista plana.
    const acumularTokens = (listaExistente, celda) => {
        if (celda === undefined || celda === null || celda.toString().trim() === "") return listaExistente;
        const tokens = celda.toString().split(",").map(t => t.trim()).filter(Boolean);
        return listaExistente.concat(tokens);
    };

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

        const tieneProducto = r[8] && r[8].toString().trim() !== "";

        // 🔴 FILA DE "CONTINUACIÓN": Odoo a veces agrega una fila aparte, sin
        // Producto, solo para sumar más Lote/Serie/Vencimiento a la línea
        // anterior (ej. la 2da unidad de un producto con 2 series distintas).
        // Antes esto se perdía sin más (Q quedaba vacío y se filtraba). Ahora
        // lo acumulamos en la fila de producto a la que pertenece.
        if (!tieneProducto && filaProductoActual && (r[10] || r[11] || r[20])) {
            filaProductoActual._loteTokens = acumularTokens(filaProductoActual._loteTokens, r[10]);
            filaProductoActual._serieTokens = acumularTokens(filaProductoActual._serieTokens, r[11]);
            filaProductoActual._vencTokens = acumularTokens(filaProductoActual._vencTokens, r[20]);
            return;
        }

        let fila = {
            Orden: (r[0] || ref.Orden || "").toString().trim(),
            Remito: r[1],
            FechaR: formatFecha(r[2]),
            Apellido: r[3] || ref.Apellido,
            Nombre: r[4] || ref.Nombre,
            Dni: r[5] || ref.Dni,
            ObraSocial: normalizarOS_VBA(r[6] || ref.ObraSocial),
            FechaCX: formatFecha(r[7] || ref.FechaCX),
            Producto: r[8],
            Q: r[9], 
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
            Expediente: r[21] || ref.Expediente,
            Favorito: r[22] || ref.Favorito,
            Prioridad: r[24] || ref.Prioridad,
            Column1: "",
            // Tokens crudos (separados por coma) de esta fila, listos para
            // sumarles los de eventuales filas de continuación de abajo.
            _loteTokens: acumularTokens([], r[10]),
            _serieTokens: acumularTokens([], r[11]),
            _vencTokens: acumularTokens([], r[20])
        };

        // Lógica de cantidad Q
        if (!fila.Q || fila.Q == 0 || fila.Q.toString().trim() === "") {
            if (!isNaN(fila.Prioridad) && Number(fila.Prioridad) !== 0) {
                fila.Q = fila.Prioridad;
            }
        }

        resultadoIntermedio.push(fila);
        if (tieneProducto) filaProductoActual = fila;
    });

    /**
     * Interpreta un token de Serie/Lote según la regla confirmada:
     * - Si trae un guión → producto serializado, formato "SERIE-LOTE".
     * - Si no trae guión → producto no serializado, el valor ES el Lote.
     */
    const interpretarToken = (token) => {
        if (!token) return { serie: "", lote: "" };
        if (token.includes("-")) {
            const partes = token.split("-");
            return { serie: partes[0].trim(), lote: partes.slice(1).join("-").trim() };
        }
        return { serie: "", lote: token.trim() };
    };

    // 🔴 DESGLOSE POR UNIDAD: cada línea con Cantidad > 0 se separa en una
    // fila por unidad física (Q=1 cada una), repartiendo los tokens de
    // Serie/Lote/Vencimiento juntados arriba. Las líneas con Cantidad 0
    // (filas de servicio/logística) se dejan como estaban, sin desglosar.
    let resultadoDesglosado = [];
    resultadoIntermedio.forEach(f => {
        const cantidad = Number(f.Q) || 0;
        const serieTokens = f._serieTokens || [];
        const loteTokens = f._loteTokens || [];
        const vencTokens = f._vencTokens || [];
        const tokensBase = serieTokens.length ? serieTokens : loteTokens;

        const base = {
            Orden: f.Orden, Remito: f.Remito, FechaR: f.FechaR, Apellido: f.Apellido,
            Nombre: f.Nombre, Dni: f.Dni, ObraSocial: f.ObraSocial, FechaCX: f.FechaCX,
            Producto: f.Producto, Vendedor: f.Vendedor, Medico: f.Medico,
            MedicoSolicitante: f.MedicoSolicitante, Foja: f.Foja, CI: f.CI,
            Devolucion: f.Devolucion, Actividades: f.Actividades, Institucion: f.Institucion,
            Ciudad: f.Ciudad, Expediente: f.Expediente, Favorito: f.Favorito,
            Prioridad: f.Prioridad, Column1: ""
        };

        if (cantidad <= 0) {
            // Sin desglosar: se comporta igual que antes (una sola fila,
            // Q tal cual venía, Lote/Serie del primer token si hay).
            const { serie, lote } = interpretarToken(tokensBase[0]);
            resultadoDesglosado.push({
                ...base, Q: f.Q, Lote: lote, Serie: serie, Vencimiento: formatFecha(vencTokens[0])
            });
            return;
        }

        const unidades = Math.max(cantidad, tokensBase.length);
        for (let i = 0; i < unidades; i++) {
            const token = tokensBase.length ? (tokensBase[i] || tokensBase[tokensBase.length - 1]) : "";
            const { serie, lote } = interpretarToken(token);
            const vencToken = vencTokens.length ? (vencTokens[i] || vencTokens[vencTokens.length - 1]) : undefined;

            resultadoDesglosado.push({
                ...base, Q: 1, Lote: lote, Serie: serie, Vencimiento: formatFecha(vencToken)
            });
        }
    });

    // Agrupamiento por Orden (igual que antes, ahora sobre el resultado ya desglosado)
    const grupos = {};
    resultadoDesglosado.forEach(f => {
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
    const vacio = document.getElementById("detalleVacio");
    const contenido = document.getElementById("detalleContenido");
    if(vacio) vacio.classList.remove("hidden");
    if(contenido) contenido.classList.add("hidden");

    const split = document.getElementById("split");
    if(split) split.classList.remove("detalle-abierto");
}

function actualizarLabelsInformativos() {
    const cantidadOrdenes = filtradas.length;
    const cantidadProductos = filtradas.reduce((acc, o) => acc + (o.detalles?.length || 0), 0);
    const cantidadFavoritas = filtradas.filter(o => esOrdenFavorita(o)).length;
    const cantidadCompletas = filtradas.filter(o => o.EstadoRecupero === "completo").length;
    const cantidadSeleccionadas = seleccionados.size;
    document.getElementById("labelCantidadOrdenes").textContent = cantidadOrdenes;
    document.getElementById("labelCantidadProductos").textContent = cantidadProductos;
    document.getElementById("labelCantidadFavoritas").textContent = cantidadFavoritas;
    document.getElementById("labelCantidadPedidas").textContent = `${cantidadCompletas}/${cantidadOrdenes}`;
    document.getElementById("labelCantidadSeleccionadas").textContent = cantidadSeleccionadas;
    document.getElementById("labelCantidadSeleccionadasSub").textContent = cantidadSeleccionadas;
    document.getElementById("labelCantidadOrdenesSub").textContent = cantidadOrdenes;
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
