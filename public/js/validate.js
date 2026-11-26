import { REGION_CODES } from './regions.js';

// Pure validators for the checkout forms. Each returns { fieldName: message } (empty = valid).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL = /^[A-Za-z0-9 -]+$/;

function length(value, min, max, label) {
  const n = value.trim().length;
  if (n === 0) return `${label} is required.`;
  if (n < min) return `${label} must be at least ${min} characters.`;
  if (n > max) return `${label} must be at most ${max} characters.`;
  return '';
}

export function validateContact(v) {
  const errors = {
    email: !v.email.trim()
      ? 'Email is required.'
      : !EMAIL.test(v.email.trim()) || v.email.trim().length > 254
        ? 'Enter a valid email address.'
        : '',
    fullName: length(v.fullName, 2, 120, 'Full name'),
    street: length(v.street, 3, 200, 'Street address'),
    city: length(v.city, 2, 100, 'City'),
    postalCode:
      length(v.postalCode, 3, 12, 'Postal code') ||
      (POSTAL.test(v.postalCode.trim()) ? '' : 'Use letters, numbers, spaces or dashes only.'),
    region: REGION_CODES.includes(v.region) ? '' : 'Choose a region.',
  };
  return pick(errors);
}

// Demo payment fields: shape checks only; the values are never sent anywhere.
export function validatePayment(v, now = new Date()) {
  const digits = v.number.replace(/[\s-]/g, '');
  const exp = /^(\d{2})\s*\/\s*(\d{2})$/.exec(v.expiry.trim());
  let expiry = 'Use the format MM/YY.';
  if (exp && Number(exp[1]) >= 1 && Number(exp[1]) <= 12) {
    const year = 2000 + Number(exp[2]);
    const past =
      year < now.getFullYear() ||
      (year === now.getFullYear() && Number(exp[1]) < now.getMonth() + 1);
    expiry = past ? 'This card has expired.' : '';
  }
  return pick({
    number: /^\d{13,19}$/.test(digits) ? '' : 'Enter a valid card number (13 to 19 digits).',
    expiry,
    cvc: /^\d{3,4}$/.test(v.cvc.trim()) ? '' : 'Enter the 3 or 4 digit security code.',
    cardName: length(v.cardName, 2, 120, 'Name on card'),
  });
}

function pick(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, msg]) => msg));
}
