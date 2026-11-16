import { $, setBusy, setStatus } from './dom.js';
import { request, setToken, describeError } from './api.js';

// Handles login/register/logout. onLogin(user) receives the /auth/me principal.
export function initAuth({ onLogin, onLogout }) {
  const form = $('auth-form');
  const status = $('auth-status');
  const buttons = [$('login-btn'), $('register-btn')];

  const busy = (value) => buttons.forEach((b) => setBusy(b, value));

  function credentials() {
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;
    if (!email || !password) {
      setStatus(status, 'Enter your email and password.', 'error');
      return null;
    }
    return { email, password };
  }

  async function login(creds) {
    const data = await request('POST', '/auth/login', creds);
    setToken(data.accessToken);
    const me = await request('GET', '/auth/me');
    $('auth-password').value = '';
    setStatus(status, '');
    onLogin({ id: me.sub, role: me.role, email: data.user.email });
  }

  async function run(action) {
    const creds = credentials();
    if (!creds) return;
    busy(true);
    setStatus(status, action === 'register' ? 'Creating account...' : 'Signing in...', 'info');
    try {
      if (action === 'register') await request('POST', '/auth/register', creds);
      await login(creds);
    } catch (err) {
      setToken(null);
      setStatus(status, describeError(err), 'error');
    } finally {
      busy(false);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    run('login');
  });
  $('register-btn').addEventListener('click', () => run('register'));
  $('logout').addEventListener('click', () => {
    setToken(null);
    onLogout();
  });

  return {
    sessionLost(err) {
      onLogout();
      setStatus(status, `Session ended (${err.code}). Please log in again.`, 'error');
    },
  };
}
