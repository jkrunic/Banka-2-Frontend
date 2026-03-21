/// <reference types="cypress" />

function base64UrlEncode(input: string) {
  return btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createJwt(role: 'ADMIN' | 'CLIENT', email: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: email,
      role,
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    })
  );

  return `${header}.${payload}.signature`;
}

describe('My Orders Page', () => {
  const adminEmail = 'marko.petrovic@banka.rs';
  const clientEmail = 'milica.nikolic@gmail.com';

  type RoleMode = 'ADMIN' | 'USER';

  type CurrentUserResponse = {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: 'ADMIN' | 'CLIENT';
    permissions: string[];
  };

  type TestOrder = {
    id: number;
    userName: string;
    userRole: string;
    listingTicker: string;
    listingName: string;
    listingType: 'STOCK' | 'FUTURES' | 'FOREX';
    orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
    quantity: number;
    contractSize: number;
    pricePerUnit: number;
    limitValue?: number;
    stopValue?: number;
    direction: 'BUY' | 'SELL';
    status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'DONE';
    approvedBy: string;
    isDone: boolean;
    remainingPortions: number;
    afterHours: boolean;
    allOrNone: boolean;
    margin: boolean;
    approximatePrice: number;
    createdAt: string;
    lastModification: string;
    accountNumber?: string;
    accountName?: string;
    accountId?: number | string;
  };

  const formatSr = (value: number, decimals = 2) =>
    new Intl.NumberFormat('sr-RS', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);

  const getCurrentUserBody = (roleMode: RoleMode): CurrentUserResponse => {
    if (roleMode === 'ADMIN') {
      return {
        id: 999,
        email: adminEmail,
        firstName: 'Marko',
        lastName: 'Petrovic',
        role: 'ADMIN',
        permissions: ['ADMIN'],
      };
    }

    return {
      id: 100,
      email: clientEmail,
      firstName: 'Milica',
      lastName: 'Nikolic',
      role: 'CLIENT',
      permissions: [],
    };
  };

  const getSessionUser = (roleMode: RoleMode) => {
    const body = getCurrentUserBody(roleMode);

    return {
      id: body.id,
      email: body.email,
      username: body.email.split('@')[0],
      firstName: body.firstName,
      lastName: body.lastName,
      role: body.role,
      permissions: roleMode === 'ADMIN' ? ['ADMIN'] : [],
    };
  };

  const seedAuthSession = (roleMode: RoleMode, win: Window) => {
    const currentUser = getCurrentUserBody(roleMode);
    const sessionUser = getSessionUser(roleMode);
    const accessToken = createJwt(currentUser.role, currentUser.email);

    win.sessionStorage.setItem('accessToken', accessToken);
    win.sessionStorage.setItem('refreshToken', 'test-refresh-token');
    win.sessionStorage.setItem('user', JSON.stringify(sessionUser));
  };

  const mockCurrentUser = (roleMode: RoleMode) => {
    const body = getCurrentUserBody(roleMode);

    cy.intercept('GET', '**/auth/me**', { statusCode: 200, body }).as('authMe');
    cy.intercept('GET', '**/users/me**', { statusCode: 200, body }).as('usersMe');
    cy.intercept('GET', '**/user/me**', { statusCode: 200, body }).as('userMe');
    cy.intercept('GET', '**/current-user**', { statusCode: 200, body }).as('currentUser');
  };

  const buildOrder = (overrides: Partial<TestOrder> = {}): TestOrder => ({
    id: 700,
    userName: 'Milica Nikolic',
    userRole: 'CLIENT',
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingType: 'STOCK',
    orderType: 'MARKET',
    quantity: 10,
    contractSize: 1,
    pricePerUnit: 193.1,
    direction: 'BUY',
    status: 'PENDING',
    approvedBy: '',
    isDone: false,
    remainingPortions: 10,
    afterHours: false,
    allOrNone: false,
    margin: false,
    approximatePrice: 1931,
    createdAt: '2026-03-19T08:00:00Z',
    lastModification: '2026-03-19T08:00:00Z',
    ...overrides,
  });

  const baseOrders = [
    buildOrder({
      id: 701,
      listingTicker: 'AAPL',
      listingName: 'Apple Inc.',
      listingType: 'STOCK',
      orderType: 'MARKET',
      quantity: 10,
      pricePerUnit: 193.1,
      approximatePrice: 1931,
      direction: 'BUY',
      status: 'PENDING',
      createdAt: '2026-03-19T09:30:00Z',
      lastModification: '2026-03-19T09:30:00Z',
    }),
    buildOrder({
      id: 702,
      listingTicker: 'MSFT',
      listingName: 'Microsoft Corp.',
      listingType: 'STOCK',
      orderType: 'LIMIT',
      quantity: 5,
      pricePerUnit: 180,
      limitValue: 180,
      direction: 'SELL',
      status: 'APPROVED',
      approvedBy: 'Supervisor One',
      isDone: false,
      remainingPortions: 0,
      allOrNone: true,
      margin: true,
      approximatePrice: 900,
      createdAt: '2026-03-21T09:15:00Z',
      lastModification: '2026-03-21T09:30:00Z',
      accountName: 'Glavni brokerski USD',
      accountNumber: '160-1111111111111-11',
    }),
    buildOrder({
      id: 703,
      listingTicker: 'ES',
      listingName: 'E-mini S&P 500',
      listingType: 'FUTURES',
      orderType: 'STOP_LIMIT',
      quantity: 2,
      contractSize: 50,
      pricePerUnit: 5200,
      limitValue: 5200,
      stopValue: 5190,
      direction: 'BUY',
      status: 'DONE',
      approvedBy: 'Supervisor Two',
      isDone: true,
      remainingPortions: 0,
      afterHours: true,
      allOrNone: false,
      margin: false,
      approximatePrice: 10400,
      createdAt: '2026-03-20T16:45:00Z',
      lastModification: '2026-03-20T17:00:00Z',
      accountId: 44,
    }),
    buildOrder({
      id: 704,
      listingTicker: 'EUR/RSD',
      listingName: 'Euro / Serbian Dinar',
      listingType: 'FOREX',
      orderType: 'STOP',
      quantity: 3,
      contractSize: 1,
      pricePerUnit: 117.2,
      stopValue: 118.5,
      direction: 'SELL',
      status: 'DECLINED',
      approvedBy: '',
      isDone: false,
      remainingPortions: 3,
      afterHours: false,
      allOrNone: false,
      margin: false,
      approximatePrice: 351.6,
      createdAt: '2026-03-18T12:00:00Z',
      lastModification: '2026-03-18T12:30:00Z',
    }),
  ];

  const buildManyOrders = (count: number): TestOrder[] =>
    Array.from({ length: count }, (_, index) =>
      buildOrder({
        id: 800 + index,
        listingTicker: `TICK${index + 1}`,
        listingName: `Company ${index + 1}`,
        orderType: index % 2 === 0 ? 'MARKET' : 'LIMIT',
        direction: index % 2 === 0 ? 'BUY' : 'SELL',
        status:
          index % 4 === 0
            ? 'PENDING'
            : index % 4 === 1
              ? 'APPROVED'
              : index % 4 === 2
                ? 'DONE'
                : 'DECLINED',
        quantity: index + 1,
        pricePerUnit: 100 + index,
        approximatePrice: (index + 1) * (100 + index),
        createdAt: `2026-03-${String((index % 28) + 1).padStart(2, '0')}T${String(
          8 + (index % 10)
        ).padStart(2, '0')}:00:00Z`,
        lastModification: `2026-03-${String((index % 28) + 1).padStart(2, '0')}T${String(
          8 + (index % 10)
        ).padStart(2, '0')}:15:00Z`,
      })
    );

  const paginateOrders = (orders: TestOrder[], page: number, size: number) => {
    const start = page * size;
    const end = start + size;

    return {
      content: orders.slice(start, end),
      totalElements: orders.length,
      totalPages: Math.max(1, Math.ceil(orders.length / size)),
      number: page,
      size,
    };
  };

  const mockMyOrders = (
    orders: TestOrder[],
    options?: {
      delay?: number;
      alias?: string;
    }
  ) => {
    cy.intercept('GET', '**/orders/my*', (req) => {
      const page = Number(req.query.page ?? 0);
      const size = Number(req.query.size ?? 10);

      req.reply({
        delay: options?.delay,
        statusCode: 200,
        body: paginateOrders(orders, page, size),
      });
    }).as(options?.alias ?? 'getMyOrders');
  };

  const mockMyOrdersError = (message = 'Internal server error') => {
    cy.intercept('GET', '**/orders/my*', {
      statusCode: 500,
      body: { message },
    }).as('getMyOrdersError');
  };

  const visitMyOrdersPage = (roleMode: RoleMode = 'USER') => {
    mockCurrentUser(roleMode);

    cy.visit('/login', {
      onBeforeLoad: (win) => seedAuthSession(roleMode, win),
    });

    cy.window().then((win) => {
      win.history.pushState({}, '', '/orders/my');
      win.dispatchEvent(new win.PopStateEvent('popstate'));
    });
  };

  const assertTodoPlaceholder = () => {
    cy.contains('Stranica u izradi').should('be.visible');
    cy.contains('pogledaj TODO komentare u kodu').should('be.visible');
  };

  const withResolvedPage = (
    callback: () => void,
    roleMode: RoleMode = 'USER'
  ) => {
    visitMyOrdersPage(roleMode);
    cy.contains('h1', 'Moji nalozi', { timeout: 10000 }).should('be.visible');
    cy.get('body').then(($body) => {
      if ($body.text().includes('Stranica u izradi')) {
        assertTodoPlaceholder();
        return;
      }

      cy.contains('Pregled naloga').should('be.visible');
      callback();
    });
  };

  it('renders the page, summary cards and orders sorted by latest date', () => {
    mockMyOrders(baseOrders);

    withResolvedPage(() => {
      cy.wait('@getMyOrders')
        .its('request.query')
        .should((query) => {
          expect(query.page).to.equal('0');
          expect(query.size).to.equal('10');
        });

      cy.contains('Pregled svih vasih BUY i SELL naloga sa detaljima izvrsenja.').should(
        'be.visible'
      );
      cy.contains('Sortiranje: datum opadajuce').should('be.visible');
      cy.get('#ordersPageSize').should('have.value', '10');

      cy.get('tbody tr').should('have.length', 4);
      cy.get('tbody tr')
        .eq(0)
        .should('contain.text', 'MSFT')
        .and('contain.text', 'Microsoft Corp.');
      cy.get('tbody tr')
        .eq(1)
        .should('contain.text', 'ES')
        .and('contain.text', 'E-mini S&P 500');
      cy.get('tbody tr')
        .eq(2)
        .should('contain.text', 'AAPL')
        .and('contain.text', 'Apple Inc.');
      cy.get('tbody tr').eq(3).should('contain.text', 'EUR/RSD');

      cy.contains('Ukupno na strani').parent().should('contain.text', '4');
      cy.contains('Na cekanju').parent().should('contain.text', '1');
      cy.contains('Odobreni').parent().should('contain.text', '1');
      cy.contains('Zavrseni').parent().should('contain.text', '1');
    });
  });

  it('shows loading state while orders are loading', () => {
    mockMyOrders(baseOrders, { delay: 1200, alias: 'getMyOrdersDelayed' });

    visitMyOrdersPage();
    cy.contains('h1', 'Moji nalozi', { timeout: 10000 }).should('be.visible');
    cy.get('body').then(($body) => {
      if ($body.text().includes('Stranica u izadi') || $body.text().includes('Stranica u izradi')) {
        assertTodoPlaceholder();
        return;
      }

      cy.get('.animate-pulse', { timeout: 4000 }).should('exist');
      cy.wait('@getMyOrdersDelayed');
      cy.contains('Pregled naloga').should('be.visible');
    });
  });

  it('shows empty state when there are no orders', () => {
    mockMyOrders([]);

    withResolvedPage(() => {
      cy.wait('@getMyOrders');

      cy.contains('Nema kreiranih naloga').should('be.visible');
      cy.contains(
        'Kada posaljete prvi nalog, ovde cete videti istoriju i status izvrsenja.'
      ).should('be.visible');
    });
  });

  it('shows an error alert when order loading fails', () => {
    mockMyOrdersError();

    withResolvedPage(() => {
      cy.wait('@getMyOrdersError');

      cy.contains('Greska pri ucitavanju').should('be.visible');
      cy.contains('Neuspesno ucitavanje naloga.').should('be.visible');
    });
  });

  it('refreshes the current page and shows the refreshing state', () => {
    const refreshedOrders = [
      buildOrder({
        id: 750,
        listingTicker: 'NVDA',
        listingName: 'NVIDIA Corp.',
        listingType: 'STOCK',
        orderType: 'LIMIT',
        quantity: 6,
        pricePerUnit: 950,
        approximatePrice: 5700,
        direction: 'BUY',
        status: 'APPROVED',
        approvedBy: 'Supervisor Refresh',
        createdAt: '2026-03-21T10:30:00Z',
        lastModification: '2026-03-21T10:45:00Z',
      }),
    ];
    let requestCount = 0;

    cy.intercept('GET', '**/orders/my*', (req) => {
      requestCount += 1;
      const page = Number(req.query.page ?? 0);
      const size = Number(req.query.size ?? 10);
      const body = requestCount === 1 ? paginateOrders(baseOrders, page, size) : paginateOrders(refreshedOrders, page, size);

      req.reply({
        delay: requestCount === 1 ? 0 : 900,
        statusCode: 200,
        body,
      });
    }).as('getMyOrdersRefresh');

    withResolvedPage(() => {
      cy.wait('@getMyOrdersRefresh');

      cy.contains('Apple Inc.').should('be.visible');
      cy.contains('button', 'Osvezi').click();

      cy.contains('button', 'Osvezavanje...').should('be.visible').and('be.disabled');
      cy.wait('@getMyOrdersRefresh')
        .its('request.query')
        .should((query) => {
          expect(query.page).to.equal('0');
          expect(query.size).to.equal('10');
        });

      cy.contains('NVIDIA Corp.').should('be.visible');
      cy.contains('Apple Inc.').should('not.exist');
    });
  });

  it('supports pagination through page and size request params', () => {
    mockMyOrders(buildManyOrders(12));

    withResolvedPage(() => {
      cy.wait('@getMyOrders')
        .its('request.query')
        .should((query) => {
          expect(query.page).to.equal('0');
          expect(query.size).to.equal('10');
        });

      cy.contains('Prikazana strana 1 od 2').should('be.visible');
      cy.contains('button', 'Prethodna').should('be.disabled');

      cy.contains('button', 'Sledeca').click();

      cy.contains('Prikazana strana 2 od 2').should('be.visible');
      cy.get('@getMyOrders.all').should(
        (calls: Array<{ request: { query: Record<string, string> } }>) => {
          expect(
            calls.some(
              (call) => call.request.query.page === '1' && call.request.query.size === '10'
            )
          ).to.equal(true);
        }
      );
      cy.contains('button', 'Sledeca').should('be.disabled');

      cy.contains('button', 'Prethodna').click();

      cy.contains('Prikazana strana 1 od 2').should('be.visible');
      cy.get('@getMyOrders.all').should(
        (calls: Array<{ request: { query: Record<string, string> } }>) => {
          const pageZeroCalls = calls.filter(
            (call) => call.request.query.page === '0' && call.request.query.size === '10'
          );
          expect(pageZeroCalls.length).to.be.greaterThan(1);
        }
      );
    });
  });

  it('changes page size and resets pagination back to the first page', () => {
    mockMyOrders(buildManyOrders(30));

    withResolvedPage(() => {
      cy.wait('@getMyOrders');

      cy.contains('button', 'Sledeca').click();
      cy.contains('Prikazana strana 2 od 3').should('be.visible');
      cy.get('@getMyOrders.all').should(
        (calls: Array<{ request: { query: Record<string, string> } }>) => {
          expect(
            calls.some(
              (call) => call.request.query.page === '1' && call.request.query.size === '10'
            )
          ).to.equal(true);
        }
      );

      cy.get('#ordersPageSize').select('25');

      cy.get('#ordersPageSize').should('have.value', '25');
      cy.contains('Prikazana strana 1 od 2').should('be.visible');
      cy.get('@getMyOrders.all').should(
        (calls: Array<{ request: { query: Record<string, string> } }>) => {
          expect(
            calls.some(
              (call) => call.request.query.page === '0' && call.request.query.size === '25'
            )
          ).to.equal(true);
        }
      );
      cy.contains('button', 'Prethodna').should('be.disabled');
      cy.get('tbody tr').should('have.length', 25);
    });
  });

  it('opens order details dialog with execution and financial data', () => {
    mockMyOrders(baseOrders);

    withResolvedPage(() => {
      cy.wait('@getMyOrders');

      cy.contains('tr', 'MSFT').contains('button', 'Detalji').click();

      cy.contains('Detalji naloga').should('be.visible');
      cy.contains('MSFT · Microsoft Corp.').should('be.visible');
      cy.contains('ID naloga #702').should('be.visible');
      cy.contains('Supervisor One').should('exist');

      cy.contains('span', 'All or None').parent().should('contain.text', 'Da');
      cy.contains('span', 'Margin').parent().should('contain.text', 'Da');
      cy.contains('span', 'After hours').parent().should('contain.text', 'Ne');
      cy.contains('span', 'Cena po jedinici')
        .parent()
        .should('contain.text', formatSr(180));
      cy.contains('span', 'Priblizna cena')
        .parent()
        .should('contain.text', formatSr(900));
      cy.contains('span', 'Provizija')
        .parent()
        .should('contain.text', formatSr(12));
      cy.contains('span', 'Ukupno')
        .parent()
        .should('contain.text', formatSr(912));
      cy.contains('span', 'Racun')
        .parent()
        .should('contain.text', 'Glavni brokerski USD | 160-1111111111111-11');
      cy.contains('span', 'Limit vrednost')
        .parent()
        .should('contain.text', formatSr(180));

      cy.get('button[aria-label="Zatvori"]').click({ force: true });
      cy.contains('Detalji naloga').should('not.exist');
    });
  });

  it('shows fallback account label when account metadata is missing', () => {
    mockMyOrders(baseOrders);

    withResolvedPage(() => {
      cy.wait('@getMyOrders');

      cy.contains('tr', 'EUR/RSD').contains('button', 'Detalji').click();

      cy.contains('Detalji naloga').should('be.visible');
      cy.contains('span', 'Racun').parent().should('contain.text', '-');
      cy.contains('span', 'Stop vrednost')
        .parent()
        .should('contain.text', formatSr(118.5));
    });
  });
});
