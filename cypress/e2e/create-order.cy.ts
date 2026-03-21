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

describe('Create Order Page', () => {
  const adminEmail = 'marko.petrovic@banka.rs';
  const adminPassword = 'Admin12345';

  const clientEmail = 'milica.nikolic@gmail.com';
  const clientPassword = 'Klijent12345';

  type RoleMode = 'ADMIN' | 'USER';

  type TestListing = {
    id: number;
    ticker: string;
    name: string;
    exchangeAcronym: string;
    listingType: 'STOCK' | 'FUTURES' | 'FOREX';
    price: number;
    ask: number;
    bid: number;
    volume: number;
    priceChange: number;
    changePercent: number;
    initialMarginCost: number;
    maintenanceMargin: number;
    outstandingShares?: number;
    dividendYield?: number;
    marketCap?: number;
    baseCurrency?: string;
    quoteCurrency?: string;
    liquidity?: string;
    contractSize?: number;
    contractUnit?: string;
    settlementDate?: string;
  };

  type CurrentUserResponse = {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: 'ADMIN' | 'CLIENT';
    permissions: string[];
  };

  const formatSr = (value: number, decimals = 2) =>
    new Intl.NumberFormat('sr-RS', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);

  const stockListing: TestListing = {
    id: 101,
    ticker: 'AAPL',
    name: 'Apple Inc.',
    exchangeAcronym: 'NASDAQ',
    listingType: 'STOCK',
    price: 192.45,
    ask: 193.1,
    bid: 191.9,
    volume: 1250000,
    priceChange: 1.12,
    changePercent: 0.58,
    initialMarginCost: 0,
    maintenanceMargin: 0,
    outstandingShares: 1000000,
    dividendYield: 0.5,
    marketCap: 1500000000,
  };

  const futuresListing: TestListing = {
    id: 102,
    ticker: 'ES',
    name: 'E-mini S&P 500',
    exchangeAcronym: 'CME',
    listingType: 'FUTURES',
    price: 5200,
    ask: 5201,
    bid: 5199,
    volume: 250000,
    priceChange: 15,
    changePercent: 0.29,
    initialMarginCost: 1200,
    maintenanceMargin: 800,
    contractSize: 50,
    contractUnit: 'USD',
    settlementDate: '2026-06-19',
  };

  const forexListing: TestListing = {
    id: 103,
    ticker: 'EUR/RSD',
    name: 'Euro / Serbian Dinar',
    exchangeAcronym: 'FOREX',
    listingType: 'FOREX',
    price: 117.2,
    ask: 117.3,
    bid: 117.1,
    volume: 500000,
    priceChange: 0.2,
    changePercent: 0.17,
    initialMarginCost: 0,
    maintenanceMargin: 0,
    baseCurrency: 'EUR',
    quoteCurrency: 'RSD',
    liquidity: 'HIGH',
  };

  const account1 = {
    id: 1,
    accountNumber: '160-1111111111111-11',
    ownerName: 'Marko Petrovic',
    accountType: 'BROKERSKI',
    currency: 'USD',
    balance: 30000,
    availableBalance: 25000,
    reservedBalance: 5000,
    dailyLimit: 100000,
    monthlyLimit: 500000,
    dailySpending: 0,
    monthlySpending: 0,
    maintenanceFee: 0,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
    name: 'Glavni brokerski USD',
  };

  const account2 = {
    id: 2,
    accountNumber: '170-2222222222222-22',
    ownerName: 'Marko Petrovic',
    accountType: 'BROKERSKI',
    currency: 'RSD',
    balance: 800000,
    availableBalance: 600000,
    reservedBalance: 200000,
    dailyLimit: 1000000,
    monthlyLimit: 5000000,
    dailySpending: 0,
    monthlySpending: 0,
    maintenanceFee: 0,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
    name: 'Glavni brokerski RSD',
  };

  const account3 = {
    id: 3,
    accountNumber: '180-3333333333333-33',
    ownerName: 'Marko Petrovic',
    accountType: 'BROKERSKI',
    currency: 'EUR',
    balance: 5000,
    availableBalance: 4000,
    reservedBalance: 1000,
    dailyLimit: 50000,
    monthlyLimit: 200000,
    dailySpending: 0,
    monthlySpending: 0,
    maintenanceFee: 0,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
    name: 'Devizni EUR',
  };

  const allAccounts = [account1, account2, account3];

  const getCredentials = (roleMode: RoleMode) =>
    roleMode === 'ADMIN'
      ? { email: adminEmail, password: adminPassword }
      : { email: clientEmail, password: clientPassword };

  const getCurrentUserBody = (roleMode: RoleMode): CurrentUserResponse => {
    if (roleMode === 'ADMIN') {
      return {
        id: 999,
        email: adminEmail,
        firstName: 'Marko',
        lastName: 'Petrovic',
        role: 'ADMIN',
        permissions: ['TRADE_STOCKS'],
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

  const mockCurrentUser = (roleMode: RoleMode) => {
    const body = getCurrentUserBody(roleMode);

    cy.intercept('GET', '**/auth/me**', { statusCode: 200, body }).as('authMe');
    cy.intercept('GET', '**/users/me**', { statusCode: 200, body }).as('usersMe');
    cy.intercept('GET', '**/user/me**', { statusCode: 200, body }).as('userMe');
    cy.intercept('GET', '**/current-user**', { statusCode: 200, body }).as('currentUser');
  };

  const loginViaUi = (roleMode: RoleMode) => {
    const { email, password } = getCredentials(roleMode);
    const accessToken = createJwt(roleMode === 'ADMIN' ? 'ADMIN' : 'CLIENT', email);
    const sessionUser = getSessionUser(roleMode);

    cy.session([roleMode, email, password], () => {
      mockCurrentUser(roleMode);
      cy.visit('/home', {
        onBeforeLoad: (win) => {
          win.sessionStorage.setItem('accessToken', accessToken);
          win.sessionStorage.setItem('refreshToken', 'test-refresh-token');
          win.sessionStorage.setItem('user', JSON.stringify(sessionUser));
        },
      });
      cy.url().should('include', '/home');
    });
  };

  const mockListings = (
    roleMode: RoleMode,
    overrides?: {
      stock?: TestListing[];
      futures?: TestListing[];
      forex?: TestListing[];
    }
  ) => {
    const stockBody = overrides?.stock ?? [stockListing];
    const futuresBody = overrides?.futures ?? [futuresListing];
    const forexBody = overrides?.forex ?? [forexListing];

    cy.intercept('GET', '/listings*', (req) => {
      const type = String(req.query.type ?? '');
      const bodyForType =
        type === 'STOCK'
          ? stockBody
          : type === 'FUTURES'
            ? futuresBody
            : type === 'FOREX'
              ? forexBody
              : [];

      req.reply({
        statusCode: 200,
        body: {
          content: bodyForType,
          totalElements: bodyForType.length,
          totalPages: 1,
          number: 0,
          size: 100,
        },
      });
    }).as(`getListings_${roleMode}`);
  };

  const mockAccounts = (body = allAccounts) => {
    cy.intercept('GET', '/accounts/all*', {
      statusCode: 200,
      body: {
        content: body,
        totalElements: body.length,
        totalPages: 1,
        number: 0,
        size: 100,
      },
    }).as('getAccountsAll');

    cy.intercept('GET', '/accounts/my*', {
      statusCode: 200,
      body,
    }).as('getAccountsMy');
  };

  const mockCreateOrderSuccess = () => {
    cy.intercept('POST', '/orders', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          id: 9001,
          userName: 'Marko Petrovic',
          userRole: 'CLIENT',
          listingTicker: 'AAPL',
          listingName: 'Apple Inc.',
          listingType: 'STOCK',
          orderType: req.body.orderType,
          quantity: req.body.quantity,
          contractSize: 1,
          pricePerUnit: 193.1,
          limitValue: req.body.limitValue,
          stopValue: req.body.stopValue,
          direction: req.body.direction,
          status: 'PENDING',
          approvedBy: '',
          isDone: false,
          remainingPortions: req.body.quantity,
          afterHours: false,
          allOrNone: req.body.allOrNone,
          margin: req.body.margin,
          approximatePrice: 193.1 * req.body.quantity,
          createdAt: '2026-03-21T10:00:00Z',
          lastModification: '2026-03-21T10:00:00Z',
        },
      });
    }).as('createOrder');
  };

  const mockCreateOrderError = (message = 'Kreiranje naloga nije uspelo.') => {
    cy.intercept('POST', '/orders', {
      statusCode: 400,
      body: { message },
    }).as('createOrderError');
  };

  const setupRole = (roleMode: RoleMode) => {
    mockCurrentUser(roleMode);
    mockListings(roleMode);
    mockAccounts();
    mockCreateOrderSuccess();
    loginViaUi(roleMode);
    mockCurrentUser(roleMode);
  };

  const visitCreateOrderPage = (query = '') => {
    cy.visit('/home');
    cy.window().then((win) => {
      win.history.pushState({}, '', `/orders/new${query}`);
      win.dispatchEvent(new win.PopStateEvent('popstate'));
    });
  };

  const waitForPageToLoad = () => {
    cy.contains('h1', 'Novi nalog', { timeout: 10000 }).should('be.visible');
    cy.contains('Podaci naloga').should('be.visible');
    cy.get('#listingId', { timeout: 10000 }).should('exist');
    cy.get('#accountId', { timeout: 10000 }).should('exist');
  };

  const selectListing = (id: number) => cy.get('#listingId').select(String(id));
  const selectAccount = (id: number) => cy.get('#accountId').select(String(id));
  const setNumberInput = (selector: string, value: string) => {
    cy.get(selector)
      .should('be.visible')
      .then(($input) => {
        const input = $input[0] as HTMLInputElement;
        const win = input.ownerDocument.defaultView;
        const valueSetter = win
          ? Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set
          : undefined;

        expect(valueSetter, `native value setter for ${selector}`).to.be.a('function');

        valueSetter?.call(input, value);
        input.dispatchEvent(new win!.Event('input', { bubbles: true }));
        input.dispatchEvent(new win!.Event('change', { bubbles: true }));
        input.dispatchEvent(new win!.Event('blur', { bubbles: true }));
      })
      .should('have.value', value);
  };

  const setQuantity = (value: string) => setNumberInput('#quantity', value);
  const setOrderType = (value: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT') =>
    cy.get('#orderType').select(value);

  const setDirection = (value: 'BUY' | 'SELL') =>
    cy.get(`input[type="radio"][value="${value}"]`).check({ force: true });

  const setAllOrNone = (checked = true) => {
    const checkbox = cy.contains('label', 'All or None').find('input[type="checkbox"]');
    if (checked) checkbox.check({ force: true });
    else checkbox.uncheck({ force: true });
  };

  const setMargin = (checked = true) => {
    const checkbox = cy.contains('label', 'Margin').find('input[type="checkbox"]');
    if (checked) checkbox.check({ force: true });
    else checkbox.uncheck({ force: true });
  };

  const openConfirmationWithValidMarketBuy = () => {
    selectListing(stockListing.id);
    selectAccount(account1.id);
    setQuantity('10');
    setOrderType('MARKET');
    cy.contains('button', 'Nastavi na potvrdu').click();
  };

  const assertRequestBodyIncludes = (
    expected: Partial<{
      listingId: number;
      orderType: string;
      quantity: number;
      direction: string;
      limitValue?: number;
      stopValue?: number;
      allOrNone: boolean;
      margin: boolean;
      accountId: number;
    }>
  ) => {
    cy.wait('@createOrder')
      .its('request.body')
      .should((body) => {
        Object.entries(expected).forEach(([key, value]) => {
          expect(body[key]).to.deep.equal(value);
        });
      });
  };

  const withinCostEstimateCard = (callback: () => void) => {
    cy.get('body').then(($body) => {
      const testIdCard = $body.find('[data-testid="cost-estimate-card"]');

      if (testIdCard.length > 0) {
        cy.wrap(testIdCard.first()).within(callback);
        return;
      }

      cy.contains('Procena troškova')
        .closest('div.rounded-lg.border')
        .within(callback);
    });
  };

  describe('ADMIN flow', () => {
    beforeEach(() => {
      setupRole('ADMIN');
    });

    it('renders page and loads order creation form', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      cy.contains('Kreirajte BUY ili SELL nalog i proverite procenu troškova pre slanja.').should(
        'be.visible'
      );
      cy.get('#listingId').find('option').should('have.length.at.least', 4);
      cy.get('#orderType').find('option').should('have.length', 4);
      cy.contains('Kupovina').should('be.visible');
      cy.contains('Prodaja').should('be.visible');
      cy.contains('Procena troškova').should('be.visible');
      cy.contains('Kontrole izvršenja').should('be.visible');
    });

    it('loads FOREX listing for admin', () => {
      visitCreateOrderPage();
      waitForPageToLoad();
      cy.get('#listingId').find('option').contains('EUR/RSD').should('exist');
    });

    it('shows loading state while data is loading', () => {
      mockCurrentUser('ADMIN');

      cy.intercept('GET', '/listings*', (req) => {
        const type = String(req.query.type ?? '');
        const content =
          type === 'STOCK'
            ? [stockListing]
            : type === 'FUTURES'
              ? [futuresListing]
              : type === 'FOREX'
                ? [forexListing]
                : [];

        req.reply({
          delay: 1200,
          statusCode: 200,
          body: {
            content,
            totalElements: content.length,
            totalPages: 1,
            number: 0,
            size: 100,
          },
        });
      }).as('getListingsDelayed');

      cy.intercept('GET', '/accounts/all*', {
        delay: 1200,
        statusCode: 200,
        body: {
          content: allAccounts,
          totalElements: allAccounts.length,
          totalPages: 1,
          number: 0,
          size: 100,
        },
      }).as('getAccountsAllDelayed');

      cy.intercept('GET', '/accounts/my*', {
        delay: 1200,
        statusCode: 200,
        body: allAccounts,
      }).as('getAccountsMyDelayed');

      visitCreateOrderPage();
      cy.get('.animate-pulse', { timeout: 4000 }).should('exist');
    });

    it('shows empty state when there are no listings', () => {
      mockCurrentUser('ADMIN');
      mockListings('ADMIN', { stock: [], futures: [], forex: [] });

      visitCreateOrderPage();
      cy.contains('Nema dostupnih hartija', { timeout: 10000 }).should('be.visible');
    });

    it('shows empty state when there are no accounts', () => {
      mockCurrentUser('ADMIN');
      mockAccounts([]);

      visitCreateOrderPage();
      cy.contains('Nema dostupnih računa', { timeout: 10000 }).should('be.visible');
    });

    it('preselects listing and direction from query params', () => {
      visitCreateOrderPage(`?listingId=${futuresListing.id}&direction=SELL`);
      waitForPageToLoad();

      cy.get('#listingId').should('have.value', String(futuresListing.id));
      cy.get('input[type="radio"][value="SELL"]').should('be.checked');
    });

    it('shows and hides conditional fields depending on order type', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      cy.get('#limitValue').should('not.exist');
      cy.get('#stopValue').should('not.exist');

      setOrderType('LIMIT');
      cy.get('#limitValue').should('exist');
      cy.get('#stopValue').should('not.exist');

      setOrderType('STOP');
      cy.get('#limitValue').should('not.exist');
      cy.get('#stopValue').should('exist');

      setOrderType('STOP_LIMIT');
      cy.get('#limitValue').should('exist');
      cy.get('#stopValue').should('exist');

      setOrderType('MARKET');
      cy.get('#limitValue').should('not.exist');
      cy.get('#stopValue').should('not.exist');
    });

    it('shows validation errors for incomplete form', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      setQuantity('0');
      cy.contains('button', 'Nastavi na potvrdu').click();

      cy.contains('Količina mora biti najmanje 1').should('be.visible');
      cy.get('@createOrder.all').should('have.length', 0);
    });

    it('validates limit value for LIMIT order type', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      selectAccount(account1.id);
      setQuantity('5');
      setOrderType('LIMIT');

      cy.contains('button', 'Nastavi na potvrdu').click();
      cy.contains('Limit vrednost je obavezna za izabrani tip ordera').should('be.visible');
    });

    it('validates stop value for STOP order type', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      selectAccount(account1.id);
      setQuantity('5');
      setOrderType('STOP');

      cy.contains('button', 'Nastavi na potvrdu').click();
      cy.contains('Stop vrednost je obavezna za izabrani tip ordera').should('be.visible');
    });

    it('shows market BUY pricing preview using ask price', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      selectAccount(account1.id);
      setQuantity('10');

      withinCostEstimateCard(() => {
        cy.contains('Ask cena').should('be.visible');
        cy.contains(formatSr(stockListing.ask)).should('be.visible');
      });
    });

    it('shows market SELL pricing preview using bid price', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      setDirection('SELL');
      selectListing(stockListing.id);
      selectAccount(account1.id);
      setQuantity('10');

      withinCostEstimateCard(() => {
        cy.contains('Bid cena').should('be.visible');
        cy.contains(formatSr(stockListing.bid)).should('be.visible');
      });
    });

    it('shows limit pricing inputs and keeps cost preview visible', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      selectAccount(account1.id);
      setQuantity('4');
      setOrderType('LIMIT');
      setNumberInput('#limitValue', '180');

      withinCostEstimateCard(() => {
        cy.contains('Limit vrednost').should('be.visible');
        cy.contains('Približna cena').should('be.visible');
      });

      cy.get('#limitValue').should('have.value', '180');
    });

    it('shows stop-limit pricing inputs and keeps cost preview visible', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      selectAccount(account1.id);
      setQuantity('3');
      setOrderType('STOP_LIMIT');
      setNumberInput('#limitValue', '175');
      setNumberInput('#stopValue', '170');

      withinCostEstimateCard(() => {
        cy.contains('Limit vrednost').should('be.visible');
        cy.contains('Približna cena').should('be.visible');
      });

      cy.get('#limitValue').should('have.value', '175');
      cy.get('#stopValue').should('have.value', '170');
    });

    it('shows selected account balance info', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectAccount(account2.id);

      cy.contains('Raspoloživo stanje').should('be.visible');
      cy.contains(account2.accountNumber.slice(-4)).should('be.visible');
    });

    it('shows insufficient funds warning when total exceeds available balance in same currency', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      selectAccount(account1.id);
      setQuantity('500');

      cy.contains('Nedovoljno sredstava').should('be.visible');
      cy.contains('Procena ukupnog troška prelazi raspoloživo stanje izabranog računa.').should(
        'be.visible'
      );
    });

    it('keeps cost preview visible when account currency differs from pricing currency', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      selectAccount(account2.id);
      setQuantity('999999');

      withinCostEstimateCard(() => {
        cy.contains('Ukupno').should('be.visible');
      });
    });

    it('shows closed market warning for weekend', () => {
      cy.clock(new Date('2026-03-21T12:00:00Z').getTime(), ['Date']);

      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      cy.contains('Berza je trenutno zatvorena').should('be.visible');
    });

    it('shows after-hours warning shortly before exchange close', () => {
      cy.clock(new Date('2026-03-20T15:20:00+01:00').getTime(), ['Date']);

      const localListing: TestListing = {
        ...stockListing,
        id: 201,
        ticker: 'NIS',
        name: 'Naftna Industrija Srbije',
        exchangeAcronym: 'BELEX',
        listingType: 'STOCK',
      };

      mockCurrentUser('ADMIN');
      mockListings('ADMIN', { stock: [localListing], futures: [], forex: [] });

      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(localListing.id);
      cy.contains('Berza se zatvara uskoro').should('be.visible');
    });

    it('opens confirmation dialog with all entered values', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      setDirection('SELL');
      setQuantity('15');
      setOrderType('STOP_LIMIT');
      setNumberInput('#limitValue', '188.5');
      setNumberInput('#stopValue', '185');
      selectAccount(account1.id);
      setAllOrNone(true);
      setMargin(true);

      cy.contains('button', 'Nastavi na potvrdu').click();

      cy.contains('Potvrda naloga').should('be.visible');
      cy.contains('AAPL · Apple Inc.').should('be.visible');
      cy.contains('Prodaja').should('be.visible');
      cy.contains('Stop-Limit').should('be.visible');
      cy.contains('188,50').should('be.visible');
      cy.contains('185,00').should('be.visible');
      cy.contains(account1.accountNumber.slice(-4)).should('be.visible');
      cy.contains('Potvrdi').should('be.visible');
    });

    it('closes confirmation dialog when user clicks Odustani', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      openConfirmationWithValidMarketBuy();

      cy.contains('Potvrda naloga').should('be.visible');
      cy.contains('button', 'Odustani').click();
      cy.contains('Potvrda naloga').should('not.exist');
      cy.get('@createOrder.all').should('have.length', 0);
    });

    it('submits order successfully after confirmation', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      selectAccount(account1.id);
      setQuantity('12');
      setOrderType('LIMIT');
      setNumberInput('#limitValue', '180');
      setDirection('BUY');

      cy.contains('button', 'Nastavi na potvrdu').click();
      cy.contains('button', 'Potvrdi').click();

      assertRequestBodyIncludes({
        listingId: 101,
        orderType: 'LIMIT',
        quantity: 12,
        direction: 'BUY',
        limitValue: 180,
        allOrNone: false,
        margin: false,
        accountId: 1,
      });

      cy.url().should('include', '/orders/my');
    });

    it('submits order with margin when admin enables it', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      selectAccount(account1.id);
      setQuantity('8');
      setOrderType('MARKET');
      setMargin(true);

      cy.contains('button', 'Nastavi na potvrdu').click();
      cy.contains('button', 'Potvrdi').click();

      assertRequestBodyIncludes({
        listingId: 101,
        orderType: 'MARKET',
        quantity: 8,
        direction: 'BUY',
        allOrNone: false,
        margin: true,
        accountId: 1,
      });
    });

    it('disables confirm button while order is being submitted', () => {
      cy.intercept('POST', '/orders', {
        delay: 1200,
        statusCode: 200,
        body: {
          id: 9002,
          status: 'PENDING',
        },
      }).as('createOrderDelayed');

      visitCreateOrderPage();
      waitForPageToLoad();

      openConfirmationWithValidMarketBuy();

      cy.contains('button', 'Potvrdi').click();

      cy.contains('Slanje...').should('be.visible');
      cy.wait('@createOrderDelayed');
    });

    it('handles order creation error gracefully and keeps confirmation dialog open', () => {
      mockCreateOrderError('Order nije moguće kreirati u ovom trenutku.');

      visitCreateOrderPage();
      waitForPageToLoad();

      openConfirmationWithValidMarketBuy();
      cy.contains('button', 'Potvrdi').click();

      cy.wait('@createOrderError');
      cy.contains('Potvrda naloga').should('be.visible');
    });

    it('resets hidden limit field when switching away from LIMIT order', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      setOrderType('LIMIT');
      setNumberInput('#limitValue', '200');
      setOrderType('MARKET');
      cy.get('#limitValue').should('not.exist');

      setOrderType('LIMIT');
      cy.get('#limitValue').should('have.value', '');
    });

    it('resets hidden stop field when switching away from STOP order', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      setOrderType('STOP');
      setNumberInput('#stopValue', '150');
      setOrderType('MARKET');
      cy.get('#stopValue').should('not.exist');

      setOrderType('STOP');
      cy.get('#stopValue').should('have.value', '');
    });

    it('shows selected listing details card', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(futuresListing.id);

      cy.contains('Izabrana hartija').should('be.visible');
      cy.contains('ES · E-mini S&P 500').should('be.visible');
      cy.contains('CME').should('be.visible');
      cy.contains('Futures').should('be.visible');
    });

    it('shows All or None and Margin status in controls preview card', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      cy.contains('Dozvoljeno je parcijalno izvršenje.').should('be.visible');

      setAllOrNone(true);
      cy.contains('Nalog se izvršava samo ako može u potpunosti.').should('be.visible');

      cy.contains('Margin je dostupan, ali trenutno nije uključen.').should('be.visible');
      setMargin(true);
      cy.contains('Margin je uključen za ovaj nalog.').should('be.visible');
    });
  });

  describe('USER flow', () => {
    beforeEach(() => {
      setupRole('USER');
    });

    it('does not load FOREX listing for regular user', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      cy.get('#listingId').find('option').contains('EUR/RSD').should('not.exist');
      cy.get('#listingId').find('option').should('have.length', 3);
    });

    it('uses regular-user account loading flow and renders form correctly', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      cy.get('#listingId').should('exist');
      cy.get('#accountId').should('exist');
      cy.contains('Podaci naloga').should('be.visible');
    });

    it('shows fallback margin message when user cannot use margin', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      cy.contains('Margin opcija nije dostupna za vaš nalog.').should('be.visible');
      cy.contains('Margin nije dostupan za vaš nalog.').should('be.visible');
    });

    it('creates order with margin forced to false for regular user', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      selectListing(stockListing.id);
      selectAccount(account1.id);
      setQuantity('7');
      setOrderType('MARKET');
      setDirection('BUY');

      cy.contains('button', 'Nastavi na potvrdu').click();
      cy.contains('button', 'Potvrdi').click();

      assertRequestBodyIncludes({
        listingId: 101,
        orderType: 'MARKET',
        quantity: 7,
        direction: 'BUY',
        allOrNone: false,
        margin: false,
        accountId: 1,
      });
    });

    it('shows All or None status in controls preview card for regular user', () => {
      visitCreateOrderPage();
      waitForPageToLoad();

      cy.contains('Dozvoljeno je parcijalno izvršenje.').should('be.visible');
      setAllOrNone(true);
      cy.contains('Nalog se izvršava samo ako može u potpunosti.').should('be.visible');
    });
  });
});
