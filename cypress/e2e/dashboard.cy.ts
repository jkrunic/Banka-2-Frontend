/// <reference types="cypress" />
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}


describe('Dashboard - Prikaz kartice i statistike', () => {
  const setSession = (
    win: Window,
    user: { id: number; email: string; username: string; firstName: string; lastName: string; permissions: string[] }
  ) => {
    win.sessionStorage.setItem('accessToken', _fakeJwt(user.permissions.includes('ADMIN') ? 'ADMIN' : 'CLIENT', user.email));
    win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
    win.sessionStorage.setItem('user', JSON.stringify(user));
  };

  const stubHomeRequests = () => {
    cy.intercept('GET', '**/accounts/my', { statusCode: 200, body: [] }).as('accountsMy');
    cy.intercept('GET', '**/payments*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0, size: 10, number: 0 },
    }).as('payments');
    cy.intercept('GET', '**/payment-recipients', { statusCode: 200, body: [] }).as('recipients');
    cy.intercept('GET', '**/exchange-rates', { statusCode: 200, body: [] }).as('exchangeRates');
  };

  describe('Admin korisnik', () => {
    beforeEach(() => {
      stubHomeRequests();
      cy.intercept('GET', '**/employees*', {
        statusCode: 200,
        body: {
          content: [],
          totalElements: 0,
          totalPages: 0,
          size: 10,
          number: 0,
        },
      }).as('getEmployees');

      cy.visit('/home', {
        onBeforeLoad(win) {
          setSession(win, {
            id: 1,
            email: 'admin@test.com',
            username: 'admin',
            firstName: 'Admin',
            lastName: 'User',
            permissions: ['ADMIN'],
          });
        },
      });

      cy.contains('h1', /Dobrodo/i, { timeout: 10000 }).should('contain.text', 'Admin');
    });

    it('prikazuje welcome sekciju sa imenom korisnika', () => {
      cy.contains('h1', /Dobrodo/i).should('contain.text', 'Admin');
      cy.contains('p', 'Upravljajte sistemom i pratite aktivnosti.').should('be.visible');
    });

    it('prikazuje statistiku zaposlenih', () => {
      cy.contains('Ukupno zaposlenih').should('be.visible');
      cy.contains('Aktivnih').should('be.visible');
      cy.contains('Neaktivnih').should('be.visible');
    });

    it('prikazuje admin akcije kartice', () => {
      cy.get('main').within(() => {
        cy.contains('Lista zaposlenih').should('be.visible');
        cy.contains('Novi zaposleni').should('be.visible');
        cy.contains(/Portal ra/i).should('be.visible');
        cy.contains('Portal klijenata').should('be.visible');
        cy.contains('Zahtevi za kredit').should('be.visible');
        cy.contains('Svi krediti').should('be.visible');
      });
    });

    it('prikazuje brze akcije naslov', () => {
      cy.contains('Brze admin akcije').should('be.visible');
    });

    it('admin vidi samo admin portale, nema klijentske stranice', () => {
      cy.get('aside:visible').within(() => {
        cy.contains('Employee portal').should('be.visible');

        cy.get('a[href="/employee/accounts"]').should('be.visible');
        cy.get('a[href="/employee/account-requests"]').should('be.visible');
        cy.get('a[href="/employee/cards"]').should('be.visible');
        cy.get('a[href="/employee/card-requests"]').should('be.visible');
        cy.get('a[href="/employee/clients"]').should('be.visible');
        cy.get('a[href="/employee/loan-requests"]').should('be.visible');
        cy.get('a[href="/employee/loans"]').should('be.visible');

        cy.get('a[href="/accounts"]').should('not.exist');
        cy.get('a[href="/payments/new"]').should('not.exist');
        cy.get('a[href="/payments/recipients"]').should('not.exist');
        cy.get('a[href="/transfers"]').should('not.exist');
        cy.get('a[href="/payments/history"]').should('not.exist');
        cy.get('a[href="/exchange"]').should('not.exist');
        cy.get('a[href="/cards"]').should('not.exist');
        cy.get('a[href="/loans"]').should('not.exist');
      });
    });

    it('preusmera na stranicu zaposlenih pri kliku', () => {
      cy.contains('Lista zaposlenih').click();
      cy.url().should('include', '/admin/employees');
    });

    it('preusmera na stranicu kreiranja pri kliku', () => {
      cy.contains('Novi zaposleni').click();
      cy.url().should('include', '/admin/employees/new');
    });
  });

  describe('Obicni korisnik', () => {
    beforeEach(() => {
      stubHomeRequests();

      cy.visit('/home', {
        onBeforeLoad(win) {
          setSession(win, {
            id: 2,
            email: 'user@test.com',
            username: 'user',
            firstName: 'John',
            lastName: 'Doe',
            permissions: ['VIEW_STOCKS'],
          });
        },
      });

      cy.contains('h1', /Dobrodo/i, { timeout: 10000 }).should('contain.text', 'John');
    });

    it('prikazuje welcome sekciju sa imenima korisnika', () => {
      cy.contains('h1', /Dobrodo/i).should('contain.text', 'John');
    });

    it('ne prikazuje statistiku zaposlenih', () => {
      cy.contains('Ukupno zaposlenih').should('not.exist');
      cy.contains('Aktivnih').should('not.exist');
      cy.contains('Neaktivnih').should('not.exist');
    });

    it('ne prikazuje admin kartice', () => {
      cy.contains('Brze admin akcije').should('not.exist');
      cy.contains('Lista zaposlenih').should('not.exist');
      cy.contains('Novi zaposleni').should('not.exist');
    });
  });
});
