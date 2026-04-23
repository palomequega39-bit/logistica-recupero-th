let ordenes = [];
let filtradas = [];

const dropzone = document.getElementById("dropzone");
const input = document.getElementById("fileInput");

// DRAG & DROP
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

function procesar(data){

  const map = {};

  data.forEach(r=>{
    if(!r.Orden) return;

    if(!map[r.Orden]){
      map[r.Orden]={...r, detalles:[]};
    }

    map[r.Orden].detalles.push(r);
  });

  ordenes = Object.values(map);
  filtradas = ordenes;

  renderLista();
}

function renderLista(){

  const cont = document.getElementById("ordenesList");
  cont.innerHTML="";

  filtradas.forEach((o,i)=>{

    const div = document.createElement("div");
    div.className="card";

    div.innerHTML = `
      <b>${o.Orden}</b><br>
      ${o.Apellido} ${o.Nombre}<br>
      DNI: ${o.Dni}
    `;

    div.onclick = ()=>{
      document.querySelectorAll(".card").forEach(c=>c.classList.remove("active"));
      div.classList.add("active");
      mostrar(o);
    };

    cont.appendChild(div);
  });
}

function mostrar(o){

  document.getElementById("cabecera").innerHTML = `
    <div class="campo"><b>${o.Apellido} ${o.Nombre}</b></div>
    <div class="campo">DNI: ${o.Dni}</div>
    <div class="campo">${o.ObraSocial}</div>

    <div class="campo">${o.Institucion}</div>
    <div class="campo">${o.Ciudad}</div>
    <div class="campo">${o.Prioridad}</div>
  `;

  const body = document.getElementById("detalleBody");
  body.innerHTML="";

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
