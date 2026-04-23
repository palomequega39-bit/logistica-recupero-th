let data = [];
let ordenes = [];
let ordenesFiltradas = [];
let grid = null;

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("fileInput").addEventListener("change", e => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = ev => procesarCSV(ev.target.result);
        reader.readAsText(file);
    });

});

function procesarCSV(text) {

    const filas = text.split("\n").map(f => f.split(";"));
    const headers = filas[0];

    data = filas.slice(1).map(f => {
        let obj = {};
        headers.forEach((h, i) => obj[h.trim()] = f[i]);
        return obj;
    });

    construirOrdenes();
    cargarFiltros();
    aplicarFiltros();
}

function construirOrdenes() {

    const map = {};

    data.forEach(row => {
        if (!map[row.Orden]) {
            map[row.Orden] = {
                ...row,
                detalles: [],
                tiene_devolucion: (row.Devolucion || "").toUpperCase() === "VERDADERO",
                tiene_foja: row.Foja && row.Foja !== "",
                tiene_ci: (row.CI || "").toUpperCase() === "VERDADERO"
            };
        }
        map[row.Orden].detalles.push(row);
    });

    ordenes = Object.values(map);
}

function cargarFiltros() {

    cargarSelect("filtroInstitucion", "Institucion");
    cargarSelect("filtroPrioridad", "Prioridad");
    cargarSelect("filtroObra", "ObraSocial");
    cargarSelect("filtroCiudad", "Ciudad");

    setSiNo("filtroDevolucion");
    setSiNo("filtroFoja");
    setSiNo("filtroCI");
}

function cargarSelect(id, campo) {
    const select = document.getElementById(id);
    const valores = [...new Set(ordenes.map(o => o[campo]).filter(Boolean))];

    select.innerHTML = `<option value="">Todos</option>` +
        valores.map(v => `<option value="${v}">${v}</option>`).join("");
}

function setSiNo(id) {
    document.getElementById(id).innerHTML = `
        <option value="">Todos</option>
        <option value="SI">Sí</option>
        <option value="NO">No</option>
    `;
}

function aplicarFiltros() {

    const inst = filtroInstitucion.value;
    const dev = filtroDevolucion.value;
    const foja = filtroFoja.value;
    const ci = filtroCI.value;
    const prioridad = filtroPrioridad.value;
    const obra = filtroObra.value;
    const ciudad = filtroCiudad.value;

    ordenesFiltradas = ordenes.filter(o => {

        if (inst && o.Institucion !== inst) return false;
        if (prioridad && o.Prioridad !== prioridad) return false;
        if (obra && o.ObraSocial !== obra) return false;
        if (ciudad && o.Ciudad !== ciudad) return false;

        if (dev === "SI" && !o.tiene_devolucion) return false;
        if (dev === "NO" && o.tiene_devolucion) return false;

        if (foja === "SI" && !o.tiene_foja) return false;
        if (foja === "NO" && o.tiene_foja) return false;

        if (ci === "SI" && !o.tiene_ci) return false;
        if (ci === "NO" && o.tiene_ci) return false;

        return true;
    });

    renderGrid();
}

function renderGrid() {

    if (grid) grid.destroy();

    grid = new gridjs.Grid({
        columns: [
            "Orden",
            "Paciente",
            "DNI",
            "Obra Social",
            "Favorito",
            {
                name: "Prioridad",
                formatter: (cell) => {
                    const clase = getClasePrioridad(cell);
                    return gridjs.html(`<span class="badge ${clase}">${cell}</span>`);
                }
            }
        ],
        data: ordenesFiltradas.map(o => [
            o.Orden,
            o.Apellido + " " + o.Nombre,
            o.Dni,
            o.ObraSocial,
            o.Favotito,
            o.Prioridad
        ]),
        search: true,
        pagination: { limit: 10 },
        sort: true
    }).render(document.getElementById("tablaGrid"));

    // CLICK EN FILA
    document.querySelectorAll(".gridjs-tr").forEach((row, i) => {
        row.addEventListener("click", () => {
            mostrarDetalle(ordenesFiltradas[i]);
        });
    });
}

function getClasePrioridad(p) {
    if (!p) return "";
    p = p.toLowerCase();
    if (p.includes("alta")) return "alta";
    if (p.includes("media")) return "media";
    return "baja";
}

function mostrarDetalle(o) {

    document.getElementById("cabecera").innerHTML = `
        <div class="campo"><b>Paciente:</b> ${o.Apellido} ${o.Nombre}</div>
        <div class="campo"><b>DNI:</b> ${o.Dni}</div>
        <div class="campo"><b>Obra Social:</b> ${o.ObraSocial}</div>

        <div class="campo"><b>Institución:</b> ${o.Institucion}</div>
        <div class="campo"><b>Ciudad:</b> ${o.Ciudad}</div>
        <div class="campo"><b>Prioridad:</b> ${o.Prioridad}</div>
    `;

    new gridjs.Grid({
        columns: ["Remito","Fecha","Producto","Cant","Lote","Serie","Venc"],
        data: o.detalles.map(d => [
            d.Remito,
            d.FechaR,
            d.Producto,
            d.Q,
            d.Lote,
            d.Serie,
            d.Vencimiento
        ]),
        pagination: { limit: 5 }
    }).render(document.getElementById("detalle"));
}
