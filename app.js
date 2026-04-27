let ordenes = [];
let filtradas = [];
let indiceSeleccionado = -1;
let sortField = null;
let ordenAsc = true;

/* =========================
   INIT
========================= */

document.getElementById("btnFiltrar").onclick = aplicarFiltros;

document.getElementById("buscadorGlobal")
  .addEventListener("input", aplicarFiltros);

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

  const reader = new FileReader();

  reader.onload = function(e){
    const data = new Uint8Array(e.target.result);

    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const csvProcesado = preprocesarExacto(raw);

    // 🔥 DEBUG opcional
    descargarCSV(csvProcesado, "debug_preprocesado.csv");

    Papa.parse(csvProcesado, {
      header: true,
      skipEmptyLines: true,
      complete: res => procesar(res.data)
    });
  };

  reader.readAsArrayBuffer(file);
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

function cargarFiltros(){
  fill("filtroPrioridad","Prioridad");
  fill("filtroCiudad","Ciudad");

  fillBool("filtroDevolucion");
  fillBool("filtroFoja");
  fillBool("filtroCI");

  fillFecha();
  cargarInstituciones();
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

  const f=id=>document.getElementById(id).value;
  const texto=document.getElementById("buscadorGlobal").value.toLowerCase();

  const hoy=new Date();
  hoy.setHours(0,0,0,0);

  filtradas=ordenes.filter(o=>{

    if(f("filtroInstitucion") && o.Institucion!==f("filtroInstitucion")) return false;
    if(f("filtroCiudad") && o.Ciudad!==f("filtroCiudad")) return false;
    if(f("filtroPrioridad") && o.Prioridad!==f("filtroPrioridad")) return false;

    if(f("filtroDevolucion") && o.Devolucion!==f("filtroDevolucion")) return false;
    if(f("filtroFoja") && o.Foja!==f("filtroFoja")) return false;
    if(f("filtroCI") && o.CI!==f("filtroCI")) return false;

    if(f("filtroFecha")){
      const fecha=new Date(o.FechaCX||"1900-01-01");
      fecha.setHours(0,0,0,0);

      if(f("filtroFecha")==="realizadas" && fecha>=hoy) return false;
      if(f("filtroFecha")==="hoy" && fecha.getTime()!==hoy.getTime()) return false;
      if(f("filtroFecha")==="pendientes" && fecha<hoy) return false;
    }

    if(texto){
      const combinado=`
        ${o.Orden}
        ${o.Apellido}
        ${o.Nombre}
        ${o.Dni}
        ${o.ObraSocial}
        ${o.Institucion}
      `.toLowerCase();

      if(!combinado.includes(texto)) return false;
    }

    return true;
  });

  indiceSeleccionado=-1;
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
        valA = new Date(a.FechaCX || "1900-01-01");
        valB = new Date(b.FechaCX || "1900-01-01");
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
        
        // Verificamos si es favorito
        const esFav = o.Favorito === "FAVORITO" || o.Favorito === "SI";
        
        // Añadimos la clase 'favorito' si corresponde
        fila.className = `fila ${esFav ? 'favorito' : ''}`;

        // Añadimos la estrella antes del número de orden si es favorito
        const estrellaHtml = esFav ? `<span class="estrella">★</span>` : "";

        fila.innerHTML = `
            <span>${estrellaHtml}${o.Orden}</span>
            <span title="${o.Apellido} ${o.Nombre}">${o.Apellido} ${o.Nombre}</span>
            <span>${o.Dni}</span>
            <span>${o.ObraSocial}</span>
            <span>${o.FechaCX || ""}</span>
            <span title="${o.Institucion}">${o.Institucion}</span>
            <span>${o.Prioridad}</span>
        `;

    fila.onclick=()=>{
      indiceSeleccionado=i;
      actualizarSeleccion();
    };

    cont.appendChild(fila);
  });
}

/* =========================
   SELECCION
========================= */

document.addEventListener("keydown",e=>{
  if(e.key==="ArrowDown") indiceSeleccionado++;
  if(e.key==="ArrowUp") indiceSeleccionado--;
  actualizarSeleccion();
});

function actualizarSeleccion(){

  const filas=document.querySelectorAll(".fila");
  filas.forEach(f=>f.classList.remove("active"));

  const fila=filas[indiceSeleccionado];
  if(!fila) return;

  fila.classList.add("active");

  mostrar(filtradas[indiceSeleccionado]);

  fila.scrollIntoView({block:"nearest"});
}

/* =========================
   DETALLE
========================= */

function mostrar(o){

   const cab = document.getElementById("cabecera");
   const estrellaTitulo = (o.Favorito === "FAVORITO" || o.Favorito === "SI") ? " ★" : "";
  cab.innerHTML = `
    <div class="campo"><b>Paciente:</b> ${o.Apellido} ${o.Nombre}${estrellaTitulo}</div>
    <div class="campo"><b>DNI:</b> ${o.Dni}</div>
    <div class="campo"><b>Obra:</b> ${o.ObraSocial}</div>
    <div class="campo"><b>Institución:</b> ${o.Institucion}</div>
    <div class="campo"><b>Fecha CX:</b> ${o.FechaCX}</div>
    <div class="campo"><b>Médico:</b> ${o.Medico}</div>
    <div class="campo"><b>Solicitante:</b> ${o.MedicoSolicitante}</div>
    <div class="campo"><b>Vendedor:</b> ${o.Vendedor}</div>

    <div class="campo"><b>Foja:</b> ${boolTag(o.Foja)}</div>
    <div class="campo"><b>CI:</b> ${boolTag(o.CI)}</div>
    <div class="campo"><b>Devolución:</b> ${boolTag(o.Devolucion,"dev")}</div>
  `;

  cab.innerHTML += `
    <div class="campo" style="grid-column: span 4;">
      <b>Actividades:</b> ${o.Actividades || ""}
    </div>
  `;

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

function boolTag(val,tipo="normal"){
  const v=(val||"").toUpperCase();

  if(v==="VERDADERO"){
    if(tipo==="dev") return `<span class="tag dev">SI</span>`;
    return `<span class="tag si">SI</span>`;
  }

  if(v==="FALSO") return `<span class="tag no">NO</span>`;

  return "";
}

/* =========================
   INSTITUCIONES
========================= */

function cargarInstituciones(){

  const input=document.getElementById("filtroInstitucion");
  const lista=document.getElementById("listaInstituciones");

  const valores=[...new Set(ordenes.map(o=>o.Institucion).filter(Boolean))];

  input.oninput=()=>{
    const texto=input.value.toLowerCase();

    lista.innerHTML=valores
      .filter(v=>v.toLowerCase().includes(texto))
      .slice(0,50)
      .map(v=>`<div class="item-inst">${v}</div>`)
      .join("");
  };

  lista.onclick=e=>{
    if(e.target.classList.contains("item-inst")){
      input.value=e.target.textContent;
      lista.innerHTML="";
      aplicarFiltros();
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
exportarCSV(procesado);
     
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

function preprocesarExacto(datos){

  let headers = datos[0];
  datos = datos.slice(1);

  let refOrden, apellido, nombre, direccion;
  let dni, cliente, fechaCirugia;
  let vendedor, medico, medicoSolicitante;
  let foja, certificado, actividades;
  let ciudad, expediente, favorito, devolucion, prioridad;

  // === 1. RELLENO
  for (let i = 0; i < datos.length; i++) {
    let row = datos[i];

    if (row[0]) {
      refOrden = row[0];
      apellido = row[3];
      nombre = row[4];
      dni = row[5];
      cliente = row[6];
      fechaCirugia = row[7];
      vendedor = row[12];
      medico = row[13];
      medicoSolicitante = row[14];
      foja = row[15];
      certificado = row[16];
      actividades = row[17];
      direccion = row[18];
      ciudad = row[19];
      expediente = row[21];
      favorito = row[22];
      devolucion = row[23];
      prioridad = row[24];
    } else {
      row[0] = refOrden;
      if (!row[3]) row[3] = apellido;
      if (!row[4]) row[4] = nombre;
      if (!row[5]) row[5] = dni;
      if (!row[6]) row[6] = cliente;
      if (!row[7]) row[7] = fechaCirugia;
      if (!row[12]) row[12] = vendedor;
      if (!row[13]) row[13] = medico;
      if (!row[14]) row[14] = medicoSolicitante;
      if (!row[15]) row[15] = foja;
      if (!row[16]) row[16] = certificado;
      if (!row[17]) row[17] = actividades;
      if (!row[18]) row[18] = direccion;
      if (!row[19]) row[19] = ciudad;
      if (!row[21]) row[21] = expediente;
      if (!row[22]) row[22] = favorito;
      if (!row[23]) row[23] = devolucion;
      if (!row[24]) row[24] = prioridad;
    }
  }

  // === 2. BOOLEANOS + FECHAS
  for (let i = 0; i < datos.length; i++) {
    let row = datos[i];

    row[22] = booleanTexto(row[22]);

    row[2] = excelFechaAJS(row[2]);
    row[7] = excelFechaAJS(row[7]);
    row[20] = excelFechaAJS(row[20]);
  }

  // === 3. FILTRO OBRA SOCIAL
  for (let i = 0; i < datos.length; i++) {
    let os = procesarObraSocial(datos[i][6]);

    if (!os) {
      datos[i]._eliminar = true;
    } else {
      datos[i][6] = os;
    }
  }

  datos = datos.filter(r => !r._eliminar);

  // === 4. J ← Y
  for (let i = 0; i < datos.length; i++) {
    let j = datos[i][9];
    let y = datos[i][24];

    if (!j || Number(j) === 0) {
      if (!isNaN(y) && Number(y) !== 0) {
        datos[i][9] = y;
      }
    }
  }

  // === 5. BLOQUES
  let resultado = [];
  let i = 0;

  while (i < datos.length) {
    let orden = datos[i][0];
    let bloque = [];

    while (i < datos.length && datos[i][0] === orden) {
      bloque.push(datos[i]);
      i++;
    }

    let tieneCantidad = bloque.some(r => Number(r[9]) > 0);

    if (tieneCantidad) {
      bloque = bloque.filter(r => Number(r[9]) > 0);
    } else {
      bloque = bloque.slice(0, 1);
    }

    resultado.push(...bloque);
  }

  // === 6. HEADERS + COLUMN1
  const nuevosHeaders = [
    "Orden","Remito","FechaR","Apellido","Nombre","Dni","ObraSocial",
    "FechaCX","Producto","Q","Lote","Serie","Vendedor","Medico",
    "MedicoSolicitante","Foja","CI","Actividades","Institucion",
    "Ciudad","Vencimiento","Expediente","Favorito","Devolucion","Prioridad","Column1"
  ];

  const resultadoConColumna = resultado.map(row => [...row, ""]);

  const ws = XLSX.utils.aoa_to_sheet([nuevosHeaders, ...resultadoConColumna]);

  return XLSX.utils.sheet_to_csv(ws);
}

function booleanTexto(valor){
  if (valor === true || String(valor).toLowerCase() === "true") return "VERDADERO";
  if (valor === false || String(valor).toLowerCase() === "false") return "FALSO";
  return valor;
}

function excelFechaAJS(valor){
  if (!valor) return "";

  if (typeof valor === "number") {
    const fecha = new Date((valor - 25569) * 86400 * 1000);
    return fecha.toLocaleDateString("es-AR");
  }

  return valor;
}

function procesarObraSocial(textoOriginal){
  let texto = (textoOriginal || "").toUpperCase().trim();

  if (!texto) return null;

  if (texto.includes("APROSS")) return "Apross";

  if (texto.includes("BSC") || texto.includes("BOSTON SCIENTIFIC")) {
    if (texto.includes("PAMI")) return "Pami - BSC";
    if (texto.includes("OSECAC")) return "Osecac - BSC";
  }

  return null;
}

function descargarCSV(csv, nombre){
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
}
