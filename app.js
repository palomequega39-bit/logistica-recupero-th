let data = [];
let ordenes = [];

document.getElementById("fileInput").addEventListener("change", function(e) {
    const file = e.target.files[0];

    const reader = new FileReader();
    reader.onload = function(event) {
        const text = event.target.result;
        procesarCSV(text);
    };

    reader.readAsText(file);
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
    renderTabla(ordenes);
}

function construirOrdenes() {

    const map = {};

    data.forEach(row => {
        if (!map[row.Orden]) {
            map[row.Orden] = {
                ...row,
                detalles: []
            };
        }
        map[row.Orden].detalles.push(row);
    });

    ordenes = Object.values(map);
}

function renderTabla(lista) {

    const tabla = document.getElementById("tablaOrdenes");
    tabla.innerHTML = "";

    lista.forEach(o => {
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

        tabla.appendChild(tr);
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

    const det = document.getElementById("detalle");
    det.innerHTML = "";

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

        det.appendChild(tr);
    });
}
