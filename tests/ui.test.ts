import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp } from './helpers/app';

const app = buildApp();

describe('static UI', () => {
  it('serves index.html at / with a CSP that has no unsafe-eval', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    const csp = String(res.headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
  });

  it('serves the JavaScript and CSS assets', async () => {
    const js = await request(app).get('/js/main.js');
    expect(js.status).toBe(200);
    expect(js.headers['content-type']).toMatch(/javascript/);
    expect((await request(app).get('/styles.css')).status).toBe(200);
  });

  it('keeps the JSON 404 for unknown API paths and /health', async () => {
    const miss = await request(app).get('/api/v1/nope');
    expect(miss.status).toBe(404);
    expect(miss.headers['content-type']).toContain('application/json');
    expect((await request(app).get('/health')).body.data).toBeDefined();
  });
});
