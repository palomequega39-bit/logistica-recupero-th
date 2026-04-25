let ordenes = [];
let filtradas = [];
let indiceSeleccionado = -1;
let sortField = null;
let ordenAsc = true;

// botón filtro
document.getElementById("btnFiltrar").onclick = aplicarFiltros;

// archivo
document.getElementById("fileInput").onchange = e=>{
  Papa.parse(e.target.files[0],{
    header:true,
    delimiter:";",
    skipEmptyLines:true,
    complete: res=>procesar(res.data)
  });
};

// DATA
function procesar(data){

  const map={};

  data.forEach(r=>{
    if(!r.Orden) return;

    if(!map[r.Orden]){
      map[r.Orden]={...r,detalles:[]};
    }

    map[r.Orden].detalles.push(r);
  });

  ordenes=Object.values(map);

  cargarFiltros();
  aplicarFiltros();
}

// FILTROS
function cargarFiltros(){

  cargarInstituciones();

  fill("filtroPrioridad","Prioridad");
  fill("filtroCiudad","Ciudad");
}

function fill(id,campo){
  const sel=document.getElementById(id);
  const vals=[...new Set(ordenes.map(o=>o[campo]).filter(Boolean))];
  sel.innerHTML=`<option value="">Todos</option>`+
    vals.map(v=>`<option>${v}</option>`).join("");
}

function aplicarFiltros(){

  const f=id=>document.getElementById(id).value;
  const texto = document.getElementById("buscadorGlobal").value.toLowerCase();

  filtradas = ordenes.filter(o=>{

    // filtros existentes
    if(f("filtroInstitucion") && o.Institucion!==f("filtroInstitucion")) return false;
    if(f("filtroPrioridad") && o.Prioridad!==f("filtroPrioridad")) return false;
    if(f("filtroCiudad") && o.Ciudad!==f("filtroCiudad")) return false;

    // 🔍 búsqueda global
    if(texto){
      const combinado = `
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

  renderLista();
}

// ===== HELPER SI / NO =====
function boolTag(val){
  const v = (val || "").toUpperCase();

  if(v === "VERDADERO"){
    return `<span class="tag si">SI</span>`;
  }
  if(v === "FALSO"){
    return `<span class="tag no">NO</span>`;
  }
  return "";
}

// LISTA
function renderLista(){

  const cont=document.getElementById("ordenesList");
  cont.innerHTML="";

  // ORDEN
  if(sortField){
    filtradas.sort((a,b)=>{

      let valA, valB;

      switch(sortField){

        case "Paciente":
          valA = (a.Apellido + a.Nombre).toLowerCase();
          valB = (b.Apellido + b.Nombre).toLowerCase();
          break;

        default:
          valA = (a[sortField]||"").toString().toLowerCase();
          valB = (b[sortField]||"").toString().toLowerCase();
      }

      if(valA < valB) return ordenAsc ? -1 : 1;
      if(valA > valB) return ordenAsc ? 1 : -1;
      return 0;
    });
  }

  filtradas.forEach(o=>{

    const fila=document.createElement("div");
    fila.className="fila";

    if((o.Favorito || "").toUpperCase() === "VERDADERO"){
      fila.classList.add("favorito");
    }

    fila.innerHTML=`
      <span>${o.Orden}</span>
      <span>${o.Apellido} ${o.Nombre}</span>
      <span>${o.Dni}</span>
      <span>${o.ObraSocial}</span>
      <span>${o.Institucion}</span>
      <span>${o.Prioridad}</span>
    `;

    fila.onclick = ()=>{

  indiceSeleccionado = filtradas.indexOf(o);

  document.querySelectorAll(".fila").forEach(f=>f.classList.remove("active"));
  fila.classList.add("active");

  mostrar(o);
};

    cont.appendChild(fila);
  });
}

// SORT
function sortBy(field){
  if(sortField === field){
    ordenAsc = !ordenAsc;
  } else {
    sortField = field;
    ordenAsc = true;
  }
  renderLista();
}

// DETALLE
function mostrar(o){

 document.getElementById("cabecera").innerHTML = `
  <div class="campo"><b>Paciente:</b> ${o.Apellido} ${o.Nombre}</div>
  <div class="campo"><b>DNI:</b> ${o.Dni}</div>
  <div class="campo"><b>Obra:</b> ${o.ObraSocial}</div>
  <div class="campo"><b>Institución:</b> ${o.Institucion}</div>

  <div class="campo"><b>Ciudad:</b> ${o.Ciudad}</div>
  <div class="campo"><b>Prioridad:</b> ${o.Prioridad}</div>
  <div class="campo"><b>Foja:</b> ${boolTag(o.Foja)}</div>
  <div class="campo"><b>CI:</b> ${boolTag(o.CI)}</div>

  <div class="campo"><b>Devolución:</b> ${boolTag(o.Devolucion)}</div>
  <div class="campo"><b>Expediente:</b> ${o.Expediente}</div>
  <div class="campo"><b>Fecha CX:</b> ${o.FechaCX}</div>
  <div class="campo"><b>Médico:</b> ${o.Medico}</div>
`;

  const body=document.getElementById("detalleBody");
  body.innerHTML="";

  o.detalles.forEach(d=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${d.Remito || ""}</td>
      <td>${d.FechaR || ""}</td>
      <td>${d.Producto || ""}</td>
      <td>${d.Q || ""}</td>
      <td>${d.Lote || ""}</td>
      <td>${d.Serie || ""}</td>
      <td>${d.Vencimiento || ""}</td>
    `;
    body.appendChild(tr);
  });
}

document.getElementById("buscadorGlobal").addEventListener("input", aplicarFiltros);
function cargarInstituciones(){

  const input = document.getElementById("filtroInstitucion");
  const lista = document.getElementById("listaInstituciones");

  const valores = [...new Set(ordenes.map(o=>o.Institucion).filter(Boolean))];

  input.addEventListener("input", ()=>{

    const texto = input.value.toLowerCase();

    lista.innerHTML = valores
      .filter(v=>v.toLowerCase().includes(texto))
      .slice(0,50)
      .map(v=>`<div onclick="seleccionarInstitucion('${v}')">${v}</div>`)
      .join("");
  });
}
function seleccionarInstitucion(valor){
  document.getElementById("filtroInstitucion").value = valor;
  document.getElementById("listaInstituciones").innerHTML = "";
  aplicarFiltros();
}

document.addEventListener("keydown", function(e){

  if(filtradas.length === 0) return;

  if(e.key === "ArrowDown"){

    if(indiceSeleccionado < filtradas.length - 1){
      indiceSeleccionado++;
    }

    actualizarSeleccion();
  }

  if(e.key === "ArrowUp"){

    if(indiceSeleccionado > 0){
      indiceSeleccionado--;
    }

    actualizarSeleccion();
  }

});
function actualizarSeleccion(){

  const filas = document.querySelectorAll(".fila");

  filas.forEach(f => f.classList.remove("active"));

  const fila = filas[indiceSeleccionado];

  if(!fila) return;

  fila.classList.add("active");

  const orden = filtradas[indiceSeleccionado];

  mostrar(orden);

  // 🔥 auto scroll para mantener visible
  fila.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}
