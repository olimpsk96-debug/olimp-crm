/* ═══════════════════════════════════════════════════════════════════
   ОЛИМП ERP — Theme Switcher
   Управляет переключением dark/light/auto + сохраняет выбор
   ═══════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const STORAGE_KEY = 'olimp-theme';
  const DEFAULT_THEME = 'dark';

  // ─── Apply theme as early as possible (avoid flash) ───
  const savedTheme = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', savedTheme);

  // ─── Build switcher UI after DOM ready ───
  function buildSwitcher() {
    if (document.querySelector('.theme-switcher')) return;

    const switcher = document.createElement('div');
    switcher.className = 'theme-switcher';
    switcher.setAttribute('role', 'radiogroup');
    switcher.setAttribute('aria-label', 'Выбор темы');

    const themes = [
      {
        id: 'light',
        label: 'Светлая',
        icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/></svg>'
      },
      {
        id: 'auto',
        label: 'Авто (системная)',
        icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6"/><path d="M8 2a6 6 0 010 12V2z" fill="currentColor"/></svg>'
      },
      {
        id: 'dark',
        label: 'Тёмная',
        icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 9.5A6 6 0 016.5 3a6 6 0 100 12A6 6 0 0013 9.5z"/></svg>'
      }
    ];

    themes.forEach(theme => {
      const btn = document.createElement('button');
      btn.dataset.theme = theme.id;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', theme.label);
      btn.title = theme.label;
      btn.innerHTML = theme.icon;
      if (theme.id === savedTheme) btn.classList.add('active');
      btn.addEventListener('click', () => setTheme(theme.id));
      switcher.appendChild(btn);
    });

    document.body.appendChild(switcher);
  }

  // ─── Apply theme ───
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // Update active button
    document.querySelectorAll('.theme-switcher button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  // ─── Init ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildSwitcher);
  } else {
    buildSwitcher();
  }

  // ─── Expose globally for debugging ───
  window.OlimpTheme = {
    set: setTheme,
    get: () => document.documentElement.getAttribute('data-theme')
  };
})();
