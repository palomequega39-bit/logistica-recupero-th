let ordenes = [];
let filtradas = [];
let indiceSeleccionado = -1;
let sortField = null;
let ordenAsc = true;

/* ================= INIT ================= */

console.log("APP INICIADA");

document.getElementById("btnFiltrar").onclick = aplicarFiltros;

document.getElementById("fileInput").addEventListener("change", function(e){
  const file = e.target.files[0];

  if(!file){
    console.log("No hay archivo");
    return;
  }

  console.log("Archivo cargado:", file.name);

  Papa.parse(file,{
    header:true,
    delimiter:";",
    skipEmptyLines:true,
    complete: res=>{
      console.log("Filas leídas:", res.data.length);
      procesar(res.data);
    }
  });
});

document.getElementById("buscadorGlobal")
  .addEventListener("input", aplicarFiltros);

/* ================= DATA ================= */

function procesar(data){

  const map = {};

  data.forEach(r=>{
    if(!r.Orden) return;

    if(!map[r.Orden]){
      map[r.Orden] = {...r, detalles:[]};
    }

    map[r.Orden].detalles.push(r);
  });

  ordenes = Object.values(map);

  console.log("Órdenes construidas:", ordenes.length);

  cargarFiltros();
  aplicarFiltros();
}

/* ================= FILTROS ================= */

function cargarFiltros(){
  fill("filtroPrioridad","Actividades"); // usamos Actividades como prioridad
  fill("filtroCiudad","Vendedor");       // ejemplo: podés cambiar si querés
  cargarInstituciones();
}

function fill(id,campo){
  const sel = document.getElementById(id);

  const vals = [...new Set(
    ordenes.map(o=>o[campo]).filter(Boolean)
  )];

  sel.innerHTML = `<option value="">Todos</option>` +
    vals.map(v=>`<option>${v}</option>`).join("");
}

function aplicarFiltros(){

  const f = id=>document.getElementById(id).value;
  const texto = document.getElementById("buscadorGlobal").value.toLowerCase();

  filtradas = ordenes.filter(o=>{

    if(f("filtroInstitucion") && o.Ins !== f("filtroInstitucion")) return false;
    if(f("filtroPrioridad") && o.Actividades !== f("filtroPrioridad")) return false;
    if(f("filtroCiudad") && o.Vendedor !== f("filtroCiudad")) return false;

    if(texto){
      const combinado = `
        ${o.Orden}
        ${o.Apellido}
        ${o.Nombre}
        ${o.Dni}
        ${o.ObraSocial}
        ${o.Ins}
      `.toLowerCase();

      if(!combinado.includes(texto)) return false;
    }

    return true;
  });

  indiceSeleccionado = -1;
  renderLista();
}

/* ================= LISTA ================= */

function renderLista(){

  const cont = document.getElementById("ordenesList");
  cont.innerHTML = "";

  if(sortField){
    filtradas.sort((a,b)=>{

      let valA, valB;

      if(sortField === "Paciente"){
        valA = (a.Apellido + a.Nombre).toLowerCase();
        valB = (b.Apellido + b.Nombre).toLowerCase();
      } else {
        valA = (a[sortField]||"").toString().toLowerCase();
        valB = (b[sortField]||"").toString().toLowerCase();
      }

      return ordenAsc
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }

  filtradas.forEach((o,index)=>{

    const fila = document.createElement("div");
    fila.className = "fila";

    fila.innerHTML = `
      <span>${o.Orden}</span>
      <span>${o.Apellido} ${o.Nombre}</span>
      <span>${o.Dni}</span>
      <span>${o.ObraSocial}</span>
      <span>${o.Ins}</span>
      <span>${o.Actividades}</span>
    `;

    fila.onclick = ()=>{
      indiceSeleccionado = index;
      actualizarSeleccion();
    };

    cont.appendChild(fila);
  });
}

/* ================= SELECCIÓN ================= */

document.addEventListener("keydown", e=>{

  if(filtradas.length===0) return;

  if(e.key==="ArrowDown"){
    if(indiceSeleccionado < filtradas.length-1) indiceSeleccionado++;
    actualizarSeleccion();
  }

  if(e.key==="ArrowUp"){
    if(indiceSeleccionado > 0) indiceSeleccionado--;
    actualizarSeleccion();
  }
});

function actualizarSeleccion(){

  const filas = document.querySelectorAll(".fila");
  filas.forEach(f=>f.classList.remove("active"));

  const fila = filas[indiceSeleccionado];
  if(!fila) return;

  fila.classList.add("active");

  mostrar(filtradas[indiceSeleccionado]);

  fila.scrollIntoView({block:"nearest"});
}

/* ================= DETALLE ================= */

function mostrar(o){

  document.getElementById("cabecera").innerHTML = `
    <div class="campo"><b>Paciente:</b> ${o.Apellido} ${o.Nombre}</div>
    <div class="campo"><b>DNI:</b> ${o.Dni}</div>
    <div class="campo"><b>Obra:</b> ${o.ObraSocial}</div>
    <div class="campo"><b>Institución:</b> ${o.Ins}</div>

    <div class="campo"><b>Fecha CX:</b> ${o.FechaCX}</div>
    <div class="campo"><b>Médico:</b> ${o.Medico}</div>
    <div class="campo"><b>Médico Sol:</b> ${o.MedicoSolicitante}</div>
    <div class="campo"><b>Vendedor:</b> ${o.Vendedor}</div>

    <div class="campo"><b>Foja:</b> ${boolTag(o.Foja)}</div>
    <div class="campo"><b>CI:</b> ${boolTag(o.CI)}</div>
  `;

  const body = document.getElementById("detalleBody");
  body.innerHTML = "";

  o.detalles.forEach(d=>{
    body.innerHTML += `
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

/* ================= UTILS ================= */

function boolTag(val){
  const v=(val||"").toUpperCase();
  if(v==="VERDADERO") return `<span class="tag si">SI</span>`;
  if(v==="FALSO") return `<span class="tag no">NO</span>`;
  return "";
}

/* ================= INSTITUCIONES ================= */

function cargarInstituciones(){

  const input = document.getElementById("filtroInstitucion");
  const lista = document.getElementById("listaInstituciones");

  const valores = [...new Set(
    ordenes.map(o=>o.Ins).filter(Boolean)
  )];

  input.oninput = ()=>{
    const texto = input.value.toLowerCase();

    lista.innerHTML = valores
      .filter(v=>v.toLowerCase().includes(texto))
      .slice(0,50)
      .map(v=>`<div class="item-inst">${v}</div>`)
      .join("");
  };

  lista.onclick = e=>{
    if(e.target.classList.contains("item-inst")){
      input.value = e.target.textContent;
      lista.innerHTML = "";
      aplicarFiltros();
    }
  };

  input.onblur = ()=>{
    setTimeout(()=> lista.innerHTML="",150);
  };
}
