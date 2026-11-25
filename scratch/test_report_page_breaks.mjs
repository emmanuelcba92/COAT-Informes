import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const playwright = process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
  : 'playwright';
const { chromium } = await import(playwright);
const origin = 'http://127.0.0.1:5178';
const source = (await readFile('src/pages/ReportsPage.jsx', 'utf8')).replace(/\r\n/g, '\n');
const renderer = source.slice(source.indexOf('    const doc = new jsPDF({ compress: true });'),
  source.indexOf("    if (mode === 'print') {\n      const pdfUrl"));
const crop = source.slice(source.indexOf('const cropSignatureCanvas ='), source.indexOf('import { AUDIT_ACTIONS'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext();
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) return route.abort();
  if (url.pathname === '/__report_breaks') {
    return route.fulfill({ contentType: 'text/html', body: `
      <script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
      </script><div id="editor"></div>` });
  }
  if (url.pathname === '/@vite/client') {
    return route.fulfill({ contentType: 'application/javascript', body: `
      export const injectQuery = url => url;
      export const createHotContext = () => ({accept(){}, dispose(){}, on(){}, data:{}});
    ` });
  }
  const mocks = {
    '/src/services/firebase.js': "export const db = {}; export const auth = {currentUser: {uid: 'local'}};",
    '/src/services/auditService.js': 'export const AUDIT_ACTIONS = {}; export const logAction = async () => {};',
    '/src/utils/aiService.js': 'export const extractPatientsFromImage = async () => [];',
    '/node_modules/.vite/deps/firebase_firestore.js': `
      export const collection = (_, name) => name;
      export const doc = (_, name, id) => [name, id];
      export const getDocs = async name => ({
        docs: name === 'practices' ? (window.fixtureModels || []).map(model => ({
          id: model.id, data: () => model
        })) : []
      });
      export const getDoc = async ([name]) => ({
        exists: () => name === 'reports',
        data: () => window.fixtureSavedReport
      });
      export const setDoc = async ([name], data) => {
        if (name === 'reports') window.fixtureSavedReport = {...window.fixtureSavedReport, ...data};
      };
      export const addDoc = async () => ({id: 'local'});
      export const arrayUnion = (...values) => values;
    `
  };
  if (mocks[url.pathname]) return route.fulfill({ contentType: 'application/javascript', body: mocks[url.pathname] });
  return route.continue();
});

try {
  const page = await context.newPage();
  page.on('pageerror', error => console.error(error));
  await page.goto(origin + '/__report_breaks');
  await page.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: ClinicalEditor } = await import('/src/components/ClinicalEditor.jsx');
    const root = createRoot(document.getElementById('editor'));
    window.mountEditor = (value, key) => root.render(React.createElement(ClinicalEditor, {
      value, key, onChange: html => { window.savedHtml = html; }
    }));
    window.mountEditor('<p><strong>PrimeroLuego</strong></p>', 'original');
  });
  const editor = page.locator('.tiptap');
  await editor.click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Salto de página', exact: true }).click();
  const marker = '<div data-report-page-break=""></div>';
  const saved = await page.evaluate(() => window.savedHtml);
  assert.equal(saved, '<p><strong>Primero</strong></p>' + marker + '<p><strong>Luego</strong></p>');
  const previousEditor = await editor.elementHandle();
  await page.evaluate(html => window.mountEditor(html, 'reabierto'), saved);
  await page.waitForFunction(element => !element.isConnected, previousEditor);
  await page.getByRole('button', { name: 'Eliminar salto' }).click();
  assert(!(await page.evaluate(() => window.savedHtml)).includes('data-report-page-break'));
  await page.getByRole('button', { name: 'Deshacer (Ctrl+Z)' }).click();
  await page.getByRole('button', { name: 'Eliminar salto' }).waitFor();
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const data = atob(canvas.toDataURL().split(',')[1]);
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([Uint8Array.from(data, ch => ch.charCodeAt(0))],
      'imagen.png', { type: 'image/png' }));
    document.querySelector('.tiptap').dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true }));
  });
  await page.waitForFunction(() => window.savedHtml.includes('<img src="data:image/png'));

  const results = await page.evaluate(async ({ renderer, crop, marker }) => {
    const { jsPDF } = await import('/node_modules/.vite/deps/jspdf.js');
    const { default: autoTable, __createTable, __drawTable } = await import('/node_modules/.vite/deps/jspdf-autotable.js');
    const { drawWrappedCenteredText } = await import('/src/utils/pdfTextLayout.js');
    const { isParticularInsurance } = await import('/src/utils/patientInsurance.js');
    const { formatDoctorDisplayName } = await import('/src/utils/doctorName.js');
    const { REPORT_PAGE_BREAK, isReportImageSource } = await import('/src/utils/reportContent.js');
    const pdfjs = await import('/node_modules/pdfjs-dist/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
    const logo = new Image();
    logo.src = '/coat_logo.png';
    await logo.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 350;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'darkblue';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(5, 90);
    ctx.bezierCurveTo(50, 5, 185, 5, 340, 110);
    ctx.stroke();
    const signature = canvas.toDataURL();
    canvas.height = 640;
    ctx.fillStyle = '#8dc9ed';
    ctx.fillRect(0, 0, 350, 640);
    ctx.fillStyle = '#59237e';
    ctx.fillRect(5, 590, 340, 45);
    const image = `<img src="${canvas.toDataURL('image/jpeg')}">`;
    const stamp = `<img src="${signature}">`;
    const table = rows => '<table><thead><tr><th>Medición</th></tr></thead><tbody>'
      + Array.from({ length: rows }, (_, i) => `<tr><td>Fila ${i + 1}</td></tr>`).join('')
      + '</tbody></table>';
    const professional = {
      nombre: 'Profesional Ficticio', especialidad: 'ORL', mp: '12345', signatureBase64: signature,
      hasLetterhead: true, headerGeneral: ['MEMBRETE SINTÉTICO'], logo
    };
    const reportData = { patient: 'PACIENTE FICTICIO', date: '2026-11-25', enableHeader: true };
    const render = new Function('jsPDF', 'autoTable', '__createTable', '__drawTable', 'drawWrappedCenteredText',
      'isParticularInsurance', 'formatDoctorDisplayName', 'REPORT_PAGE_BREAK', 'isReportImageSource',
      'professional', 'reportData', 'content', 'optionsByPage', `return (async () => {
        const selectedDelegate = null, selectedPractice = '';
        ${crop}
        ${renderer.replace('const logoUrl = "/coat_logo.png";', 'const logoUrl = professional.logo;')}
        return doc;
      })();`);
    const generate = (html, options = {}) => render(jsPDF, autoTable, __createTable, __drawTable,
      drawWrappedCenteredText, isParticularInsurance, formatDoctorDisplayName, REPORT_PAGE_BREAK,
      isReportImageSource, professional, reportData, html, options);
    const inspect = async doc => {
      const pdf = await pdfjs.getDocument({ data: doc.output('arraybuffer') }).promise;
      try {
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const { items } = await page.getTextContent();
          const list = await page.getOperatorList();
          const images = list.fnArray.filter(code => code === pdfjs.OPS.paintImageXObject
            || code === pdfjs.OPS.paintInlineImageXObject).length;
          pages.push({ text: items.map(item => item.str).join(' '), images, dimensions: page.view.slice(2),
            overflow: items.some(item => item.str.trim() && !/^(Urquiza 401|Email:)/.test(item.str)
              && (page.view[3] - item.transform[5]) * 25.4 / 72 > 274) });
        }
        return pages;
      } finally {
        await pdf.destroy();
      }
    };
    const sections = [
      '<h1>ESTUDIO UNO</h1><p>Texto de la primera sección.</p>' + image,
      '<h1>ESTUDIO DOS</h1>' + table(8) + stamp,
      '<h1>ESTUDIO TRES</h1><p>Texto de la tercera sección.</p>',
      '<h1>ESTUDIO CUATRO</h1>' + image + stamp,
      '<h1>ESTUDIO CINCO</h1>' + table(5) + '<p>Conclusión y firma digital.</p>'
    ];
    const doc = await generate(marker + sections.join(marker + '<p><br></p>' + marker) + marker);
    const pages = await inspect(doc);
    const customized = await inspect(await generate(sections.join(marker), {
      1: { patient: false, signature: true },
      2: { patient: true },
      3: { patient: true, signature: true },
      5: { signature: false }
    }));
    const overflow = await inspect(await generate(sections[0] + marker + '<h1>TABLA EXTENSA</h1>'
      + table(28) + marker + sections[3] + marker + sections[4]));
    const signedOverflow = await inspect(await generate(sections[0] + marker + '<h1>TABLA EXTENSA</h1>'
      + table(40), {
        2: { patient: true, signature: true }, 3: { patient: true, signature: false }
      }));
    const single = await inspect(await generate(marker + sections[2] + marker));
    canvas.height = 1900;
    ctx.fillStyle = '#228dca';
    ctx.fillRect(0, 0, 350, 1900);
    const tall = await inspect(await generate(sections[2] + marker
      + `<img src="${canvas.toDataURL('image/jpeg')}">`));
    window.fixtureSavedReport = {
      pacienteNombre: reportData.patient, pacienteObraSocial: 'PARTICULAR', fecha: reportData.date,
      contenidoTexto: sections.join(marker), enableHeader: true
    };
    window.fixtureProfessional = professional;
    return { pages, customized, overflow, signedOverflow, single, tall };
  }, { renderer, crop, marker });

  assert.equal(results.pages.length, 5);
  for (const [index, title] of ['UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO'].entries()) {
    const sheet = results.pages[index];
    assert.match(sheet.text, new RegExp('ESTUDIO ' + title));
    assert(sheet.text.includes('Urquiza 401'));
    assert(!sheet.overflow);
    assert(Math.abs(sheet.dimensions[0] - 595.28) < 0.1);
    assert(Math.abs(sheet.dimensions[1] - 841.89) < 0.1);
    assert.equal(sheet.text.includes('MEMBRETE SINTÉTICO'), index === 0);
    assert.equal(sheet.text.includes('MP: 12345'), index === 4);
  }
  assert.deepEqual(results.pages.map(sheet => sheet.images), [2, 1, 0, 2, 1]);
  assert.equal(results.customized.length, 5);
  for (const [index, sheet] of results.customized.entries()) {
    assert.equal(sheet.text.includes('PACIENTE: PACIENTE FICTICIO'), [1, 2].includes(index));
    assert.equal(sheet.text.includes('MP: 12345'), [0, 2].includes(index));
    assert(!sheet.overflow);
  }
  assert.match(results.pages[1].text, /Fila 8\b/);
  assert.match(results.pages[4].text, /Fila 5\b/);
  assert.equal(results.overflow.length, 5);
  assert.match(results.overflow[1].text, /Fila 1\b/);
  assert.match(results.overflow[2].text, /Fila 28\b/);
  assert.match(results.signedOverflow[1].text, /MP: 12345/);
  assert.match(results.signedOverflow[2].text, /PACIENTE: PACIENTE FICTICIO/);
  assert(!results.signedOverflow[2].text.includes('MP: 12345'));
  assert(results.signedOverflow.every(sheet => !sheet.overflow));
  assert.deepEqual(results.signedOverflow.flatMap(sheet =>
    [...sheet.text.matchAll(/Fila (\d+)\b/g)].map(match => Number(match[1]))),
  Array.from({ length: 40 }, (_, index) => index + 1));
  assert.equal(results.single.length, 1);
  assert.equal(results.tall.length, 2);
  assert.equal(results.tall[1].images, 2);
  assert(!results.tall[1].overflow);

  await page.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const modulePath = '/src/pages/ReportsPage.jsx';
    const transformed = await fetch(modulePath).then(response => response.text());
    const routerPath = transformed.match(/"([^"]*\/react-router-dom\.js\?[^"]+)"/)[1];
    const { MemoryRouter } = await import(routerPath);
    const { default: ReportsPage } = await import(modulePath);
    const container = document.createElement('div');
    document.body.replaceChildren(container);
    const root = createRoot(container);
    window.mountReport = (key, query = '?edit=local') => root.render(React.createElement(MemoryRouter, {
      key, initialEntries: ['/reports' + query]
    }, React.createElement(ReportsPage, { userProfile: window.fixtureProfessional })));
    window.mountReport('download');
    window.mountModelOptions = async () => {
      const { default: ModelOptions } = await import('/src/components/ReportModelPageOptions.jsx');
      window.modelOptions = {};
      const renderOptions = () => {
        root.render(React.createElement(ModelOptions, {
          html: window.fixtureSavedReport.contenidoTexto,
          options: window.modelOptions,
          onChange: next => { window.modelOptions = next; renderOptions(); }
        }));
      };
      renderOptions();
    };
  });
  const pageBreaks = page.getByRole('button', { name: 'Eliminar salto' });
  await pageBreaks.last().waitFor();
  assert.equal(await pageBreaks.count(), 4);
  await page.locator('.tiptap td p').first().click({ position: { x: 2, y: 5 } });
  await page.getByRole('button', { name: 'Salto de página', exact: true })
    .and(page.locator('button:disabled')).waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: 'Vista previa y JPG' }).click();
  const picker = page.getByRole('combobox', { name: 'Página del informe' });
  await picker.waitFor();
  assert.equal(await picker.locator('option').count(), 5);
  await picker.selectOption('3');
  await page.getByRole('checkbox', { name: 'Datos del paciente' }).check();
  await page.getByRole('checkbox', { name: 'Firma', exact: true }).check();
  for (let i = 1; i <= 5; i++) {
    await picker.selectOption(String(i));
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar JPG' }).click();
    const jpg = await download;
    assert.equal(jpg.suggestedFilename(), `Informe - PACIENTE FICTICIO - página ${i}.jpg`);
    const bytes = await readFile(await jpg.path());
    assert.equal(bytes.readUInt16BE(0), 0xFFD8);
    assert(bytes.length > 10_000);
  }
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar', exact: true }).click();
  assert((await pdfDownload).suggestedFilename().endsWith('.pdf'));
  await page.getByRole('button', { name: 'Vista previa y JPG' }).waitFor();
  assert((await page.evaluate(() => window.fixtureSavedReport.contenidoTexto)).includes(marker));
  assert.deepEqual(await page.evaluate(() => window.fixtureSavedReport.opcionesPaginas), {
    3: { patient: true, signature: true }
  });
  await page.evaluate(() => {
    window.open = url => { window.printedPdf = url; return null; };
    window.mountReport('print');
  });
  await pageBreaks.last().waitFor();
  await page.getByRole('button', { name: /Imprimir/ }).click();
  await page.waitForFunction(() => Boolean(window.printedPdf));
  assert.equal(await page.evaluate(async () => {
    const { getDocument } = await import('/node_modules/pdfjs-dist/build/pdf.mjs');
    const loading = getDocument(window.printedPdf);
    try {
      return (await loading.promise).numPages;
    } finally {
      await loading.destroy();
    }
  }), 5);
  await page.evaluate(() => {
    window.savedFivePageBody = window.fixtureSavedReport.contenidoTexto;
    window.fixtureSavedReport.contenidoTexto = '<p>Informe de una hoja.</p>';
    window.mountReport('single', '?edit=local&preview=true');
  });
  const singleJpg = page.getByRole('button', { name: 'Descargar JPG' });
  await singleJpg.waitFor();
  assert.equal(await picker.count(), 0);
  const singleDownload = page.waitForEvent('download');
  await singleJpg.click();
  assert.equal((await singleDownload).suggestedFilename(), 'Informe - PACIENTE FICTICIO.jpg');
  await page.evaluate(() => {
    window.fixtureSavedReport.contenidoTexto = window.savedFivePageBody;
    return window.mountModelOptions();
  });
  await page.getByLabel('Datos del paciente, página 2').selectOption('show');
  await page.getByLabel('Firma, página 5').selectOption('hide');
  await page.getByRole('button', { name: 'Configurar otra página' }).click();
  await page.getByLabel('Firma, página 6').selectOption('show');
  await page.getByLabel('Firma, página 6').selectOption('');
  assert.deepEqual(await page.evaluate(() => window.modelOptions), {
    2: { patient: true }, 5: { signature: false }
  });
  await page.evaluate(() => {
    window.fixtureProfessional.role = 'medico';
    window.fixtureModels = [{
      id: 'modelo-local', n: 'MODELO DE PRUEBA', b: window.savedFivePageBody, st: false,
      allowedRoles: ['medico'], opcionesPaginas: window.modelOptions
    }];
    window.mountReport('new-from-model', '');
  });
  await page.getByRole('option', { name: 'MODELO DE PRUEBA' }).waitFor({ state: 'attached' });
  await page.locator('select').filter({ has: page.getByRole('option', { name: 'MODELO DE PRUEBA' }) })
    .selectOption('MODELO DE PRUEBA');
  await page.getByRole('button', { name: 'Vista previa y JPG' }).click();
  await picker.selectOption('2');
  assert(await page.getByRole('checkbox', { name: 'Datos del paciente' }).isChecked());
  await picker.selectOption('5');
  assert(!(await page.getByRole('checkbox', { name: 'Firma', exact: true }).isChecked()));
  console.log('Informe de 5 hojas A4, paginación automática y 5 JPG verificados.');
} finally {
  await browser.close();
}
