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
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const headerBottomY = 24;
    const footerY = pageHeight - 7;
    const usableBottomY = pageHeight - 12;

    const cleanRemito = (txt) => {
        if (!txt) return "";
        return txt.toString().replace(/^R/i, '').split('-').map(part => parseInt(part, 10)).join('-');
    };

    const cleanProduct = (txt) => {
        if (!txt) return "";
        return txt.toString().replace(/\[.*?\]\s*/g, '').trim();
    };

    const drawPageHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.text(`Planilla de Órdenes v2.0 - ${subtitulo}`, margin, 10);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(`Generado: ${new Date().toLocaleDateString()}`, pageWidth - margin, 10, { align: "right" });

        doc.setDrawColor(220);
        doc.line(margin, headerBottomY, pageWidth - margin, headerBottomY);
    };

    const buildFlags = (o) => ({
        faltaF: o.Foja === "FALSO" ? "F" : "",
        faltaC: o.CI === "FALSO" ? "C" : "",
        devolPend: o.Devolucion === "VERDADERO" ? "D" : ""
    });

    const getHeaderColor = (o) => {
        const esFav = (o.Favorito === "FAVORITO" || o.Favorito === "SI");
        const esApross = (o.ObraSocial || "").toLowerCase().includes("apross");
        if (esFav) return [255, 235, 133];
        if (esApross) return [174, 202, 230];
        return [230, 230, 230];
    };

    const estimateOrderHeight = (o) => {
        const detalles = Math.max(1, (o.detalles || []).length);
        const actividadesLines = doc.splitTextToSize(`${o.Prioridad || "-"} | ${o.Actividades || "-"}`, 185).length;
        return 10 + 6 + (detalles * 5.2) + (actividadesLines * 3.1) + 6;
    };

    drawPageHeader();
    let y = headerBottomY + 3;

    const ordenesParaExportar = ordenes.filter(o => seleccionados.has(o.Orden));

    ordenesParaExportar.forEach((o) => {
        const estimated = estimateOrderHeight(o);
        if (y + estimated > usableBottomY) {
            doc.addPage();
            drawPageHeader();
            y = headerBottomY + 3;
        }

        const flags = buildFlags(o);
        const esFav = (o.Favorito === "FAVORITO" || o.Favorito === "SI");
        const ordenConEstrella = `${esFav ? "★ " : ""}${o.Orden || ""}`;

        doc.autoTable({
            startY: y,
            theme: "grid",
            body: [[
                ordenConEstrella,
                `${o.Apellido || ""} ${o.Nombre || ""}`.trim(),
                o.Dni || "",
                o.ObraSocial || "",
                o.Expediente || "",
                o.FechaCX || "",
                o.MedicoSolicitante || o.Medico || "",
                flags.faltaF,
                flags.faltaC,
                flags.devolPend
            ]],
            margin: { left: margin, right: margin },
            styles: {
                fontSize: 7,
                cellPadding: 0.8,
                valign: "middle",
                overflow: "hidden",
                lineWidth: 0.1,
                textColor: 25
            },
            bodyStyles: { fillColor: getHeaderColor(o) },
            columnStyles: {
                0: { cellWidth: 20, fontStyle: "bold" },
                1: { cellWidth: 33, fontStyle: "bold" },
                2: { cellWidth: 18, fontStyle: "normal" },
                3: { cellWidth: 26, fontStyle: "normal" },
                4: { cellWidth: 18, fontStyle: "normal" },
                5: { cellWidth: 19, fontStyle: "normal" },
                6: { cellWidth: 30, fontStyle: "normal" },
                7: { cellWidth: 5, fontStyle: "bold", halign: "center" },
                8: { cellWidth: 5, fontStyle: "bold", halign: "center" },
                9: { cellWidth: 5, fontStyle: "bold", halign: "center" }
            }
        });

        y = doc.lastAutoTable.finalY + 1;

        doc.autoTable({
            startY: y,
            theme: "grid",
            head: [["Remito", "Fecha R", "Q", "Producto", "Lote", "Serie", "Vencimiento"]],
            body: (o.detalles || []).map(d => [
                cleanRemito(d.Remito || ""),
                d.FechaR || "",
                d.Q || "",
                `${cleanProduct(d.Producto || "")}`,
                d.Lote || "",
                d.Serie || "",
                d.Vencimiento || ""
            ]),
            margin: { left: margin, right: margin },
            styles: {
                fontSize: 6.6,
                cellPadding: 0.7,
                valign: "middle",
                overflow: "hidden",
                lineWidth: 0.1
            },
            headStyles: { fillColor: [241, 245, 249], textColor: 30, fontStyle: "bold" },
            columnStyles: {
                0: { cellWidth: 18 }, 1: { cellWidth: 18 }, 2: { cellWidth: 8 },
                3: { cellWidth: 82 }, 4: { cellWidth: 18 }, 5: { cellWidth: 18 }, 6: { cellWidth: 20 }
            }
        });

        y = doc.lastAutoTable.finalY + 1.8;

        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(90);
        const pie = doc.splitTextToSize(`${o.Prioridad || "-"} | ${o.Actividades || "-"}`, 185);
        doc.text(pie, margin, y);
        y += pie.length * 2.8 + 2;

        doc.setDrawColor(235);
        doc.line(margin, y, pageWidth - margin, y);
        y += 2;
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(220);
        doc.line(margin, footerY - 2.5, pageWidth - margin, footerY - 2.5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(110);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
    }

    const fechaArchivo = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    doc.save(`Planilla_v2_${subtitulo.replace(/\s/g, "_")}_${fechaArchivo}.pdf`);
}

