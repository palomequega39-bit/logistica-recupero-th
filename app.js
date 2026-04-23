let ordenes = [];
let grid;

document.getElementById("fileInput").addEventListener("change", function (e) {

    const file = e.target.files[0];

    Papa.parse(file, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
        complete: function (results) {
            procesarDatos(results.data);
        }
    });

});

function procesarDatos(data) {

    const map = {};

    data.forEach(row => {

        if (!row.Orden) return;

        if (!map[row.Orden]) {
            map[row.Orden] = {
                ...row,
                detalles: [],
                tiene_devolucion: (row.Devolucion || "").toUpperCase() === "VERDADERO"
            };
        }

        map[row.Orden].detalles.push(row);
    });

    ordenes = Object.values(map);

    renderTabla();
}

function renderTabla() {

    if (grid) {
        grid.destroy();
        document.getElementById("tablaGrid").innerHTML = "";
    }

    grid = new gridjs.Grid({
        columns: [
            "Orden",
            "Paciente",
            "DNI",
            "Obra Social",
            {
                name: "Prioridad",
                formatter: (cell) => {
                    return gridjs.html(`<span class="badge ${getClase(cell)}">${cell}</span>`);
                }
            }
        ],
        data: ordenes.map(o => [
            o.Orden,
            o.Apellido + " " + o.Nombre,
            o.Dni,
            o.ObraSocial,
            o.Prioridad
        ]),
        search: true,
        pagination: { limit: 10 },
        sort: true
    }).render(document.getElementById("tablaGrid"));

    setTimeout(asignarClicks, 300);
}

function asignarClicks() {

    document.querySelectorAll(".gridjs-tr").forEach((row, i) => {
        row.onclick = () => mostrarDetalle(ordenes[i]);
    });
}

function mostrarDetalle(o) {

    document.getElementById("cabecera").innerHTML = `
        <div class="campo"><b>${o.Apellido} ${o.Nombre}</b></div>
        <div class="campo">DNI: ${o.Dni}</div>
        <div class="campo">Obra: ${o.ObraSocial}</div>

        <div class="campo">Institución: ${o.Institucion}</div>
        <div class="campo">Ciudad: ${o.Ciudad}</div>
        <div class="campo">Prioridad: ${o.Prioridad}</div>
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

function getClase(p) {
    if (!p) return "";
    p = p.toLowerCase();
    if (p.includes("alta")) return "alta";
    if (p.includes("media")) return "media";
    return "baja";
}
