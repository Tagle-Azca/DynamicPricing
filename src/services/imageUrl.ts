import { AppError } from '../errors/AppError';
import { IMAGE_HOST, cloudName } from '../config/imageHost';

const MAX_LENGTH = 500;
// Anything outside printable ASCII (whitespace, controls, unicode) is refused before parsing.
const UNSAFE_CHARS = /[^\x21-\x7e]/;
// Encoded dot, slash and backslash could hide path traversal from the image host.
const ENCODED_TRAVERSAL = /%(2e|2f|5c)/i;

const notAllowed = (): AppError =>
  new AppError(422, 'IMAGE_URL_NOT_ALLOWED', 'imageUrl is not an allowed image address');

/** Returns the canonical URL string when `raw` points into the configured Cloudinary cloud. */
export function assertAllowedImageUrl(raw: string): string {
  const cloud = cloudName();
  if (!cloud || raw.length > MAX_LENGTH || UNSAFE_CHARS.test(raw)) throw notAllowed();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw notAllowed();
  }
  const ok =
    url.protocol === 'https:' &&
    url.hostname === IMAGE_HOST &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    url.pathname.startsWith(`/${cloud}/image/upload/`) &&
    !ENCODED_TRAVERSAL.test(url.pathname) &&
    url.href.length <= MAX_LENGTH;
  if (!ok) throw notAllowed();
  return url.href;
}

/** undefined: leave as is; null: clear; string: validated canonical URL. */
export function resolveImageUrl(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  return assertAllowedImageUrl(value);
}
