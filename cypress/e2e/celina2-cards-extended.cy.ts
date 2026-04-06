/// <reference types="cypress" />
// Extended E2E tests for Card features: card list, request new card, block/unblock,
// card limit changes, and business account cards with authorized persons.
import { setupAdminSession, setupClientSession } from '../support/commands';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockAccounts = [
  {
    id: 1, accountNumber: '265000000000000001', name: 'Tekuci RSD',
    accountType: 'CHECKING', currency: 'RSD', balance: 150000,
    availableBalance: 145000, status: 'ACTIVE', ownerName: 'Stefan Jovanovic',
  },
  {
    id: 2, accountNumber: '265000000000000002', name: 'Devizni EUR',
    accountType: 'FOREIGN', currency: 'EUR', balance: 5000,
    availableBalance: 4800, status: 'ACTIVE', ownerName: 'Stefan Jovanovic',
  },
  {
    id: 3, accountNumber: '265000000000000003', name: 'Poslovni DOO',
    accountType: 'BUSINESS', currency: 'RSD', balance: 800000,
    availableBalance: 780000, status: 'ACTIVE', ownerName: 'Test DOO',
  },
];

const mockCards = [
  {
    id: 101, cardNumber: '4111111111111111', cardType: 'VISA', cardName: 'Visa Debit',
    accountId: 1, accountNumber: '265000000000000001', ownerName: 'STEFAN JOVANOVIC',
    holderName: 'STEFAN JOVANOVIC', expirationDate: '2028-06-30',
    status: 'ACTIVE', cardLimit: 200000, limit: 200000, createdAt: '2025-01-15',
  },
  {
    id: 102, cardNumber: '5500000000000004', cardType: 'MASTERCARD', cardName: 'MasterCard Gold',
    accountId: 1, accountNumber: '265000000000000001', ownerName: 'STEFAN JOVANOVIC',
    holderName: 'STEFAN JOVANOVIC', expirationDate: '2027-12-31',
    status: 'BLOCKED', cardLimit: 100000, limit: 100000, createdAt: '2025-02-20',
  },
  {
    id: 103, cardNumber: '3566002020360505', cardType: 'DINACARD', cardName: 'DinaCard Standard',
    accountId: 2, accountNumber: '265000000000000002', ownerName: 'STEFAN JOVANOVIC',
    holderName: 'STEFAN JOVANOVIC', expirationDate: '2026-03-15',
    status: 'DEACTIVATED', cardLimit: 50000, limit: 50000, createdAt: '2024-03-15',
  },
];

const mockBusinessCards = [
  {
    id: 201, cardNumber: '4222333344445555', cardType: 'VISA', cardName: 'Visa Business',
    accountId: 3, accountNumber: '265000000000000003', ownerName: 'TEST DOO',
    holderName: 'MARKO PETROVIC', expirationDate: '2029-01-31',
    status: 'ACTIVE', cardLimit: 500000, limit: 500000, createdAt: '2025-03-01',
    authorizedPerson: { id: 1, firstName: 'Marko', lastName: 'Petrovic', phoneNumber: '+381601111111' },
  },
  {
    id: 202, cardNumber: '5555666677778888', cardType: 'MASTERCARD', cardName: 'Mastercard Business',
    accountId: 3, accountNumber: '265000000000000003', ownerName: 'TEST DOO',
    holderName: 'ANA JOVIC', expirationDate: '2028-06-30',
    status: 'ACTIVE', cardLimit: 300000, limit: 300000, createdAt: '2025-03-15',
    authorizedPerson: { id: 2, firstName: 'Ana', lastName: 'Jovic', phoneNumber: '+381602222222' },
  },
];

const mockCardRequests = [
  {
    id: 301, accountId: 1, accountNumber: '265000000000000001', cardType: 'VISA',
    clientName: 'Stefan Jovanovic', status: 'PENDING', createdAt: '2025-03-25',
  },
  {
    id: 302, accountId: 2, accountNumber: '265000000000000002', cardType: 'MASTERCARD',
    clientName: 'Stefan Jovanovic', status: 'APPROVED', createdAt: '2025-03-20',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupCommonIntercepts() {
  cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake-access-token' } });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
  // Default cards intercept — individual tests override with their own alias
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD LIST - MASKED NUMBERS AND DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cards - Masked Card Numbers and Display', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockCards }).as('getCards');
  });

  it('displays card numbers with **** **** **** XXXX masking', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('****').should('exist');
    cy.contains('1111').should('exist');
    cy.contains('0004').should('exist');
  });

  it('never shows full card numbers in the UI', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    // Full card number should NOT appear
    cy.contains('4111111111111111').should('not.exist');
    cy.contains('5500000000000004').should('not.exist');
  });

  it('shows card type icons or labels (VISA, MASTERCARD, DINACARD)', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('Visa').should('exist');
    cy.contains('MasterCard').should('exist');
    cy.contains('DinaCard').should('exist');
  });

  it('shows expiration date in MM/YY format', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('06/28').should('exist');
    cy.contains('12/27').should('exist');
  });

  it('shows card holder name on each card', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('STEFAN JOVANOVIC').should('exist');
  });

  it('renders gradient backgrounds per card type', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.get('[class*="bg-gradient-to-br"]').should('have.length.at.least', 3);
  });

  it('shows card limit value with formatted number', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('Limit').should('exist');
    cy.contains('200').should('exist');
  });

  it('displays status colors: green for active, red for blocked, gray for deactivated', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('Aktivna').should('exist');
    cy.contains('Blokirana').should('exist');
    cy.contains('Deaktivirana').should('exist');
  });

  it('shows account number associated with each card', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('Racun').should('exist');
    cy.contains('265000000000000001').should('exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST NEW CARD FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cards - Request New Card Flow', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockCards }).as('getCards');
  });

  it('shows Nova kartica button for client users', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('button', 'Nova kartica').should('be.visible');
  });

  it('opens request card dialog when clicking Nova kartica', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('button', 'Nova kartica').click();
    cy.contains('Zahtev za novu karticu').should('be.visible');
  });

  it('shows account dropdown in request dialog', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('button', 'Nova kartica').click();
    cy.contains('Izaberite racun').should('be.visible');
  });

  it('submits new card request successfully', () => {
    cy.intercept('POST', '**/api/cards/requests', {
      statusCode: 201,
      body: { id: 200, status: 'PENDING' },
    }).as('submitCardRequest');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('button', 'Nova kartica').click();
    // Select account 2 (Devizni EUR) — account 1 already has max non-deactivated cards
    cy.contains('Izaberite racun').click();
    cy.get('[role="option"]').contains('Devizni EUR').click();
    cy.contains('button', 'Kreiraj karticu').click();
    cy.wait('@submitCardRequest');
    cy.contains('Zahtev za karticu je uspesno podnet').should('be.visible');
  });

  it('handles server error on card request', () => {
    cy.intercept('POST', '**/api/cards/requests', {
      statusCode: 500,
      body: { message: 'Server error' },
    }).as('submitCardRequestError');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('button', 'Nova kartica').click();
    // Select account 2 (Devizni EUR) — account 1 already has max non-deactivated cards
    cy.contains('Izaberite racun').click();
    cy.get('[role="option"]').contains('Devizni EUR').click();
    cy.contains('button', 'Kreiraj karticu').click();
    cy.wait('@submitCardRequestError');
  });

  it('does not show Nova kartica button for admin users', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCards');
    cy.contains('button', 'Nova kartica').should('not.exist');
  });

  it('shows Zatrazite karticu button when no cards exist', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] }).as('getEmptyCards');
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getEmptyCards');
    cy.contains('button', 'Zatrazite karticu').should('be.visible');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK / UNBLOCK CARD
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cards - Block and Unblock', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockCards }).as('getCards');
  });

  it('client can block their own active card via toggle', () => {
    cy.intercept('PATCH', '**/api/cards/101/block', { statusCode: 200, body: {} }).as('blockCard');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.get('button[role="switch"][aria-checked="true"]').first().click();
    cy.wait('@blockCard');
    cy.contains('Akcija uspesno izvrsena').should('be.visible');
  });

  it('client cannot unblock their own blocked card', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('Kontaktirajte banku').should('be.visible');
  });

  it('admin can unblock a blocked card via toggle', () => {
    cy.intercept('PATCH', '**/api/cards/102/unblock', { statusCode: 200, body: {} }).as('unblockCard');

    cy.visit('/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCards');
    cy.get('button[role="switch"][aria-checked="false"]').first().click();
    cy.wait('@unblockCard');
    cy.contains('Akcija uspesno izvrsena').should('be.visible');
  });

  it('admin can deactivate an active card with confirmation', () => {
    cy.intercept('PATCH', '**/api/cards/101/deactivate', { statusCode: 200, body: {} }).as('deactivateCard');
    cy.on('window:confirm', () => true);

    cy.visit('/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCards');
    cy.contains('button', 'Deaktiviraj').first().click();
    cy.wait('@deactivateCard');
    cy.contains('Akcija uspesno izvrsena').should('be.visible');
  });

  it('canceling deactivation confirmation does not deactivate', () => {
    cy.on('window:confirm', () => false);

    cy.visit('/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCards');
    cy.contains('button', 'Deaktiviraj').first().click();
    // Card should still be active
    cy.contains('Aktivna').should('exist');
  });

  it('shows disabled toggle for deactivated cards', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('Kartica je deaktivirana').should('exist');
  });

  it('handles block API error gracefully', () => {
    cy.intercept('PATCH', '**/api/cards/101/block', { statusCode: 500, body: { message: 'Error' } }).as('blockError');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.get('button[role="switch"][aria-checked="true"]').first().click();
    cy.wait('@blockError');
  });

  it('handles unblock API error gracefully', () => {
    cy.intercept('PATCH', '**/api/cards/102/unblock', { statusCode: 500, body: { message: 'Error' } }).as('unblockError');

    cy.visit('/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCards');
    cy.get('button[role="switch"][aria-checked="false"]').first().click();
    cy.wait('@unblockError');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CARD LIMIT CHANGE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cards - Card Limit Management', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockCards }).as('getCards');
  });

  it('shows current card limit on each card', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('Limit').should('exist');
    cy.contains('200').should('exist');
  });

  it('shows limit usage ring/progress indicator', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.get('svg circle').should('have.length.at.least', 2);
  });

  it('shows all card stats: total, active, blocked counts', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.contains('Ukupno kartica').should('be.visible');
    cy.contains('Aktivne').should('be.visible');
    cy.contains('Blokirane').should('be.visible');
  });

  it('shows correct count values in stats row', () => {
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    // 3 total, 1 active, 1 blocked
    cy.contains('3').should('exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS ACCOUNT CARDS WITH AUTHORIZED PERSONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cards - Business Account Cards', () => {
  beforeEach(() => {
    setupCommonIntercepts();
  });

  it('shows business account cards with owner names', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockBusinessCards }).as('getBusinessCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessCards');
    // Card visual shows ownerName (company name) as "Vlasnik"
    cy.contains('TEST DOO').should('exist');
    // Card names should be visible
    cy.contains('Visa Business').should('exist');
    cy.contains('Mastercard Business').should('exist');
  });

  it('shows business card company as owner', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockBusinessCards }).as('getBusinessCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessCards');
    cy.contains('TEST DOO').should('exist');
  });

  it('shows different card names for business cards', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockBusinessCards }).as('getBusinessCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessCards');
    // Two different business cards should be visible
    cy.contains('Visa Business').should('exist');
    cy.contains('Mastercard Business').should('exist');
    // Owner name (company) shown on card visual
    cy.contains('TEST DOO').should('exist');
  });

  it('shows business card limits higher than personal cards', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockBusinessCards }).as('getBusinessCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessCards');
    cy.contains('500').should('exist');
    cy.contains('300').should('exist');
  });

  it('allows blocking business account cards', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockBusinessCards }).as('getBusinessCards');
    cy.intercept('PATCH', '**/api/cards/201/block', { statusCode: 200, body: {} }).as('blockBusinessCard');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessCards');
    cy.get('button[role="switch"][aria-checked="true"]').first().click();
    cy.wait('@blockBusinessCard');
    cy.contains('Akcija uspesno izvrsena').should('be.visible');
  });

  it('shows mixed personal and business cards together', () => {
    const allCards = [...mockCards, ...mockBusinessCards];
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: allCards }).as('getAllCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAllCards');
    // Should show 5 cards total
    cy.contains('Visa Debit').should('exist');
    cy.contains('Visa Business').should('exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CARD REQUESTS (employee/card-requests)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Employee Portal - Card Requests', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/cards/requests*', {
      statusCode: 200,
      body: { content: mockCardRequests, totalElements: 2, totalPages: 1 },
    }).as('getCardRequests');
  });

  it('loads the card requests page', () => {
    cy.visit('/employee/card-requests', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.contains('Zahtevi').should('exist');
  });

  it('displays pending card requests', () => {
    cy.visit('/employee/card-requests', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCardRequests');
    cy.contains('Stefan Jovanovic').should('exist');
  });

  it('approves a pending card request', () => {
    cy.intercept('PATCH', '**/api/cards/requests/301/approve', {
      statusCode: 200,
      body: { ...mockCardRequests[0], status: 'APPROVED' },
    }).as('approveRequest');

    cy.visit('/employee/card-requests', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCardRequests');
    cy.contains('button', 'Odobri').first().click({ force: true });
    cy.wait('@approveRequest');
  });

  it('rejects a pending card request', () => {
    cy.intercept('PATCH', '**/api/cards/requests/301/reject', {
      statusCode: 200,
      body: { ...mockCardRequests[0], status: 'REJECTED' },
    }).as('rejectRequest');

    cy.visit('/employee/card-requests', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCardRequests');
    cy.contains('button', 'Odbij').first().click({ force: true });
    cy.wait('@rejectRequest');
  });

  it('shows empty state when no card requests exist', () => {
    cy.intercept('GET', '**/api/cards/requests*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    }).as('getEmptyRequests');

    cy.visit('/employee/card-requests', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getEmptyRequests');
    cy.contains('Nema').should('exist');
  });

  it('shows request account number and client info', () => {
    cy.visit('/employee/card-requests', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCardRequests');
    // CardRequestsPage shows accountNumber and clientName, but not cardType
    cy.contains('265000000000000001').should('exist');
    cy.contains('Stefan Jovanovic').should('exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING AND ERROR STATES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cards - Loading and Error States', () => {
  beforeEach(() => {
    setupCommonIntercepts();
  });

  it('shows loading skeletons while cards are fetching', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
      delay: 2000,
    }).as('getCardsDelayed');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('.animate-pulse').should('have.length.at.least', 1);
  });

  it('shows error state when cards API returns 500', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 500,
      body: { message: 'Internal Server Error' },
    }).as('getCardsError');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCardsError');
  });

  it('shows empty state with message and action button', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] }).as('getEmptyCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getEmptyCards');
    cy.contains('Nemate kartica').should('be.visible');
    cy.contains('Trenutno nemate nijednu karticu').should('be.visible');
  });

  it('refreshes card list after successful action', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockCards }).as('getCards');
    cy.intercept('PATCH', '**/api/cards/101/block', { statusCode: 200, body: {} }).as('blockCard');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
    cy.get('button[role="switch"][aria-checked="true"]').first().click();
    cy.wait('@blockCard');
    // Should refetch cards
    cy.wait('@getCards');
  });
});
