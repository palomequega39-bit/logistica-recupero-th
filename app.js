let data = [];
let ordenes = [];
let ordenesFiltradas = [];

document.addEventListener("DOMContentLoaded", function () {

    const input = document.getElementById("fileInput");

    input.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (event) {
            const text = event.target.result;
            procesarCSV(text);
        };

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

    setOpcionesSiNo("filtroDevolucion");
    setOpcionesSiNo("filtroFoja");
    setOpcionesSiNo("filtroCI");
}

function cargarSelect(id, campo) {
    const select = document.getElementById(id);
    const valores = [...new Set(ordenes.map(o => o[campo]).filter(Boolean))];

    select.innerHTML = `<option value="">Todos</option>` +
        valores.map(v => `<option value="${v}">${v}</option>`).join("");
}

function setOpcionesSiNo(id) {
    document.getElementById(id).innerHTML = `
        <option value="">Todos</option>
        <option value="SI">Sí</option>
        <option value="NO">No</option>
    `;
}

function aplicarFiltros() {

    const inst = document.getElementById("filtroInstitucion").value;
    const dev = document.getElementById("filtroDevolucion").value;
    const foja = document.getElementById("filtroFoja").value;
    const ci = document.getElementById("filtroCI").value;
    const prioridad = document.getElementById("filtroPrioridad").value;
    const obra = document.getElementById("filtroObra").value;
    const ciudad = document.getElementById("filtroCiudad").value;

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

    renderTabla();
}

function renderTabla() {

    const tbody = document.querySelector("#tablaOrdenes tbody");
    tbody.innerHTML = "";

    ordenesFiltradas.forEach(o => {

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${o.Orden}</td>
            <td>${o.Apellido} ${o.Nombre}</td>
            <td>${o.Dni}</td>
            <td>${o.ObraSocial}</td>
            <td>${o.Favotito}</td>
            <td>${o.Prioridad}</td>
        `;

        tr.onclick = () => mostrarDetalle(o);

        tbody.appendChild(tr);
    });
}

function mostrarDetalle(o) {

    const cab = document.getElementById("cabecera");

    cab.innerHTML = `
        <div class="campo"><b>Paciente:</b> ${o.Apellido} ${o.Nombre}</div>
        <div class="campo"><b>DNI:</b> ${o.Dni}</div>
        <div class="campo"><b>Obra Social:</b> ${o.ObraSocial}</div>

        <div class="campo"><b>Institución:</b> ${o.Institucion}</div>
        <div class="campo"><b>Ciudad:</b> ${o.Ciudad}</div>
        <div class="campo"><b>Prioridad:</b> ${o.Prioridad}</div>

        <div class="campo"><b>Vendedor:</b> ${o.Vendedor}</div>
        <div class="campo"><b>Médico:</b> ${o.Medico}</div>
        <div class="campo"><b>CI:</b> ${o.CI}</div>
    `;

    const tbody = document.querySelector("#detalle tbody");
    tbody.innerHTML = "";

    o.detalles.forEach(d => {

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${d.Remito}</td>
            <td>${d.FechaR}</td>
            <td>${d.Producto}</td>
            <td>${d.Q}</td>
            <td>${d.Lote}</td>
            <td>${d.Serie}</td>
            <td>${d.Vencimiento}</td>
        `;

        tbody.appendChild(tr);
    });
}
