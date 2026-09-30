/** Keep app-owned URLs inside a static host's project directory. */
export function appUrl(value, base = import.meta.env?.BASE_URL || '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return value;
  const prefix = `/${base.replace(/^\/+|\/+$/g, '')}${base === '/' ? '' : '/'}`;
  if (prefix === '/' || value.startsWith(prefix)) return value;
  return prefix + value.slice(1);
}

/** Resolve the app's authored HTML attributes, including modal content. */
export function appMarkup(html, base = import.meta.env?.BASE_URL || '/') {
  return html.replace(/\b(href|src|data-nav)="(\/(?!\/)[^"]*)"/g,
    (_, attribute, value) => `${attribute}="${appUrl(value, base)}"`);
}
