import { Node } from '@tiptap/core';
import { Plugin, Selection } from '@tiptap/pm/state';
import { canSplit } from '@tiptap/pm/transform';
import { REPORT_PAGE_BREAK, isReportImageSource } from '../utils/reportContent';

export const ReportPageBreak = Node.create({
  name: 'reportPageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: `div[${REPORT_PAGE_BREAK}]`, context: 'doc/' }];
  },

  renderHTML() {
    return ['div', { [REPORT_PAGE_BREAK]: '' }];
  },

  addCommands() {
    return {
      insertReportPageBreak: () => ({ tr, dispatch, editor }) => {
        if (editor.isActive('table')) return false;
        const { $head } = tr.selection;
        let position = $head.pos;
        if ($head.depth && $head.parent.isTextblock) {
          let atStart = $head.parentOffset === 0 && $head.parent.content.size > 0;
          let atEnd = $head.parentOffset === $head.parent.content.size;
          for (let depth = 1; depth < $head.depth; depth++) {
            atStart = atStart && $head.index(depth) === 0;
            atEnd = atEnd && $head.index(depth) === $head.node(depth).childCount - 1;
          }
          if (atStart) position = $head.before(1);
          else if (atEnd) position = $head.after(1);
          else if (canSplit(tr.doc, position, $head.depth)) {
            if (dispatch) tr.split(position, $head.depth);
            position += $head.depth;
          } else return false;
        } else if ($head.depth) {
          position = $head.after(1);
        }
        if (!dispatch) return true;
        tr.insert(position, this.type.create());
        if (position + 1 === tr.doc.content.size) {
          tr.insert(position + 1, tr.doc.type.schema.nodes.paragraph.create());
        }
        tr.setSelection(Selection.near(tr.doc.resolve(position + 1), 1));
        tr.scrollIntoView();
        return true;
      }
    };
  },

  addNodeView() {
    return ({ editor, getPos }) => {
      const dom = document.createElement('div');
      dom.contentEditable = 'false';
      dom.className = 'my-5 flex items-center gap-3 border-y-2 border-dashed border-main py-2 text-xs font-semibold';
      const label = document.createElement('span');
      label.textContent = 'Salto de página';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ml-auto rounded px-2 py-1 hover:bg-[var(--bg-secondary)]';
      remove.textContent = 'Eliminar salto';
      remove.addEventListener('click', event => {
        event.stopPropagation();
        const from = getPos();
        if (typeof from === 'number') editor.chain().focus().deleteRange({ from, to: from + 1 }).run();
      });
      dom.append(label, remove);
      return { dom, stopEvent: event => remove.contains(event.target) };
    };
  }
});

export const ReportImage = Node.create({
  name: 'reportImage',
  group: 'block',
  atom: true,

  addAttributes() {
    return { src: { default: null }, alt: { default: '' } };
  },

  parseHTML() {
    return [{
      tag: 'img[src]',
      context: 'doc/',
      getAttrs: element => isReportImageSource(element.getAttribute('src')) ? null : false
    }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', { ...HTMLAttributes, class: 'max-w-full h-auto' }];
  },

  addProseMirrorPlugins() {
    const { editor } = this;
    return [new Plugin({
      props: {
        handlePaste(_view, event) {
          const image = Array.from(event.clipboardData?.files || []).find(file =>
            file.type === 'image/png' || file.type === 'image/jpeg');
          if (!image || editor.isActive('table')) return false;
          const reader = new FileReader();
          reader.onload = () => {
            if (!editor.isDestroyed && !editor.isActive('table')) {
              editor.commands.insertContent({ type: 'reportImage', attrs: { src: reader.result } });
            }
          };
          reader.readAsDataURL(image);
          return true;
        }
      }
    })];
  }
});
