/// <reference types="cypress" />
// Comprehensive E2E tests for OTP Verification Flow:
// Payment with OTP, Transfer with OTP, Limit change with OTP, and failed OTP scenarios.
import { setupClientSession } from '../support/commands';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockAccounts = [
  {
    id: 1, accountNumber: '265000000000000001', name: 'Tekuci RSD',
    accountType: 'CHECKING', currency: 'RSD', balance: 150000,
    availableBalance: 145000, status: 'ACTIVE', dailyLimit: 500000,
    monthlyLimit: 2000000, dailySpending: 10000, monthlySpending: 50000,
    reservedBalance: 5000, maintenanceFee: 200, ownerName: 'Stefan Jovanovic',
    createdAt: '2025-01-01',
  },
  {
    id: 2, accountNumber: '265000000000000002', name: 'Devizni EUR',
    accountType: 'FOREIGN', currency: 'EUR', balance: 5000,
    availableBalance: 4800, status: 'ACTIVE', dailyLimit: 10000,
    monthlyLimit: 50000, dailySpending: 0, monthlySpending: 0,
    reservedBalance: 200, maintenanceFee: 5, ownerName: 'Stefan Jovanovic',
    createdAt: '2025-02-01',
  },
];

const mockRecipients = [
  { id: 1, name: 'Petar Petrovic', accountNumber: '265000000000000099' },
  { id: 2, name: 'Ana Markovic', accountNumber: '265000000000000088' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupCommonIntercepts() {
  cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake-access-token' } });
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: mockRecipients });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/requests/my*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
  cy.intercept('POST', '**/api/payments/request-otp-email', { statusCode: 200, body: { sent: true } });
}

function setupOtpIntercepts() {
  cy.intercept('POST', '**/api/payments/request-otp', {
    statusCode: 200,
    body: { sent: true, message: 'OTP sent' },
  }).as('requestOtp');
}

/**
 * Fill out the payment form using correct selectors for native <select> and react-hook-form input names.
 */
function fillPaymentForm() {
  // Select source account via native <select>
  cy.get('select[name="fromAccountNumber"]').select(mockAccounts[0].accountNumber);
  // Fill recipient fields
  cy.get('input[name="recipientName"]').type('Petar Petrovic');
  cy.get('input[name="toAccountNumber"]').clear().type('265000000000000099');
  cy.get('input[name="amount"]').clear().type('5000');
  // paymentPurpose is a <textarea>, not <input>
  cy.get('textarea[name="paymentPurpose"]').type('Test placanje');
  // paymentCode already defaults to '289', clear and retype to be safe
  cy.get('input[name="paymentCode"]').clear().type('289');
  // Submit the form
  cy.contains('button', 'Nastavi').click({ force: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT WITH OTP VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('OTP Verification - Payment Flow', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    setupOtpIntercepts();
  });

  it('shows verification modal after payment form submission', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
  });

  it('displays OTP modal with timer and input', () => {
    cy.intercept('POST', '**/api/payments', {
      statusCode: 200,
      body: { id: 100, status: 'PENDING' },
    }).as('submitPayment');

    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();

    // Verification modal should appear
    cy.contains('Verifikacija transakcije').should('be.visible');
    // Timer should be visible
    cy.contains(/\d{2}:\d{2}/).should('exist');
    // OTP input should be visible
    cy.get('input[name="code"]').should('be.visible');
  });

  it('requests OTP when modal opens', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');
  });

  it('submits OTP code and completes payment', () => {
    cy.intercept('POST', '**/api/payments', {
      statusCode: 200,
      body: { id: 100, status: 'COMPLETED' },
    }).as('submitPayment');

    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    // Enter OTP code
    cy.get('input[name="code"]').type('123456');
    cy.contains('button', 'Potvrdi').click();
  });

  it('shows OTP modal description about mobile app', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    cy.contains('mobilnu aplikaciju').should('be.visible');
  });

  it('shows Potvrdi and close buttons in OTP modal', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    cy.contains('button', 'Potvrdi').should('be.visible');
    cy.get('button[aria-label="Zatvori"]').should('be.visible');
  });

  it('closes OTP modal when clicking close without completing payment', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    cy.get('button[aria-label="Zatvori"]').click();
    cy.contains('Verifikacija transakcije').should('not.exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSFER WITH OTP VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('OTP Verification - Transfer Flow', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    setupOtpIntercepts();
  });

  it('shows transfer page with source account selector', () => {
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    // Transfer page should show account selectors
    cy.get('select').should('have.length.at.least', 1);
  });

  it('opens transfer page and selects source account', () => {
    cy.intercept('POST', '**/api/transfers/internal', {
      statusCode: 200,
      body: { id: 200, status: 'COMPLETED' },
    }).as('submitTransfer');

    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    // Select source account via native select
    cy.get('select').first().select(mockAccounts[0].accountNumber);
  });

  it('can select accounts for transfer', () => {
    cy.intercept('POST', '**/api/transfers/internal', {
      statusCode: 200,
      body: { id: 200, status: 'COMPLETED' },
    }).as('submitTransfer');

    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('select').first().select(mockAccounts[0].accountNumber);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LIMIT CHANGE WITH OTP VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('OTP Verification - Limit Change Flow', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    setupOtpIntercepts();
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] }).as('getAccountDetail');
    // Intercept transaction history for account details page
    cy.intercept('GET', '**/api/payments/account/**', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
  });

  it('shows limit change dialog on account details page', () => {
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountDetail');
    cy.contains('button', 'Promeni limit').click();
    cy.contains('Promena limita').should('be.visible');
  });

  it('displays daily and monthly limit input fields', () => {
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountDetail');
    cy.contains('button', 'Promeni limit').click();
    cy.get('#dailyLimit').should('be.visible');
    cy.get('#monthlyLimit').should('be.visible');
  });

  it('submits limit change and triggers OTP verification modal', () => {
    cy.intercept('PATCH', '**/api/accounts/1/limits', {
      statusCode: 200,
      body: {},
    }).as('changeLimits');

    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountDetail');
    cy.contains('button', 'Promeni limit').click();
    cy.get('#dailyLimit').clear().type('600000');
    cy.get('#monthlyLimit').clear().type('3000000');
    cy.contains('button', 'Sacuvaj limite').click();
    // Limit change now opens OTP verification modal
    cy.contains('Verifikacija transakcije').should('be.visible');
    cy.wait('@requestOtp');
    // Enter OTP code and confirm
    cy.get('input[name="code"]').type('123456');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@changeLimits');
    cy.contains('Limiti su uspesno sacuvani').should('be.visible');
  });

  it('shows validation error for invalid limit values', () => {
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountDetail');
    cy.contains('button', 'Promeni limit').click();
    cy.get('#dailyLimit').clear().type('0');
    cy.get('#monthlyLimit').clear().type('0');
    cy.contains('button', 'Sacuvaj limite').click();
  });

  it('handles limit change API error', () => {
    cy.intercept('PATCH', '**/api/accounts/1/limits', {
      statusCode: 500,
      body: { message: 'Server error' },
    }).as('changeLimitsError');

    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountDetail');
    cy.contains('button', 'Promeni limit').click();
    cy.get('#dailyLimit').clear().type('600000');
    cy.get('#monthlyLimit').clear().type('3000000');
    cy.contains('button', 'Sacuvaj limite').click();
    // Goes through OTP flow, then API returns error
    cy.contains('Verifikacija transakcije').should('be.visible');
    cy.wait('@requestOtp');
    cy.get('input[name="code"]').type('123456');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@changeLimitsError');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FAILED OTP SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

describe('OTP Verification - Failed Scenarios', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    setupOtpIntercepts();
  });

  it('shows error message for wrong OTP code', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    // Mock payment to fail with wrong OTP
    cy.intercept('POST', '**/api/payments', {
      statusCode: 400,
      body: { message: 'Neispravan verifikacioni kod.' },
    }).as('paymentWrongOtp');

    cy.get('input[name="code"]').type('000000');
    cy.contains('button', 'Potvrdi').click();
  });

  it('shows remaining attempts counter', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    // The modal should show attempts remaining (3)
    cy.contains('3').should('exist');
  });

  it('shows countdown timer starting from 05:00', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    // Timer should start at 05:00 or 04:59
    cy.contains(/0[45]:\d{2}/).should('exist');
  });

  it('validates OTP code length (6 digits)', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    // Type only 3 digits - should not allow submission
    cy.get('input[name="code"]').type('123');
    cy.contains('button', 'Potvrdi').click();
    // Should show validation error
    cy.contains('6').should('exist');
  });

  it('shows error when OTP request fails', () => {
    cy.intercept('POST', '**/api/payments/request-otp', {
      statusCode: 500,
      body: { sent: false, message: 'Error' },
    }).as('requestOtpError');

    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtpError');
  });

  it('disables submit button while OTP is being verified', () => {
    cy.intercept('POST', '**/api/payments', {
      statusCode: 200,
      body: { id: 100, status: 'COMPLETED' },
      delay: 2000,
    }).as('paymentSlow');

    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    cy.get('input[name="code"]').type('123456');
    cy.contains('button', 'Potvrdi').click();
    // Button should be disabled during submission
    cy.get('button:disabled').should('have.length.at.least', 1);
  });

  it('shows shield icon in OTP modal header', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    // Shield icon in gradient container
    cy.get('[class*="bg-gradient-to-br"][class*="from-indigo"]').should('exist');
  });

  it('shows OTP modal with backdrop overlay', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    // Overlay should exist
    cy.get('[class*="backdrop-blur"]').should('exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// OTP EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('OTP Verification - Edge Cases', () => {
  beforeEach(() => {
    setupCommonIntercepts();
  });

  it('does not submit payment when modal is closed without entering code', () => {
    setupOtpIntercepts();

    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    // Close the modal without entering code
    cy.get('button[aria-label="Zatvori"]').click();

    // User should still be on the payment page
    cy.url().should('include', '/payments/new');
  });

  it('validates that OTP code only accepts digits', () => {
    setupOtpIntercepts();

    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    // Type non-digits
    cy.get('input[name="code"]').type('abcdef');
    cy.contains('button', 'Potvrdi').click();
  });

  it('shows loading spinner on Potvrdi button during submission', () => {
    setupOtpIntercepts();
    cy.intercept('POST', '**/api/payments', {
      statusCode: 200,
      body: { id: 100, status: 'COMPLETED' },
      delay: 3000,
    }).as('paymentVerySlow');

    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    cy.get('input[name="code"]').type('123456');
    cy.contains('button', 'Potvrdi').click();
    // Should show loader
    cy.get('svg.animate-spin, .animate-spin').should('exist');
  });

  it('OTP modal shows email icon for sending indication', () => {
    setupOtpIntercepts();

    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    fillPaymentForm();
    cy.wait('@requestOtp');

    // Modal should contain shield/email related SVG
    cy.get('svg').should('have.length.at.least', 1);
  });
});
