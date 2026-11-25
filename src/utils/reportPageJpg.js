import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export async function downloadReportPage(pdfUrl, pageNumber, fileName) {
  const { getDocument, PDFWorker } = await import('pdfjs-dist');
  // Use a dedicated worker so this export does not change the settings of other PDF tools.
  const worker = new Worker(workerSrc, { type: 'module' });
  const pdfWorker = new PDFWorker({ port: worker });
  const loading = getDocument({ url: pdfUrl, worker: pdfWorker });
  try {
    const pdf = await loading.promise;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport, background: '#ffffff' }).promise;
    const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!image) throw new Error('No se pudo convertir la página');
    const url = URL.createObjectURL(image);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    try {
      await loading.destroy();
    } finally {
      pdfWorker.destroy();
      worker.terminate();
    }
  }
}
