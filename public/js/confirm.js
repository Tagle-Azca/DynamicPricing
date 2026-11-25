import { h } from './dom.js';

// In-page confirmation (no browser dialog). The trigger button is hidden while the
// prompt is open; Cancel restores it and returns focus to it.
export function askConfirm(trigger, message, confirmLabel, onConfirm) {
  const close = () => {
    box.remove();
    trigger.hidden = false;
  };
  const cancel = h('button', {
    type: 'button',
    class: 'btn small secondary',
    text: 'Cancel',
    onClick: () => {
      close();
      trigger.focus();
    },
  });
  const ok = h('button', {
    type: 'button',
    class: 'btn small danger',
    text: confirmLabel,
    onClick: () => {
      close();
      onConfirm();
    },
  });
  const box = h(
    'span',
    {
      class: 'confirm',
      role: 'alertdialog',
      'aria-label': message,
      onKeydown: (e) => {
        if (e.key === 'Escape') cancel.click();
      },
    },
    h('span', { class: 'confirm-text', text: message }),
    ok,
    cancel,
  );
  trigger.hidden = true;
  trigger.after(box);
  cancel.focus();
}
