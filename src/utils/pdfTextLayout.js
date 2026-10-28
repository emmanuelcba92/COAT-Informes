// Devuelve la última línea base para que el contenido siguiente conserve su separación.
export function drawWrappedCenteredText(doc, text, y, lineHeight, maxWidth = 180, separator = null) {
  // Reserva 2 mm por lado para diferencias de métricas entre jsPDF y los visores.
  const wrapWidth = maxWidth - 4;
  // jsPDF puede exceder el ancho al dividir palabras sin espacios (p. ej. afiliados).
  const wrapText = value => doc.splitTextToSize(value, wrapWidth).flatMap(line => {
    if (doc.getTextWidth(line) <= wrapWidth) return [line];
    const chunks = [];
    let chunk = '';
    for (const character of line) {
      if (chunk && doc.getTextWidth(chunk + character) > wrapWidth) {
        chunks.push(chunk);
        chunk = '';
      }
      chunk += character;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  });
  let lines;
  if (separator) {
    lines = [];
    let currentLine = '';
    for (const field of text.split(separator).map(value => value.trim()).filter(Boolean)) {
      const candidate = currentLine ? `${currentLine}  ${separator}  ${field}` : field;
      if (doc.getTextWidth(candidate) <= wrapWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        const fieldLines = wrapText(field);
        lines.push(...fieldLines.slice(0, -1));
        currentLine = fieldLines[fieldLines.length - 1] || '';
      }
    }
    if (currentLine) lines.push(currentLine);
  } else {
    lines = wrapText(text);
  }
  const centerX = doc.internal.pageSize.getWidth() / 2;
  lines.forEach((line, index) => doc.text(line, centerX, y + index * lineHeight, { align: 'center' }));
  return y + Math.max(0, lines.length - 1) * lineHeight;
}
