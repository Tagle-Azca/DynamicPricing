export const IMAGE_HOST = 'res.cloudinary.com';

const CLOUD_NAME = /^[A-Za-z0-9_-]{1,64}$/;

/** Configured Cloudinary cloud name, or undefined (fail closed) when unset or malformed. */
export function cloudName(source: NodeJS.ProcessEnv = process.env): string | undefined {
  const value = source.CLOUDINARY_CLOUD_NAME?.trim();
  return value && CLOUD_NAME.test(value) ? value : undefined;
}
