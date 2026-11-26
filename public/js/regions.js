// Fixed region list for checkout (2-letter codes sent as context.region).
export const REGIONS = [
  ['AR', 'Argentina'],
  ['AU', 'Australia'],
  ['CL', 'Chile'],
  ['CN', 'China'],
  ['HK', 'Hong Kong'],
  ['MX', 'Mexico'],
  ['SG', 'Singapore'],
  ['US', 'United States'],
];

export const REGION_CODES = REGIONS.map(([code]) => code);
