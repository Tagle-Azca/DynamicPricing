// The only place that divides cents. It formats a server amount and never computes one.
const formatters = new Map();

function formatter(currency, compact) {
  const key = `${currency}:${compact}`;
  if (!formatters.has(key)) {
    const digits = compact ? 0 : 2;
    formatters.set(
      key,
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
    );
  }
  return formatters.get(key);
}

// formatMoney(121000) -> "$1,210.00". With { compact: true } whole amounts drop the cents.
export function formatMoney(cents, { currency = 'USD', compact = false } = {}) {
  const whole = compact && Number(cents) % 100 === 0;
  return formatter(currency, whole).format(Number(cents) / 100);
}

// Plain two-decimal figure used by the admin tables ("1200.00").
export function money(cents) {
  return (Number(cents) / 100).toFixed(2);
}
