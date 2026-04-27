/**
 * Exportación Modernizada de Órdenes a PDF
 * Utiliza jsPDF y jsPDF-AutoTable
 */
async function exportarDetallePDF(ordenes, seleccionados) {
    const { jsPDF } = window.jspdf;
    if (seleccionados.size === 0) return;

    const subtitulo = prompt("Hospital/Servicio:", "Servicio");
    if (!subtitulo) return;

    const doc = new jsPDF();
    const margin = 12;
    let y = 18;

    // Helper: Limpiar Remitos (R0008-00048510 -> 8-48510)
    const cleanRemito = (txt) => {
        if (!txt) return "";
        return txt.replace(/^R/i, '').split('-').map(part => parseInt(part, 10)).join('-');
    };

    // Helper: Limpiar Productos (Elimina [DATOS])
    const cleanProduct = (txt) => {
        if (!txt) return "";
        return txt.replace(/\[.*?\]\s*/g, '').trim();
    };

    const drawHeader = (doc) => {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40);
        doc.text(`PLANILLA: ${subtitulo.toUpperCase()}`, margin, 12);
        doc.setDrawColor(200);
        doc.line(margin, 14, 198, 14);
    };

    drawHeader(doc);

    const ordenesParaExportar = ordenes.filter(o => seleccionados.has(o.Orden));

    ordenesParaExportar.forEach((o) => {
        if (y > 260) { doc.addPage(); drawHeader(doc); y = 22; }

        // --- CABECERA DE ORDEN (Compacta) ---
        doc.setFillColor(248, 249, 250);
        doc.rect(margin, y, 186, 7, "F");
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        
        const estrella = (o.Favorito === "FAVORITO" || o.Favorito === "SI") ? "* " : "";
        const headerText = `${estrella}${o.Orden} - ${o.Apellido} ${o.Nombre} | DNI: ${o.Dni || "-"} | OS: ${o.ObraSocial}`;
        doc.text(headerText, margin + 2, y + 4.5);

        // Flags minimalistas al final de la línea
        let flags = [];
        if (o.Foja === "FALSO") flags.push("F");
        if (o.CI === "FALSO") flags.push("C");
        if (o.Devolucion === "VERDADERO") flags.push("D");
        if (flags.length > 0) {
            doc.setFontSize(7);
            doc.text(`[${flags.join(" ")}]`, 195, y + 4.5, { align: "right" });
        }
        
        y += 10; // Espaciado reducido

        // --- REMITOS Y PRODUCTOS ---
        const remitosMap = {};
        o.detalles.forEach(d => {
            const clave = `${d.Remito}|${d.FechaR}`;
            if (!remitosMap[clave]) remitosMap[clave] = [];
            remitosMap[clave].push(d);
        });

        Object.keys(remitosMap).forEach(claveRemito => {
            const [nro, fecha] = claveRemito.split("|");
            const items = remitosMap[claveRemito];

            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(60);
            doc.text(`Rmt: ${cleanRemito(nro)} (${fecha})  |  Médico: ${o.MedicoSolicitante || o.Medico || "-"}`, margin + 2, y);
            y += 3;

            doc.autoTable({
                startY: y,
                margin: { left: margin + 4 },
                body: items.map(item => [
                    `${item.Q} x ${cleanProduct(item.Producto)}`,
                    `Lt: ${item.Lote || "-"}`,
                    `Sn: ${item.Serie || "-"}`,
                    `Vto: ${item.Vencimiento || "-"}`
                ]),
                theme: 'plain',
                styles: { fontSize: 7.5, cellPadding: 0.5, textColor: 50 },
                columnStyles: { 0: { cellWidth: 85 } },
                didDrawPage: (data) => { y = data.cursor.y; }
            });
            y += 2;
        });

        if (o.Actividades) {
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100);
            doc.text(`Obs: ${o.Actividades}`, margin + 2, y);
            y += 4;
        }
        y += 2; // Espacio entre órdenes
    });

    // --- PIE DE PÁGINA ---
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`G. Palomeque - 3513393334 | Página ${i}/${pageCount}`, 105, 290, { align: "center" });
    }

    doc.save(`Export_${subtitulo.replace(/\s/g, "_")}.pdf`);
}
