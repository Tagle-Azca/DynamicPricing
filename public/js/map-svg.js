// Loads the local world SVG safely: fetch, parse, sanitize, then import into the page.
const SVG_NS = 'http://www.w3.org/2000/svg';
const BLOCKED = 'script, foreignObject, style, use, image, a, iframe, object, embed';

function sanitize(root) {
  for (const el of root.querySelectorAll(BLOCKED)) el.remove();
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'style' || name.includes('href')) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

// Hatch pattern used for "only inactive or expired" countries (not color-only).
function hatchDefs() {
  const defs = document.createElementNS(SVG_NS, 'defs');
  const pattern = document.createElementNS(SVG_NS, 'pattern');
  pattern.setAttribute('id', 'map-hatch');
  pattern.setAttribute('width', '6');
  pattern.setAttribute('height', '6');
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('patternTransform', 'rotate(45)');
  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', '6');
  bg.setAttribute('height', '6');
  bg.setAttribute('class', 'hatch-bg');
  const line = document.createElementNS(SVG_NS, 'rect');
  line.setAttribute('width', '2.5');
  line.setAttribute('height', '6');
  line.setAttribute('class', 'hatch-line');
  pattern.append(bg, line);
  defs.append(pattern);
  return defs;
}

export async function loadWorldSvg() {
  const res = await fetch('/map/world.svg', { headers: { Accept: 'image/svg+xml' } });
  if (!res.ok) throw new Error(`Map file not available (HTTP ${res.status}).`);
  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('Map file is not valid SVG.');
  }
  sanitize(root);
  const svg = document.importNode(root, true);
  svg.prepend(hatchDefs());
  return svg;
}
