let ordenes = [];
let filtradas = [];
let seleccionActual = null;

// ================= FILE =================
const dropzone = document.getElementById("dropzone");
const input = document.getElementById("fileInput");

dropzone.onclick = () => input.click();

dropzone.ondragover = e => {
  e.preventDefault();
  dropzone.style.background = "#1e293b";
};

dropzone.ondragleave = () => {
  dropzone.style.background = "";
};

dropzone.ondrop = e => {
  e.preventDefault();
  leerArchivo(e.dataTransfer.files[0]);
};

input.onchange = e => leerArchivo(e.target.files[0]);

function leerArchivo(file){
  Papa.parse(file,{
    header:true,
    delimiter:";",
    skipEmptyLines:true,
    complete: res => procesar(res.data)
  });
}

// ================= DATA =================
function procesar(data){

  const map = {};

  data.forEach(r=>{
    if(!r.Orden) return;

    if(!map[r.Orden]){
      map[r.Orden]={
        ...r,
        detalles:[],
        dev: (r.Devolucion || "").toUpperCase()==="VERDADERO",
        ci: (r.CI || "").toUpperCase()==="VERDADERO",
        foja: r.Foja && r.Foja !== ""
      };
    }

    map[r.Orden].detalles.push(r);
  });

  ordenes = Object.values(map);

  cargarFiltros();
  aplicarFiltros();
}

// ================= FILTROS =================
function cargarFiltros(){

  fill("filtroInstitucion","Institucion");
  fill("filtroPrioridad","Prioridad");
  fill("filtroCiudad","Ciudad");

  setYN("filtroDevolucion");
  setYN("filtroFoja");
  setYN("filtroCI");

  // NUEVO: fecha
  document.getElementById("filtroFecha").innerHTML = `
    <option value="">Todas</option>
    <option value="REALIZADA">Realizada</option>
    <option value="HOY">Hoy</option>
    <option value="PENDIENTE">No realizada</option>
  `;
}

function fill(id,campo){
  const sel = document.getElementById(id);
  const vals = [...new Set(ordenes.map(o=>o[campo]).filter(Boolean))];
  sel.innerHTML = `<option value="">Todos</option>` +
    vals.map(v=>`<option>${v}</option>`).join("");
}

function setYN(id){
  document.getElementById(id).innerHTML = `
    <option value="">Todos</option>
    <option value="SI">Sí</option>
    <option value="NO">No</option>
  `;
}

function aplicarFiltros(){

  const f = id => document.getElementById(id).value;

  const hoy = new Date().toISOString().split("T")[0];

  filtradas = ordenes.filter(o=>{

    if(f("filtroInstitucion") && o.Institucion!==f("filtroInstitucion")) return false;
    if(f("filtroPrioridad") && o.Prioridad!==f("filtroPrioridad")) return false;
    if(f("filtroCiudad") && o.Ciudad!==f("filtroCiudad")) return false;

    if(f("filtroDevolucion")==="SI" && !o.dev) return false;
    if(f("filtroDevolucion")==="NO" && o.dev) return false;

    if(f("filtroFoja")==="SI" && !o.foja) return false;
    if(f("filtroFoja")==="NO" && o.foja) return false;

    if(f("filtroCI")==="SI" && !o.ci) return false;
    if(f("filtroCI")==="NO" && o.ci) return false;

    // FECHA CX
    if(o.FechaCX){
      const fecha = o.FechaCX.split(" ")[0];

      if(f("filtroFecha")==="HOY" && fecha !== hoy) return false;
      if(f("filtroFecha")==="REALIZADA" && fecha > hoy) return false;
      if(f("filtroFecha")==="PENDIENTE" && fecha <= hoy) return false;
    }

    return true;
  });

  renderLista();
}

// ================= LISTA =================
function renderLista(){

  const cont = document.getElementById("ordenesList");
  cont.innerHTML="";

  filtradas.forEach(o=>{

    const div = document.createElement("div");
    div.className="card";

    div.innerHTML = `
      ${(o.Favotito || "").toUpperCase() === "VERDADERO" ? "⭐" : ""}
      <b>${o.Orden}</b><br>
      ${o.Apellido} ${o.Nombre}<br>
      DNI: ${o.Dni}<br>
      ${o.ObraSocial}<br>
      ${o.Institucion}<br>
      <small>${o.FechaCX || ""}</small>
    `;

    div.onclick = ()=>{
      document.querySelectorAll(".card").forEach(c=>c.classList.remove("active"));
      div.classList.add("active");
      seleccionActual = o;
      mostrar(o);
    };

    cont.appendChild(div);
  });
}

// ================= DETALLE =================
function mostrar(o){

  // CABECERA COMPLETA
  document.getElementById("cabecera").innerHTML = `
    <div class="campo"><b>${o.Apellido} ${o.Nombre}</b></div>
    <div class="campo">DNI: ${o.Dni}</div>
    <div class="campo">${o.ObraSocial}</div>

    <div class="campo">Institución: ${o.Institucion}</div>
    <div class="campo">Ciudad: ${o.Ciudad}</div>
    <div class="campo">Prioridad: ${o.Prioridad}</div>

    <div class="campo">Foja: ${o.Foja}</div>
    <div class="campo">CI: ${o.CI}</div>
    <div class="campo">Devolución: ${o.Devolucion}</div>

    <div class="campo">Expediente: ${o.Expediente}</div>
    <div class="campo">Fecha CX: ${o.FechaCX}</div>
    <div class="campo">Médico: ${o.Medico}</div>

    <div class="campo">Solicitante: ${o.MedicoSolicitante}</div>
  `;

  // LIMPIAR DETALLE
  const body = document.getElementById("detalleBody");
  body.innerHTML = "";

  o.detalles.forEach(d=>{
    const tr = document.createElement("tr");

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
