import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const source = await readFile('src/pages/ReportsPage.jsx', 'utf8');
const before = execFileSync('git', ['show', '521c90d:src/pages/ReportsPage.jsx'], {encoding:'utf8'});
const extract = raw => { const s=raw.replace(/\r\n/g,'\n'); return s.slice(s.indexOf('    const doc = new jsPDF({ compress: true });'), s.indexOf("    if (mode === 'print') {\n      const pdfUrl")); };
const crop = source.slice(source.indexOf('const cropSignatureCanvas ='), source.indexOf('import { AUDIT_ACTIONS'));
const browser = await chromium.launch({ channel:'msedge', headless:true });
const context = await browser.newContext();
const page = await context.newPage();
page.on('console', msg => { if(msg.text().startsWith('CASE:')) console.log(msg.text()); });
page.setDefaultTimeout(30000);
const external = [];
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin !== 'http://127.0.0.1:5178') {external.push(url.origin);return route.abort();}
  if (url.pathname === '/__pagination') return route.fulfill({contentType:'text/html',body:'<html><body>Pruebas sintéticas locales</body></html>'});
  if (url.pathname === '/@vite/client') return route.fulfill({contentType:'application/javascript',body:'export const injectQuery=url=>url; export const createHotContext=()=>({accept(){},dispose(){},on(){},data:{}});'});
  return route.continue();
});
try {
  await page.goto('http://127.0.0.1:5178/__pagination');
  const results = await page.evaluate(async ({after,before,crop,filter}) => {
    console.log('CASE: imports');
    const {jsPDF} = await import('/node_modules/.vite/deps/jspdf.js');
    const {default:autoTable} = await import('/node_modules/.vite/deps/jspdf-autotable.js');
    const {drawWrappedCenteredText} = await import('/src/utils/pdfTextLayout.js');
    const {formatDoctorDisplayName} = await import('/src/utils/doctorName.js');
    const pdfjs = await import('/node_modules/pdfjs-dist/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='/node_modules/pdfjs-dist/build/pdf.worker.mjs';
    // Preload the logo to avoid jsPDF's synchronous XHR in this routed test page.
    const logo = await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src='/coat_logo.png';});
    const instrument = code => code.replace('const doc = new jsPDF({ compress: true });', `const doc = new jsPDF({ compress: true });
      doc.__images=[]; const originalAddImage=doc.addImage.bind(doc);
      doc.addImage=(...args)=>{if(typeof args[0]==='string'&&args[0].startsWith('data:'))doc.__images.push({page:doc.getNumberOfPages(),y:args[3],h:args[5]});return originalAddImage(...args);};`);
    const make = raw => { const code=instrument(raw); return new Function('jsPDF','autoTable','drawWrappedCenteredText','formatDoctorDisplayName','reportData','professional','selectedPractice',
      `return (async()=>{const selectedDelegate=null;const content='';${crop}\n${code.replace("const logoUrl = \"/coat_logo.png\";",'const logoUrl = professional.__logo;')}\nreturn doc;})()`); };
    const generate = make(after), legacy = make(before);
    const canvas=document.createElement('canvas');canvas.width=180;canvas.height=90;
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,180,90);
    ctx.strokeStyle='black';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(12,75);ctx.bezierCurveTo(70,5,15,5,155,75);ctx.stroke();
    const professional={nombre:'Profesional Ficticio',especialidad:'ORL',mp:'00000',me:'00000',signatureBase64:canvas.toDataURL(),__logo:logo};
    const wide=document.createElement('canvas');wide.width=500;wide.height=60;
    const wideCtx=wide.getContext('2d');wideCtx.strokeStyle='black';wideCtx.lineWidth=3;wideCtx.beginPath();wideCtx.moveTo(5,50);wideCtx.bezierCurveTo(150,5,250,5,490,50);wideCtx.stroke();
    const base={patient:'PACIENTE FICTICIO',date:'2026-10-28',includeTitle:true,socialWork:'OBRA SOCIAL DE PRUEBA',dni:'99999999'};
    const paragraph=i=>`<p>P${i}: Texto sintético para verificar la distribución del informe y conservar su contenido.</p>`;
    const table=n=>`<table><thead><tr><th>Identificador</th><th>Resultado de prueba</th></tr></thead><tbody>${Array.from({length:n},(_,i)=>`<tr><td>R${i}</td><td>Valor sintético ${i}</td></tr>`).join('')}</tbody></table>`;
    const fixtures=[];
    for(let n=1;n<=70;n++) fixtures.push({name:`parrafos-${n}`,html:Array.from({length:n},(_,i)=>paragraph(i)).join('')});
    for(const n of [1,5,15,20,25,40,65]) fixtures.push({name:`tabla-${n}`,html:table(n)});
    fixtures.push(
      {name:'conclusion',html:Array.from({length:27},(_,i)=>paragraph(i)).join('')+'<h2>CONCLUSIÓN DE PRUEBA</h2><p>CIERRE coherente del informe sintético. '.repeat(1)+'Texto final preservado para verificar la firma.</p>'},
      {name:'parrafo-extenso',html:'<p>'+Array.from({length:800},(_,i)=>`Palabra${i}`).join(' ')+'</p>'},
      {name:'encabezado-tabla',html:Array.from({length:27},(_,i)=>paragraph(i)).join('')+'<h2>TABLA FINAL</h2>'+table(10)},
      {name:'saltos-finales',html:Array.from({length:25},(_,i)=>paragraph(i)).join('')+'<p><br></p>'.repeat(30)},
      {name:'tipografia',html:'<p style="font-size: 14pt">Texto de prueba amplio. '.repeat(1)+'Lectura de prueba. '.repeat(250)+'</p>'},
      {name:'sin-firma',html:Array.from({length:31},(_,i)=>paragraph(i)).join(''),prof:{...professional,signatureBase64:null}},
      {name:'administracion',html:Array.from({length:32},(_,i)=>paragraph(i)).join(''),prof:{...professional,role:'admin'}},
      {name:'tabla-fila-larga',html:Array.from({length:25},(_,i)=>paragraph(i)).join('')+'<h2>TABLA FINAL</h2>'+table(2).replace('Valor sintético 0','Valor sintético 0 '+ 'Contenido de celda con varias líneas. '.repeat(40))},
      {name:'conclusion-extensa',html:Array.from({length:25},(_,i)=>paragraph(i)).join('')+'<h2>CONCLUSIÓN DE PRUEBA</h2><p>CIERRE '+ 'Texto final coherente. '.repeat(35)+'</p>'},
      ...[20,30].map(size=>({name:'tipografia-'+size,html:'<p style="font-size: '+size+'pt">Texto final coherente. '.repeat(1)+'Lectura de prueba. '.repeat(250)+'</p>'})),
      {name:'firma-ancha',html:Array.from({length:26},(_,i)=>paragraph(i)).join(''),prof:{...professional,signatureBase64:wide.toDataURL()}},
      {name:'sin-matricula',html:Array.from({length:26},(_,i)=>paragraph(i)).join(''),prof:{...professional,mp:'',me:''}},
      {name:'membrete-general',html:Array.from({length:26},(_,i)=>paragraph(i)).join(''),prof:{...professional,hasLetterhead:true,headerGeneral:['MEMBRETE DE PRUEBA','Línea dos','Línea tres','Línea cuatro','Cinco','Seis','Siete','Ocho']}},
      {name:'membrete-fibro',html:Array.from({length:26},(_,i)=>paragraph(i)).join(''),practice:'Rinofaringolaringofibroscopia',prof:{...professional,hasLetterhead:true,headerFibro:['MEMBRETE FIBRO','Prueba','Línea tres','Línea cuatro']}}
    );
    const results=[];
    for(const fixture of fixtures.filter(f=>!filter||new RegExp(filter).test(f.name))){
      console.log('CASE: '+fixture.name);
      const args=[jsPDF,autoTable,drawWrappedCenteredText,formatDoctorDisplayName,{...base,enableHeader:true,result:fixture.html},fixture.prof||professional,fixture.practice||'MODELO DE PRUEBA'];
      const doc=await generate(...args);
      const original=await legacy(...args);
      const bytes=new Uint8Array(doc.output('arraybuffer'));
      const pdf=await pdfjs.getDocument({data:bytes.slice()}).promise;
      const texts=[], errors=[];
      const bodyStrings=[];
      for(let i=1;i<=pdf.numPages;i++){
        const p=await pdf.getPage(i),text=await p.getTextContent();
        const items=text.items.filter(t=>t.str.trim());
        const body=items.filter(t=>(/^(P\d+:|R\d+$|Valor sint|Palabra\d|CIERRE|Texto final|Texto de prueba|Lectura de prueba)/.test(t.str) || (i>1&&!/^(DR\.|DRA\.|MP:|PROFESIONAL FICTICIO|OTORRINOLARINGOLOG|Urquiza 401|Email:|TABLA FINAL|CONCLUSIÓN|Identificador|Resultado de prueba)/i.test(t.str))));
        const stamp=items.filter(t=>/^(DR\.|DRA\.|PROFESIONAL FICTICIO|OTORRINOLARINGOLOG|MP:)/i.test(t.str));
        const y=t=>(p.view[3]-t.transform[5])*25.4/72;
        if(!items.some(t=>t.str.startsWith('Urquiza 401'))||!items.some(t=>t.str.includes('info@coat.com.ar')))errors.push(`footer missing page ${i}`);
        if(body.some(t=>y(t)>273))errors.push(`body touches footer page ${i}`);
        if(stamp.some(t=>y(t)>274))errors.push(`stamp touches footer page ${i}`);
        if(i===pdf.numPages && !body.length)errors.push('signature orphan');
        if(i!==pdf.numPages && stamp.length)errors.push('split stamp');
        if(items.some(t=>t.str==='TABLA FINAL')&&!items.some(t=>t.str==='R0'))errors.push('table heading orphan');
        if(items.some(t=>t.str==='CONCLUSIÓN DE PRUEBA')&&!body.length)errors.push('conclusion heading orphan');
        for(const row of items.filter(t=>/^R\d+$/.test(t.str))){const id=row.str.slice(1);if(!items.some(t=>t.str.includes('Valor sintético '+id)))errors.push('table row split '+id);}
        const images=doc.__images.filter(img=>img.page===i);
        for(const img of images){
          if(i!==pdf.numPages||img.y+img.h>274)errors.push('signature image split/overflow');
          if(body.length&&img.y<Math.max(...body.map(y))+2)errors.push('signature overlaps content');
          if(i>1&&body.length&&img.y-Math.max(...body.map(y))>35)errors.push('signature too far from closing content');
        }
        bodyStrings.push(items.filter(t=>!t.str.startsWith('Urquiza 401')&&!t.str.startsWith('Email:')&&!['Identificador','Resultado de prueba'].includes(t.str)).map(t=>t.str).join(''));
        texts.push(items.map(t=>t.str).join(' '));
      }
      // Compare every visible clinical token with the pre-change generator, including tables.
      const oldPdf=await pdfjs.getDocument({data:new Uint8Array(original.output('arraybuffer'))}).promise;
      let oldText='',oldAll='';for(let i=1;i<=oldPdf.numPages;i++){
        const items=(await(await oldPdf.getPage(i)).getTextContent()).items;
        oldText+=' '+items.map(t=>t.str).join(' ');
        oldAll+=items.filter(t=>!t.str.startsWith('Urquiza 401')&&!t.str.startsWith('Email:')&&!['Identificador','Resultado de prueba'].includes(t.str)).map(t=>t.str).join('');
      }
      const actualText=bodyStrings.join('').replace(/\s/g,''),expectedText=oldAll.replace(/\s/g,'');
      if(actualText!==expectedText){let j=0;while(j<actualText.length&&actualText[j]===expectedText[j])j++;errors.push('visible text changed '+JSON.stringify({actual:actualText.slice(j,j+100),expected:expectedText.slice(j,j+100)}));}
      const clinical=text=>text.match(/P\d+:|R\d+\b|Palabra\d+\b|Valor sintético \d+/g)||[];
      if(JSON.stringify(clinical(texts.join(' ')))!==JSON.stringify(clinical(oldText))) errors.push('clinical tokens changed');
      const result={name:fixture.name,pages:pdf.numPages,before:oldPdf.numPages,errors};
      if(['parrafos-25','parrafos-26','conclusion','tabla-65','encabezado-tabla','membrete-fibro'].includes(fixture.name)){
        result.pdf=Array.from(bytes);result.pngs=[];
        for(let i=1;i<=pdf.numPages;i++) {const p=await pdf.getPage(i),viewport=p.getViewport({scale:1.15}),c=document.createElement('canvas');c.width=viewport.width;c.height=viewport.height;
          await p.render({canvasContext:c.getContext('2d'),viewport}).promise;result.pngs.push(c.toDataURL().split(',')[1]);}
      }
      results.push(result);await oldPdf.destroy();await pdf.destroy();
    }
    return results;
  },{after:extract(source),before:extract(before),crop,filter:process.env.CASE_FILTER||''});
  await mkdir('scratch/pdf_pagination',{recursive:true});
  for(const r of results){
    if(r.pdf) {await writeFile(`scratch/pdf_pagination/${r.name}.pdf`,Buffer.from(r.pdf));for(const [i,png] of r.pngs.entries())await writeFile(`scratch/pdf_pagination/${r.name}-${i+1}.png`,Buffer.from(png,'base64'));}
    delete r.pdf;delete r.pngs;
  }
  await writeFile(process.env.CASE_FILTER?'scratch/pdf_pagination/targeted-results.json':'scratch/pdf_pagination/results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
  assert.deepEqual(results.filter(r=>r.errors.length),[]);
  assert(results.some(r=>r.before===2&&r.pages===1),'must reproduce and fix a signature-only extra page');
  assert.deepEqual(external,[]);
  console.log(`PASS: ${results.length} cases, no external requests`);
} finally {await browser.close();}
