let ordenes = [];
let filtradas = [];
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
  fill("filtroInstitucion","Institucion");
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

  filtradas=ordenes.filter(o=>{

    if(f("filtroInstitucion") && o.Institucion!==f("filtroInstitucion")) return false;
    if(f("filtroPrioridad") && o.Prioridad!==f("filtroPrioridad")) return false;
    if(f("filtroCiudad") && o.Ciudad!==f("filtroCiudad")) return false;

    return true;
  });

  renderLista();
}

// LISTA
function renderLista(){

  if(sortField){
    filtradas.sort((a,b)=>{

      let valA, valB;

      switch(sortField){

        case "fav":
          valA = (a.Favotito||"").toUpperCase()==="VERDADERO" ? 1 : 0;
          valB = (b.Favotito||"").toUpperCase()==="VERDADERO" ? 1 : 0;
          break;

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

// DETALLE
function mostrar(o){

 document.getElementById("cabecera").innerHTML = `
  <div class="campo"><b>Paciente:</b> ${o.Apellido} ${o.Nombre}</div>
  <div class="campo"><b>DNI:</b> ${o.Dni}</div>
  <div class="campo"><b>Obra:</b> ${o.ObraSocial}</div>
  <div class="campo"><b>Institución:</b> ${o.Institucion}</div>

  <div class="campo"><b>Ciudad:</b> ${o.Ciudad}</div>
  <div class="campo"><b>Prioridad:</b> ${o.Prioridad}</div>
  <div class="campo"><b>Foja:</b> ${o.Foja}</div>
  <div class="campo"><b>CI:</b> ${o.CI}</div>

  <div class="campo"><b>Devolución:</b> ${o.Devolucion}</div>
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
function sortBy(field){
  if(sortField === field){
    ordenAsc = !ordenAsc;
  } else {
    sortField = field;
    ordenAsc = true;
  }
  renderLista();
}
