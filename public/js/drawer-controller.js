import { nextTrapTarget } from './focus.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open/close behavior of a modal drawer: backdrop, X and Esc close it, Tab is trapped,
// the page behind is inert and scroll-locked, and focus returns to whatever opened it.
// All DOM access goes through the injected nodes so it can be tested with plain fakes.
export function createDrawerController({
  doc,
  root,
  panel,
  backdrop,
  closeButton,
  opener,
  background,
  onOpen,
}) {
  let returnTo = null;
  const isOpen = () => root.classList.contains('open');

  function open() {
    returnTo = doc.activeElement;
    onOpen();
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    doc.body.classList.add('lock');
    for (const el of background()) el.inert = true;
    opener.setAttribute('aria-expanded', 'true');
    closeButton.focus();
  }

  function close(restore = true) {
    if (!isOpen()) return;
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');
    doc.body.classList.remove('lock');
    for (const el of background()) el.inert = false;
    opener.setAttribute('aria-expanded', 'false');
    if (restore && returnTo && returnTo.focus) returnTo.focus();
  }

  function onKeydown(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      const list = [...panel.querySelectorAll(FOCUSABLE)];
      const target = nextTrapTarget(list, doc.activeElement, e.shiftKey);
      if (target) {
        e.preventDefault();
        target.focus();
      }
    }
  }

  opener.addEventListener('click', open);
  closeButton.addEventListener('click', () => close());
  backdrop.addEventListener('click', () => close());
  doc.addEventListener('keydown', onKeydown);
  return { open, close, isOpen };
}
