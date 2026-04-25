let ordenes = [];
let filtradas = [];
let indiceSeleccionado = -1;
let sortField = null;
let ordenAsc = true;

/* INIT */

document.getElementById("fileInput").addEventListener("change", e=>{
  Papa.parse(e.target.files[0],{
    header:true,
    delimiter:";",
    skipEmptyLines:true,
    complete: res=>procesar(res.data)
  });
});

document.getElementById("btnFiltrar").onclick = aplicarFiltros;
document.getElementById("buscadorGlobal").addEventListener("input", aplicarFiltros);

/* DATA */

function procesar(data){

  const map={};

  data.forEach(r=>{
    if(!r.Orden) return;

    // derivar devolución desde Actividades
    r.Devolucion = (r.Actividades || "").toUpperCase().includes("DEV")
      ? "VERDADERO" : "FALSO";

    // clasificar fecha CX
    r.EstadoFecha = clasificarFecha(r.FechaCX);

    if(!map[r.Orden]){
      map[r.Orden]={...r,detalles:[]};
    }

    map[r.Orden].detalles.push(r);
  });

  ordenes=Object.values(map);

  cargarFiltros();
  aplicarFiltros();
}

/* FILTROS */

function cargarFiltros(){

  fillSelect("filtroFoja", ["VERDADERO","FALSO"]);
  fillSelect("filtroCI", ["VERDADERO","FALSO"]);
  fillSelect("filtroDevolucion", ["VERDADERO","FALSO"]);
  fillSelect("filtroFecha", ["Realizadas","Hoy","Sin realizarse"]);

  cargarInstituciones();
}

function fillSelect(id, valores){
  const sel=document.getElementById(id);
  sel.innerHTML = `<option value="">Todos</option>` +
    valores.map(v=>`<option>${v}</option>`).join("");
}

function aplicarFiltros(){

  const f=id=>document.getElementById(id).value;
  const texto=document.getElementById("buscadorGlobal").value.toLowerCase();

  filtradas = ordenes.filter(o=>{

    if(f("filtroInstitucion") && o.Ins!==f("filtroInstitucion")) return false;
    if(f("filtroFoja") && o.Foja!==f("filtroFoja")) return false;
    if(f("filtroCI") && o.CI!==f("filtroCI")) return false;
    if(f("filtroDevolucion") && o.Devolucion!==f("filtroDevolucion")) return false;
    if(f("filtroFecha") && o.EstadoFecha!==f("filtroFecha")) return false;

    if(texto){
      const c = `${o.Orden} ${o.Apellido} ${o.Nombre} ${o.Dni} ${o.ObraSocial} ${o.Ins}`.toLowerCase();
      if(!c.includes(texto)) return false;
    }

    return true;
  });

  indiceSeleccionado=-1;
  renderLista();
}

/* LISTA */

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
      <span>${o.FechaCX}</span>
      <span>${o.Ins}</span>
    `;

    fila.onclick=()=>{
      indiceSeleccionado=i;
      actualizarSeleccion();
    };

    cont.appendChild(fila);
  });
}

/* SELECCION */

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

  const filas=document.querySelectorAll(".fila");
  filas.forEach(f=>f.classList.remove("active"));

  const fila=filas[indiceSeleccionado];
  if(!fila) return;

  fila.classList.add("active");

  mostrar(filtradas[indiceSeleccionado]);

  fila.scrollIntoView({block:"nearest"});
}

/* DETALLE */

function mostrar(o){

  document.getElementById("cabecera").innerHTML=`
    <div class="campo"><b>Paciente:</b> ${o.Apellido} ${o.Nombre}</div>
    <div class="campo"><b>DNI:</b> ${o.Dni}</div>
    <div class="campo"><b>Obra:</b> ${o.ObraSocial}</div>
    <div class="campo"><b>Institución:</b> ${o.Ins}</div>

    <div class="campo"><b>Foja:</b> ${tag(o.Foja,"verde")}</div>
    <div class="campo"><b>CI:</b> ${tag(o.CI,"verde")}</div>
    <div class="campo"><b>Devolución:</b> ${tag(o.Devolucion,"naranja")}</div>
    <div class="campo"><b>Fecha CX:</b> ${o.FechaCX}</div>
  `;

  const body=document.getElementById("detalleBody");
  body.innerHTML="";

  o.detalles.forEach(d=>{
    body.innerHTML+=`
      <tr>
        <td>${d.Remito}</td>
        <td>${d.FechaR}</td>
        <td>${d.Producto}</td>
        <td>${d.Q}</td>
        <td>${d.Lote}</td>
        <td>${d.Serie}</td>
        <td>${d.Vencimiento}</td>
      </tr>
    `;
  });
}

/* UTILS */

function tag(val,tipo){
  if(val==="VERDADERO"){
    if(tipo==="naranja") return `<span class="tag dev">SI</span>`;
    return `<span class="tag si">SI</span>`;
  }
  if(val==="FALSO") return `<span class="tag no">NO</span>`;
  return "";
}

function clasificarFecha(f){
  if(!f) return "Sin realizarse";

  const hoy=new Date();
  const fecha=new Date(f);

  if(fecha.toDateString()===hoy.toDateString()) return "Hoy";
  if(fecha < hoy) return "Realizadas";
  return "Sin realizarse";
}

/* INSTITUCIONES */

function cargarInstituciones(){

  const input=document.getElementById("filtroInstitucion");
  const lista=document.getElementById("listaInstituciones");

  const valores=[...new Set(ordenes.map(o=>o.Ins).filter(Boolean))];

  input.oninput=()=>{
    const t=input.value.toLowerCase();

    lista.innerHTML=valores
      .filter(v=>v.toLowerCase().includes(t))
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
