/**
 * Exportación Modernizada de Órdenes a PDF
 * Utiliza jsPDF y jsPDF-AutoTable
 */
/**
 * Exportación Modernizada de Órdenes a PDF - Versión Master Compact
 * Utiliza jsPDF y jsPDF-AutoTable
 */
async function exportarDetallePDF(ordenes, seleccionados) {
    const { jsPDF } = window.jspdf;
    
    if (seleccionados.size === 0) {
        Swal.fire("Atención", "Por favor, selecciona al menos una orden.", "warning");
        return;
    }

    const subtitulo = prompt("Ingrese el Hospital o Servicio:", "Servicio / Hospital");
    if (!subtitulo) return;

    const doc = new jsPDF();
    const primaryColor = [41, 128, 185]; 
    const secondaryColor = [108, 117, 125]; 
    const margin = 15;
    let y = 20;

    const cleanRemito = (txt) => {
        if (!txt) return "";
        return txt.replace(/^R/i, '').split('-').map(part => parseInt(part, 10)).join('-');
    };

    const cleanProduct = (txt) => {
        if (!txt) return "";
        return txt.replace(/\[.*?\]\s*/g, '').trim();
    };

    const drawHeader = (doc, title) => {
        doc.setFillColor(...primaryColor);
        doc.rect(margin, 15, 2, 7, "F"); 
        doc.setFontSize(12); // Ligeramente más pequeño para ganar espacio
        doc.setFont("helvetica", "bold");
        doc.setTextColor(44, 62, 80);
        doc.text(title.toUpperCase(), margin + 5, 20.5);
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...secondaryColor);
        doc.text(`Generado: ${new Date().toLocaleDateString()}`, 195, 20.5, { align: "right" });
        
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, 24, 195, 24);
    };

    drawHeader(doc, `Certificados Pendientes - ${subtitulo}`);
    y = 30;

    const ordenesParaExportar = ordenes.filter(o => seleccionados.has(o.Orden));

    ordenesParaExportar.forEach((o, index) => {
        if (y > 270) { 
            doc.addPage(); 
            drawHeader(doc, subtitulo);
            y = 30; 
        }

        // --- CABECERA DE ORDEN ---
        const esApross = (o.ObraSocial || "").toLowerCase().includes("apross");
        doc.setFillColor(esApross ? 245 : 252, esApross ? 245 : 252, esApross ? 255 : 252);
        doc.rect(margin, y, 180, 7, "F"); 
        
        if (o.Favorito === "FAVORITO" || o.Favorito === "SI") {
            doc.setTextColor(231, 76, 60);
            doc.setFont("helvetica", "bold");
            doc.text("★", margin + 2, y + 4.8);
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(44, 62, 80);
        doc.text(`${o.Orden}  |  ${o.Apellido}, ${o.Nombre}`, margin + 7, y + 4.8);

        // Flags
        let xFlag = 190;
        const drawFlag = (txt, color) => {
            doc.setFontSize(6.5);
            doc.setDrawColor(...color);
            doc.setTextColor(...color);
            doc.rect(xFlag - 5, y + 1.5, 4, 3.5, "D");
            doc.text(txt, xFlag - 3.8, y + 4.2);
            xFlag -= 6;
        };
        if (o.Devolucion === "VERDADERO") drawFlag("D", [231, 76, 60]);
        if (o.CI === "FALSO") drawFlag("C", [243, 156, 18]);
        if (o.Foja === "FALSO") drawFlag("F", [52, 152, 219]);

        y += 10;

        // --- SUB-INFO ---
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...secondaryColor);
        doc.text(`DNI: ${o.Dni || "N/C"}  •  OS: ${o.ObraSocial}  •  Exp: ${o.Expediente || "---"}`, margin + 2, y - 2.5);
        
        const remitosMap = {};
        o.detalles.forEach(d => {
            const clave = `${d.Remito}|${d.FechaR}`;
            if (!remitosMap[clave]) remitosMap[clave] = [];
            remitosMap[clave].push(d);
        });

        Object.keys(remitosMap).forEach(claveRemito => {
            const [nroRemito, fechaRemito] = claveRemito.split("|");
            const items = remitosMap[claveRemito];

            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(60);
            doc.text(`Rmt: ${cleanRemito(nroRemito)} (${fechaRemito})`, margin + 2, y + 1.5);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(`Médico: ${o.MedicoSolicitante || o.Medico || "-"}`, margin + 60, y + 1.5);
            y += 4;

            doc.autoTable({
                startY: y,
                margin: { left: margin + 2 },
                body: items.map(item => [
                    { content: `${item.Q} x ${cleanProduct(item.Producto)}`, styles: { fontStyle: 'bold' } },
                    `Lt: ${item.Lote || "-"}`,
                    `Sn: ${item.Serie || "-"}`,
                    `Vto: ${item.Vencimiento || "-"}`
                ]),
                theme: 'striped',
                styles: { fontSize: 8, cellPadding: 0.5, verticalAlign: 'middle' }, 
                columnStyles: { 0: { cellWidth: 85 } },
                didDrawPage: (data) => { y = data.cursor.y; }
            });
            y += 2; 
        });

        if (o.Actividades) {
            y += 1;
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100);
            const textLines = doc.splitTextToSize(`Obs: ${o.Actividades}`, 175);
            doc.text(textLines, margin + 2, y);
            y += (textLines.length * 3) + 1;
        }

        y += 1; // Espacio entre órdenes
        doc.setDrawColor(245, 245, 245);
        doc.line(margin, y, 195, y);
        y += 2; 
    });

    // --- PIE DE PÁGINA ---
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.4);
        doc.line(margin, 284, 195, 284);

        doc.setFontSize(6.5);
        doc.setTextColor(...secondaryColor);
        doc.text(`Gastón Palomeque • 3513393334 • operadorlogisticoeste@technohealth.com.ar`, margin, 288);
        doc.text(`Página ${i} de ${pageCount}`, 195, 288, { align: "right" });
    }

    const fechaArchivo = new Date().toISOString().slice(0,10).replace(/-/g, "");
    doc.save(`Planilla_${subtitulo.replace(/\s/g, "_")}_${fechaArchivo}.pdf`);
}
