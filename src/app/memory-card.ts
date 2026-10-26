import { t } from '../i18n';
import { cursorList } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';

/**
 * A memory fragment's card (docs/story-quests.md): a Senda's lore item, read
 * like a souls item description: its name, a short paragraph about the
 * past, and «Guardar». Solo it is modal and the run pauses (the item pick's
 * policy); in a shared run it is a strip that never pauses and never takes
 * the keyboard focus. Returns a function that removes it.
 */
export function openMemoryCard(parent: HTMLElement, name: string, text: string, shared: boolean, onClose: () => void): () => void {
  const overlay = h('div', { className: shared ? 'item-pick shared memory-card' : 'item-pick overlay memory-card' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', t('story.fragment.title'));
  const list = cursorList({ keyboard: !shared, label: t('story.fragment.title'), items: [{ label: t('story.fragment.close'), onConfirm: onClose }], onBack: onClose });
  list.element.addEventListener('mousedown', (e) => e.preventDefault());
  overlay.append(
    mdWindow({ title: t('story.fragment.title'), className: 'pick-panel memory-panel' }, [
      h('strong', { className: 'memory-name', textContent: name }),
      h('p', { className: 'memory-text', textContent: text }),
      list.element,
    ]),
  );
  parent.append(overlay);
  return () => {
    list.dispose();
    overlay.remove();
  };
}
