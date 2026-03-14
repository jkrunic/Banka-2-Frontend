/// <reference types="cypress" />

const MOCK_ACCOUNTS = [
  {
    id: 1, accountNumber: '265000000000000112', name: 'Tekuci racun - RSD',
    accountType: 'TEKUCI', status: 'ACTIVE', balance: 500000, availableBalance: 485230.5,
    reservedBalance: 14769.5, dailyLimit: 200000, monthlyLimit: 1000000,
    dailySpending: 0, monthlySpending: 15000, maintenanceFee: 250,
    currency: 'RSD', ownerName: 'Stefan Jovanovic', createdAt: '2025-01-15',
  },
  {
    id: 2, accountNumber: '265000000000000229', name: 'Devizni racun - EUR',
    accountType: 'DEVIZNI', status: 'ACTIVE', balance: 13000, availableBalance: 12500.0,
    reservedBalance: 500, dailyLimit: 50000, monthlyLimit: 200000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 3,
    currency: 'EUR', ownerName: 'Stefan Jovanovic', createdAt: '2025-02-01',
  },
  {
    id: 3, accountNumber: '265000000000000336', name: 'Poslovni racun - RSD',
    accountType: 'POSLOVNI', status: 'ACTIVE', balance: 2800000, availableBalance: 2750000.0,
    reservedBalance: 50000, dailyLimit: 5000000, monthlyLimit: 20000000,
    dailySpending: 0, monthlySpending: 100000, maintenanceFee: 1500,
    currency: 'RSD', ownerName: 'Milica Nikolic', createdAt: '2025-01-20',
  },
  {
    id: 4, accountNumber: '265000000000000443', name: 'Tekuci racun - EUR',
    accountType: 'TEKUCI', status: 'ACTIVE', balance: 3500, availableBalance: 3200.75,
    reservedBalance: 299.25, dailyLimit: 10000, monthlyLimit: 50000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 2,
    currency: 'EUR', ownerName: 'Stefan Jovanovic', createdAt: '2025-03-01',
  },
  {
    id: 5, accountNumber: '265000000000000550', name: 'Devizni racun - RSD',
    accountType: 'DEVIZNI', status: 'ACTIVE', balance: 1150000, availableBalance: 1100000.0,
    reservedBalance: 50000, dailyLimit: 500000, monthlyLimit: 2000000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 500,
    currency: 'RSD', ownerName: 'Lazar Petrovic', createdAt: '2025-01-25',
  },
  {
    id: 6, accountNumber: '265000000000000667', name: 'Poslovni racun - EUR',
    accountType: 'POSLOVNI', status: 'ACTIVE', balance: 55000, availableBalance: 54000.0,
    reservedBalance: 1000, dailyLimit: 100000, monthlyLimit: 500000,
    dailySpending: 0, monthlySpending: 5000, maintenanceFee: 10,
    currency: 'EUR', ownerName: 'Milica Nikolic', createdAt: '2025-02-10',
  },
  {
    id: 7, accountNumber: '265000000000000774', name: 'Tekuci racun - USD',
    accountType: 'TEKUCI', status: 'ACTIVE', balance: 9000, availableBalance: 8750.25,
    reservedBalance: 249.75, dailyLimit: 15000, monthlyLimit: 60000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 3,
    currency: 'USD', ownerName: 'Ana Markovic', createdAt: '2025-02-15',
  },
  {
    id: 8, accountNumber: '265000000000000881', name: 'Devizni racun - EUR',
    accountType: 'DEVIZNI', status: 'ACTIVE', balance: 26000, availableBalance: 25000.0,
    reservedBalance: 1000, dailyLimit: 50000, monthlyLimit: 200000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 5,
    currency: 'EUR', ownerName: 'Ana Markovic', createdAt: '2025-03-01',
  },
  {
    id: 9, accountNumber: '265000000000000998', name: 'Tekuci racun - RSD',
    accountType: 'TEKUCI', status: 'ACTIVE', balance: 75000, availableBalance: 72300.0,
    reservedBalance: 2700, dailyLimit: 100000, monthlyLimit: 500000,
    dailySpending: 0, monthlySpending: 10000, maintenanceFee: 250,
    currency: 'RSD', ownerName: 'Lazar Petrovic', createdAt: '2025-01-30',
  },
  {
    id: 10, accountNumber: '265000000000001008', name: 'Poslovni racun - USD',
    accountType: 'POSLOVNI', status: 'ACTIVE', balance: 125000, availableBalance: 120000.0,
    reservedBalance: 5000, dailyLimit: 200000, monthlyLimit: 1000000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 15,
    currency: 'USD', ownerName: 'Milica Nikolic', createdAt: '2025-02-20',
  },
  {
    id: 11, accountNumber: '265000000000001115', name: 'Tekuci racun - RSD',
    accountType: 'TEKUCI', status: 'INACTIVE', balance: 0, availableBalance: 0,
    reservedBalance: 0, dailyLimit: 0, monthlyLimit: 0,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 0,
    currency: 'RSD', ownerName: 'Nemanja Savic', createdAt: '2024-06-01',
  },
];

function setupClientSession(win: Cypress.AUTWindow) {
  win.sessionStorage.setItem('accessToken', 'fake-access-token');
  win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
  win.sessionStorage.setItem(
    'user',
    JSON.stringify({
      id: 2,
      email: 'user@test.com',
      username: 'user',
      firstName: 'Stefan',
      lastName: 'Jovanovic',
      permissions: ['VIEW_STOCKS'],
    })
  );
}

function interceptAccountsApi() {
  cy.intercept('GET', '**/accounts/my', {
    statusCode: 200,
    body: MOCK_ACCOUNTS,
  }).as('getAccounts');
}

describe('Accounts - Lista racuna', () => {
  beforeEach(() => {
    interceptAccountsApi();

    cy.visit('/accounts', {
      onBeforeLoad(win) {
        setupClientSession(win);
      },
    });

    cy.contains('Racuni', { timeout: 10000 }).should('be.visible');
  });

  it('prikazuje naslov stranice', () => {
    cy.contains('h1', 'Racuni').should('be.visible');
  });

  it('prikazuje tabelu sa racunima', () => {
    cy.get('table').should('be.visible');
    cy.contains('th', 'Broj racuna').should('be.visible');
    cy.contains('th', 'Naziv').should('be.visible');
    cy.contains('th', 'Tip').should('be.visible');
    cy.contains('th', 'Raspolozivo stanje').should('be.visible');
    cy.contains('th', 'Valuta').should('be.visible');
    cy.contains('th', 'Status').should('be.visible');
  });

  it('prikazuje racune u tabeli', () => {
    cy.get('table tbody tr').should('have.length.greaterThan', 0);
    cy.contains('265-').should('be.visible');
  });

  it('prikazuje badge za tip racuna', () => {
    cy.contains('Tekuci').should('be.visible');
    cy.contains('Devizni').should('be.visible');
    cy.contains('Poslovni').should('be.visible');
  });

  it('prikazuje badge za status racuna', () => {
    cy.contains('Aktivan').should('be.visible');
  });

  it('prikazuje paginaciju', () => {
    cy.contains('Redova po stranici:').should('be.visible');
    cy.contains('od').should('be.visible');
  });

  it('racuni su sortirani po stanju opadajuce', () => {
    cy.get('table tbody tr').then(($rows) => {
      const balances: number[] = [];
      $rows.each((_, row) => {
        const cells = Cypress.$(row).find('td');
        const balanceText = cells.eq(3).text().replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
        const balance = parseFloat(balanceText);
        if (!isNaN(balance)) {
          balances.push(balance);
        }
      });
      for (let i = 1; i < balances.length; i++) {
        expect(balances[i]).to.be.at.most(balances[i - 1]);
      }
    });
  });

  describe('Filter po tipu', () => {
    beforeEach(() => {
      cy.get('button[title="Filteri"]').click();
    });

    it('prikazuje filter sekciju', () => {
      cy.contains('Svi tipovi').should('be.visible');
    });

    it('filtrira po tekucem tipu', () => {
      cy.get('[role="combobox"]').first().click();
      cy.get('[role="option"]').contains('Tekuci').click();

      cy.get('table tbody tr', { timeout: 10000 }).should(($rows) => {
        expect($rows.length).to.be.greaterThan(0);
        $rows.each((_, row) => {
          expect(Cypress.$(row).text()).to.include('Tekuci');
        });
      });
    });

    it('filtrira po deviznom tipu', () => {
      cy.get('[role="combobox"]').first().click();
      cy.get('[role="option"]').contains('Devizni').click();

      cy.get('table tbody tr', { timeout: 10000 }).should(($rows) => {
        expect($rows.length).to.be.greaterThan(0);
        $rows.each((_, row) => {
          expect(Cypress.$(row).text()).to.include('Devizni');
        });
      });
    });

    it('filtrira po poslovnom tipu', () => {
      cy.get('[role="combobox"]').first().click();
      cy.get('[role="option"]').contains('Poslovni').click();

      cy.get('table tbody tr', { timeout: 10000 }).should(($rows) => {
        expect($rows.length).to.be.greaterThan(0);
        $rows.each((_, row) => {
          expect(Cypress.$(row).text()).to.include('Poslovni');
        });
      });
    });

    it('prikazuje sve tipove kada se izabere Svi tipovi', () => {
      cy.get('[role="combobox"]').first().click();
      cy.get('[role="option"]').contains('Tekuci').click();

      cy.get('[role="combobox"]').first().click();
      cy.get('[role="option"]').contains('Svi tipovi').click();

      cy.get('table tbody tr').should('have.length.greaterThan', 3);
    });
  });

  describe('Paginacija', () => {
    it('menja broj redova po stranici', () => {
      cy.contains('Redova po stranici:')
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').contains('5').click();

      cy.get('table tbody tr').should('have.length.at.most', 5);
    });

    it('navigira na sledecu stranicu', () => {
      cy.contains('Redova po stranici:')
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').contains('5').click();

      cy.get('button').filter(':has(svg.lucide-chevron-right)').click();
      cy.contains('6–').should('be.visible');
    });
  });

  describe('Formatiranje podataka', () => {
    it('stanje je formatirano u sr-RS formatu', () => {
      cy.get('table tbody tr').first().find('td').eq(3).invoke('text').should('match', /\d{1,3}(\.\d{3})*(,\d{2})/);
    });

    it('broj racuna ima ispravan format (265-...)', () => {
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).find('td').first().invoke('text').should('match', /^265-/);
      });
    });

    it('svaki racun ima prikazanu valutu', () => {
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).find('td').eq(4).invoke('text').should('match', /^(RSD|EUR|USD)$/);
      });
    });
  });

  describe('Loading i prazno stanje', () => {
    it('prikazuje spinner dok se ucitavaju podaci', () => {
      cy.intercept('GET', '**/accounts/my', {
        statusCode: 200,
        body: MOCK_ACCOUNTS,
        delay: 1000,
      }).as('getAccountsSlow');

      cy.visit('/accounts', {
        onBeforeLoad(win) {
          setupClientSession(win);
        },
      });
      cy.get('.animate-spin').should('exist');
    });

    it('prikazuje poruku greske kada API vrati gresku', () => {
      cy.intercept('GET', '**/accounts/my', {
        statusCode: 500,
        body: { message: 'Internal Server Error' },
      }).as('getAccountsError');

      cy.visit('/accounts', {
        onBeforeLoad(win) {
          setupClientSession(win);
        },
      });

      cy.contains('Greska pri ucitavanju racuna', { timeout: 10000 }).should('be.visible');
    });

    it('prikazuje poruku kada nema racuna', () => {
      cy.intercept('GET', '**/accounts/my', {
        statusCode: 200,
        body: [],
      }).as('getAccountsEmpty');

      cy.visit('/accounts', {
        onBeforeLoad(win) {
          setupClientSession(win);
        },
      });

      cy.contains('Nema pronadjenih racuna', { timeout: 10000 }).should('be.visible');
    });
  });

  describe('Paginacija - napredni testovi', () => {
    it('navigira na prethodnu stranicu', () => {
      cy.contains('Redova po stranici:')
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').contains('5').click();

      cy.get('button').filter(':has(svg.lucide-chevron-right)').click();
      cy.contains('6–').should('be.visible');

      cy.get('button').filter(':has(svg.lucide-chevron-left)').click();
      cy.contains('1–').should('be.visible');
    });

    it('dugme za prethodnu stranicu je onemoguceno na prvoj stranici', () => {
      cy.get('button').filter(':has(svg.lucide-chevron-left)').should('be.disabled');
    });

    it('prikazuje tacan opseg zapisa (npr. 1-10 od 11)', () => {
      cy.get('.text-muted-foreground').contains(/\d+–\d+ od \d+/).should('be.visible');
    });

    it('resetuje na prvu stranicu kada se promeni filter', () => {
      cy.contains('Redova po stranici:')
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').contains('5').click();

      cy.get('button').filter(':has(svg.lucide-chevron-right)').click();
      cy.contains('6–').should('be.visible');

      cy.get('button[title="Filteri"]').click();
      cy.get('[role="combobox"]').first().click();
      cy.get('[role="option"]').contains('Tekuci').click();

      cy.get('.text-muted-foreground').contains(/1–/).should('be.visible');
    });
  });

  describe('Navigacija', () => {
    it('klik na red preusmerava na detalje racuna', () => {
      cy.get('table tbody tr').first().click();
      cy.url().should('include', '/accounts/');
    });

    it('Racuni link je vidljiv u navbaru', () => {
      cy.get('header').contains('Računi').should('be.visible');
    });

    it('klik na Racuni u navbaru ostaje na listi racuna', () => {
      cy.get('header').contains('Računi').click();
      cy.url().should('include', '/accounts');
      cy.contains('h1', 'Racuni').should('be.visible');
    });

    it('redovi tabele imaju kursor pointer', () => {
      cy.get('table tbody tr').first().should('have.class', 'cursor-pointer');
    });
  });
});
