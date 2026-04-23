let ordenes = [];
let filtradas = [];

// FILE
document.getElementById("dropzone").onclick = () => {
  document.getElementById("fileInput").click();
};

document.getElementById("fileInput").onchange = e => {
  leerArchivo(e.target.files[0]);
};

function leerArchivo(file){
  Papa.parse(file,{
    header:true,
    delimiter:";",
    skipEmptyLines:true,
    complete: res => procesar(res.data)
  });
}

// DATA
function procesar(data){

  const map = {};

  data.forEach(r=>{
    if(!r.Orden) return;

    if(!map[r.Orden]){
      map[r.Orden]={...r, detalles:[]};
    }

    map[r.Orden].detalles.push(r);
  });

  ordenes = Object.values(map);

  cargarFiltros();
  aplicarFiltros();
}

// FILTROS
function cargarFiltros(){
  fill("filtroInstitucion","Institucion");
  fill("filtroPrioridad","Prioridad");
  fill("filtroCiudad","Ciudad");

  setYN("filtroDevolucion");
  setYN("filtroFoja");
  setYN("filtroCI");

  document.getElementById("filtroFecha").innerHTML=`
    <option value="">Todas</option>
    <option value="REALIZADA">Realizada</option>
    <option value="HOY">Hoy</option>
    <option value="PENDIENTE">No realizada</option>
  `;
}

function fill(id,campo){
  const sel=document.getElementById(id);
  const vals=[...new Set(ordenes.map(o=>o[campo]).filter(Boolean))];
  sel.innerHTML=`<option value="">Todos</option>`+
    vals.map(v=>`<option>${v}</option>`).join("");
}

function setYN(id){
  document.getElementById(id).innerHTML=`
    <option value="">Todos</option>
    <option value="SI">Sí</option>
    <option value="NO">No</option>
  `;
}

function aplicarFiltros(){
  filtradas = ordenes;
  renderLista();
}

// LISTA
function renderLista(){

  const cont = document.getElementById("ordenesList");
  cont.innerHTML="";

  filtradas.forEach(o=>{

    const fila = document.createElement("div");
    fila.className = "fila";

    fila.innerHTML = `
      ${(o.Favotito||"").toUpperCase()==="VERDADERO" ? "⭐" : ""}
      <span>${o.Orden}</span>
      <span>${o.Apellido} ${o.Nombre}</span>
      <span>${o.Dni}</span>
      <span>${o.ObraSocial}</span>
      <span>${o.Institucion}</span>
      <span>${o.Prioridad}</span>
    `;

    fila.onclick = ()=>{
      document.querySelectorAll(".fila").forEach(f=>f.classList.remove("active"));
      fila.classList.add("active");
      mostrar(o);
    };

    cont.appendChild(fila);
  });
}

// DETALLE
function mostrar(o){

  document.getElementById("cabecera").innerHTML=`
    <div class="campo">${o.Apellido} ${o.Nombre}</div>
    <div class="campo">${o.Dni}</div>
    <div class="campo">${o.ObraSocial}</div>
    <div class="campo">${o.Institucion}</div>

    <div class="campo">${o.Ciudad}</div>
    <div class="campo">${o.Prioridad}</div>
    <div class="campo">Foja: ${o.Foja}</div>
    <div class="campo">CI: ${o.CI}</div>

    <div class="campo">Dev: ${o.Devolucion}</div>
    <div class="campo">${o.Expediente}</div>
    <div class="campo">${o.FechaCX}</div>
    <div class="campo">${o.Medico}</div>
  `;

  const body=document.getElementById("detalleBody");
  body.innerHTML="";

  o.detalles.forEach(d=>{
    const tr=document.createElement("tr");

    tr.innerHTML=`
      <td>${d.Producto}</td>
      <td>${d.Q}</td>
      <td>${d.Lote}</td>
      <td>${d.Serie}</td>
      <td>${d.Vencimiento}</td>
    `;

    body.appendChild(tr);
  });
}
