/**
 * Lógica para exportar las órdenes seleccionadas a PDF
 * Utiliza jsPDF y jsPDF-AutoTable
 */

async function exportarDetallePDF(ordenes, seleccionados) {
    const { jsPDF } = window.jspdf;
    
    if (seleccionados.size === 0) {
        alert("Por favor, selecciona al menos una orden para exportar.");
        return;
    }

    const subtitulo = prompt("Ingrese el Hospital o Servicio de la planilla:", "Servicio / Hospital");
    if (subtitulo === null) return;

    const doc = new jsPDF();
    const margin = 10;
    let y = 15;

    // Título Principal
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`CERTIFICADOS PENDIENTES - ${subtitulo.toUpperCase()}`, 105, y, { align: "center" });
    y += 10;

    const ordenesParaExportar = ordenes.filter(o => seleccionados.has(o.Orden));

    ordenesParaExportar.forEach((o) => {
        if (y > 250) { doc.addPage(); y = 20; }

        let flags = [];
        if (o.Foja === "FALSO") flags.push("F");
        if (o.CI === "FALSO") flags.push("C");
        if (o.Devolucion === "VERDADERO") flags.push("D");
        const flagsTexto = flags.length > 0 ? ` [${flags.join(" ")}]` : "";

        const esApross = (o.ObraSocial || "").toLowerCase().includes("apross");
        const bgColor = esApross ? [230, 230, 230] : [0, 0, 0];
        const textColor = esApross ? [0, 0, 0] : [255, 255, 255];
        
        doc.setFillColor(...bgColor);
        doc.rect(margin, y, 190, 8, "F");
        
        doc.setTextColor(...textColor);
        doc.setFontSize(9);
        const estrella = (o.Favorito === "FAVORITO" || o.Favorito === "SI") ? ">> " : "";
        const tituloOrden = `${estrella}${o.Orden} - ${o.Apellido} ${o.Nombre} - DNI: ${o.Dni || "SIN DNI"} - OS: ${o.ObraSocial} - Exp: ${o.Expediente || ""}${flagsTexto}`;
        
        doc.text(tituloOrden, margin + 2, y + 5.5);
        y += 12;

        const remitosMap = {};
        o.detalles.forEach(d => {
            const clave = `${d.Remito}|${d.FechaR}`;
            if (!remitosMap[clave]) remitosMap[clave] = [];
            remitosMap[clave].push(d);
        });

        Object.keys(remitosMap).forEach(claveRemito => {
            const [nroRemito, fechaRemito] = claveRemito.split("|");
            const items = remitosMap[claveRemito];

            doc.setTextColor(0);
            doc.setFont("helvetica", "bold");
            doc.text(`Remito: ${nroRemito} - Fecha: ${fechaRemito}      Fecha CX: ${o.FechaCX || ""} - Médico: ${o.MedicoSolicitante || o.Medico || ""}`, margin, y);
            y += 5;

            const rows = items.map(item => [
                `${item.Q} - ${item.Producto}`,
                `Lt: ${item.Lote || ""}`,
                `Serie: ${item.Serie || ""}`,
                `Vto: ${item.Vencimiento || ""}`
            ]);

            doc.autoTable({
                startY: y,
                margin: { left: margin },
                body: rows,
                theme: 'plain',
                styles: { fontSize: 8, cellPadding: 1 },
                columnStyles: { 0: { cellWidth: 80 } },
                didDrawPage: (data) => { y = data.cursor.y; }
            });
            y += 2;
        });

        if (o.Actividades) {
            doc.setFont("helvetica", "italic");
            doc.text(`Observaciones: ${o.Actividades}`, margin, y);
            y += 6;
        }
        y += 4;
    });

    // Pie de página fijo
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("Operador Logístico: Gastón Palomeque - Tel: 3513393334 - Email: operadorlogisticoeste@technohealth.com.ar", margin, 285);
    }

    const fechaArchivo = new Date().toISOString().slice(0,10).replace(/-/g, "");
    doc.save(`${subtitulo.replace(/\s/g, "_")}_${fechaArchivo}.pdf`);
}
