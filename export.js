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
        const esFav = (o.Favorito === "FAVORITO" || o.Favorito === "SI");
        const esApross = (o.ObraSocial || "").toLowerCase().includes("apross");
        
        if (esFav) {
            doc.setFillColor(255, 235, 133); // Amarillo suave
        } else if (esApross) {
            doc.setFillColor(174, 202, 230); // Azul pálido
        } else {
            doc.setFillColor(148, 148, 148); // Gris muy claro
        }
        
        // AJUSTE AQUÍ: Reducimos el alto de 7 a 4.5 para que quede ceñido a la letra
        const altoFondo = 4.5; 
        doc.rect(margin, y, 180, altoFondo, "F"); 
        
        if (esFav) {
            doc.setTextColor(231, 76, 60);
            doc.setFont("helvetica", "bold");
            // Ajustado para que el centro de la estrella coincida
            doc.text("★", margin + 2, y + 3.5); 
        }
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(44, 62, 80);
        
        // AJUSTE AQUÍ: y + 3.5 posiciona la línea base de la letra casi al final del rectángulo de 4.5
        doc.text(`${o.Orden}  |  ${o.Apellido}, ${o.Nombre}`, margin + 7, y + 3.5);
        
        // Reajustamos la posición de los flags para que no floten fuera del nuevo fondo
        let xFlag = 190;
        const drawFlag = (txt, color) => {
            doc.setFontSize(6.5);
            doc.setDrawColor(...color);
            doc.setTextColor(...color);
            // Bajamos un poco el rectángulo del flag (y + 0.5)
            doc.rect(xFlag - 5, y + 0.5, 4, 3.5, "D");
            doc.text(txt, xFlag - 3.8, y + 3.2);
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
        doc.text(`DNI: ${o.Dni || "N/C"}  •  OS: ${o.ObraSocial}  •  Exp: ${o.Expediente || "---"}  •  Fecha CX: ${o.FechaCX || "---"}`, margin + 2, y - 2.5);
        
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
async function exportarDetallePDFv2(ordenes, seleccionados) {
    const { jsPDF } = window.jspdf;

    if (seleccionados.size === 0) {
        Swal.fire("Atención", "Por favor, selecciona al menos una orden.", "warning");
        return;
    }

    const subtitulo = prompt("Ingrese el Hospital o Servicio:", "Servicio / Hospital");
    if (!subtitulo) return;

    const doc = new jsPDF({ orientation: "portrait" });
    const margin = 12;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const headerBottomY = 28;
    const footerY = pageHeight - 8;
    const usableBottomY = pageHeight - 14;

    const drawPageHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.text(`Planilla de Órdenes v2.0 - ${subtitulo}`, margin, 12);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Generado: ${new Date().toLocaleDateString()}`, pageWidth - margin, 12, { align: "right" });

        doc.setDrawColor(220);
        doc.line(margin, headerBottomY, pageWidth - margin, headerBottomY);
    };

    const buildFlags = (o) => {
        const esFav = (o.Favorito === "FAVORITO" || o.Favorito === "SI") ? "SI" : "NO";
        const faltaF = o.Foja === "FALSO" ? "SI" : "NO";
        const faltaC = o.CI === "FALSO" ? "SI" : "NO";
        const devolPend = o.Devolucion === "VERDADERO" ? "SI" : "NO";
        return { esFav, faltaF, faltaC, devolPend };
    };

    const getHeaderColor = (o) => {
        const esFav = (o.Favorito === "FAVORITO" || o.Favorito === "SI");
        const esApross = (o.ObraSocial || "").toLowerCase().includes("apross");
        if (esFav) return [255, 235, 133];
        if (esApross) return [174, 202, 230];
        return [230, 230, 230];
    };

    const estimateOrderHeight = (o) => {
        const detalles = (o.detalles || []).length;
        const actividadesLines = doc.splitTextToSize(`Prioridad: ${o.Prioridad || "-"} | Actividad: ${o.Actividades || "-"}`, 180).length;
        return 24 + 12 + Math.max(1, detalles) * 7 + actividadesLines * 4 + 8;
    };

    drawPageHeader();
    let y = headerBottomY + 4;

    const ordenesParaExportar = ordenes.filter(o => seleccionados.has(o.Orden));

    ordenesParaExportar.forEach((o) => {
        const estimated = estimateOrderHeight(o);
        if (y + estimated > usableBottomY) {
            doc.addPage();
            drawPageHeader();
            y = headerBottomY + 4;
        }

        const flags = buildFlags(o);

        doc.autoTable({
            startY: y,
            theme: "grid",
            head: [["N° Orden", "Paciente", "DNI", "Obra Social", "Expediente", "Fecha CX", "Médico", "Fav", "F", "C", "D"]],
            body: [[
                o.Orden || "",
                `${o.Apellido || ""} ${o.Nombre || ""}`.trim(),
                o.Dni || "",
                o.ObraSocial || "",
                o.Expediente || "",
                o.FechaCX || "",
                o.MedicoSolicitante || o.Medico || "",
                flags.esFav,
                flags.faltaF,
                flags.faltaC,
                flags.devolPend
            ]],
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 1.5, valign: "middle" },
            headStyles: { fillColor: getHeaderColor(o), textColor: 20, fontStyle: "bold" },
            bodyStyles: { textColor: 30 },
            columnStyles: {
                0: { cellWidth: 16 }, 1: { cellWidth: 30 }, 2: { cellWidth: 18 }, 3: { cellWidth: 28 },
                4: { cellWidth: 18 }, 5: { cellWidth: 20 }, 6: { cellWidth: 24 }, 7: { cellWidth: 8 },
                8: { cellWidth: 8 }, 9: { cellWidth: 8 }, 10: { cellWidth: 8 }
            }
        });

        y = doc.lastAutoTable.finalY + 2;

        doc.autoTable({
            startY: y,
            theme: "grid",
            head: [["N° Remito", "Fecha R", "Q", "Producto", "Lote", "Serie"]],
            body: (o.detalles || []).map(d => [
                d.Remito || "",
                d.FechaR || "",
                d.Q || "",
                d.Producto || "",
                d.Lote || "",
                d.Serie || ""
            ]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 1.2, valign: "middle" },
            headStyles: { fillColor: [241, 245, 249], textColor: 30, fontStyle: "bold" },
            columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 22 }, 2: { cellWidth: 10 }, 3: { cellWidth: 90 }, 4: { cellWidth: 20 }, 5: { cellWidth: 20 } }
        });

        y = doc.lastAutoTable.finalY + 3;

        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(90);
        const pie = doc.splitTextToSize(`Prioridad: ${o.Prioridad || "-"} | Actividad: ${o.Actividades || "-"}`, 180);
        doc.text(pie, margin, y);
        y += pie.length * 3.5 + 4;

        doc.setDrawColor(230);
        doc.line(margin, y, pageWidth - margin, y);
        y += 3;
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(220);
        doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(110);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
    }

    const fechaArchivo = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    doc.save(`Planilla_v2_${subtitulo.replace(/\s/g, "_")}_${fechaArchivo}.pdf`);
}
