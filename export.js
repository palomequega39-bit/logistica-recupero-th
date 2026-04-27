/**
 * Exportación Modernizada de Órdenes a PDF
 * Utiliza jsPDF y jsPDF-AutoTable
 */
async function exportarDetallePDF(ordenes, seleccionados) {
    const { jsPDF } = window.jspdf;
    
    if (seleccionados.size === 0) {
        Swal.fire("Atención", "Por favor, selecciona al menos una orden.", "warning"); // Opcional: usar SweetAlert
        return;
    }

    const subtitulo = prompt("Ingrese el Hospital o Servicio:", "Servicio / Hospital");
    if (!subtitulo) return;

    const doc = new jsPDF();
    const primaryColor = [41, 128, 185]; // Azul elegante
    const secondaryColor = [108, 117, 125]; // Gris moderno
    const margin = 15;
    let y = 20;

    // --- ENCABEZADO DE PÁGINA ---
    const drawHeader = (doc, title) => {
        doc.setFillColor(...primaryColor);
        doc.rect(margin, 15, 2, 8, "F"); // Acento visual vertical
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(44, 62, 80);
        doc.text(title.toUpperCase(), margin + 5, 21);
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...secondaryColor);
        doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 195, 21, { align: "right" });
        
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, 25, 195, 25);
    };

    drawHeader(doc, `Certificados Pendientes - ${subtitulo}`);
    y = 35;

    const ordenesParaExportar = ordenes.filter(o => seleccionados.has(o.Orden));

    ordenesParaExportar.forEach((o, index) => {
        // Control de salto de página
        if (y > 240) { 
            doc.addPage(); 
            drawHeader(doc, subtitulo);
            y = 40; 
        }

        // --- TARJETA DE ORDEN ---
        const esApross = (o.ObraSocial || "").toLowerCase().includes("apross");
        
        // Fondo sutil para la cabecera de la orden
        doc.setFillColor(esApross ? 245 : 250, esApross ? 245 : 250, esApross ? 255 : 250);
        doc.roundedRect(margin, y, 180, 10, 1, 1, "F");
        
        // Indicador lateral de prioridad (Estrella)
        if (o.Favorito === "FAVORITO" || o.Favorito === "SI") {
            doc.setTextColor(231, 76, 60); // Rojo suave
            doc.setFont("helvetica", "bold");
            doc.text("★", margin + 2, y + 6.5);
        }

        // Título de la Orden
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(44, 62, 80);
        doc.text(`${o.Orden}  |  ${o.Apellido}, ${o.Nombre}`, margin + 8, y + 6.5);

        // Flags estilizados (F C D)
        let xFlag = 190;
        const drawFlag = (txt, color) => {
            doc.setFontSize(7);
            doc.setDrawColor(...color);
            doc.setTextColor(...color);
            doc.roundedRect(xFlag - 6, y + 3, 5, 4, 1, 1, "D");
            doc.text(txt, xFlag - 4.5, y + 6);
            xFlag -= 7;
        };

        if (o.Devolucion === "VERDADERO") drawFlag("D", [231, 76, 60]);
        if (o.CI === "FALSO") drawFlag("C", [243, 156, 18]);
        if (o.Foja === "FALSO") drawFlag("F", [52, 152, 219]);

        y += 15;

        // --- SUB-INFO (DNI, OS, EXP) ---
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...secondaryColor);
        doc.text(`DNI: ${o.Dni || "N/C"}   •   OS: ${o.ObraSocial}   •   Expediente: ${o.Expediente || "---"}`, margin + 2, y - 1);
        y += 5;

        // Agrupar Remitos
        const remitosMap = {};
        o.detalles.forEach(d => {
            const clave = `${d.Remito}|${d.FechaR}`;
            if (!remitosMap[clave]) remitosMap[clave] = [];
            remitosMap[clave].push(d);
        });

        Object.keys(remitosMap).forEach(claveRemito => {
            const [nroRemito, fechaRemito] = claveRemito.split("|");
            const items = remitosMap[claveRemito];

            // Línea de info de remito y médico
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(50);
            doc.text(`Remito: ${nroRemito}`, margin + 2, y);
            
            doc.setFont("helvetica", "normal");
            doc.text(`Fecha: ${fechaRemito}  •  Médico: ${o.MedicoSolicitante || o.Medico || "No especificado"}`, margin + 35, y);
            y += 3;

            // Tabla de productos moderna
            doc.autoTable({
                startY: y,
                margin: { left: margin + 2 },
                body: items.map(item => [
                    { content: `${item.Q} x ${item.Producto}`, styles: { fontStyle: 'bold' } },
                    `Lote: ${item.Lote || "-"}`,
                    `Serie: ${item.Serie || "-"}`,
                    `Vto: ${item.Vencimiento || "-"}`
                ]),
                theme: 'striped',
                headStyles: { fillColor: [240, 240, 240], textColor: 50 },
                styles: { fontSize: 8, cellPadding: 2, verticalAlign: 'middle' },
                columnStyles: { 0: { cellWidth: 90 } },
                didDrawPage: (data) => { y = data.cursor.y; }
            });
            y += 5;
        });

        // Observaciones con estilo de "nota"
        if (o.Actividades) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100);
            const textLines = doc.splitTextToSize(`Obs: ${o.Actividades}`, 180);
            doc.text(textLines, margin + 2, y);
            y += (textLines.length * 4) + 2;
        }

        // Separador sutil entre órdenes
        doc.setDrawColor(240, 240, 240);
        doc.line(margin, y, 195, y);
        y += 10;
    });

    // --- PIE DE PÁGINA ---
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.5);
        doc.line(margin, 282, 195, 282); // Línea decorativa final

        doc.setFontSize(7);
        doc.setTextColor(...secondaryColor);
        doc.setFont("helvetica", "bold");
        doc.text("OPERADOR LOGÍSTICO:", margin, 287);
        doc.setFont("helvetica", "normal");
        doc.text("Gastón Palomeque  •  Tel: 3513393334  •  operadorlogisticoeste@technohealth.com.ar", margin + 30, 287);
        
        doc.text(`Página ${i} de ${pageCount}`, 195, 287, { align: "right" });
    }

    const fechaArchivo = new Date().toISOString().slice(0,10).replace(/-/g, "");
    doc.save(`Reporte_${subtitulo.replace(/\s/g, "_")}_${fechaArchivo}.pdf`);
}
