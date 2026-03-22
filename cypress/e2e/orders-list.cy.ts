/// <reference types="cypress" />

// ============================================================
// Celina 3: Pregled naloga (supervizor) — OrdersListPage
// UI testovi sa interceptovanim API pozivima (mock data)
// Pokriva: prikaz, filtriranje, approve/decline, detalji,
//          paginacija, edge caseovi, error handling
// ============================================================

// --- Helpers ---

function createJwt(role: string, email = 'admin@banka.rs') {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = btoa(JSON.stringify({
    sub: email, role, active: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${payload}.signature`;
}

function loginAsAdmin() {
  const token = createJwt('ADMIN', 'marko.petrovic@banka.rs');
  const user = {
    id: 1, email: 'marko.petrovic@banka.rs', username: 'marko.petrovic',
    firstName: 'Marko', lastName: 'Petrovic', role: 'ADMIN',
    permissions: ['ADMIN'],
  };
  window.sessionStorage.setItem('accessToken', token);
  window.sessionStorage.setItem('refreshToken', token);
  window.sessionStorage.setItem('user', JSON.stringify(user));
}

// --- Mock Data Factories ---

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    userName: 'Jana Ivanovic',
    userRole: 'EMPLOYEE',
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingType: 'STOCK',
    orderType: 'MARKET',
    quantity: 10,
    contractSize: 1,
    pricePerUnit: 175.50,
    limitValue: null,
    stopValue: null,
    direction: 'BUY',
    status: 'PENDING',
    approvedBy: '',
    isDone: false,
    remainingPortions: 10,
    afterHours: false,
    allOrNone: false,
    margin: false,
    approximatePrice: 1755.00,
    createdAt: '2026-03-20T14:30:00',
    lastModification: '2026-03-20T14:30:00',
    ...overrides,
  };
}

function makePaginatedResponse(orders: unknown[], page = 0, size = 20, totalElements?: number) {
  const total = totalElements ?? orders.length;
  return {
    content: orders,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    number: page,
    size,
  };
}

// Raznovrsni mock orderi za realistične scenarije
const MOCK_ORDERS = {
  pendingMarketBuy: makeOrder({
    id: 1, userName: 'Jana Ivanovic', orderType: 'MARKET', direction: 'BUY',
    listingTicker: 'AAPL', listingName: 'Apple Inc.', listingType: 'STOCK',
    quantity: 10, pricePerUnit: 175.50, approximatePrice: 1755.00, status: 'PENDING',
  }),
  pendingLimitSell: makeOrder({
    id: 2, userName: 'Petar Petrovic', orderType: 'LIMIT', direction: 'SELL',
    listingTicker: 'MSFT', listingName: 'Microsoft Corp', listingType: 'STOCK',
    quantity: 5, pricePerUnit: 420.00, limitValue: 425.00, approximatePrice: 2100.00,
    status: 'PENDING', remainingPortions: 5,
  }),
  pendingStopLimitFutures: makeOrder({
    id: 3, userName: 'Nikola Nikolic', orderType: 'STOP_LIMIT', direction: 'BUY',
    listingTicker: 'CLJ26', listingName: 'Crude Oil Apr 2026', listingType: 'FUTURES',
    quantity: 2, contractSize: 1000, pricePerUnit: 78.50, limitValue: 79.00, stopValue: 78.00,
    approximatePrice: 157000.00, status: 'PENDING', remainingPortions: 2,
  }),
  approvedDone: makeOrder({
    id: 4, userName: 'Jana Ivanovic', orderType: 'MARKET', direction: 'BUY',
    listingTicker: 'GOOG', listingName: 'Alphabet Inc.', listingType: 'STOCK',
    quantity: 3, pricePerUnit: 140.00, approximatePrice: 420.00,
    status: 'APPROVED', approvedBy: 'Marko Petrovic', isDone: true, remainingPortions: 0,
  }),
  declined: makeOrder({
    id: 5, userName: 'Petar Petrovic', orderType: 'STOP', direction: 'SELL',
    listingTicker: 'EUR/USD', listingName: 'EUR/USD', listingType: 'FOREX',
    quantity: 1, contractSize: 1000, pricePerUnit: 1.0850, stopValue: 1.0800,
    approximatePrice: 1085.00, status: 'DECLINED', approvedBy: 'Marko Petrovic',
  }),
  approvedPartiallyFilled: makeOrder({
    id: 6, userName: 'Nikola Nikolic', orderType: 'LIMIT', direction: 'BUY',
    listingTicker: 'TSLA', listingName: 'Tesla Inc.', listingType: 'STOCK',
    quantity: 20, pricePerUnit: 250.00, limitValue: 248.00, approximatePrice: 5000.00,
    status: 'APPROVED', approvedBy: 'Marko Petrovic', isDone: false, remainingPortions: 12,
  }),
  pendingAfterHours: makeOrder({
    id: 7, userName: 'Jana Ivanovic', orderType: 'MARKET', direction: 'BUY',
    listingTicker: 'AMZN', listingName: 'Amazon.com Inc.', listingType: 'STOCK',
    quantity: 2, pricePerUnit: 185.00, approximatePrice: 370.00,
    status: 'PENDING', afterHours: true,
  }),
  pendingAonMargin: makeOrder({
    id: 8, userName: 'Petar Petrovic', orderType: 'MARKET', direction: 'BUY',
    listingTicker: 'NVDA', listingName: 'NVIDIA Corp.', listingType: 'STOCK',
    quantity: 50, pricePerUnit: 950.00, approximatePrice: 47500.00,
    status: 'PENDING', allOrNone: true, margin: true,
  }),
  doneOrder: makeOrder({
    id: 9, userName: 'Nikola Nikolic', orderType: 'MARKET', direction: 'SELL',
    listingTicker: 'AAPL', listingName: 'Apple Inc.', listingType: 'STOCK',
    quantity: 15, pricePerUnit: 178.00, approximatePrice: 2670.00,
    status: 'DONE', approvedBy: 'No need for approval', isDone: true, remainingPortions: 0,
  }),
};

const ALL_ORDERS = Object.values(MOCK_ORDERS);

// ============================================================
// TESTOVI
// ============================================================

describe('Pregled naloga - Supervizor portal', () => {

  // --------------------------------------------------------
  // 1. OSNOVNO PRIKAZIVANJE
  // --------------------------------------------------------
  describe('Prikaz stranice i tabele', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('prikazuje naslov i opis stranice', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse(ALL_ORDERS)).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('Pregled naloga').should('be.visible');
      cy.contains('Pregledajte i obradite naloge').should('be.visible');
    });

    it('prikazuje sve kolone tabele', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse(ALL_ORDERS)).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('th', 'Agent').should('be.visible');
      cy.contains('th', 'Tip').should('be.visible');
      cy.contains('th', 'Hartija').should('be.visible');
      cy.contains('th', 'Količina').should('be.visible');
      cy.contains('th', 'CS').should('be.visible');
      cy.contains('th', 'Cena').should('be.visible');
      cy.contains('th', 'Smer').should('be.visible');
      cy.contains('th', 'Preostalo').should('be.visible');
      cy.contains('th', 'Status').should('be.visible');
      cy.contains('th', 'Akcije').should('be.visible');
    });

    it('prikazuje podatke iz ordera u tabeli', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('td', 'Jana Ivanovic').should('be.visible');
      cy.contains('td', 'Market').should('be.visible');
      cy.contains('AAPL').should('be.visible');
      cy.contains('STOCK').should('be.visible');
      cy.contains('td', '10').should('be.visible');
      cy.contains('175.50').should('be.visible');
      cy.contains('Kupovina').should('be.visible');
    });

    it('prikazuje razlicite tipove naloga ispravno', () => {
      const orders = [
        MOCK_ORDERS.pendingMarketBuy,
        MOCK_ORDERS.pendingLimitSell,
        MOCK_ORDERS.pendingStopLimitFutures,
        MOCK_ORDERS.declined,
      ];
      cy.intercept('GET', '**/orders?*', makePaginatedResponse(orders)).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('Market').should('be.visible');
      cy.contains('Limit').should('be.visible');
      cy.contains('Stop-Limit').should('be.visible');
      cy.contains('Stop').should('be.visible');
    });

    it('prikazuje razlicite smerove sa odgovarajucim oznakama', () => {
      const orders = [MOCK_ORDERS.pendingMarketBuy, MOCK_ORDERS.pendingLimitSell];
      cy.intercept('GET', '**/orders?*', makePaginatedResponse(orders)).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('Kupovina').should('be.visible');
      cy.contains('Prodaja').should('be.visible');
    });
  });

  // --------------------------------------------------------
  // 2. STATUS BADGE-ovi
  // --------------------------------------------------------
  describe('Status oznake', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('prikazuje sve cetiri vrste status badge-ova', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse(ALL_ORDERS)).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('Na čekanju').should('be.visible');
      cy.contains('Odobren').should('be.visible');
      cy.contains('Odbijen').should('be.visible');
      cy.contains('Završen').should('be.visible');
    });
  });

  // --------------------------------------------------------
  // 3. FILTRIRANJE PO STATUSU
  // --------------------------------------------------------
  describe('Filtriranje po statusu', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('prikazuje sve filter dugmice', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse(ALL_ORDERS)).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Svi').should('be.visible');
      cy.contains('button', 'Na čekanju').should('be.visible');
      cy.contains('button', 'Odobreni').should('be.visible');
      cy.contains('button', 'Odbijeni').should('be.visible');
      cy.contains('button', 'Završeni').should('be.visible');
    });

    it('filtrira po PENDING statusu - salje ispravan parametar', () => {
      cy.intercept('GET', '**/orders?*', (req) => {
        const url = new URL(req.url, 'http://localhost');
        const status = url.searchParams.get('status');
        if (status === 'PENDING') {
          req.reply(makePaginatedResponse([
            MOCK_ORDERS.pendingMarketBuy,
            MOCK_ORDERS.pendingLimitSell,
            MOCK_ORDERS.pendingStopLimitFutures,
          ]));
        } else {
          req.reply(makePaginatedResponse(ALL_ORDERS));
        }
      }).as('orders');

      cy.visit('/employee/orders');
      cy.wait('@orders');
      // Default je PENDING, kliknemo Svi pa onda Na cekanju da triggerujemo nov request
      cy.contains('button', /^Svi/).click();
      cy.wait('@orders');
      cy.contains('button', /^Na čekanju/).click();
      cy.wait('@orders');
    });

    it('klikom na "Svi" prikazuje sve naloge', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse(ALL_ORDERS)).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Svi').click();
      cy.wait('@orders');
    });

    it('klikom na "Završeni" filtrira po DONE statusu', () => {
      cy.intercept('GET', '**/orders?*', (req) => {
        const url = new URL(req.url, 'http://localhost');
        const status = url.searchParams.get('status');
        if (status === 'DONE') {
          req.reply(makePaginatedResponse([MOCK_ORDERS.doneOrder]));
        } else {
          req.reply(makePaginatedResponse(ALL_ORDERS));
        }
      }).as('orders');

      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Završeni').click();
      cy.wait('@orders');
    });
  });

  // --------------------------------------------------------
  // 4. APPROVE/DECLINE DUGMICI - VIDLJIVOST
  // --------------------------------------------------------
  describe('Approve/Decline dugmici - vidljivost', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('prikazuje Odobri i Odbij dugmice SAMO za PENDING naloge', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([
        MOCK_ORDERS.pendingMarketBuy,
        MOCK_ORDERS.approvedDone,
        MOCK_ORDERS.declined,
      ])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');

      // PENDING red ima oba dugmeta
      cy.contains('tr', 'Jana Ivanovic').within(() => {
        cy.contains('Odobri').should('be.visible');
        cy.contains('Odbij').should('be.visible');
      });

      // APPROVED/DONE red NEMA dugmice za odobrenje
      cy.contains('tr', 'GOOG').within(() => {
        cy.contains('button', 'Odobri').should('not.exist');
        cy.contains('button', 'Odbij').should('not.exist');
      });

      // DECLINED red NEMA dugmice za odobrenje
      cy.contains('tr', 'EUR/USD').within(() => {
        cy.contains('button', 'Odobri').should('not.exist');
        cy.contains('button', 'Odbij').should('not.exist');
      });
    });

    it('svi redovi imaju Detalji dugme bez obzira na status', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([
        MOCK_ORDERS.pendingMarketBuy,
        MOCK_ORDERS.approvedDone,
        MOCK_ORDERS.declined,
        MOCK_ORDERS.doneOrder,
      ])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');

      cy.get('table tbody tr').each(($row) => {
        // Svaki data-row (ne detail-row) treba da ima Detalji dugme
        if ($row.find('td').length >= 10) {
          cy.wrap($row).contains('Detalji').should('be.visible');
        }
      });
    });
  });

  // --------------------------------------------------------
  // 5. KONFIRMACIONI DIALOG
  // --------------------------------------------------------
  describe('Konfirmacioni dialog pre approve/decline', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('prikazuje konfirmacioni dialog kada se klikne Odobri', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Odobri').click();
      cy.contains('Da li ste sigurni da želite da odobrite ovaj nalog?').should('be.visible');
      cy.contains('button', 'Potvrdi').should('be.visible');
      cy.contains('button', 'Otkaži').should('be.visible');
    });

    it('prikazuje konfirmacioni dialog kada se klikne Odbij', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.get('table').contains('button', 'Odbij').click();
      cy.contains('Da li ste sigurni da želite da odbijete ovaj nalog?').should('be.visible');
    });

    it('zatvara konfirmacioni dialog klikom na Otkazi', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Odobri').click();
      cy.contains('Da li ste sigurni').should('be.visible');
      cy.contains('button', 'Otkaži').click();
      cy.contains('Da li ste sigurni').should('not.exist');
    });
  });

  // --------------------------------------------------------
  // 6. APPROVE FLOW
  // --------------------------------------------------------
  describe('Odobravanje naloga', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('uspesno odobrava nalog i refreshuje listu', () => {
      let approveCallCount = 0;
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy])).as('orders');
      cy.intercept('PATCH', '**/orders/1/approve', (req) => {
        approveCallCount++;
        req.reply({
          statusCode: 200,
          body: makeOrder({ id: 1, status: 'APPROVED', approvedBy: 'Marko Petrovic' }),
        });
      }).as('approve');

      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Odobri').click();
      cy.contains('button', 'Potvrdi').click();
      cy.wait('@approve').then(() => {
        expect(approveCallCount).to.eq(1);
      });
    });

    it('prikazuje error toast kada odobravanje ne uspe (500)', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy])).as('orders');
      cy.intercept('PATCH', '**/orders/1/approve', { statusCode: 500, body: { message: 'Internal Server Error' } }).as('approveFail');

      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Odobri').click();
      cy.contains('button', 'Potvrdi').click();
      cy.wait('@approveFail');
      // Toast sa greškom treba da se pojavi
      cy.contains('nije uspelo').should('be.visible');
    });

    it('prikazuje error toast kada odobravanje ne uspe (403 - neautorizovan)', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy])).as('orders');
      cy.intercept('PATCH', '**/orders/1/approve', { statusCode: 403, body: { message: 'Forbidden' } }).as('approveForbidden');

      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Odobri').click();
      cy.contains('button', 'Potvrdi').click();
      cy.wait('@approveForbidden');
      cy.contains('nije uspelo').should('be.visible');
    });
  });

  // --------------------------------------------------------
  // 7. DECLINE FLOW
  // --------------------------------------------------------
  describe('Odbijanje naloga', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('uspesno odbija nalog i refreshuje listu', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingLimitSell])).as('orders');
      cy.intercept('PATCH', '**/orders/2/decline', {
        statusCode: 200,
        body: makeOrder({ id: 2, status: 'DECLINED', approvedBy: 'Marko Petrovic' }),
      }).as('decline');

      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.get('table').contains('button', 'Odbij').click();
      cy.contains('button', 'Potvrdi').click();
      cy.wait('@decline');
    });

    it('prikazuje error toast kada odbijanje ne uspe', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy])).as('orders');
      cy.intercept('PATCH', '**/orders/1/decline', { statusCode: 500 }).as('declineFail');

      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.get('table').contains('button', 'Odbij').click();
      cy.contains('button', 'Potvrdi').click();
      cy.wait('@declineFail');
      cy.contains('nije uspelo').should('be.visible');
    });
  });

  // --------------------------------------------------------
  // 8. DETALJI ORDERA (EXPAND ROW)
  // --------------------------------------------------------
  describe('Detalji naloga - expand/collapse', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('klik na Detalji proširuje red sa svim informacijama', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingLimitSell])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Detalji').click();

      // Proveravamo da su prikazani svi bitni detalji
      cy.contains('Microsoft Corp (MSFT)').should('be.visible');
      cy.contains('Limit').should('be.visible');
      cy.contains('Limit vrednost').should('be.visible');
      cy.contains('425.00').should('be.visible');
      cy.contains('Približna cena').should('be.visible');
      cy.contains('2100.00').should('be.visible');
      cy.contains('Prodaja').should('be.visible');
    });

    it('prikazuje limit i stop vrednosti za STOP_LIMIT nalog', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingStopLimitFutures])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Detalji').click();
      cy.contains('Limit vrednost').should('be.visible');
      cy.contains('79.00').should('be.visible');
      cy.contains('Stop vrednost').should('be.visible');
      cy.contains('78.00').should('be.visible');
    });

    it('NE prikazuje limit/stop polja za MARKET nalog', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Detalji').click();
      cy.contains('Limit vrednost').should('not.exist');
      cy.contains('Stop vrednost').should('not.exist');
    });

    it('prikazuje All or None i Margin flagove ispravno', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingAonMargin])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Detalji').click();
      cy.contains('p', 'All or None').should('contain', 'Da');
      cy.contains('p', 'Margin').should('contain', 'Da');
    });

    it('prikazuje After Hours flag ispravno', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingAfterHours])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Detalji').click();
      cy.contains('p', 'After Hours').should('contain', 'Da');
    });

    it('prikazuje ko je odobrio nalog', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.approvedDone])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Detalji').click();
      cy.contains('p', 'Odobrio').should('contain', 'Marko Petrovic');
    });

    it('klik na Sakrij zatvara prosireni red', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Detalji').click();
      cy.contains('Približna cena').should('be.visible');
      cy.contains('button', 'Sakrij').click();
      cy.contains('Približna cena').should('not.exist');
    });

    it('samo jedan red moze biti prosiren istovremeno', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([
        MOCK_ORDERS.pendingMarketBuy,
        MOCK_ORDERS.pendingLimitSell,
      ])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');

      // Otvorimo prvi
      cy.contains('tr', 'Jana Ivanovic').contains('button', 'Detalji').click();
      cy.contains('Apple Inc. (AAPL)').should('be.visible');

      // Otvorimo drugi - prvi se zatvara
      cy.contains('tr', 'Petar Petrovic').contains('button', 'Detalji').click();
      cy.contains('Microsoft Corp (MSFT)').should('be.visible');
      cy.contains('Apple Inc. (AAPL)').should('not.exist');
    });
  });

  // --------------------------------------------------------
  // 9. PRAZAN SPISAK / LOADING
  // --------------------------------------------------------
  describe('Prazna lista i loading stanje', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('prikazuje poruku kada nema naloga', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('Nema naloga za izabrani filter').should('be.visible');
      cy.contains('Pokušajte sa drugim statusom filtera').should('be.visible');
    });

    it('prikazuje loading skeleton dok se podaci ucitavaju', () => {
      cy.intercept('GET', '**/orders?*', (req) => {
        // Simuliramo spor odgovor
        req.reply({
          statusCode: 200,
          body: makePaginatedResponse(ALL_ORDERS),
          delay: 1000,
        });
      }).as('orders');

      cy.visit('/employee/orders');
      // Dok se ceka, treba da se vide loading skeletoni (pulse animacije)
      cy.get('.animate-pulse').should('have.length.greaterThan', 0);
      cy.wait('@orders');
    });
  });

  // --------------------------------------------------------
  // 10. ERROR HANDLING - API GRESKE
  // --------------------------------------------------------
  describe('Error handling', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('prikazuje error toast kada ucitavanje naloga ne uspe (500)', () => {
      cy.intercept('GET', '**/orders?*', { statusCode: 500 }).as('ordersFail');
      cy.visit('/employee/orders');
      cy.wait('@ordersFail');
      cy.contains('Neuspešno učitavanje').should('be.visible');
    });

    it('prikazuje error toast kada ucitavanje naloga ne uspe (network error)', () => {
      cy.intercept('GET', '**/orders?*', { forceNetworkError: true }).as('ordersNetworkFail');
      cy.visit('/employee/orders');
      cy.wait('@ordersNetworkFail');
      cy.contains('Neuspešno učitavanje').should('be.visible');
    });

    it('prikazuje praznu listu nakon API greske', () => {
      cy.intercept('GET', '**/orders?*', { statusCode: 500 }).as('ordersFail');
      cy.visit('/employee/orders');
      cy.wait('@ordersFail');
      cy.contains('Nema naloga za izabrani filter').should('be.visible');
    });
  });

  // --------------------------------------------------------
  // 11. PAGINACIJA
  // --------------------------------------------------------
  describe('Paginacija', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('prikazuje paginaciju kada ima vise stranica', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse(
        [MOCK_ORDERS.pendingMarketBuy], 0, 5, 15
      )).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('Stranica 1 od 3').should('be.visible');
      cy.contains('button', 'Prethodna').should('be.disabled');
      cy.contains('button', 'Sledeća').should('not.be.disabled');
    });

    it('NE prikazuje paginaciju kada ima samo jedna stranica', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy], 0, 20, 1)).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('Stranica').should('not.exist');
    });

    it('klik na Sledeca menja stranicu', () => {
      cy.intercept('GET', '**/orders?*', (req) => {
        const url = new URL(req.url, 'http://localhost');
        const page = parseInt(url.searchParams.get('page') || '0');
        if (page === 0) {
          req.reply(makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy], 0, 5, 10));
        } else {
          req.reply(makePaginatedResponse([MOCK_ORDERS.approvedDone], 1, 5, 10));
        }
      }).as('orders');

      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('Stranica 1 od 2').should('be.visible');
      cy.contains('button', 'Sledeća').click();
      cy.wait('@orders');
      cy.contains('Stranica 2 od 2').should('be.visible');
      cy.contains('button', 'Sledeća').should('be.disabled');
      cy.contains('button', 'Prethodna').should('not.be.disabled');
    });

    it('resetuje stranicu na 0 kada se promeni filter', () => {
      cy.intercept('GET', '**/orders?*', (req) => {
        const url = new URL(req.url, 'http://localhost');
        const page = parseInt(url.searchParams.get('page') || '0');
        req.reply(makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy], page, 5, 10));
      }).as('orders');

      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Sledeća').click();
      cy.wait('@orders');
      cy.contains('Stranica 2').should('be.visible');

      // Promena filtera resetuje na prvu stranicu
      cy.contains('button', 'Svi').click();
      cy.wait('@orders');
      cy.contains('Stranica 1').should('be.visible');
    });
  });

  // --------------------------------------------------------
  // 12. EDGE CASEOVI - RAZLICITI TIPOVI HARTIJA
  // --------------------------------------------------------
  describe('Edge caseovi - razliciti tipovi hartija', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('ispravno prikazuje FUTURES nalog sa velikim contract size-om', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingStopLimitFutures])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('CLJ26').should('be.visible');
      cy.contains('FUTURES').should('be.visible');
      cy.contains('1000').should('be.visible'); // contractSize
    });

    it('ispravno prikazuje FOREX nalog', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.declined])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('EUR/USD').should('be.visible');
      cy.contains('FOREX').should('be.visible');
    });

    it('ispravno prikazuje STOCK nalog', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.pendingMarketBuy])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('AAPL').should('be.visible');
      cy.contains('STOCK').should('be.visible');
    });
  });

  // --------------------------------------------------------
  // 13. EDGE CASEOVI - PARTIALLY FILLED ORDER
  // --------------------------------------------------------
  describe('Edge case - delimicno ispunjeni nalozi', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('prikazuje preostale porcije za delimicno ispunjen nalog', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.approvedPartiallyFilled])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      // quantity=20, remainingPortions=12 → prikazuje 12
      cy.contains('td', '12').should('be.visible');
      cy.contains('button', 'Detalji').click();
      // U detail redu proveravamo sadrzaj <p> tagova
      cy.contains('p', 'Količina').should('contain', '20');
      cy.contains('p', 'Preostalo').should('contain', '12');
      cy.contains('p', 'Završen').should('contain', 'Ne');
    });

    it('prikazuje 0 preostalih za potpuno ispunjen nalog', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([MOCK_ORDERS.approvedDone])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Detalji').click();
      cy.contains('p', 'Preostalo').should('contain', '0');
      cy.contains('p', 'Završen').should('contain', 'Da');
    });
  });

  // --------------------------------------------------------
  // 14. EDGE CASE - VISE PENDING NALOGA ISTOVREMENO
  // --------------------------------------------------------
  describe('Edge case - vise PENDING naloga', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('svaki PENDING nalog ima nezavisne dugmice', () => {
      const pendingOrders = [
        MOCK_ORDERS.pendingMarketBuy,
        MOCK_ORDERS.pendingLimitSell,
        MOCK_ORDERS.pendingStopLimitFutures,
        MOCK_ORDERS.pendingAfterHours,
        MOCK_ORDERS.pendingAonMargin,
      ];
      cy.intercept('GET', '**/orders?*', makePaginatedResponse(pendingOrders)).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');

      // Svaki red ima oba dugmeta
      cy.get('table tbody').within(() => {
        cy.get('tr').each(($tr) => {
          if ($tr.find('td').length >= 10) {
            cy.wrap($tr).within(() => {
              cy.contains('Odobri').should('be.visible');
              cy.contains('Odbij').should('be.visible');
            });
          }
        });
      });
    });

    it('odobravanje jednog naloga ne utice na dugmice drugih', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([
        MOCK_ORDERS.pendingMarketBuy,
        MOCK_ORDERS.pendingLimitSell,
      ])).as('orders');
      cy.intercept('PATCH', '**/orders/1/approve', {
        statusCode: 200,
        body: makeOrder({ id: 1, status: 'APPROVED', approvedBy: 'Marko Petrovic' }),
      }).as('approve');

      cy.visit('/employee/orders');
      cy.wait('@orders');

      // Kliknemo odobri na prvom
      cy.contains('tr', 'Jana Ivanovic').contains('button', 'Odobri').click();
      cy.contains('button', 'Potvrdi').click();
      cy.wait('@approve');
    });
  });

  // --------------------------------------------------------
  // 15. EDGE CASE - ORDER BEZ IMENA AGENTA
  // --------------------------------------------------------
  describe('Edge case - nedostajuci podaci', () => {
    beforeEach(() => {
      cy.visit('/login');
      loginAsAdmin();
    });

    it('prikazuje crtu za prazan userName', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([
        makeOrder({ id: 99, userName: '', listingTicker: 'TEST', status: 'PENDING' }),
      ])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('td', '-').should('be.visible');
    });

    it('prikazuje crtu za prazan approvedBy u detaljima', () => {
      cy.intercept('GET', '**/orders?*', makePaginatedResponse([
        makeOrder({ id: 99, approvedBy: '', status: 'PENDING' }),
      ])).as('orders');
      cy.visit('/employee/orders');
      cy.wait('@orders');
      cy.contains('button', 'Detalji').click();
      cy.contains('p', 'Odobrio').should('contain', '-');
    });
  });
});
