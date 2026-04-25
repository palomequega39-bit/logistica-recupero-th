
let ordenes = [];
let filtradas = [];
let indiceSeleccionado = -1;
let sortField = null;
let ordenAsc = true;

console.log("APP INICIADA");
/* ================= INIT ================= */

document.getElementById("btnFiltrar").onclick = aplicarFiltros;

document.getElementById("fileInput").onchange = e=>{
  console.log("Archivo cargado");
  
  Papa.parse(e.target.files[0],{
    header:true,
    delimiter:";",
    skipEmptyLines:true,
    complete: res=>{
      console.log("DATA:", res.data);
      procesar(res.data);
    }
  });
};

document.getElementById("buscadorGlobal")
  .addEventListener("input", aplicarFiltros);

/* ================= DATA ================= */

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

/* ================= FILTROS ================= */

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

    if(f("filtroInstitucion") && o.Institucion!==f("filtroInstitucion")) return false;
    if(f("filtroPrioridad") && o.Prioridad!==f("filtroPrioridad")) return false;
    if(f("filtroCiudad") && o.Ciudad!==f("filtroCiudad")) return false;

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

  indiceSeleccionado = -1;
  renderLista();
}

/* ================= LISTA ================= */

function renderLista(){

  const cont=document.getElementById("ordenesList");
  cont.innerHTML="";

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

      if(valA < valB) return ordenAsc ? -1 : 1;
      if(valA > valB) return ordenAsc ? 1 : -1;
      return 0;
    });
  }

  filtradas.forEach((o,index)=>{

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
      indiceSeleccionado = index;
      actualizarSeleccion();
    };

    cont.appendChild(fila);
  });
}

/* ================= SELECCIÓN ================= */

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

  const contenedor = document.getElementById("ordenesList");

  const filaTop = fila.offsetTop;
  const filaBottom = filaTop + fila.offsetHeight;

  const viewTop = contenedor.scrollTop;
  const viewBottom = viewTop + contenedor.clientHeight;

  if (filaTop < viewTop) {
    contenedor.scrollTop = filaTop;
  } else if (filaBottom > viewBottom) {
    contenedor.scrollTop = filaBottom - contenedor.clientHeight;
  }
}

/* ================= DETALLE ================= */

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

/* ================= UTILS ================= */

function boolTag(val){
  const v = (val || "").toUpperCase();
  if(v === "VERDADERO") return `<span class="tag si">SI</span>`;
  if(v === "FALSO") return `<span class="tag no">NO</span>`;
  return "";
}

/* ================= INSTITUCIONES ================= */

function cargarInstituciones(){

  const input = document.getElementById("filtroInstitucion");
  const lista = document.getElementById("listaInstituciones");

  const valores = [...new Set(ordenes.map(o=>o.Institucion).filter(Boolean))];

  input.addEventListener("input", ()=>{

    const texto = input.value.toLowerCase();

    lista.innerHTML = valores
      .filter(v=>v.toLowerCase().includes(texto))
      .slice(0,50)
      .map(v=>`<div class="item-inst">${v}</div>`)
      .join("");

  });

  lista.addEventListener("click", e=>{
    if(e.target.classList.contains("item-inst")){
      input.value = e.target.textContent;
      lista.innerHTML = "";
      aplicarFiltros();
    }
  });

  input.addEventListener("blur", ()=>{
    setTimeout(()=> lista.innerHTML="",150);
  });

  document.addEventListener("click", e=>{
    if(!input.contains(e.target) && !lista.contains(e.target)){
      lista.innerHTML="";
    }
  });
}
