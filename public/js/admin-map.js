// Admin discount map: colors countries by campaign state, tooltips, and the edit panel.
import { $, setStatus } from './dom.js';
import { request, describeError } from './api.js';
import { loadWorldSvg } from './map-svg.js';
import { indexRegions, stateOf, summaryText, globalText } from './map-data.js';
import { createTooltip } from './map-tooltip.js';
import { createPanel } from './map-panel.js';

let svg = null;
let byRegion = new Map();
let seq = 0;
let tooltip = null;
let panel = null;
let selected = null;
let onCampaignsChanged = () => {};

const countries = () => (svg ? [...svg.querySelectorAll('[data-region]')] : []);
const nameOf = (el) => el.dataset.name || el.dataset.region;

function paint() {
  for (const el of countries()) {
    const list = byRegion.get(el.dataset.region) || [];
    const state = stateOf(list);
    el.setAttribute('class', `country c-${state}${el === selected ? ' c-selected' : ''}`);
    el.setAttribute('aria-label', `${nameOf(el)}: ${summaryText(list)}. Press Enter to edit.`);
  }
}

function select(el) {
  selected = el;
  paint();
  panel.open(el.dataset.region, nameOf(el));
}

function prepare() {
  for (const el of svg.querySelectorAll('[data-region]')) {
    const title = el.querySelector('title');
    el.dataset.name = title ? title.textContent : el.dataset.region;
    if (title) title.remove();
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
  }
  const showFor = (e) => {
    const el = e.target.closest ? e.target.closest('[data-region]') : null;
    if (el) tooltip.show(nameOf(el), byRegion.get(el.dataset.region));
  };
  svg.addEventListener('mouseover', showFor);
  svg.addEventListener('focusin', showFor);
  svg.addEventListener('mouseout', () => tooltip.hide());
  svg.addEventListener('focusout', () => tooltip.hide());
  svg.addEventListener('click', (e) => {
    const el = e.target.closest('[data-region]');
    if (el) select(el);
  });
  svg.addEventListener('keydown', (e) => {
    const el = e.target.closest('[data-region]');
    if (el && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      select(el);
    }
  });
}

export async function loadMap() {
  const mine = ++seq;
  const status = $('map-status');
  setStatus(status, 'Loading map...', 'info');
  try {
    const [map, data] = await Promise.all([
      svg ? Promise.resolve(svg) : loadWorldSvg(),
      request('GET', '/admin/regions'),
    ]);
    if (mine !== seq) return; // stale response, a newer load or logout happened
    if (!svg) {
      svg = map;
      prepare();
      $('map').replaceChildren(svg);
    }
    byRegion = indexRegions(data);
    $('map-global').textContent = globalText(data.global);
    paint();
    setStatus(status, '');
  } catch (err) {
    if (mine === seq) setStatus(status, err.code ? describeError(err) : err.message, 'error');
  }
}

export const refreshMap = () => {
  if (svg) loadMap();
};

export function initMap(onChanged) {
  onCampaignsChanged = onChanged;
  tooltip = createTooltip($('map-tip'));
  panel = createPanel($('map-panel'), {
    onChanged: () => {
      loadMap();
      onCampaignsChanged();
    },
    onClose: () => {
      const el = selected;
      selected = null;
      paint();
      if (el) el.focus();
    },
  });
}

export function clearMap() {
  seq++;
  svg = null;
  selected = null;
  byRegion = new Map();
  if (panel) panel.clear();
  if (tooltip) tooltip.hide();
  $('map').replaceChildren();
  $('map-global').textContent = '';
  setStatus($('map-status'), '');
}
