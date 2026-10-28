import { jsPDF } from 'jspdf';

export const EXTERNAL_REPORT_ACCEPT = '.pdf,.jpg,.jpeg,application/pdf,image/jpeg';

export function validateExternalReportFile(file) {
  if (!file || !(/\.(pdf|jpe?g)$/i.test(file.name))) {
    throw new Error('Archivo incompatible. Seleccione un PDF, JPG o JPEG.');
  }
}

// Los PDF pasan sin modificaciones. Las imágenes se preparan antes de cualquier escritura.
export async function prepareExternalReportFile(file) {
  validateExternalReportFile(file);
  if (/\.pdf$/i.test(file.name)) return file;

  let objectUrl;
  let canvas;
  try {
    const signature = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
      throw new Error('Invalid JPEG');
    }

    objectUrl = URL.createObjectURL(file);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = objectUrl;
    });

    // El navegador aplica la orientación EXIF. El canvas conserva esos píxeles
    // sin una segunda rotación EXIF ni otra compresión JPEG con pérdida.
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) throw new Error('Empty image');
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, 0, 0);
    const pixels = canvas.toDataURL('image/png');
    if (pixels === 'data:,') throw new Error('Image too large');

    const pdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const scale = Math.min((pageWidth - 20) / width, (pageHeight - 20) / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    pdf.addImage(pixels, 'PNG', (pageWidth - drawWidth) / 2, (pageHeight - drawHeight) / 2,
      drawWidth, drawHeight, undefined, 'FAST');

    return new File([pdf.output('blob')], file.name.replace(/\.jpe?g$/i, '.pdf'), {
      type: 'application/pdf',
      lastModified: file.lastModified,
    });
  } catch {
    throw new Error('No se pudo convertir la imagen a PDF. Verifique que el JPG/JPEG sea válido o intente con una imagen de menor tamaño. No se subió ningún archivo.');
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
