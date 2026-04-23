let ordenes = [];
let filtradas = [];
let grid;
let ordenSeleccionadaIndex = null;

// INIT
document.addEventListener("DOMContentLoaded", () => {

  // Drag & drop
  const dz = document.getElementById("dropzone");

  dz.addEventListener("dragover", e => {
    e.preventDefault();
    dz.style.background = "#1f2937";
  });

  dz.addEventListener("dragleave", () => {
    dz.style.background = "";
  });

  dz.addEventListener("drop", e => {
    e.preventDefault();
    dz.style.background = "";
    const file = e.dataTransfer.files[0];
    leerArchivo(file);
  });

  document.getElementById("fileInput").addEventListener("change", e => {
    leerArchivo(e.target.files[0]);
  });

  document.getElementById("btnFiltrar").onclick = aplicarFiltros;
  document.getElementById("btnReset").onclick = () => {
    document.querySelectorAll("select").forEach(s => s.value = "");
    aplicarFiltros();
  };

});

// CSV
function leerArchivo(file) {
  Papa.parse(file, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    complete: res => procesar(res.data)
  });
}

// DATA
function procesar(data) {

  const map = {};

  data.forEach(r => {
    if (!r.Orden) return;

    if (!map[r.Orden]) {
      map[r.Orden] = {
        ...r,
        detalles: [],
        dev: (r.Devolucion || "").toUpperCase() === "VERDADERO",
        ci: (r.CI || "").toUpperCase() === "VERDADERO",
        foja: r.Foja && r.Foja !== ""
      };
    }

    map[r.Orden].detalles.push(r);
  });

  ordenes = Object.values(map);

  cargarFiltros();
  aplicarFiltros();
}

// FILTROS
function cargarFiltros() {
  fill("filtroInstitucion","Institucion");
  fill("filtroPrioridad","Prioridad");
  fill("filtroObra","ObraSocial");
  fill("filtroCiudad","Ciudad");

  setYN("filtroDevolucion");
  setYN("filtroFoja");
  setYN("filtroCI");
}

function fill(id, campo) {
  const sel = document.getElementById(id);
  const vals = [...new Set(ordenes.map(o => o[campo]).filter(Boolean))];
  sel.innerHTML = `<option value="">Todos</option>` + vals.map(v=>`<option>${v}</option>`).join("");
}

function setYN(id) {
  document.getElementById(id).innerHTML = `
    <option value="">Todos</option>
    <option value="SI">Sí</option>
    <option value="NO">No</option>
  `;
}

// FILTRAR
function aplicarFiltros() {

  const f = id => document.getElementById(id).value;

  filtradas = ordenes.filter(o => {

    if (f("filtroInstitucion") && o.Institucion !== f("filtroInstitucion")) return false;
    if (f("filtroPrioridad") && o.Prioridad !== f("filtroPrioridad")) return false;
    if (f("filtroObra") && o.ObraSocial !== f("filtroObra")) return false;
    if (f("filtroCiudad") && o.Ciudad !== f("filtroCiudad")) return false;

    if (f("filtroDevolucion") === "SI" && !o.dev) return false;
    if (f("filtroDevolucion") === "NO" && o.dev) return false;

    if (f("filtroFoja") === "SI" && !o.foja) return false;
    if (f("filtroFoja") === "NO" && o.foja) return false;

    if (f("filtroCI") === "SI" && !o.ci) return false;
    if (f("filtroCI") === "NO" && o.ci) return false;

    return true;
  });

  render();
}

// GRID
function render() {

  if (grid) {
    grid.destroy();
    document.getElementById("tablaGrid").innerHTML = "";
  }

  document.getElementById("counter").innerText = filtradas.length + " órdenes";

  grid = new gridjs.Grid({
    columns: [
      "Orden",
      "Paciente",
      "DNI",
      "Obra Social",
      {
        name: "Prioridad",
        formatter: c => gridjs.html(`<span class="badge ${cls(c)}">${c}</span>`)
      }
    ],
    data: filtradas.map(o => [
      o.Orden,
      o.Apellido + " " + o.Nombre,
      o.Dni,
      o.ObraSocial,
      o.Prioridad
    ]),
    pagination: { limit: 10 },
    search: true,
    sort: true
  }).render(document.getElementById("tablaGrid"));

  setTimeout(bindClicks, 200);
}

// CLICK FILA
function bindClicks() {

  document.querySelectorAll(".gridjs-tr").forEach((row, i) => {

    row.onclick = () => {

      document.querySelectorAll(".gridjs-tr").forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");

      ordenSeleccionadaIndex = i;
      mostrar(filtradas[i]);
    };

  });
}

// DETALLE
function mostrar(o) {

  document.getElementById("cabecera").innerHTML = `
    <div class="campo"><b>${o.Apellido} ${o.Nombre}</b></div>
    <div class="campo">DNI: ${o.Dni}</div>
    <div class="campo">Obra: ${o.ObraSocial}</div>

    <div class="campo">Institución: ${o.Institucion}</div>
    <div class="campo">Ciudad: ${o.Ciudad}</div>
    <div class="campo">Prioridad: ${o.Prioridad}</div>
  `;

  document.getElementById("detalle").innerHTML = "";

  new gridjs.Grid({
    columns: ["Remito","Fecha","Producto","Cant","Lote","Serie","Venc"],
    data: o.detalles.map(d => [
      d.Remito, d.FechaR, d.Producto, d.Q, d.Lote, d.Serie, d.Vencimiento
    ]),
    pagination: { limit: 5 }
  }).render(document.getElementById("detalle"));
}

// UTILS
function cls(p){
  if(!p) return "";
  p=p.toLowerCase();
  if(p.includes("alta")) return "alta";
  if(p.includes("media")) return "media";
  return "baja";
}
