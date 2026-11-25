import React, { useState } from 'react';
import { REPORT_PAGE_BREAK, isReportImageSource } from '../utils/reportContent';

function countModelPages(html) {
  const { body } = new DOMParser().parseFromString(html, 'text/html');
  let pages = 0;
  let hasContent = false;
  for (const node of body.childNodes) {
    if (node.nodeType === 1 && node.hasAttribute(REPORT_PAGE_BREAK)) {
      if (hasContent) pages++;
      hasContent = false;
    } else if (node.textContent.trim() || (node.nodeName === 'IMG' && isReportImageSource(node.getAttribute('src')))) {
      hasContent = true;
    }
  }
  return Math.max(1, pages + Number(hasContent));
}

const fields = [['patient', 'Datos del paciente'], ['signature', 'Firma']];

export default function ReportModelPageOptions({ html, options, onChange }) {
  const [requestedPage, setRequestedPage] = useState(1);
  const pageCount = Math.max(requestedPage, countModelPages(html), ...Object.keys(options).map(Number));

  const changeOption = (page, field, value) => {
    const next = { ...options };
    const row = { ...next[page] };
    if (value === '') delete row[field];
    else row[field] = value === 'show';
    if (Object.keys(row).length) next[page] = row;
    else delete next[page];
    onChange(next);
  };

  return (
    <fieldset className="mb-8 space-y-3 rounded-2xl border border-main p-4 text-sm">
      <legend className="px-2 font-bold">Datos del paciente y firma por página</legend>
      <p className="text-[var(--text-sub)]">
        Con la opción predeterminada, los datos aparecen en la primera hoja y la firma en la última.
      </p>
      <div className="grid gap-3">
        {Array.from({ length: pageCount }, (_, index) => {
          const page = index + 1;
          return (
            <div key={page} className="flex flex-wrap items-center gap-3 border-b border-main pb-3">
              <span className="min-w-20 font-semibold">Página {page}</span>
              {fields.map(([field, label]) => {
                const preference = options[page]?.[field];
                return (
                  <label className="flex flex-wrap items-center gap-2" key={field}>
                    {label}
                    <select className="input-field" aria-label={`${label}, página ${page}`}
                      value={preference === undefined ? '' : preference ? 'show' : 'hide'}
                      onChange={event => changeOption(page, field, event.target.value)}>
                      <option value="">Predeterminado</option>
                      <option value="show">Mostrar</option>
                      <option value="hide">Ocultar</option>
                    </select>
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => setRequestedPage(pageCount + 1)}
        className="rounded-xl border border-main px-3 py-2 font-semibold">
        Configurar otra página
      </button>
    </fieldset>
  );
}
