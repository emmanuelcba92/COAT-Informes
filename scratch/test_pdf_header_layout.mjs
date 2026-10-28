import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const reportSource = await readFile('src/pages/ReportsPage.jsx','utf8');
const reportHeader = reportSource.slice(reportSource.indexOf('    const prof = selectedDelegate'),reportSource.indexOf('    // 4. Report Content'));
const legacySource = await readFile('src/pages/OrdersPage.jsx','utf8');
const legacyHeader = legacySource.slice(legacySource.indexOf('      // Patient Information (COMPACTED'),legacySource.indexOf('      // Practices List'));
const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext();
const page = await context.newPage();
const external=[];
await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://127.0.0.1:5178') {external.push(url.origin);return route.abort();}
  if(url.pathname==='/__layout')return route.fulfill({contentType:'text/html',body:'<html><body>Prueba local de PDF con datos ficticios</body></html>'});
  if(url.pathname==='/@vite/client')return route.fulfill({contentType:'application/javascript',body:'export const injectQuery=url=>url; export const createHotContext=()=>({accept(){},dispose(){},on(){},data:{}});'});
  return route.continue();
});
try {
  await page.goto('http://127.0.0.1:5178/__layout');
  const results=await page.evaluate(async ({reportHeader,legacyHeader})=>{
    const {jsPDF}=await import('/node_modules/.vite/deps/jspdf.js');
    const {drawWrappedCenteredText}=await import('/src/utils/pdfTextLayout.js');
    const {generateOrderPDF}=await import('/src/utils/orderPdfGenerator.js');
    const pdfjs=await import('/node_modules/pdfjs-dist/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='/node_modules/pdfjs-dist/build/pdf.worker.mjs';
    const makeReport=new Function('doc','reportData','professional','drawWrappedCenteredText',
      `const selectedDelegate=null;const selectedPractice='';${reportHeader};return currentY;`);
    const makeLegacy=new Function('doc','patientData','drawWrappedCenteredText',
      `const pageWidth=210;const centerX=105;${legacyHeader};return currentY;`);
    const base={patient:'PACIENTE FICTICIO',socialWork:'JERARQUICOS SALUD',affiliateNumber:'1234567890',dni:'99999999',date:'2026-10-28',
      requester:'Profesional solicitante de prueba',reason:'Mareos, vertigos en crisis y evaluacion audiologica completa'};
    const fixtures=[
      ['informe-corto',{...base,socialWork:'',affiliateNumber:'',requester:'',reason:''}],
      ['informe-completo',base],
      ['informe-textos-largos',{...base,patient:'PACIENTE FICTICIO CON APELLIDOS EXTENSOS '.repeat(4),socialWork:'OBRA SOCIAL DE PRUEBA CON DENOMINACION EXTENSA '.repeat(3),requester:'PROFESIONAL SOLICITANTE '.repeat(5),reason:'EVALUACION CLINICA Y AUDIOLOGICA COMPLETA CON SEGUIMIENTO '.repeat(8)}],
      ['informe-sin-espacios',{...base,affiliateNumber:'1234567890'.repeat(20),reason:'MOTIVODEPRUEBA'.repeat(20)}],
    ];
    const results=[];
    async function inspect(doc,name,contentY,expected,render=false){
      const bytes=new Uint8Array(doc.output('arraybuffer'));
      const pdf=await pdfjs.getDocument({data:bytes.slice()}).promise;
      const p=await pdf.getPage(1);const text=await p.getTextContent();
      const compact=text.items.map(t=>t.str).join('').replace(/\s/g,'');
      const header=text.items.filter(t=>t.str && t.transform[5]>p.view[3]-(contentY-1)*72/25.4);
      const outOfBounds=header.filter(t=>t.transform[4]<14.5*72/25.4 || t.transform[4]+t.width>195.5*72/25.4).map(t=>({text:t.str,x:t.transform[4]*25.4/72,width:t.width*25.4/72}));
      const missing=expected.filter(v=>!compact.includes(v.replace(/\s/g,'')));
      if(name==='informe-completo' && !text.items.some(t=>t.str.includes('SOLICITANTE: '+base.requester))) {
        missing.push('SOLICITANTE and value must share a line');
      }
      let png;
      if(render){const viewport=p.getViewport({scale:1.5});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
        await p.render({canvasContext:canvas.getContext('2d'),viewport}).promise;png=canvas.toDataURL('image/png').split(',')[1];}
      results.push({name,contentY,pages:pdf.numPages,outOfBounds,missing,bytes:Array.from(bytes),png});
      await pdf.destroy();
    }
    for(const [name,data] of fixtures){
      const doc=new jsPDF();const contentY=makeReport(doc,data,{},drawWrappedCenteredText);
      doc.setFontSize(10);doc.text('CONTENIDO DEL INFORME - Audiometria y logoaudiometria',15,contentY);
      await inspect(doc,name,contentY,[data.patient,data.socialWork,data.affiliateNumber,data.dni,data.requester,data.reason].filter(Boolean),name==='informe-completo'||name==='informe-textos-largos');
    }
    for(const type of ['coat','general']){
      const data={orderType:type,name:'PACIENTE FICTICIO CON APELLIDOS EXTENSOS '.repeat(3),date:'2026-10-28',insurance:'OBRA SOCIAL DE PRUEBA CON NOMBRE EXTENSO '.repeat(3),affiliateNumber:'12345678901234567890',diagnosis:'Diagnostico de prueba con texto extenso '.repeat(6),practices:['Audiometria'],allPracticesInCategory:[{n:'Audiometria'}],observations:'Observacion de prueba'};
      const doc=await generateOrderPDF(data,{nombre:'Profesional Ficticio',especialidad:'Fonoaudiologia'},'instance');
      const p=await pdfjs.getDocument({data:new Uint8Array(doc.output('arraybuffer'))}).promise;
      const t=await(await p.getPage(1)).getTextContent();const solicit=t.items.find(t=>t.str==='Se solicita:');
      const contentY=(841.8897637795277-solicit.transform[5])*25.4/72;
      await p.destroy();
      await inspect(doc,'pedido-'+type,contentY,[data.name,data.insurance,data.affiliateNumber,data.diagnosis],type==='coat');
    }
    const legacyData={name:base.patient,insurance:'OBRA SOCIAL EXTENSA '.repeat(6),affiliateNumber:base.affiliateNumber,diagnosis:base.reason.repeat(4)};
    const legacy=new jsPDF();const legacyY=makeLegacy(legacy,legacyData,drawWrappedCenteredText);
    await inspect(legacy,'pedido-anterior',legacyY,[legacyData.name,legacyData.insurance,legacyData.diagnosis]);
    return results;
  },{reportHeader,legacyHeader});
  await mkdir('scratch/pdf_layout',{recursive:true});
  for(const result of results){
    assert.deepEqual(result.outOfBounds,[],result.name+' horizontal overflow');
    assert.deepEqual(result.missing,[],result.name+' missing text');
    if(result.name==='informe-corto')assert.equal(result.contentY,46);
    if(result.png){await writeFile(`scratch/pdf_layout/${result.name}.png`,Buffer.from(result.png,'base64'));
      await writeFile(`scratch/pdf_layout/${result.name}.pdf`,Buffer.from(result.bytes));}
    console.log(JSON.stringify({name:result.name,contentY:result.contentY,pages:result.pages,pass:true}));
  }
  assert.deepEqual(external,[]);
  console.log('PASS: text preserved within margins; short report baseline unchanged; no external requests');
} finally {await browser.close();}
