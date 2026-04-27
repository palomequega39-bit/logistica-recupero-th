let ordenes = [];
let filtradas = [];
let indiceSeleccionado = -1;
let sortField = null;
let ordenAsc = true;
let seleccionados = new Set(); // Para guardar los IDs de las órdenes seleccionadas


/* =========================
   INIT
========================= */


document.getElementById("buscadorGlobal")
  .addEventListener("input", aplicarFiltros);
// Dentro de app.js, donde configures los eventos:
document.getElementById("btnExportarPDF").onclick = () => {
    // Llamamos a la función de export.js pasando las variables globales de app.js
    exportarDetallePDF(ordenes, seleccionados);
};

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

    r.Paciente = (r.Apellido || "") + " " + (r.Nombre || "");
    r.Institucion = r.Institucion || "";
    r.Ciudad = r.Ciudad || "";
    r.Prioridad = r.Prioridad || "";
    r.Devolucion = r.Devolucion || "";
    r.Foja = r.Foja || "";
    r.CI = r.CI || "";
    r.Favorito = (r.Favorito || "").toUpperCase();
   
    if(!map[r.Orden]){
      map[r.Orden] = {...r, detalles:[]};
    }

    map[r.Orden].detalles.push(r);
  });

  ordenes = Object.values(map);

  console.log("Órdenes cargadas:", ordenes.length);

  cargarFiltros();
  aplicarFiltros();
}

/* =========================
   FILTROS
========================= */

function cargarFiltros() {
    fill("filtroPrioridad", "Prioridad");
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

    // Escuchar cambios en todos los select y inputs de la barra lateral
    const controles = document.querySelectorAll('.filters select, .filters input');
    controles.forEach(el => {
        el.addEventListener('change', aplicarFiltros);
        if(el.tagName === "INPUT") el.addEventListener('keyup', aplicarFiltros);
    });
   document.getElementById("btnLimpiar").onclick = borrarFiltros;
   
}

function fill(id,campo){
  const sel=document.getElementById(id);
  const vals=[...new Set(ordenes.map(o=>o[campo]).filter(Boolean))];

  sel.innerHTML=`<option value="">Todos</option>`+
    vals.map(v=>`<option>${v}</option>`).join("");
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
    <option value="">Todas</option>
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
    if(f("filtroInstitucion") && o.Institucion !== f("filtroInstitucion")) return false;
    if(f("filtroCiudad") && o.Ciudad !== f("filtroCiudad")) return false;
    if(f("filtroPrioridad") && o.Prioridad !== f("filtroPrioridad")) return false;
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
      const combinado = `${o.Orden} ${o.Apellido} ${o.Nombre} ${o.Dni} ${o.ObraSocial} ${o.Institucion}`.toLowerCase();
      if(!combinado.includes(texto)) return false;
    }

    return true;
  });

  indiceSeleccionado = -1;
  renderLista();
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
    fila.className = `fila ${esFav ? 'favorito' : ''}`;

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
   
  // 1. Actualizamos el título del panel
  // IMPORTANTE: Usamos .innerHTML en lugar de .textContent para que procese la estrella
  const panelTitulo = document.querySelector(".panel:nth-of-type(2) .titulo");
  if (panelTitulo) {
    panelTitulo.innerHTML = `Datos de la Orden - ${o.Orden} ${estrellaHtml} - ${o.Apellido} ${o.Nombre}`;
  }
   
  const cab = document.getElementById("cabecera");

  // 2. Renderizado Compacto (Sin duplicar actividades y con el orden pedido)
  cab.innerHTML = `
    <div class="campo"><b>Fecha CX:</b> ${o.FechaCX || ""}</div>
    <div class="campo"><b>DNI:</b> ${o.Dni || ""}</div>
    <div class="campo"><b>Obra Social:</b> ${o.ObraSocial || ""}</div>
    <div class="campo"><b>Institución:</b> ${o.Institucion || ""}</div>

    <div class="campo"><b>Expte:</b> ${o.Expediente || ""}</div>
    <div class="campo"><b>Médico:</b> ${o.Medico || ""}</div>
    <div class="campo"><b>Solicitante:</b> ${o.MedicoSolicitante || ""}</div>
    <div class="campo" style="grid-column: span 2;"><b>Vendedor:</b> ${o.Vendedor || ""}</div>
    
    <div class="campo"><b>Foja:</b> ${boolTag(o.Foja)}</div>
    <div class="campo"><b>CI:</b> ${boolTag(o.CI)}</div>
    <div class="campo" style="grid-column: span 2;"><b>Devolución:</b> ${boolTag(o.Devolucion,"dev")}</div>

    <div class="campo" style="grid-column: span 4; margin-top: 5px; white-space: normal; color: #444; border-top: 1px solid #eee; padding-top: 5px;">
      <b>Actividades:</b> ${o.Actividades || ""}
    </div>
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

    input.oninput = () => {
        const texto = input.value.toLowerCase();
        const filtrados = valores.filter(v => v.toLowerCase().includes(texto));

        if (texto === "" || filtrados.length === 0) {
            lista.innerHTML = "";
            return;
        }

        lista.innerHTML = filtrados
            .slice(0, 50)
            .map(v => `<div class="item-inst">${v}</div>`)
            .join("");
    };

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
    if(h.getAttribute("onclick").includes(field)){
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
    const camposPermitidos = ["Orden", "Apellido", "Nombre", "DNI", "Obra Social", "Institución"];
    
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

    // Volvemos a tu flujo actual
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
            Orden: r[0] || ref.Orden,
            Remito: r[1],
            FechaR: formatFecha(r[2]),
            Apellido: r[3] || ref.Apellido,
            Nombre: r[4] || ref.Nombre,
            Dni: r[5] || ref.Dni,
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
    if (e.key === "ArrowDown") {
        e.preventDefault(); // Evita que la ventana se mueva
        indiceSeleccionado++;
        actualizarSeleccion();
    }
    if (e.key === "ArrowUp") {
        e.preventDefault(); // Evita que la ventana se mueva
        indiceSeleccionado--;
        actualizarSeleccion();
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
    const selects = document.querySelectorAll('.filters select');
    selects.forEach(sel => sel.value = "");

    // 3. Resetear variables de ordenamiento si lo deseas
    sortField = null;
    
    // 4. Aplicar los filtros (que ahora están vacíos)
    aplicarFiltros();
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
}

function handleCheck(event, ordenId) {
    event.stopPropagation(); // Evita que se dispare el click de la fila (selección para detalle)
    if (event.target.checked) {
        seleccionados.add(ordenId);
    } else {
        seleccionados.delete(ordenId);
        document.getElementById("selectAll").checked = false;
    }
}

