import jsPDF from 'jspdf';
import { drawWrappedCenteredText } from './pdfTextLayout';
import { formatDoctorDisplayName } from './doctorName';

const cropSignatureCanvas = (img) => {
  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0);
    
    const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imgData.data;
    const width = tempCanvas.width;
    const height = tempCanvas.height;
    
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let found = false;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        
        // Calcular brillo del píxel en escala de grises
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Considerar fondo si es muy transparente (a < 50) o muy claro/blanco (gray > 200)
        const isBackground = (a < 50) || (gray > 200);
        
        if (!isBackground) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }
    
    if (!found) return tempCanvas;
    
    // Dejar un pequeño margen de cortesía de 3 píxeles
    minX = Math.max(0, minX - 3);
    minY = Math.max(0, minY - 3);
    maxX = Math.min(width - 1, maxX + 3);
    maxY = Math.min(height - 1, maxY + 3);
    
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(tempCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    
    return cropCanvas;
  } catch (e) {
    console.error("Error cropping signature, returning original:", e);
    return img;
  }
};

const optimizeImage = async (src, maxWidth = 600) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const croppedCanvas = cropSignatureCanvas(img);
      
      // Solo escalar si es realmente necesario (si supera el maxWidth)
      let finalW = croppedCanvas.width;
      let finalH = croppedCanvas.height;
      
      if (croppedCanvas.width > maxWidth) {
        const scale = maxWidth / croppedCanvas.width;
        finalW = maxWidth;
        finalH = croppedCanvas.height * scale;
      }

      const canvas = document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      const ctx = canvas.getContext('2d');
      // Usar suavizado de alta calidad
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(croppedCanvas, 0, 0, finalW, finalH);
      
      resolve({ 
        data: canvas.toDataURL('image/png'), 
        ratio: finalW / finalH 
      });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

export const generateOrderPDF = async (orderData, profile, mode = 'save') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const centerX = pageWidth / 2;
  const coatBlue = [0, 102, 128];

  const toTitleCase = (str) => {
    return str || '';
  };

  const drawHeader = async (targetDoc, orderTypeLabel) => {
    // Institutional COAT branding is ALWAYS shown on orders
    try {
      const logoData = await optimizeImage('/coat_logo.png', 600);
      if (logoData) {
        targetDoc.addImage(logoData.data, 'PNG', 15, 8, 35, 35 / logoData.ratio, undefined, 'FAST');
      }
    } catch (e) {}

    targetDoc.setFontSize(10);
    targetDoc.setTextColor(0, 121, 153);
    targetDoc.text("CENTRO OTOAUDIOLÓGICO DE ALTA TECNOLOGÍA", centerX, 20, { align: 'center' });
    targetDoc.setFontSize(8);
    targetDoc.text("NARIZ - GARGANTA - OÍDO", centerX, 25, { align: 'center' });
    if (orderTypeLabel && orderData.orderType !== 'coat') {
      targetDoc.setFontSize(14);
      targetDoc.setFont("helvetica", "bold");
      targetDoc.text(orderTypeLabel.toUpperCase(), centerX, 33, { align: 'center' });
    }

    targetDoc.setDrawColor(0, 121, 153);
    targetDoc.setLineWidth(0.5);
    targetDoc.line(15, 38, pageWidth - 15, 38);

    const [yY, mM, dD] = orderData.date.split('-').map(Number);
    const localDate = new Date(yY, mM - 1, dD);
    const dateStr = `Córdoba, ${localDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    targetDoc.setFontSize(11);
    targetDoc.setTextColor(80, 80, 80);
    targetDoc.text(dateStr, pageWidth - 15, 43, { align: 'right' });

    targetDoc.setFontSize(12);
    targetDoc.setFont("helvetica", "bold");
    targetDoc.setTextColor(0, 0, 0);
    const patientLastY = drawWrappedCenteredText(targetDoc, `Paciente: ${orderData.name}`, 49, 5);

    targetDoc.setFontSize(10);
    targetDoc.setFont("helvetica", "normal");
    const infoLastY = drawWrappedCenteredText(targetDoc, `Obra Social: ${orderData.insurance} | Nro. Afiliado: ${orderData.affiliateNumber || '-'}${orderData.diagnosis ? ` | Diag: ${orderData.diagnosis}` : ''}`, patientLastY + 6, 5, 180, '|');
    return infoLastY + 7;
  };

  const drawFooter = async (targetDoc, currentY = null) => {
    // 5. Signature Area - ADAPTATIVA (Petición para que no quede abajo del todo)
    const middlePoint = pageHeight / 2;
    let signatureY = pageHeight - 42; // Fallback position

    if (currentY !== null) {
      // Si el contenido terminó muy arriba, forzamos la firma a la mitad de la hoja
      if (currentY < middlePoint - 20) {
        signatureY = middlePoint + 20; // Ajustado para que el nombre quede cerca del centro
      } else {
        signatureY = Math.min(currentY + 30, pageHeight - 42); // Sigue al texto con límite
      }
    }

    const signatureX = pageWidth - 80;
    const sealCenterX = signatureX + 32;

    if (profile.signatureBase64) {
      try {
        const sigData = await optimizeImage(profile.signatureBase64, 500);
        if (sigData) {
          const maxW = 51.41;
          const maxH = 19.28;
          const imageRatio = sigData.ratio || 2.5;
          let sigW = maxW;
          let sigH = maxH;
          if (imageRatio > maxW / maxH) {
            sigW = maxW;
            sigH = maxW / imageRatio;
          } else {
            sigH = maxH;
            sigW = maxH * imageRatio;
          }
          // Centrar perfectamente a sealCenterX y ubicar sobre la línea del sello
          targetDoc.addImage(sigData.data, 'PNG', sealCenterX - (sigW / 2), signatureY - sigH - 2, sigW, sigH, undefined, 'FAST');
        }
      } catch (e) {}
    }

    // Línea separadora estilo sello
    targetDoc.setDrawColor(0, 0, 0);
    targetDoc.setLineWidth(0.3);
    targetDoc.line(sealCenterX - 25.7, signatureY, sealCenterX + 25.7, signatureY);

    const cleanName = formatDoctorDisplayName(profile.nombre || profile.n || 'PROFESIONAL');
    const displayEspecialidad = (profile.especialidad || profile.esp || 'Otorrinolaringología') === 'ORL' 
      ? 'OTORRINOLARINGOLOGÍA' 
      : (profile.especialidad || profile.esp || 'OTORRINOLARINGOLOGÍA').toUpperCase();

    const mp = profile.mp || profile.m || '';
    const me = profile.me || '';
    let registrationText = "";
    if (mp && me) registrationText = `MP: ${mp} | ME: ${me}`;
    else if (mp) registrationText = `MP: ${mp}`;
    else if (me) registrationText = `ME: ${me}`;

    const footerLines = [
      cleanName.toUpperCase(),
      displayEspecialidad,
      registrationText
    ].filter(line => line !== '');

    let textY = signatureY + 3.11;
    targetDoc.setTextColor(0, 0, 0);
    targetDoc.setFont("helvetica", "bold");
    targetDoc.setFontSize(6.31);

    footerLines.forEach((text) => {
      targetDoc.text(text, sealCenterX, textY, { align: 'center' });
      textY += 2.71;
    });

    // Footer line — ALWAYS shown at the very bottom
    targetDoc.setDrawColor(...coatBlue);
    targetDoc.setLineWidth(0.3);
    targetDoc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);
    targetDoc.setFontSize(8);
    targetDoc.setTextColor(100);
    targetDoc.text("Urquiza 401 - X5000KPI Córdoba - Tel. (0351) 423-0530 - WhatsApp +54 3543 579794 - www.coat.com.ar", centerX, pageHeight - 12, { align: 'center' });
  };

  const drawObservations = (targetDoc, currentY) => {
    if (!orderData.observations) return currentY;
    targetDoc.setFontSize(8.5);
    const label = "Observaciones: ";
    const obsText = orderData.observations;
    targetDoc.setFont("helvetica", "bold");
    const labelWidth = targetDoc.getTextWidth(label);
    targetDoc.setFont("helvetica", "italic");
    const textWidth = targetDoc.getTextWidth(obsText);
    const totalWidth = labelWidth + textWidth;
    if (totalWidth < pageWidth - 30) {
      const startX = (pageWidth - totalWidth) / 2;
      targetDoc.setFont("helvetica", "bold");
      targetDoc.text(label, startX, currentY);
      targetDoc.setFont("helvetica", "italic");
      targetDoc.text(obsText, startX + labelWidth, currentY);
      return currentY + 6;
    } else {
      targetDoc.setFont("helvetica", "bold");
      targetDoc.text(label, 15, currentY);
      targetDoc.setFont("helvetica", "italic");
      const splitObs = targetDoc.splitTextToSize(obsText, pageWidth - 30 - labelWidth);
      targetDoc.text(splitObs, 15 + labelWidth, currentY);
      return currentY + (splitObs.length * 4) + 2;
    }
  };

  if (orderData.orderType === 'preop') {
    const labItems = ["Citológico completo", "Glucemia", "Uremia", "Creatinina", "Recuento de plaquetas", "APP", "KPTT"];
    const cardioItems = ["E.C.G.", "Valoración Cardiovascular", "Informe de riesgo quirúrgico (ASA)"];
    const rxItems = ["RX Tórax (Frente)"];

    const selectedLabs = orderData.practices.filter(p => labItems.includes(p) || (!cardioItems.includes(p) && !rxItems.includes(p) && !orderData.allPracticesInCategory?.some(ap => ap.n === p && (cardioItems.includes(ap.n) || rxItems.includes(ap.n)))));
    const selectedCardio = orderData.practices.filter(p => cardioItems.includes(p));
    const selectedRX = orderData.practices.filter(p => rxItems.includes(p));

    let firstPage = true;

    // Page 1: Laboratorio
    if (selectedLabs.length > 0) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      let curY = await drawHeader(doc, "");
      curY = drawObservations(doc, curY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(coatBlue[0], coatBlue[1], coatBlue[2]);
      doc.text("Se solicita Laboratorio:", 20, curY + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30);
      selectedLabs.forEach((p, i) => {
        doc.text(`- ${p}`, 25, curY + 15 + (i * 7));
        if (orderData.indications?.[p]) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "italic");
          doc.text(`  Ind: ${orderData.indications[p]}`, 25, curY + 19 + (i * 7));
          doc.setFontSize(11);
          doc.setFont("helvetica", "normal");
        }
      });
      await drawFooter(doc, curY + 15 + (selectedLabs.length * 7));
    }

    // Page 2: Cardiovascular (Checklist style)
    if (selectedCardio.length > 0) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      let curY = await drawHeader(doc, "");
      curY = drawObservations(doc, curY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(coatBlue[0], coatBlue[1], coatBlue[2]);
      doc.text("Se solicita:", 20, curY + 5);

      let y = curY + 15;
      const allPractices = orderData.allPracticesInCategory || [];
      const cardioPractices = allPractices.filter(p => cardioItems.includes(p.n));

      cardioPractices.forEach(p => {
        const isSelected = selectedCardio.includes(p.n);
        doc.setDrawColor(160);
        doc.setLineWidth(0.1);
        doc.rect(25, y - 3.2, 3.5, 3.5);
        if (isSelected) {
          doc.setFillColor(0, 102, 128);
          doc.rect(25, y - 3.2, 3.5, 3.5, 'F');
          doc.setDrawColor(255);
          doc.setLineWidth(0.3);
          doc.line(25.7, y - 1.5, 26.6, y - 0.6);
          doc.line(26.6, y - 0.6, 27.8, y - 2.2);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(isSelected ? 30 : 120);
        doc.text(p.n, 32, y);
        if (isSelected && orderData.indications?.[p.n]) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "italic");
          doc.text(`(${orderData.indications[p.n]})`, 100, y);
        }
        y += 8;
      });
      await drawFooter(doc, y);
    }

    // Page 3: RX
    if (selectedRX.length > 0) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      let curY = await drawHeader(doc, "");
      curY = drawObservations(doc, curY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(coatBlue[0], coatBlue[1], coatBlue[2]);
      doc.text("Se solicita:", 20, curY + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30);
      selectedRX.forEach((p, i) => {
        doc.text(`• ${p.toUpperCase()}`, 25, curY + 15 + (i * 10));
        if (orderData.indications?.[p]) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "italic");
          doc.text(`Ind: ${orderData.indications[p]}`, 32, curY + 22 + (i * 10));
        }
      });
      await drawFooter(doc, curY + 15 + (selectedRX.length * 10));
    }
  } else if (orderData.orderType === 'coat') {
    let currentY = await drawHeader(doc, "");
    currentY = drawObservations(doc, currentY);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Se solicita:", 20, currentY);
    
    let y = currentY + 6; // Un poco más compacto arriba
    const allPractices = orderData.allPracticesInCategory || [];
    const standardNames = allPractices.map(p => p.n);
    const customOnes = orderData.practices.filter(n => !standardNames.includes(n));
    const totalItems = allPractices.length + customOnes.length;
    
    // El margen debe ser mayor para no chocar con la firma (que empieza en pageHeight - 70 aprox)
    const footerMargin = totalItems > 38 ? 62 : (totalItems > 30 ? 70 : 78); 
    const availableHeight = (pageHeight - footerMargin) - y;
    
    // Calcular interlineado dinámico (permitir más compresión: min 3.2, max 6.5)
    let yIncrement = Math.min(Math.max(availableHeight / totalItems, 3.2), 6.5);
    
    // Tamaño de fuente más agresivo (min 6.0, max 9)
    let dynamicFontSize = Math.min(Math.max((yIncrement * 8.5) / 5.1, 6.0), 9);
    let dynamicCodeSize = dynamicFontSize * 0.82;

    for (const p of allPractices) {
      const isSelected = orderData.practices.includes(p.n);
      
      // Si realmente no entra, pasar a otra página
      if (y > pageHeight - 35) { 
        await drawFooter(doc, y);
        doc.addPage();
        y = (await drawHeader(doc, "")) + 3;
      }
      
      const boxSize = Math.max(yIncrement * 0.6, 2.5);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.15);
      doc.rect(25, y - (boxSize * 0.8), boxSize, boxSize);
      
      if (isSelected) {
        doc.setFillColor(0, 0, 0);
        doc.rect(25, y - (boxSize * 0.8), boxSize, boxSize, 'F');
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.25);
        doc.line(25 + (boxSize * 0.2), y - (boxSize * 0.4), 25 + (boxSize * 0.45), y - (boxSize * 0.15));
        doc.line(25 + (boxSize * 0.45), y - (boxSize * 0.15), 25 + (boxSize * 0.8), y - (boxSize * 0.6));
      }
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(dynamicFontSize);
      doc.setTextColor(0, 0, 0);
      doc.text(p.n, 32, y);
      
      if (p.c) {
        doc.setFontSize(dynamicCodeSize);
        doc.setTextColor(0, 0, 0);
        doc.text(p.c, 90, y);
      }
      
      if (isSelected && (orderData.quantities?.[p.n] || 1) > 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(dynamicFontSize);
        doc.setTextColor(0, 0, 0);
        doc.text(`x${orderData.quantities[p.n]}`, 110, y);
      }
      
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.05);
      doc.line(120, y + 0.5, pageWidth - 15, y + 0.5);
      
      if (isSelected && orderData.indications?.[p.n]) {
        doc.setFontSize(dynamicFontSize * 0.95);
        doc.setTextColor(0, 0, 0);
        doc.text(orderData.indications[p.n], 121, y);
      }
      y += yIncrement;
    }

    for (const pName of customOnes) {
      if (y > pageHeight - 35) {
        await drawFooter(doc, y);
        doc.addPage();
        y = (await drawHeader(doc, "")) + 3;
      }
      
      const boxSize = Math.max(yIncrement * 0.6, 2.5);
      doc.setFillColor(0, 0, 0);
      doc.rect(25, y - (boxSize * 0.8), boxSize, boxSize, 'F');
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.25);
      doc.line(25 + (boxSize * 0.2), y - (boxSize * 0.4), 25 + (boxSize * 0.45), y - (boxSize * 0.15));
      doc.line(25 + (boxSize * 0.45), y - (boxSize * 0.15), 25 + (boxSize * 0.8), y - (boxSize * 0.6));
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(dynamicFontSize);
      doc.setTextColor(0, 0, 0);
      doc.text(pName.toUpperCase(), 32, y);
      
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.05);
      doc.line(120, y + 0.5, pageWidth - 15, y + 0.5);
      
      if (orderData.indications?.[pName]) {
        doc.setFontSize(dynamicFontSize * 0.95);
        doc.setTextColor(0, 0, 0);
        doc.text(orderData.indications[pName], 121, y);
      }
      y += yIncrement;
    }
    await drawFooter(doc, y);
  } else {
    let currentY = await drawHeader(doc, "");
    currentY = drawObservations(doc, currentY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 121, 153);
    doc.text("Se solicita:", 20, currentY);
    let y = currentY + 10;
    const footerMargin = 70;
    for (const pName of orderData.practices) {
      doc.setFontSize(10);
      const indications = orderData.indications?.[pName] || "";
      const splitIndications = indications ? doc.splitTextToSize(indications, pageWidth - 45) : [];
      const itemHeight = 6 + (splitIndications.length > 0 ? (splitIndications.length * 5) : 0) + 2;
      if (y + itemHeight > pageHeight - footerMargin) {
        await drawFooter(doc, y);
        doc.addPage();
        y = (await drawHeader(doc, "")) + 3;
      }
      doc.setFontSize(10);
      doc.setTextColor(50);
      doc.setFont('helvetica', 'bold');
      doc.text(`• ${pName}`, 25, y);
      y += 6;
      if (indications) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(80);
        doc.text(splitIndications, 32, y);
        y += (splitIndications.length * 5);
      }
      y += 2;
    }
    await drawFooter(doc, y);
  }

  if (mode === 'save') {
    doc.save(`Pedido_${orderData.name.replace(/\s/g, '_')}.pdf`);
  } else if (mode === 'print') {
    window.open(doc.output('bloburl'), '_blank');
  } else if (mode === 'instance') {
    return doc;
  }
};
