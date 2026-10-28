# Paginación de informes: validación local

Fecha: 28/10/2026.

## Causa confirmada

En `src/pages/ReportsPage.jsx`, el texto se dibujaba hasta `pageHeight - 25`, pero la firma se comprobaba recién después de terminar el contenido: tras sumar 10 mm, cualquier inicio posterior a `pageHeight - 65` provocaba `addPage()`. No había reserva para el bloque profesional ni posibilidad de trasladar contenido final. En A4, esto permitía texto hasta aproximadamente 272 mm y rechazaba la firma desde aproximadamente 232 mm, independientemente de su altura real. Las tablas tampoco reservaban explícitamente el pie. El pie institucional se dibujaba únicamente en la última página.

## Ajuste localizado

El único archivo de aplicación modificado es `src/pages/ReportsPage.jsx`. Se conservan jsPDF, AutoTable, los textos, tamaños, alineaciones, membretes, recorte y escala originales de la firma y reglas de selección del profesional/modelo.

La imagen se prepara una vez, antes de paginar, para medir su altura real junto con la línea y todos los datos profesionales. El mismo renderizador existente mide el cuerpo en un documento temporal y después dibuja el documento final. Primero intenta la separación original; si hace falta, reduce únicamente la separación anterior a la firma de 10 a 4 mm. Si no alcanza, reserva espacio en el bloque final (párrafo o tabla y encabezados inmediatamente anteriores). Los párrafos de tamaño normal se conservan enteros; los mayores que una página se dividen con un mínimo de dos líneas junto al corte. Las tablas conservan filas enteras cuando su altura lo permite, repiten su cabecera y respetan el área del pie. Una fila físicamente mayor que el área útil sigue necesitando división por AutoTable.

Los párrafos vacíos finales del editor no generan espacio adicional. Los informes cortos de una página conservan la posición institucional anterior de la firma. En continuaciones, la firma sigue al contenido final. El pie mantiene su texto, aspecto y coordenadas en cada página.

## Pruebas y resultados

- `scratch/test_report_pagination.mjs`: **92 casos aprobados**, ejecutando el código real del generador extraído de ReportsPage en Edge y leyendo/renderizando los PDF con PDF.js. Barrido de 1 a 70 párrafos; tablas de 1 a 65 filas; conclusiones; filas con mucho texto; párrafos mayores que una página; fuentes personalizadas de 14, 20 y 30 puntos; firma ancha; ausencia de firma o matrícula; administración; membretes general y de fibroscopía.
- Se verifica conservación del texto visible frente al generador anterior (521c90d) (descontando repeticiones de cabeceras de tabla y pies), datos de todas las filas, firma completa en la última página, separación respecto del contenido, ausencia de página final solo con firma, encabezados de conclusión/tabla acompañados y límites respecto del pie.
- Regresión reproducida: 24 y 25 párrafos pasan de dos páginas a una; 26 párrafos mantienen dos páginas con el cierre acompañando la firma. La firma ancha también pasa de dos páginas a una usando su altura real. Los documentos realmente extensos conservan varias páginas, incluido un caso de ocho páginas.
- `scratch/test_pdf_header_layout.mjs`: **7 casos aprobados**, incluidos pedidos COAT, generales y el generador anterior. El informe corto mantiene el inicio del cuerpo en 46 mm.
- `npm.cmd run build`: aprobado. `git -c core.whitespace=cr-at-eol diff --check -- src/pages/ReportsPage.jsx`: aprobado.
- Revisión visual de los PDF renderizados: caso de una página, cierre trasladado, conclusión, tabla extensa, encabezado de tabla y ambas páginas del membrete de fibroscopía.

Resultados por caso: `scratch/pdf_pagination/results.json`. PDF y PNG sintéticos representativos: `scratch/pdf_pagination/`. Registro de compilación: `scratch/pdf_pagination/build.log`.

Las pruebas bloquean todas las solicitudes fuera de `http://127.0.0.1:5178`, usan datos y firma ficticios y omiten deliberadamente las acciones de historial, pacientes, guardado y envío. No verifican interacciones autenticadas completas, impresión física ni todos los modelos almacenados en la base: verifican las variantes del generador común sin consultar producción.

## Repetición y estado local

Con Vite ejecutándose en el puerto 5178:

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/Emmanuel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
node scratch/test_report_pagination.mjs
node scratch/test_pdf_header_layout.mjs
npm.cmd run build
```

También se puede usar Playwright instalado localmente, omitiendo la variable. `CASE_FILTER` permite ejecutar una selección por expresión regular y guarda sus resultados aparte, en `targeted-results.json`.

Aplicación local disponible en http://127.0.0.1:5178/. La validación se realizó sin publicar en Cloudflare, Firebase ni otro destino; la publicación posterior requiere autorización independiente. La caché Firebase y los archivos de validaciones anteriores ya tenían cambios al comenzar y no forman parte del ajuste.

**Pendiente:** el PDF mencionado como adjunto no estuvo accesible en esta conversación. La regresión sintética reproduce y corrige el fallo, pero todavía debe verificarse ese archivo concreto cuando se facilite.
