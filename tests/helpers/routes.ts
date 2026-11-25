import type { Express } from 'express';

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  name: string;
  regexp: RegExp;
  handle: { stack?: Layer[] };
}

function mountPrefix(layer: Layer): string {
  const src = layer.regexp.source;
  if (src.startsWith('^\\/?(?=')) return '';
  const match = /^\^(.*?)\\\/\?\(\?=\\\/\|\$\)$/.exec(src);
  if (!match?.[1]) throw new Error(`Cannot derive mount path from ${src}`);
  return match[1].replace(/\\\//g, '/');
}

function walk(stack: Layer[], prefix: string, out: string[]): void {
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        out.push(`${method.toUpperCase()} ${prefix}${layer.route.path}`);
      }
    } else if (layer.name === 'router' && layer.handle.stack) {
      walk(layer.handle.stack, prefix + mountPrefix(layer), out);
    }
  }
}

/** Lists "METHOD /path" for every route registered on the app, with Express-style :params. */
export function registeredRoutes(app: Express): string[] {
  const root = (app as unknown as { _router: { stack: Layer[] } })._router.stack;
  const out: string[] = [];
  walk(root, '', out);
  return out;
}
