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

function preProcesarExcel(rows){

  if(rows.length < 2) return [];

  const headers = [
    "Orden","Remito","FechaR","Apellido","Nombre","Dni","ObraSocial",
    "FechaCX","Producto","Q","Lote","Serie","Vendedor","Medico",
    "MedicoSolicitante","Foja","CI","Actividades","Institucion",
    "Ciudad","Vencimiento","Expediente","Favorito","Devolucion","Prioridad"
  ];

  rows = rows.slice(1); // sacar header original

  let resultado = [];

  let ref = {};

  rows.forEach(r=>{

    // detectar nueva orden
    if(r[0]){
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
        CI: r[16],
        Actividades: r[17],
        Institucion: r[18],
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
      ObraSocial: normalizarOS(r[6] || ref.ObraSocial),
      FechaCX: formatFecha(r[7] || ref.FechaCX),
      Producto: r[8],
      Q: r[9] || r[24],
      Lote: r[10],
      Serie: r[11],
      Vendedor: r[12] || ref.Vendedor,
      Medico: r[13] || ref.Medico,
      MedicoSolicitante: r[14] || ref.MedicoSolicitante,
      Foja: bool(r[15] || ref.Foja),
      CI: bool(r[16] || ref.CI),
      Actividades: r[17] || ref.Actividades,
      Institucion: r[18] || ref.Institucion,
      Ciudad: r[19] || ref.Ciudad,
      Vencimiento: formatFecha(r[20]),
      Expediente: r[21] || ref.Expediente,
      Favorito: bool(r[22] || ref.Favorito),
      Devolucion: bool(r[23] || ref.Devolucion),
      Prioridad: r[24] || ref.Prioridad
    };

    // 🔴 FILTRO DE OBRA SOCIAL
    if(!fila.ObraSocial) return;

    const os = fila.ObraSocial.toUpperCase();

    const valido =
      os.includes("APROSS") ||
      (os.includes("PAMI") && os.includes("BSC")) ||
      (os.includes("OSECAC") && os.includes("BSC"));

    if(!valido) return;

    resultado.push(fila);
  });

  return resultado;
}

function bool(v){
  if(!v) return "FALSO";

  const val = v.toString().toLowerCase();

  if(val === "true" || val === "1" || val === "si") return "VERDADERO";
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

function normalizarOS(texto){
  if(!texto) return "";

  const t = texto.toUpperCase();

  if(t.includes("APROSS")) return "Apross";

  if(t.includes("BSC")){
    if(t.includes("PAMI")) return "Pami - BSC";
    if(t.includes("OSECAC")) return "Osecac - BSC";
  }

  return texto;
}

