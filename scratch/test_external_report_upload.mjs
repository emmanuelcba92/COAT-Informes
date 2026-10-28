// Ejecutar con Vite en 127.0.0.1:5178. PLAYWRIGHT_MODULE puede indicar el paquete instalado.
// Todos los servicios se sustituyen en el navegador; cualquier solicitud externa se bloquea.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const external = [];
const errors = [];
page.on('pageerror', error => { if(errors.length<10) { errors.push(error.message); console.error('BROWSER ERROR', error.message); } });
const origin = 'http://127.0.0.1:5178';
const mock = `
window.testState ??= {uploads: [], writes: [], reports: [
  {id:'existing-pdf',pacienteNombre:'Previo Sintetico',profesionalId:'synthetic-prof',tipoReporte:'externo',fecha:'2026-10-01',pdfUrl:'/__existing.pdf'},
  {id:'existing-clinical',pacienteNombre:'Clinico Sintetico',profesionalId:'synthetic-prof',tipoReporte:'clinico',fecha:'2026-10-01'}
], emails: [], opens: []};
const s = window.testState;
export const db = {}; export const auth = {currentUser: {uid: 'synthetic-prof'}};
export const collection = (_, name) => ({name});
export const doc = (_, name, id) => ({name, id});
export const query = (ref) => ref;
export const where = () => ({}); export const orderBy = where;
export const limit = where; export const startAfter = where; export const arrayUnion = (...v) => v;
export const getDocs = async ref => ({docs: (ref.name === 'users'
  ? [{id:'synthetic-prof', nombre:'Profesional Prueba', role:'fonoaudiologa'}]
  : s.reports).map(r => ({id:r.id, data:() => r}))});
export const getDoc = async ref => ({exists: () => ref.name === 'config', data: () =>
  ({adminEmail:'test@example.invalid',appsScriptUrl:'/__test_email',token:'synthetic',reportRequiredSocialWork:false,
    ...JSON.parse(new URL(location.href).searchParams.get('required') || '{}')})});
export const setDoc = async (...args) => s.writes.push(['patient', ...args]);
export const addDoc = async (_, value) => {const id='report-'+s.reports.length;
  s.writes.push(['report',value]); s.reports.push({...value,id}); return {id};};
export const deleteDoc = async () => {throw Error('Unexpected deletion');};
export const logAction = async (...args) => s.writes.push(['audit',...args]);
export const AUDIT_ACTIONS = {UPLOAD_EXTERNAL_PDF:'upload'};
export const extractPatientsFromImage = () => {throw Error('Unexpected AI call');};
export const supabase = {storage:{from: () => ({upload: async (path,file) => {
  s.uploads.push({path,file,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))});
  return {data:{},error:null};}, getPublicUrl: path => ({data:{publicUrl:'/__stored/'+path}})})}};
`;
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) { external.push(url.origin); return route.abort(); }
  if (url.pathname === '/@vite/client') return route.fulfill({contentType:'application/javascript',body:`
    export const createHotContext=()=>({accept(){},dispose(){},invalidate(){},on(){},prune(){},data:{},send(){}});
    export const injectQuery=url=>url; export const updateStyle=()=>{};export const removeStyle=()=>{};`});
  if (url.pathname === '/__test') return route.fulfill({contentType:'text/html', body:`
    <html><head><script type="module">import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};
    window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    </script></head><body><div id="root"></div>
    <script type="module" src="/scratch/external_report_test_harness.jsx"></script></body></html>`});
  if (url.pathname === '/__mock.js') return route.fulfill({contentType:'application/javascript',body:mock});
  if (url.pathname === '/src/pages/MyReportsPage.jsx') {
    const response = await route.fetch();
    const body = (await response.text()).replace(/from "([^"]+)"/g, (whole, path) =>
      /firebase_firestore|\/services\/(firebase|supabase|auditService)|\/utils\/aiService/.test(path)
        ? 'from "/__mock.js"' : whole);
    return route.fulfill({response, body});
  }
  return route.continue();
});
try {
  await page.goto(origin+'/__test');
  await page.getByRole('button',{name:'Subir archivo',exact:true}).waitFor();
  await page.getByRole('row').filter({hasText:'Previo Sintetico'}).getByTitle('Ver / Imprimir').click();
  await page.getByRole('row').filter({hasText:'Clinico Sintetico'}).getByTitle('Editar Informe').waitFor();
  const previousReports=await page.evaluate(()=>JSON.stringify(window.testState.reports));
  const conversion = await page.evaluate(async () => {
    const {prepareExternalReportFile:prepare} = await import('/src/utils/externalReportFile.js');
    const {jsPDF} = await import('/node_modules/.vite/deps/jspdf.js');
    const pdfjs = await import('/node_modules/pdfjs-dist/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
    const pdf = new File([new jsPDF().output('blob')], 'original.pdf',{type:'application/pdf'});
    const original = await prepare(pdf);
    window.fixtures = [{file:pdf,name:'original.pdf'}];
    const results = [{name:'PDF identical object and bytes', pass:original===pdf}];
    for (const [name,width,height,orientation] of [
      ['vertical.jpg',600,900,1], ['horizontal.jpeg',900,600,1],
      ['EXIF-6.jpg',900,600,6], ['EXIF-8.jpeg',900,600,8], ['EXIF-3.JPG',900,600,3]]) {
      const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
      const ctx=canvas.getContext('2d'); ctx.fillStyle='white'; ctx.fillRect(0,0,width,height);
      ctx.fillStyle='red';ctx.fillRect(0,0,100,100);ctx.fillStyle='blue';ctx.fillRect(width-100,height-100,100,100);
      ctx.strokeStyle='black';ctx.lineWidth=8;ctx.strokeRect(4,4,width-8,height-8);
      let bytes = new Uint8Array(await (await new Promise(r=>canvas.toBlob(r,'image/jpeg',1))).arrayBuffer());
      if (orientation!==1) {
        const exif=new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,orientation,0,0,0,0,0,0,0]);
        bytes=new Uint8Array([...bytes.slice(0,2),...exif,...bytes.slice(2)]);
      }
      const input=new File([bytes],name,{type:'image/jpeg'});
      window.fixtures.push({file:input,name});
      const output=await prepare(input);
      const pdfDocument=await pdfjs.getDocument({data:new Uint8Array(await output.arrayBuffer())}).promise;
      const p=await pdfDocument.getPage(1); const viewport=p.getViewport({scale:1});
      const rotated=orientation===6||orientation===8;
      const expectedRatio=rotated?height/width:width/height;
      const ops=await p.getOperatorList();
      const imageTransform=ops.argsArray[ops.fnArray.findIndex((fn,i)=>fn===pdfjs.OPS.transform && ops.argsArray[i][0]>100)];
      const ratio=imageTransform[0]/imageTransform[3];
      const rendered=window.document.createElement('canvas');rendered.width=viewport.width;rendered.height=viewport.height;
      await p.render({canvasContext:rendered.getContext('2d'),viewport}).promise;
      await p.render({canvasContext:rendered.getContext('2d'),viewport,intent:'print'}).promise;
      const pixels=rendered.getContext('2d').getImageData(0,0,rendered.width,rendered.height).data;
      let red=0,blue=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]>180&&pixels[i+2]<80)red++;if(pixels[i+2]>180&&pixels[i]<80)blue++;}
      results.push({name,pass:Math.abs(ratio-expectedRatio)<0.001 && (viewport.width>viewport.height)===(expectedRatio>1)
        && pdfDocument.numPages===1 && red>100 && blue>100 && output.type==='application/pdf' && /\.pdf$/.test(output.name),ratio,expectedRatio,red,blue});
      await pdfDocument.destroy();
    }
    for(const name of ['broken.jpg','broken.jpeg','unsupported.png']) {
      let rejected=false;try{await prepare(new File(['broken'],name));}catch{rejected=true;}
      results.push({name,pass:rejected});
    }
    return results;
  });
  conversion.forEach(result=>assert.equal(result.pass,true,JSON.stringify(result)));
  console.log('CONVERSION',JSON.stringify(conversion));
  for (let i=0;i<3;i++) {
    await page.getByRole('button',{name:'Subir archivo',exact:true}).click();
    const inputs=page.locator('form input');
    await inputs.nth(0).fill('Paciente Sintetico');
    await inputs.nth(1).fill('99999999');
    await inputs.nth(7).fill('Audiograma sintetico');
    await page.locator('form select').selectOption('synthetic-prof');
    await page.evaluate(i=>{const dt=new DataTransfer();dt.items.add(window.fixtures[i].file);
      const input=document.getElementById('pdf-upload');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));},i);
    await page.getByRole('button',{name:'Registrar Informe',exact:true}).click();
    await page.getByRole('heading',{name:'Subir archivo de informe'}).waitFor({state:'hidden',timeout:8000});
    await page.getByRole('row').filter({hasText:'Paciente Sintetico'}).last().getByTitle('Ver / Imprimir').click();
  }
  const flow=await page.evaluate(async()=>({
    uploads:window.testState.uploads.map(u=>({path:u.path,type:u.file.type,header:String.fromCharCode(...u.bytes.slice(0,5))})),
    reports:window.testState.reports.length,
    opens:window.testState.opens.length,
    emails:window.testState.emails.map(e=>atob(e.pdfBase64).slice(0,5)),
    unchangedPdf:JSON.stringify(window.testState.uploads[0].bytes)===JSON.stringify(Array.from(new Uint8Array(await window.fixtures[0].file.arrayBuffer())))
  }));
  assert.equal(flow.uploads.length,3);assert.equal(flow.reports,5);assert.equal(flow.opens,4);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.testState.reports.slice(0,2))),previousReports);
  assert.equal(await page.evaluate(()=>window.testState.opens[0]),'/__existing.pdf');
  assert.equal(flow.emails.length,3);assert(flow.unchangedPdf);
  flow.uploads.forEach(u=>{assert.equal(u.header,'%PDF-');assert.match(u.path,/\.pdf$/);assert.equal(u.type,'application/pdf');});
  flow.emails.forEach(h=>assert.equal(h,'%PDF-'));
  console.log('MOCKED UPLOAD / HISTORY / EMAIL',JSON.stringify(flow));
  for(let i=0;i<3;i++) {
    const downloadReady=page.waitForEvent('download');
    await page.evaluate(i=>{const file=window.testState.uploads[i].file;
      const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;a.click();},i);
    const download=await downloadReady;
    const stream=await download.createReadStream();const chunks=[];
    for await(const chunk of stream) chunks.push(chunk);
    const bytes=Buffer.concat(chunks);
    assert.deepEqual([...bytes],await page.evaluate(i=>window.testState.uploads[i].bytes,i));
  }
  console.log('DOWNLOAD: all three PDFs downloaded with identical bytes; display and print rendering passed');
  await page.getByRole('button',{name:'Subir archivo',exact:true}).click();
  const inputs=page.locator('form input');await inputs.nth(0).fill('Paciente Sintetico');await inputs.nth(1).fill('99999999');await inputs.nth(7).fill('Audiograma sintetico');
  await page.locator('form select').selectOption('synthetic-prof');
  const before=await page.evaluate(()=>[window.testState.uploads.length,window.testState.writes.length]);
  await page.locator('#pdf-upload').setInputFiles({name:'broken.jpg',mimeType:'image/jpeg',buffer:Buffer.from('broken')});
  await page.getByRole('button',{name:'Registrar Informe',exact:true}).click();
  await page.getByText(/No se pudo convertir la imagen a PDF/).waitFor();
  assert.deepEqual(await page.evaluate(()=>[window.testState.uploads.length,window.testState.writes.length]),before);
  // Simular falta de recursos del navegador durante una conversión válida.
  await page.evaluate(()=>{window.savedGetContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=()=>null;
    const dt=new DataTransfer();dt.items.add(window.fixtures[1].file);
    const input=document.getElementById('pdf-upload');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.getByRole('button',{name:'Registrar Informe',exact:true}).click();
  await page.getByRole('button',{name:'Registrar Informe',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('button[type="submit"]').disabled);
  assert.deepEqual(await page.evaluate(()=>[window.testState.uploads.length,window.testState.writes.length]),before);
  await page.evaluate(()=>HTMLCanvasElement.prototype.getContext=window.savedGetContext);
  await page.locator('#pdf-upload').setInputFiles({name:'unsupported.png',mimeType:'image/png',buffer:Buffer.from('invalid')});
  await page.getByText(/Archivo incompatible/).waitFor();
  console.log('FAILURES: conversion and incompatible format produce no upload or write');
  const fixtures=await page.evaluate(async()=>Promise.all(window.fixtures.slice(0,3).map(async f=>({name:f.name,type:f.file.type,bytes:Array.from(new Uint8Array(await f.file.arrayBuffer()))}))));
  const fields=[
    ['reportRequiredPatient',0,'Paciente','Paciente Sintetico'],
    ['reportRequiredDate',4,'Fecha','2026-10-28'],
    ['reportRequiredSocialWork',2,'Obra Social','Obra social de prueba'],
    ['reportRequiredAffiliate',3,'Nro. Afiliado','123456'],
    ['reportRequiredDni',1,'DNI','99999999'],
    ['reportRequiredRequester',5,'Solicitante','Profesional Prueba'],
    ['reportRequiredReason',7,'Motivo / Descripción','Audiograma'],
    ['reportRequiredEmail',6,'Email del Paciente','test@example.invalid'],
  ];
  const optionalConfig=Object.fromEntries(fields.map(([key])=>[key,false]));
  async function openConfigured(config,fixture){
    await page.goto(origin+'/__test?required='+encodeURIComponent(JSON.stringify(config)));
    await page.getByRole('button',{name:'Subir archivo',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('form select option').length>1);
    await page.locator('form select').selectOption('synthetic-prof');
    await page.locator('form input').nth(4).fill('');
    await page.locator('#pdf-upload').setInputFiles({name:fixture.name,mimeType:fixture.type,buffer:Buffer.from(fixture.bytes)});
  }
  for(const [setting,index,label,value] of fields){
    await openConfigured({...optionalConfig,[setting]:true},fixtures[0]);
    const inputs=page.locator('form input');
    for(const [key,i] of fields) assert.equal(await inputs.nth(i).getAttribute('required')!==null,key===setting,key);
    await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    await page.getByRole('alert').filter({hasText:'El campo '+label+' es obligatorio.'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>[window.testState.uploads.length,window.testState.writes.length]),[0,0]);
    await inputs.nth(index).fill(value);
    await page.getByRole('button',{name:'Registrar Informe',exact:true}).click();
    await page.getByRole('heading',{name:'Subir archivo de informe'}).waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>window.testState.uploads.length),1);
    if(setting==='reportRequiredDni') assert.equal(await page.evaluate(()=>window.testState.writes.filter(w=>w[0]==='patient').length),0);
  }
  for(const fixture of fixtures){
    await openConfigured(optionalConfig,fixture);
    await page.getByRole('button',{name:'Registrar Informe',exact:true}).click();
    await page.getByRole('heading',{name:'Subir archivo de informe'}).waitFor({state:'hidden'});
    const record=await page.evaluate(()=>window.testState.reports.at(-1));
    assert.equal(record.pacienteDni,'');assert.equal(record.reason,'');assert.equal(record.pacienteNombre,'');
    assert.equal(await page.evaluate(()=>window.testState.uploads.length),1);
  }
  console.log('CONFIGURATION: all 8 required-field settings enforced; optional fields blank accepted for PDF/JPG/JPEG; no empty patient write');
  assert.deepEqual(external,[]); assert.deepEqual(errors,[]);
  console.log('PASS: no external requests, no browser errors');
} catch (error) {
  console.error('TEST STATE', await page.evaluate(()=>({text:document.body.innerText.slice(-1500),
    uploads:window.testState?.uploads.length,writes:window.testState?.writes.length,
    fields:[...document.querySelectorAll('form input')].map(e=>({type:e.type,value:e.value,valid:e.validity.valid}))})));
  throw error;
} finally { await browser.close(); }
