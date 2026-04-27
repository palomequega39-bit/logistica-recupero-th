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
   DROPZONE
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
    Papa.parse(file,{
      header:true,
      delimiter:";",
      skipEmptyLines:true,
      complete: res=>procesar(res.data)
    });
  }
}

/* =========================
   EXCEL → PREPROCESO NUEVO
========================= */

function leerExcel(file){

  const reader = new FileReader();

  reader.onload = function(e){

    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, {type: "array"});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const csvProcesado = preprocesarExacto(raw);

    descargarCSV(csvProcesado, "debug_preprocesado.csv");

    Papa.parse(csvProcesado,{
      header:true,
      skipEmptyLines:true,
      complete: res=>procesar(res.data)
    });

  };

  reader.readAsArrayBuffer(file);
}

/* =========================
   PROCESAR (ORIGINAL)
========================= */

function procesar(data){

  const map = {};

  data.forEach(r=>{

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

    if(texto){
      const combinado=`${o.Orden} ${o.Apellido} ${o.Nombre} ${o.Dni} ${o.ObraSocial} ${o.Institucion}`.toLowerCase();
      if(!combinado.includes(texto)) return false;
    }

    return true;
  });

  indiceSeleccionado=-1;
  renderLista();
}

/* =========================
   LISTA (FAVORITOS OK)
========================= */

function renderLista(){

  const cont=document.getElementById("ordenesList");
  cont.innerHTML="";

  filtradas.forEach((o, i) => {

    const fila = document.createElement("div");

    const esFav = o.Favorito === "VERDADERO" || o.Favorito === "SI";

    fila.className = `fila ${esFav ? 'favorito' : ''}`;

    const estrella = esFav ? `<span class="estrella">★</span>` : "";

    fila.innerHTML = `
      <span>${estrella}${o.Orden}</span>
      <span>${o.Apellido} ${o.Nombre}</span>
      <span>${o.Dni}</span>
      <span>${o.ObraSocial}</span>
      <span>${o.FechaCX || ""}</span>
      <span>${o.Institucion}</span>
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

  cab.innerHTML = `
    <div class="campo"><b>Paciente:</b> ${o.Apellido} ${o.Nombre}</div>
    <div class="campo"><b>DNI:</b> ${o.Dni}</div>
    <div class="campo"><b>Obra:</b> ${o.ObraSocial}</div>
    <div class="campo"><b>Institución:</b> ${o.Institucion}</div>
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
   HELPERS PREPROCESO
========================= */

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
  if (texto.includes("BSC")) {
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

/* =========================
   PREPROCESAR EXACTO
========================= */

function preprocesarExacto(datos){

  datos = datos.slice(1);

  let refOrden, apellido, nombre, dni, cliente, fechaCirugia;
  let vendedor, medico, medicoSolicitante;
  let foja, certificado, actividades;
  let direccion, ciudad, expediente, favorito, devolucion, prioridad;

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

  for (let i = 0; i < datos.length; i++) {
    let row = datos[i];
    row[22] = booleanTexto(row[22]);
    row[2] = excelFechaAJS(row[2]);
    row[7] = excelFechaAJS(row[7]);
    row[20] = excelFechaAJS(row[20]);
  }

  datos = datos.filter(row => {
    let os = procesarObraSocial(row[6]);
    if (!os) return false;
    row[6] = os;
    return true;
  });

  return XLSX.utils.sheet_to_csv(
    XLSX.utils.aoa_to_sheet([
      ["Orden","Remito","FechaR","Apellido","Nombre","Dni","ObraSocial","FechaCX","Producto","Q","Lote","Serie","Vendedor","Medico","MedicoSolicitante","Foja","CI","Actividades","Institucion","Ciudad","Vencimiento","Expediente","Favorito","Devolucion","Prioridad","Column1"],
      ...datos.map(r => [...r, ""])
    ])
  );
}
