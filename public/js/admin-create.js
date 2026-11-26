// "+ New ..." buttons open their form; Cancel or a successful create (both call
// form.reset()) collapse it again.
export function initCreateToggles() {
  for (const button of document.querySelectorAll('[data-create-toggle]')) {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    const form = panel.querySelector('form');
    const set = (open) => {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    };
    button.addEventListener('click', () => {
      set(panel.hidden);
      if (!panel.hidden) form.querySelector('input').focus();
    });
    form.addEventListener('reset', () => {
      set(false);
      button.focus();
    });
  }
}
