/// <reference types="cypress" />

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function b64url(s: string) {
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fakeJwt(role: string, email: string, active = true) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: email,
      role,
      active,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  return `${header}.${payload}.fakesig`;
}

function _expiredJwt(role: string, email: string) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: email,
      role,
      active: true,
      exp: Math.floor(Date.now() / 1000) - 3600,
      iat: Math.floor(Date.now() / 1000) - 7200,
    })
  );
  return `${header}.${payload}.fakesig`;
}

function injectAdmin(win: Window) {
  win.sessionStorage.setItem('accessToken', fakeJwt('ADMIN', 'marko.petrovic@banka.rs'));
  win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
  win.sessionStorage.setItem(
    'user',
    JSON.stringify({
      id: 1,
      email: 'marko.petrovic@banka.rs',
      role: 'ADMIN',
      firstName: 'Marko',
      lastName: 'Petrovic',
      permissions: ['ADMIN'],
    })
  );
}

function injectClient(win: Window) {
  win.sessionStorage.setItem('accessToken', fakeJwt('CLIENT', 'stefan.jovanovic@gmail.com'));
  win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
  win.sessionStorage.setItem(
    'user',
    JSON.stringify({
      id: 2,
      email: 'stefan.jovanovic@gmail.com',
      role: 'CLIENT',
      firstName: 'Stefan',
      lastName: 'Jovanovic',
    })
  );
}

// ---------------------------------------------------------------------------
// Mock employee data
// ---------------------------------------------------------------------------
const mockEmployees = [
  {
    id: 10,
    firstName: 'Elena',
    lastName: 'Kalajdzic',
    username: 'elena',
    email: 'elena@banka.rs',
    position: 'Software Developer',
    phone: '+381601234567',
    active: true,
    address: 'Bulevar oslobodjenja 1, Novi Sad',
    dateOfBirth: '2002-12-05',
    gender: 'F',
    department: 'IT',
    permissions: ['TRADE_STOCKS'],
  },
  {
    id: 11,
    firstName: 'Jovan',
    lastName: 'Markovic',
    username: 'jovan',
    email: 'jovan@banka.rs',
    position: 'Project Manager',
    phone: '+381609876543',
    active: false,
    address: 'Knez Mihailova 22, Beograd',
    dateOfBirth: '1995-03-15',
    gender: 'M',
    department: 'Operations',
    permissions: ['VIEW_STOCKS'],
  },
  {
    id: 1,
    firstName: 'Marko',
    lastName: 'Petrovic',
    username: 'admin',
    email: 'marko.petrovic@banka.rs',
    position: 'Team Lead',
    phone: '+381601111111',
    active: true,
    address: 'Bulevar 3',
    dateOfBirth: '1990-01-01',
    gender: 'M',
    department: 'IT',
    permissions: ['ADMIN'],
  },
];

function mockEmployeesPage(content = mockEmployees, totalElements?: number) {
  return {
    content,
    totalElements: totalElements ?? content.length,
    totalPages: Math.ceil((totalElements ?? content.length) / 10),
    size: 10,
    number: 0,
  };
}

// After backend mapping, FE expects phoneNumber/isActive
const _mockEmployeesMapped = mockEmployees.map((e) => ({
  ...e,
  phoneNumber: e.phone,
  isActive: e.active,
}));

function singleEmployee(id: number) {
  return mockEmployees.find((e) => e.id === id) ?? mockEmployees[0];
}

// ============================================================================
// AUTH TESTS
// ============================================================================
describe('Celina 1 - Auth flows', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/auth/refresh', {
      statusCode: 200,
      body: { accessToken: 'fake' },
    });
  });

  // ---- Login page rendering ----
  it('Login page renderuje sva polja i elemente', () => {
    cy.visit('/login');

    cy.contains('BANKA 2025').should('be.visible');
    cy.contains('Prijavite se na vaš nalog').should('be.visible');
    cy.get('#email').should('be.visible');
    cy.get('#password').should('be.visible');
    cy.contains('Prijavi se').should('be.visible');
    cy.contains('Zaboravili ste lozinku?').should('be.visible');
    cy.contains('Nazad na početnu').should('be.visible');
    cy.get('img[alt*="BANKA"]').should('be.visible');
  });

  // ---- Empty form validation ----
  it('Prazna forma prikazuje validacione greske', () => {
    cy.visit('/login');

    cy.contains('Prijavi se').click();

    cy.get('#email').should('have.class', 'border-destructive');
    cy.get('#password').should('have.class', 'border-destructive');
  });

  // ---- Invalid email format ----
  it('Nevalidan email format prikazuje gresku', () => {
    cy.visit('/login');

    cy.get('#email').type('not-an-email');
    cy.get('#password').type('SomePassword1');
    cy.contains('Prijavi se').click();

    cy.get('#email').should('have.class', 'border-destructive');
  });

  // ---- Wrong password server error ----
  it('Pogresna lozinka prikazuje server gresku', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 400,
      body: { message: 'Pogresan email ili lozinka.' },
    }).as('loginFail');

    cy.visit('/login');

    cy.get('#email').type('admin@test.com');
    cy.get('#password').type('WrongPass123');
    cy.contains('Prijavi se').click();

    cy.wait('@loginFail');
    cy.contains('Pogresan email ili lozinka').should('be.visible');
  });

  // ---- Successful client login ----
  it('Uspesan CLIENT login preusmerava na /home', () => {
    const token = fakeJwt('CLIENT', 'stefan@test.com');

    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { accessToken: token, refreshToken: 'refresh-client', tokenType: 'Bearer' },
    }).as('loginClient');

    cy.visit('/login');
    cy.get('#email').type('stefan@test.com');
    cy.get('#password').type('Klijent12345');
    cy.contains('Prijavi se').click();

    cy.wait('@loginClient');
    cy.url().should('include', '/home');
  });

  // ---- Successful admin login ----
  it('Uspesan ADMIN login preusmerava na /home', () => {
    const token = fakeJwt('ADMIN', 'admin@banka.rs');

    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { accessToken: token, refreshToken: 'refresh-admin', tokenType: 'Bearer' },
    }).as('loginAdmin');

    cy.visit('/login');
    cy.get('#email').type('admin@banka.rs');
    cy.get('#password').type('Admin12345');
    cy.contains('Prijavi se').click();

    cy.wait('@loginAdmin');
    cy.url().should('include', '/home');
  });

  // ---- JWT stored in sessionStorage ----
  it('JWT token se cuva u sessionStorage posle logina', () => {
    const token = fakeJwt('ADMIN', 'admin@banka.rs');

    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { accessToken: token, refreshToken: 'my-refresh', tokenType: 'Bearer' },
    }).as('login');

    cy.visit('/login');
    cy.get('#email').type('admin@banka.rs');
    cy.get('#password').type('Admin12345');
    cy.contains('Prijavi se').click();

    cy.wait('@login');
    cy.url().should('include', '/home');

    cy.window().then((win) => {
      expect(win.sessionStorage.getItem('accessToken')).to.eq(token);
      expect(win.sessionStorage.getItem('refreshToken')).to.eq('my-refresh');
    });
  });

  // ---- Unauthorized access redirects to /login ----
  it('Neautorizovan pristup /home preusmerava na /login', () => {
    cy.visit('/home');

    cy.url().should('include', '/login');
  });

  // ---- Client accessing admin routes gets /403 ----
  it('CLIENT pristup admin rutama preusmerava na /403', () => {
    cy.visit('/admin/employees', {
      onBeforeLoad(win) {
        injectClient(win);
      },
    });

    cy.url().should('include', '/403');
    cy.contains('Nemate dozvolu za pristup').should('be.visible');
  });

  // ---- Logout clears session and redirects ----
  it('Logout brise sessionStorage i preusmerava na login', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });

    cy.visit('/home', {
      onBeforeLoad(win) {
        injectClient(win);
      },
    });

    cy.url().should('include', '/home');

    // Click logout in sidebar
    cy.contains('Odjavi se').click({ force: true });

    cy.url().should('include', '/login');

    cy.window().then((win) => {
      expect(win.sessionStorage.getItem('accessToken')).to.equal(null);
      expect(win.sessionStorage.getItem('refreshToken')).to.equal(null);
    });
  });

  // ---- Forgot password page renders ----
  it('Forgot password stranica se renderuje korektno', () => {
    cy.visit('/forgot-password');

    cy.get('#email').should('be.visible');
    cy.contains('Pošalji link za resetovanje').should('be.visible');
  });

  // ---- Forgot password submits email ----
  it('Forgot password salje email i prikazuje success', () => {
    cy.intercept('POST', '**/api/auth/password_reset/request', {
      statusCode: 200,
      body: { message: 'OK' },
    }).as('forgot');

    cy.visit('/forgot-password');

    cy.get('#email').type('user@test.com');
    cy.contains('Pošalji link za resetovanje').click();

    cy.wait('@forgot');
    cy.contains('Proverite vaš email').should('be.visible');
  });

  // ---- Reset password page with valid token ----
  it('Reset password sa validnim tokenom prikazuje formu', () => {
    cy.visit('/reset-password?token=valid-test-token');

    cy.get('#newPassword').should('be.visible');
    cy.get('#confirmPassword').should('be.visible');
    cy.contains('Postavi novu lozinku').should('be.visible');
  });

  // ---- Reset password successful submit ----
  it('Reset password uspesno menja lozinku', () => {
    cy.intercept('POST', '**/api/auth/password_reset/confirm', {
      statusCode: 200,
      body: { message: 'OK' },
    }).as('reset');

    cy.visit('/reset-password?token=valid-test-token');

    cy.get('#newPassword').type('NovaLozinka12');
    cy.get('#confirmPassword').type('NovaLozinka12');
    cy.contains('Postavi novu lozinku').click();

    cy.wait('@reset');
    cy.contains('Lozinka uspešno promenjena!').should('be.visible');
  });

  // ---- Reset password with expired token shows error ----
  it('Reset password sa isteklim tokenom prikazuje gresku', () => {
    cy.intercept('POST', '**/api/auth/password_reset/confirm', {
      statusCode: 400,
      body: { message: 'Token je istekao.' },
    }).as('resetFail');

    cy.visit('/reset-password?token=expired-token');

    cy.get('#newPassword').type('NovaLozinka12');
    cy.get('#confirmPassword').type('NovaLozinka12');
    cy.contains('Postavi novu lozinku').click();

    cy.wait('@resetFail');
    cy.get('[role="alert"]').should('be.visible');
  });

  // ---- Reset password without token ----
  it('Reset password bez tokena prikazuje nevazeci link poruku', () => {
    cy.visit('/reset-password');

    cy.contains('Nevažeći link za resetovanje lozinke').should('be.visible');
    cy.contains('Zatraži novi link').should('be.visible');
  });

  // ---- Activate account page renders ----
  it('Activate account stranica se renderuje sa tokenom', () => {
    cy.visit('/activate-account?token=activation-token');

    cy.get('#password').should('be.visible');
    cy.get('#confirmPassword').should('be.visible');
    cy.contains('Aktiviraj nalog').should('be.visible');
  });

  // ---- Activate account without token ----
  it('Activate account bez tokena prikazuje nevazeci link', () => {
    cy.visit('/activate-account');

    cy.contains('Nevažeći link za aktivaciju').should('be.visible');
  });

  // ---- Activate account sets password ----
  it('Activate account uspesno postavlja lozinku', () => {
    cy.intercept('POST', '**/api/auth-employee/activate', {
      statusCode: 200,
      body: { message: 'OK' },
    }).as('activate');

    cy.visit('/activate-account?token=activation-token');

    cy.get('#password').type('NovaLozinka12');
    cy.get('#confirmPassword').type('NovaLozinka12');
    cy.contains('Aktiviraj nalog').click();

    cy.wait('@activate');
    cy.contains('Nalog uspešno aktiviran!').should('be.visible');
  });

  // ---- Password visibility toggle ----
  it('Toggle za prikaz lozinke radi na login stranici', () => {
    cy.visit('/login');

    cy.get('#password').should('have.attr', 'type', 'password');
    cy.get('button[aria-label="Prikaži lozinku"]').click();
    cy.get('#password').should('have.attr', 'type', 'text');
    cy.get('button[aria-label="Sakrij lozinku"]').click();
    cy.get('#password').should('have.attr', 'type', 'password');
  });
});

// ============================================================================
// EMPLOYEE CRUD TESTS
// ============================================================================
describe('Celina 1 - Employee CRUD', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/auth/refresh', {
      statusCode: 200,
      body: { accessToken: 'fake' },
    });
  });

  // =========================================================================
  // Employee List
  // =========================================================================
  describe('Employee List', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/api/employees*', {
        statusCode: 200,
        body: mockEmployeesPage(),
      }).as('getEmployees');
    });

    it('Employee list stranica ucitava tabelu sa podacima', () => {
      cy.visit('/admin/employees', { onBeforeLoad: injectAdmin });

      cy.wait('@getEmployees');
      cy.contains('Upravljanje zaposlenima').should('be.visible');
      cy.contains('Elena').should('be.visible');
      cy.contains('Kalajdzic').should('be.visible');
      cy.contains('elena@banka.rs').should('be.visible');
      cy.contains('Software Developer').should('be.visible');
    });

    it('Employee list prikazuje stats kartice (ukupno, aktivni, neaktivni)', () => {
      cy.visit('/admin/employees', { onBeforeLoad: injectAdmin });

      cy.wait('@getEmployees');
      cy.contains('Ukupno').should('be.visible');
      cy.contains('Aktivni').should('be.visible');
      cy.contains('Neaktivni').should('be.visible');
    });

    it('Employee list prikazuje status badge za aktivnog i neaktivnog zaposlenog', () => {
      cy.visit('/admin/employees', { onBeforeLoad: injectAdmin });

      cy.wait('@getEmployees');
      cy.contains('Aktivan').should('exist');
      cy.contains('Neaktivan').should('exist');
    });

    it('Employee list prikazuje Admin badge za admin korisnika', () => {
      cy.visit('/admin/employees', { onBeforeLoad: injectAdmin });

      cy.wait('@getEmployees');
      cy.contains('Admin').should('exist');
      cy.contains('Zaposleni').should('exist');
    });

    it('Employee list prikazuje empty state kada nema zaposlenih', () => {
      cy.intercept('GET', '**/api/employees*', {
        statusCode: 200,
        body: mockEmployeesPage([], 0),
      }).as('emptyEmployees');

      cy.visit('/admin/employees', { onBeforeLoad: injectAdmin });

      cy.wait('@emptyEmployees');
      cy.contains('Nema pronadjenih zaposlenih').should('be.visible');
    });

    it('Employee list filtrira po imenu', () => {
      cy.visit('/admin/employees', { onBeforeLoad: injectAdmin });
      cy.wait('@getEmployees');

      // Open filters
      cy.get('button[title="Filteri"]').click();
      cy.contains('Filteri pretrage').should('be.visible');

      // Intercept filtered request
      cy.intercept('GET', '**/api/employees*firstName=Elena*', {
        statusCode: 200,
        body: mockEmployeesPage([mockEmployees[0]], 1),
      }).as('filteredByName');

      cy.get('input[placeholder="Pretraga po imenu"]').type('Elena');
      cy.wait('@filteredByName');
    });

    it('Employee list filtrira po email-u', () => {
      cy.visit('/admin/employees', { onBeforeLoad: injectAdmin });
      cy.wait('@getEmployees');

      cy.get('button[title="Filteri"]').click();

      cy.intercept('GET', '**/api/employees*email=elena*', {
        statusCode: 200,
        body: mockEmployeesPage([mockEmployees[0]], 1),
      }).as('filteredByEmail');

      cy.get('input[placeholder="Pretraga po email-u"]').type('elena');
      cy.wait('@filteredByEmail');
    });

    it('Employee list paginacija radi', () => {
      // First page with 10 items, total 15
      const page1 = Array.from({ length: 10 }, (_, i) => ({
        ...mockEmployees[0],
        id: 100 + i,
        firstName: `Emp${i}`,
        lastName: `Last${i}`,
        email: `emp${i}@banka.rs`,
      }));

      cy.intercept('GET', '**/api/employees*', {
        statusCode: 200,
        body: {
          content: page1,
          totalElements: 15,
          totalPages: 2,
          size: 10,
          number: 0,
        },
      }).as('page1');

      cy.visit('/admin/employees', { onBeforeLoad: injectAdmin });
      cy.wait('@page1');

      cy.contains('1-10 od 15').should('be.visible');

      // Intercept page 2
      const page2 = Array.from({ length: 5 }, (_, i) => ({
        ...mockEmployees[0],
        id: 200 + i,
        firstName: `Emp2_${i}`,
        lastName: `Last2_${i}`,
        email: `emp2_${i}@banka.rs`,
      }));

      cy.intercept('GET', '**/api/employees*page=1*', {
        statusCode: 200,
        body: {
          content: page2,
          totalElements: 15,
          totalPages: 2,
          size: 10,
          number: 1,
        },
      }).as('page2');

      // Click next page button (the second ChevronRight button in pagination)
      cy.get('button').filter(':has(svg)').last().click();
      cy.wait('@page2');
    });

    it('Employee list navigira na edit stranicu klikom na red', () => {
      cy.visit('/admin/employees', { onBeforeLoad: injectAdmin });
      cy.wait('@getEmployees');

      // Intercept the employee detail fetch
      cy.intercept('GET', '**/api/employees/10', {
        statusCode: 200,
        body: singleEmployee(10),
      }).as('getEmployee10');

      // Click on non-admin employee row (Elena, id=10)
      cy.contains('Elena').click();

      cy.url().should('include', '/admin/employees/10');
    });

    it('Employee list Novi zaposleni dugme navigira na create stranicu', () => {
      cy.visit('/admin/employees', { onBeforeLoad: injectAdmin });
      cy.wait('@getEmployees');

      cy.contains('Novi zaposleni').click();

      cy.url().should('include', '/admin/employees/new');
    });
  });

  // =========================================================================
  // Employee Create
  // =========================================================================
  describe('Employee Create', () => {
    beforeEach(() => {
      cy.visit('/admin/employees/new', { onBeforeLoad: injectAdmin });
      cy.contains('Kreiranje novog zaposlenog', { timeout: 10000 }).should('be.visible');
    });

    it('Create forma renderuje sve sekcije i polja', () => {
      cy.contains('Licni podaci').should('be.visible');
      cy.contains('Kontakt').should('be.visible');
      cy.contains('Posao').should('be.visible');

      cy.get('#firstName').should('be.visible');
      cy.get('#lastName').should('be.visible');
      cy.get('#dateOfBirth').should('exist');
      cy.get('#email').should('be.visible');
      cy.get('#phoneNumber').should('be.visible');
      cy.get('#address').should('be.visible');
      cy.get('#username').should('be.visible');
      cy.get('[data-cy="position-select"]').should('exist');
      cy.get('[data-cy="department-select"]').should('exist');
    });

    it('Create forma prikazuje validacione greske za prazna polja', () => {
      cy.get('[data-cy="createBtn"]').scrollIntoView().click({ force: true });

      cy.get('#firstName').should('have.class', 'border-destructive');
      cy.get('#lastName').should('have.class', 'border-destructive');
      cy.get('#email').should('have.class', 'border-destructive');
      cy.get('#phoneNumber').should('have.class', 'border-destructive');
      cy.get('#address').should('have.class', 'border-destructive');
      cy.get('#username').should('have.class', 'border-destructive');
      cy.get('[data-cy="position-select"]').should('have.class', 'border-destructive');
      cy.get('[data-cy="department-select"]').should('have.class', 'border-destructive');
    });

    it('Create forma uspesno kreira zaposlenog', () => {
      cy.intercept('POST', '**/api/employees', {
        statusCode: 201,
        body: { id: 99, message: 'Created' },
      }).as('createEmployee');

      cy.intercept('GET', '**/api/employees*', {
        statusCode: 200,
        body: mockEmployeesPage(),
      });

      // Fill all required fields
      cy.get('#firstName').type('Novi');
      cy.get('#lastName').type('Zaposleni');
      cy.get('#dateOfBirth').type('1995-05-15');
      // Gender select
      cy.contains('label', 'Pol').parent().find('button[role="combobox"]').click();
      cy.contains('[role="option"]', 'Muski').click();
      cy.get('#email').type('novi@banka.rs');
      cy.get('#phoneNumber').type('+381601112233');
      cy.get('#address').type('Nemanjina 11, Beograd');
      cy.get('#username').type('novizaposleni');
      // Position select
      cy.get('[data-cy="position-select"]').click();
      cy.contains('[role="option"]', 'Software Developer').click();
      // Department select
      cy.get('[data-cy="department-select"]').click();
      cy.contains('[role="option"]', 'IT').click();

      cy.get('[data-cy="createBtn"]').scrollIntoView().click({ force: true });

      cy.wait('@createEmployee');
      cy.url().should('include', '/admin/employees');
    });

    it('Create forma prikazuje server gresku za duplikat email', () => {
      cy.intercept('POST', '**/api/employees', {
        statusCode: 409,
        body: { message: 'Korisnik sa ovim email-om već postoji.' },
      }).as('createDuplicate');

      cy.get('#firstName').type('Test');
      cy.get('#lastName').type('Korisnik');
      cy.get('#dateOfBirth').type('1995-05-15');
      cy.contains('label', 'Pol').parent().find('button[role="combobox"]').click();
      cy.contains('[role="option"]', 'Muski').click();
      cy.get('#email').type('elena@banka.rs');
      cy.get('#phoneNumber').type('+381601112233');
      cy.get('#address').type('Adresa 1');
      cy.get('#username').type('testkorisnik');
      cy.get('[data-cy="position-select"]').click();
      cy.contains('[role="option"]', 'QA Engineer').click();
      cy.get('[data-cy="department-select"]').click();
      cy.contains('[role="option"]', 'IT').click();

      cy.get('[data-cy="createBtn"]').scrollIntoView().click({ force: true });

      cy.wait('@createDuplicate');
      cy.contains('email').should('be.visible');
    });

    it('Create forma - Otkazi dugme vraca na listu zaposlenih', () => {
      cy.intercept('GET', '**/api/employees*', {
        statusCode: 200,
        body: mockEmployeesPage(),
      });

      cy.contains('Otkazi').click();
      cy.url().should('include', '/admin/employees');
    });
  });

  // =========================================================================
  // Employee Edit
  // =========================================================================
  describe('Employee Edit', () => {
    const employeeData = singleEmployee(10);

    beforeEach(() => {
      cy.intercept('GET', '**/api/employees/10', {
        statusCode: 200,
        body: employeeData,
      }).as('getEmployee');
    });

    it('Edit stranica ucitava podatke zaposlenog u formu', () => {
      cy.visit('/admin/employees/10', { onBeforeLoad: injectAdmin });

      cy.wait('@getEmployee');

      cy.get('[data-testid="employee-edit-form"]').should('exist');
      cy.contains('Izmeni zaposlenog: Elena Kalajdzic').should('be.visible');

      cy.contains('Licni podaci').should('be.visible');
      cy.contains('Kontakt').should('be.visible');
      cy.contains('Posao').should('be.visible');
      cy.contains('Permisije').should('be.visible');

      cy.get('input#firstName').should('have.value', 'Elena');
      cy.get('input#lastName').should('have.value', 'Kalajdzic');
      cy.get('input#email').should('have.value', 'elena@banka.rs');
    });

    it('Edit stranica cuva izmene uspesno', () => {
      cy.intercept('PUT', '**/api/employees/10', {
        statusCode: 200,
        body: { ...employeeData, firstName: 'Elena Izmenjena' },
      }).as('updateEmployee');

      cy.intercept('GET', '**/api/employees*', {
        statusCode: 200,
        body: mockEmployeesPage(),
      });

      cy.visit('/admin/employees/10', { onBeforeLoad: injectAdmin });
      cy.wait('@getEmployee');

      cy.get('input#firstName').clear().type('Elena Izmenjena');

      cy.contains('Sacuvaj izmene').scrollIntoView().click({ force: true });
      cy.wait('@updateEmployee');

      cy.url().should('include', '/admin/employees');
    });

    it('Edit stranica - deaktivacija zaposlenog', () => {
      cy.intercept('PATCH', '**/api/employees/10/deactivate', {
        statusCode: 200,
        body: { message: 'Deactivated' },
      }).as('deactivate');

      cy.intercept('PUT', '**/api/employees/10', {
        statusCode: 200,
        body: { ...employeeData, active: false },
      }).as('updateEmployee');

      cy.intercept('GET', '**/api/employees*', {
        statusCode: 200,
        body: mockEmployeesPage(),
      });

      cy.visit('/admin/employees/10', { onBeforeLoad: injectAdmin });
      cy.wait('@getEmployee');

      // Find status switch and toggle it off
      cy.contains('Status zaposlenog')
        .closest('div.flex')
        .find('button[role="switch"]')
        .click();

      // Verify badge changed
      cy.contains('Neaktivan').should('be.visible');

      cy.contains('Sacuvaj izmene').scrollIntoView().click({ force: true });
      cy.wait('@deactivate');
    });

    it('Edit stranica - permisije se prikazuju i mogu se menjati', () => {
      cy.visit('/admin/employees/10', { onBeforeLoad: injectAdmin });
      cy.wait('@getEmployee');

      cy.contains('Permisije').should('be.visible');

      // TRADE_STOCKS should be checked (from mockEmployees[0])
      cy.get('#perm-TRADE_STOCKS').should('exist');

      // Toggle a permission
      cy.contains('VIEW_STOCKS').click();
    });

    it('Edit stranica - zaposleni nije pronadjen prikazuje poruku', () => {
      cy.intercept('GET', '**/api/employees/999', {
        statusCode: 404,
        body: { message: 'Not found' },
      }).as('notFound');

      cy.visit('/admin/employees/999', { onBeforeLoad: injectAdmin });
      cy.wait('@notFound');

      cy.contains('Zaposleni nije pronadjen').should('be.visible');
      cy.contains('Nazad na listu').should('be.visible');
    });

    it('Edit stranica - prikazuje loading skeleton dok se podaci ucitavaju', () => {
      cy.intercept('GET', '**/api/employees/10', (req) => {
        req.reply({
          statusCode: 200,
          body: employeeData,
          delay: 500,
        });
      }).as('getEmployeeSlow');

      cy.visit('/admin/employees/10', { onBeforeLoad: injectAdmin });

      cy.get('[data-testid="employee-edit-skeleton"]').should('exist');
      cy.wait('@getEmployeeSlow');
      cy.get('[data-testid="employee-edit-skeleton"]').should('not.exist');
    });

    it('Edit stranica - Otkazi dugme vraca na listu', () => {
      cy.intercept('GET', '**/api/employees*', {
        statusCode: 200,
        body: mockEmployeesPage(),
      });

      cy.visit('/admin/employees/10', { onBeforeLoad: injectAdmin });
      cy.wait('@getEmployee');

      cy.contains('Otkazi').scrollIntoView().click({ force: true });
      cy.url().should('include', '/admin/employees');
    });

    it('Edit stranica - Nazad na listu dugme navigira nazad', () => {
      cy.intercept('GET', '**/api/employees*', {
        statusCode: 200,
        body: mockEmployeesPage(),
      });

      cy.visit('/admin/employees/10', { onBeforeLoad: injectAdmin });
      cy.wait('@getEmployee');

      cy.contains('Nazad na listu').first().click();
      cy.url().should('include', '/admin/employees');
    });
  });
});
