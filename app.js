let ordenes = [];
let filtradas = [];
let indiceSeleccionado = -1;
let sortField = null;
let ordenAsc = true;

/* =========================
   INIT
========================= */

document.getElementById("btnFiltrar").onclick = aplicarFiltros;
document.getElementById("buscadorGlobal")
  .addEventListener("input", aplicarFiltros);

/* =========================
   DROPZONE
========================= */

const dz = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");

dz.addEventListener("dragover", e=>{
  e.preventDefault();
  dz.classList.add("hover");
});

dz.addEventListener("dragleave", ()=>{
  dz.classList.remove("hover");
});

dz.addEventListener("drop", e=>{
  e.preventDefault();
  dz.classList.remove("hover");

  const file = e.dataTransfer.files[0];
  fileInput.files = e.dataTransfer.files;

  handleFile(file);
});

fileInput.addEventListener("change", e=>{
  handleFile(e.target.files[0]);
});

/* =========================
   FILE LOAD
========================= */

function handleFile(file){
  if(!file) return;

  document.getElementById("fileName").textContent = file.name;
  document.getElementById("fileStatus").classList.remove("hidden");

  const reader = new FileReader();

  reader.onload = function(e){
    const data = new Uint8Array(e.target.result);

    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const csvProcesado = preprocesarExacto(raw);

    // DEBUG opcional
    descargarCSV(csvProcesado, "debug_preprocesado.csv");

    Papa.parse(csvProcesado, {
      header: true,
      skipEmptyLines: true,
      complete: res => procesar(res.data)
    });
  };

  reader.readAsArrayBuffer(file);
}

/* =========================
   HELPERS (GLOBAL)
========================= */

function booleanTexto(valor){
  if (valor === true || String(valor).toLowerCase() === "true") return "VERDADERO";
  if (valor === false || String(valor).toLowerCase() === "false") return "FALSO";
  return valor;
}

function excelFechaAJS(valor){
  if (!valor) return "";

  if (typeof valor === "number") {
    const fecha = new Date((valor - 25569) * 86400 * 1000);
    return fecha.toLocaleDateString("es-AR");
  }

  return valor;
}

function procesarObraSocial(textoOriginal){
  let texto = (textoOriginal || "").toUpperCase().trim();

  if (!texto) return null;

  if (texto.includes("APROSS")) return "Apross";

  if (texto.includes("BSC") || texto.includes("BOSTON SCIENTIFIC")) {
    if (texto.includes("PAMI")) return "Pami - BSC";
    if (texto.includes("OSECAC")) return "Osecac - BSC";
  }

  return null;
}

function descargarCSV(csv, nombre){
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
}

/* =========================
   PREPROCESO EXACTO (CLAVE)
========================= */

function preprocesarExacto(datos){

  datos = datos.slice(1);

  let refOrden, apellido, nombre;
  let dni, cliente, fechaCirugia;
  let vendedor, medico, medicoSolicitante;
  let foja, certificado, actividades;
  let direccion, ciudad, expediente, favorito, devolucion, prioridad;

  // 1. Relleno
  for (let i = 0; i < datos.length; i++) {
    let row = datos[i];

    if (row[0]) {
      refOrden = row[0];
      apellido = row[3];
      nombre = row[4];
      dni = row[5];
      cliente = row[6];
      fechaCirugia = row[7];
      vendedor = row[12];
      medico = row[13];
      medicoSolicitante = row[14];
      foja = row[15];
      certificado = row[16];
      actividades = row[17];
      direccion = row[18];
      ciudad = row[19];
      expediente = row[21];
      favorito = row[22];
      devolucion = row[23];
      prioridad = row[24];
    } else {
      row[0] = refOrden;
      if (!row[3]) row[3] = apellido;
      if (!row[4]) row[4] = nombre;
      if (!row[5]) row[5] = dni;
      if (!row[6]) row[6] = cliente;
      if (!row[7]) row[7] = fechaCirugia;
      if (!row[12]) row[12] = vendedor;
      if (!row[13]) row[13] = medico;
      if (!row[14]) row[14] = medicoSolicitante;
      if (!row[15]) row[15] = foja;
      if (!row[16]) row[16] = certificado;
      if (!row[17]) row[17] = actividades;
      if (!row[18]) row[18] = direccion;
      if (!row[19]) row[19] = ciudad;
      if (!row[21]) row[21] = expediente;
      if (!row[22]) row[22] = favorito;
      if (!row[23]) row[23] = devolucion;
      if (!row[24]) row[24] = prioridad;
    }
  }

  // 2. Booleanos + fechas
  for (let i = 0; i < datos.length; i++) {
    let row = datos[i];

    row[22] = booleanTexto(row[22]);
    row[2] = excelFechaAJS(row[2]);
    row[7] = excelFechaAJS(row[7]);
    row[20] = excelFechaAJS(row[20]);
  }

  // 3. Obra social
  datos = datos.filter(row => {
    let os = procesarObraSocial(row[6]);
    if (!os) return false;
    row[6] = os;
    return true;
  });

  // 4. J ← Y
  for (let i = 0; i < datos.length; i++) {
    let j = datos[i][9];
    let y = datos[i][24];

    if (!j || Number(j) === 0) {
      if (!isNaN(y) && Number(y) !== 0) {
        datos[i][9] = y;
      }
    }
  }

  // 5. Bloques
  let resultado = [];
  let i = 0;

  while (i < datos.length) {
    let orden = datos[i][0];
    let bloque = [];

    while (i < datos.length && datos[i][0] === orden) {
      bloque.push(datos[i]);
      i++;
    }

    let tieneCantidad = bloque.some(r => Number(r[9]) > 0);

    if (tieneCantidad) {
      bloque = bloque.filter(r => Number(r[9]) > 0);
    } else {
      bloque = bloque.slice(0, 1);
    }

    resultado.push(...bloque);
  }

  // 6. Headers + Column1
  const headers = [
    "Orden","Remito","FechaR","Apellido","Nombre","Dni","ObraSocial",
    "FechaCX","Producto","Q","Lote","Serie","Vendedor","Medico",
    "MedicoSolicitante","Foja","CI","Actividades","Institucion",
    "Ciudad","Vencimiento","Expediente","Favorito","Devolucion","Prioridad","Column1"
  ];

  const resultadoFinal = resultado.map(r => [...r, ""]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...resultadoFinal]);

  return XLSX.utils.sheet_to_csv(ws);
}
