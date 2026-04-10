import './commands'

// Prevent Cypress from failing tests on uncaught React/app exceptions
// (e.g. failed API calls during render, lazy-load errors, etc.)
Cypress.on('uncaught:exception', (_err, _runnable) => {
  // Return false to prevent the error from failing the test
  return false;
});

// Global: intercept auth refresh to prevent redirect loops in mock tests
beforeEach(() => {
  // Only mock auth refresh — prevents redirect loops when using fake tokens
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = btoa(JSON.stringify({ sub: 'test@test.rs', role: 'CLIENT', active: true, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  cy.intercept('POST', '**/api/auth/refresh', {
    statusCode: 200,
    body: { accessToken: `${header}.${payload}.fakesig` },
  });

  // NOTE: API catch-all mocks moved to mockCommonEndpoints() command in commands.ts.
  // Mock tests should call cy.mockCommonEndpoints() in their own beforeEach.
  // This prevents global mocks from blocking real API calls in live tests.
});

// Global: fix "fake-access-token" that doesn't have JWT structure
// Replace it with a proper decodable fake JWT in sessionStorage
Cypress.on('window:before:load', (win) => {
  const token = win.sessionStorage.getItem('accessToken');
  if (token === 'fake-access-token' || token === 'fake') {
    // Detect role from user object if stored
    const userStr = win.sessionStorage.getItem('user');
    let role = 'CLIENT';
    let email = 'test@test.com';
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        role = user.role || 'CLIENT';
        email = user.email || 'test@test.com';
      } catch { /* ignore */ }
    }

    // Create properly decodable fake JWT
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payload = btoa(JSON.stringify({
      sub: email,
      role,
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    win.sessionStorage.setItem('accessToken', `${header}.${payload}.fakesig`);
  }
});
