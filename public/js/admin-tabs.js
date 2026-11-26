// Admin sub-navigation: role=tablist with arrow-key support. Panels are only hidden,
// never removed, so form input and table state survive a switch.
export function initAdminTabs() {
  const tabs = [...document.querySelectorAll('.subtab')];

  function select(tab, focus) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
    if (focus) tab.focus();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (step) {
        e.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length], true);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        select(e.key === 'Home' ? tabs[0] : tabs[tabs.length - 1], true);
      }
    });
  });
  if (tabs[0]) select(tabs[0], false);
}
