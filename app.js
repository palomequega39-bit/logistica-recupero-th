let ordenes = [];
let filtradas = [];

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

  const cont=document.getElementById("ordenesList");
  cont.innerHTML="";

  filtradas.forEach(o=>{

    const fila=document.createElement("div");
    fila.className="fila";

    fila.innerHTML=`
      ${(o.Favotito||"").toUpperCase()==="VERDADERO" ? "⭐" : ""}
      <span>${o.Orden}</span>
      <span>${o.Apellido} ${o.Nombre}</span>
      <span>${o.Dni}</span>
      <span>${o.ObraSocial}</span>
      <span>${o.Institucion}</span>
      <span>${o.Prioridad}</span>
    `;

    fila.onclick=()=>{
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
    <div class="campo">${o.Foja}</div>
    <div class="campo">${o.CI}</div>
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
