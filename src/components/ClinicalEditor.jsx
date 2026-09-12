import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Mark, mergeAttributes } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Table as TableIcon,
  Plus,
  Trash2,
  Columns,
  Rows,
  Split,
  Undo,
  Redo,
  RemoveFormatting,
  Type
} from 'lucide-react';

const FontSize = Mark.create({
  name: 'fontSize',

  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: element => element.style.fontSize || null,
        renderHTML: attributes => {
          if (!attributes.size) {
            return {};
          }
          return {
            style: `font-size: ${attributes.size}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[style*=font-size]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

const ClinicalEditor = ({
  value = '',
  onChange,
  placeholder = 'Escriba aquí los resultados u observaciones...',
  className = '',
  minHeight = '320px'
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      FontSize,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'clinical-table'
        }
      }),
      TableRow,
      TableHeader,
      TableCell
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: `focus:outline-none p-4 min-h-[${minHeight}] text-[var(--text-main)] font-normal text-sm leading-relaxed`,
        style: `min-height: ${minHeight};`
      }
    }
  });

  // Sincronizar contenido si cambia externamente (ej: al elegir otra plantilla)
  useEffect(() => {
    if (editor && value !== undefined) {
      const currentHTML = editor.getHTML();
      if (value !== currentHTML) {
        editor.commands.setContent(value || '', false);
      }
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const isTableActive = editor.isActive('table');

  const addTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 2, withHeaderRow: true })
      .run();
  };

  const btnClass = (isActive) =>
    `p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm'
        : 'hover:bg-[var(--bg-secondary)] text-[var(--text-main)] opacity-70 hover:opacity-100'
    }`;

  const actionBtnClass =
    'px-2 py-1 rounded-md text-xs font-semibold bg-[var(--bg-secondary)] text-[var(--text-main)] hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1 border border-main shadow-xs';

  return (
    <div className={`clinical-editor-container border border-main rounded-2xl overflow-hidden bg-[var(--bg-card)] ${className}`}>
      {/* Barra de Herramientas Principal */}
      <div className="border-b border-main bg-[var(--bg-secondary)]/50 p-2 flex flex-wrap items-center gap-1 select-none">
        {/* Encabezados */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-main">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={btnClass(editor.isActive('heading', { level: 1 }))}
            title="Título 1"
          >
            <Heading1 size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={btnClass(editor.isActive('heading', { level: 2 }))}
            title="Título 2"
          >
            <Heading2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={btnClass(editor.isActive('heading', { level: 3 }))}
            title="Título 3"
          >
            <Heading3 size={16} />
          </button>
        </div>

        {/* Selector de Tamaño de Letra (7 a 18 pt) */}
        <div className="flex items-center gap-1 px-2 border-r border-main">
          <Type size={14} className="opacity-50" />
          <select
            className="px-1.5 py-1 rounded-md text-xs font-bold bg-[var(--bg-secondary)] text-[var(--text-main)] border border-main outline-none cursor-pointer hover:border-blue-500 transition-colors"
            value={editor.getAttributes('fontSize')?.size?.replace('pt', '') || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                editor.chain().focus().unsetMark('fontSize').run();
              } else {
                editor.chain().focus().setMark('fontSize', { size: `${val}pt` }).run();
              }
            }}
            title="Tamaño de letra"
          >
            <option value="">Tam.</option>
            {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 24].map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>
        </div>

        {/* Formatos de Texto */}
        <div className="flex items-center gap-0.5 px-2 border-r border-main">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={btnClass(editor.isActive('bold'))}
            title="Negrita (Ctrl+B)"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={btnClass(editor.isActive('italic'))}
            title="Cursiva (Ctrl+I)"
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={btnClass(editor.isActive('underline'))}
            title="Subrayado (Ctrl+U)"
          >
            <UnderlineIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={btnClass(editor.isActive('strike'))}
            title="Tachado"
          >
            <Strikethrough size={16} />
          </button>
        </div>

        {/* Alineación */}
        <div className="flex items-center gap-0.5 px-2 border-r border-main">
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={btnClass(editor.isActive({ textAlign: 'left' }))}
            title="Alinear a la izquierda"
          >
            <AlignLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={btnClass(editor.isActive({ textAlign: 'center' }))}
            title="Centrar"
          >
            <AlignCenter size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={btnClass(editor.isActive({ textAlign: 'right' }))}
            title="Alinear a la derecha"
          >
            <AlignRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={btnClass(editor.isActive({ textAlign: 'justify' }))}
            title="Justificar"
          >
            <AlignJustify size={16} />
          </button>
        </div>

        {/* Listas */}
        <div className="flex items-center gap-0.5 px-2 border-r border-main">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={btnClass(editor.isActive('bulletList'))}
            title="Lista con viñetas"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={btnClass(editor.isActive('orderedList'))}
            title="Lista numerada"
          >
            <ListOrdered size={16} />
          </button>
        </div>

        {/* Insertar Tabla */}
        <div className="flex items-center gap-1 px-2 border-r border-main">
          <button
            type="button"
            onClick={addTable}
            className={`${btnClass(isTableActive)} gap-1.5 px-2 font-bold`}
            title="Insertar Tabla clínica (2 columnas)"
          >
            <TableIcon size={16} />
            <span className="text-xs">Insertar Tabla</span>
          </button>
        </div>

        {/* Historial y Limpieza */}
        <div className="flex items-center gap-0.5 pl-2 ml-auto">
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            className={btnClass(false)}
            title="Limpiar formato"
          >
            <RemoveFormatting size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className={`${btnClass(false)} disabled:opacity-30`}
            title="Deshacer (Ctrl+Z)"
          >
            <Undo size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className={`${btnClass(false)} disabled:opacity-30`}
            title="Rehacer (Ctrl+Y)"
          >
            <Redo size={16} />
          </button>
        </div>
      </div>

      {/* Barra de Gestión de Tablas (Activa únicamente cuando el cursor está dentro de una tabla) */}
      {isTableActive && (
        <div className="bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/60 p-2 flex flex-wrap items-center gap-1.5 text-xs animate-in fade-in duration-200">
          <span className="font-bold text-blue-700 dark:text-blue-300 mr-1 flex items-center gap-1">
            <TableIcon size={14} /> Tabla:
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowBefore().run()}
              className={actionBtnClass}
              title="Insertar fila arriba"
            >
              <Plus size={13} /> Fila arriba
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className={actionBtnClass}
              title="Insertar fila abajo"
            >
              <Plus size={13} /> Fila abajo
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              className={`${actionBtnClass} text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white`}
              title="Eliminar fila actual"
            >
              <Trash2 size={13} /> Fila
            </button>
          </div>

          <div className="h-4 w-px bg-blue-300 dark:bg-blue-800 mx-1" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              className={actionBtnClass}
              title="Insertar columna a la izquierda"
            >
              <Plus size={13} /> Col izq
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className={actionBtnClass}
              title="Insertar columna a la derecha"
            >
              <Plus size={13} /> Col der
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className={`${actionBtnClass} text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white`}
              title="Eliminar columna actual"
            >
              <Trash2 size={13} /> Columna
            </button>
          </div>

          <div className="h-4 w-px bg-blue-300 dark:bg-blue-800 mx-1" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => editor.chain().focus().mergeOrSplit().run()}
              className={actionBtnClass}
              title="Combinar o dividir celdas seleccionadas"
            >
              <Split size={13} /> Combinar / Dividir
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 hover:bg-red-600 hover:text-white transition-all flex items-center gap-1 border border-red-200 dark:border-red-900"
              title="Eliminar tabla completa"
            >
              <Trash2 size={13} /> Eliminar Tabla
            </button>
          </div>
        </div>
      )}

      {/* Área de Edición */}
      <div className="bg-[var(--bg-page)]/40 cursor-text min-h-[300px]" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default ClinicalEditor;
