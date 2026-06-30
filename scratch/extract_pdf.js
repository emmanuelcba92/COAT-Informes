
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

async function extractText() {
    const data = new Uint8Array(fs.readFileSync('./Listado Pacientes.pdf'));
    const loadingTask = pdfjs.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
        verbosity: 0
    });
    const pdf = await loadingTask.promise;
    
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fs.writeFileSync('./scratch/page1.txt', pageText);
    console.log("Page 1 saved to ./scratch/page1.txt");
}

extractText().catch(console.error);
