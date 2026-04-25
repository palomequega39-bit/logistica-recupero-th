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

  Papa.parse(file,{
    header:true,
    delimiter:";",
    skipEmptyLines:true,
    complete: res=>procesar(res.data)
  });
}

/* =========================
   === LOGICA VBA ===
========================= */

// 1. Fill-down por orden
function normalizarFilas(data){

  let ref = {};

  return data.map(r=>{

    if(r.Orden){
      ref = {...r};
      return r;
    }

    const nueva = {...r};

    Object.keys(ref).forEach(k=>{
      if(!nueva[k]) nueva[k] = ref[k];
    });

    return nueva;
  });
}

// 2. Obra social
function procesarObraSocial(texto){

  if(!texto) return "";

  const t = texto.toUpperCase().trim();

  if(t.includes("BSC") || t.includes("BOSTON SCIENTIFIC")){
    if(t.includes("PAMI")) return "Pami - BSC";
    if(t.includes("OSECAC")) return "Osecac - BSC";
    return "Otra - BSC";
  }

  const partes = t.split(" ");

  if(partes.length >= 2){
    return capitalizar(partes[0]) + " " + capitalizar(partes[1]);
  }

  return capitalizar(partes[0]);
}

function capitalizar(str){
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// 3. Completar cantidad
function completarCantidad(rows){

  return rows.map(r=>{
    let q = Number(r.Q || 0);
    let alt = Number(r.Prioridad || 0); // ajustar si corresponde a otra columna real

    if(!q || q === 0){
      if(alt && alt !== 0){
        r.Q = alt;
      }
    }

    return r;
  });
}

// 4. Limpiar filas inválidas
function limpiarFilas(rows){

  const resultado = [];
  let i = 0;

  while(i < rows.length){

    const orden = rows[i].Orden;
    let bloque = [];

    while(i < rows.length && rows[i].Orden === orden){
      bloque.push(rows[i]);
      i++;
    }

    const hayCantidadValida = bloque.some(r => Number(r.Q) > 0);

    if(hayCantidadValida){
      bloque = bloque.filter(r => Number(r.Q) > 0);
    } else {
      bloque = bloque.slice(0,1);
    }

    resultado.push(...bloque);
  }

  return resultado;
}

/* =========================
   DATA
========================= */

function procesar(data){

  // limpiar headers
  data = data.map(r=>{
    const limpio = {};
    Object.keys(r).forEach(k=>{
      const key = k.replace(/\uFEFF/g, "").trim();
      limpio[key] = r[k];
    });
    return limpio;
  });

  // pipeline VBA
  data = normalizarFilas(data);

  data.forEach(r=>{
    r.ObraSocial = procesarObraSocial(r.ObraSocial);
  });

  data = completarCantidad(data);
  data = limpiarFilas(data);

  // agrupación
  const map = {};

  data.forEach(r=>{

    if(!r.Orden) return;

    r.Paciente = (r.Apellido || "") + " " + (r.Nombre || "");

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
   FILTROS / UI (igual)
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
   FILTRAR / LISTA / DETALLE
   (sin cambios relevantes)
========================= */

function aplicarFiltros(){

  const f=id=>document.getElementById(id).value;
  const texto=document.getElementById("buscadorGlobal").value.toLowerCase();

  filtradas=ordenes.filter(o=>{

    if(f("filtroInstitucion") && o.Institucion!==f("filtroInstitucion")) return false;
    if(f("filtroCiudad") && o.Ciudad!==f("filtroCiudad")) return false;
    if(f("filtroPrioridad") && o.Prioridad!==f("filtroPrioridad")) return false;

    if(f("filtroDevolucion") && o.Devolucion!==f("filtroDevolucion")) return false;
    if(f("filtroFoja") && o.Foja!==f("filtroFoja")) return false;
    if(f("filtroCI") && o.CI!==f("filtroCI")) return false;

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

function renderLista(){

  const cont=document.getElementById("ordenesList");
  cont.innerHTML="";

  filtradas.forEach((o,i)=>{

    const fila=document.createElement("div");
    fila.className="fila";

    fila.innerHTML=`
      <span>${o.Orden}</span>
      <span>${o.Apellido} ${o.Nombre}</span>
      <span>${o.Dni}</span>
      <span>${o.ObraSocial}</span>
      <span>${o.FechaCX||""}</span>
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

function actualizarSeleccion(){

  const filas=document.querySelectorAll(".fila");
  filas.forEach(f=>f.classList.remove("active"));

  const fila=filas[indiceSeleccionado];
  if(!fila) return;

  fila.classList.add("active");

  mostrar(filtradas[indiceSeleccionado]);
}

/* ========================= */

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
      </tr>
    `;
  });
}
