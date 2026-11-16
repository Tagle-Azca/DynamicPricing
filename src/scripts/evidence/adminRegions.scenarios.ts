import { Harness, dig } from './harness';
import { loginAs, run } from './admin.helpers';

const A = '/api/v1/admin';

function regionsOf(body: unknown): unknown {
  return dig(body, 'data', 'conditions', 'regions');
}

export async function runAdminRegionScenarios(h: Harness): Promise<void> {
  const admin = await loginAs(h, 'evidence.regions@example.com', 'admin');

  await run(h, {
    name: 'Admin adds region MX to CNY-EVIDENCE and lists regions',
    method: 'PUT',
    path: `${A}/campaigns/CNY-EVIDENCE/regions/mx`,
    token: admin.token,
    status: 200,
    expected: '200 with regions ["CN","MX"] (lowercase input uppercased)',
    verify: (b) => JSON.stringify(regionsOf(b)) === '["CN","MX"]',
  });
  await run(h, {
    name: 'Admin lists campaigns grouped by region',
    method: 'GET',
    path: `${A}/regions`,
    token: admin.token,
    status: 200,
    expected: '200 with regions[] and global[]',
    verify: (b) =>
      Array.isArray(dig(b, 'data', 'regions')) && Array.isArray(dig(b, 'data', 'global')),
  });
  await run(h, {
    name: 'Admin removes MX, then the last region CN is protected',
    method: 'DELETE',
    path: `${A}/campaigns/CNY-EVIDENCE/regions/MX`,
    token: admin.token,
    status: 200,
    expected: '200 with regions ["CN"]',
    verify: (b) => JSON.stringify(regionsOf(b)) === '["CN"]',
  });
  await run(h, {
    name: 'Admin cannot remove the last region (409 LAST_REGION)',
    method: 'DELETE',
    path: `${A}/campaigns/CNY-EVIDENCE/regions/CN`,
    token: admin.token,
    status: 409,
    expected: '409 LAST_REGION',
    verify: (b) => dig(b, 'error', 'code') === 'LAST_REGION',
  });
}
