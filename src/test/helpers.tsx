/**
 * Shared test helpers and mock factories for Celina 2 page tests.
 */
import type { Account, Transaction, PaymentRecipient, ExchangeRate, Loan, LoanRequest, Installment } from '@/types/celina2';
import type { Card as BankCard } from '@/types/celina2';

// ---------- Mock data factories ----------

export function mockAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    accountNumber: '265000000000000001',
    ownerName: 'Marko Petrovic',
    accountType: 'CHECKING',
    currency: 'RSD',
    balance: 150000,
    availableBalance: 140000,
    reservedBalance: 10000,
    dailyLimit: 500000,
    monthlyLimit: 2000000,
    dailySpending: 50000,
    monthlySpending: 300000,
    maintenanceFee: 250,
    status: 'ACTIVE',
    createdAt: '2025-01-15T10:00:00Z',
    name: 'Tekuci racun',
    ...overrides,
  };
}

export function mockAccountEUR(overrides: Partial<Account> = {}): Account {
  return mockAccount({
    id: 2,
    accountNumber: '265000000000000002',
    accountType: 'FOREIGN',
    currency: 'EUR',
    balance: 5000,
    availableBalance: 4800,
    reservedBalance: 200,
    name: 'Devizni racun',
    ...overrides,
  });
}

export function mockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    fromAccountNumber: '265000000000000001',
    toAccountNumber: '265000000000000099',
    amount: 15000,
    currency: 'RSD',
    description: 'Uplata za racun',
    referenceNumber: 'REF-001',
    paymentCode: '289',
    paymentPurpose: 'Placanje racuna za struju',
    recipientName: 'EPS Srbija',
    status: 'COMPLETED',
    createdAt: new Date().toISOString(),
    model: '97',
    callNumber: '12345',
    ...overrides,
  };
}

export function mockRecipient(overrides: Partial<PaymentRecipient> = {}): PaymentRecipient {
  return {
    id: 1,
    name: 'Marko Petrovic',
    accountNumber: '265000000000000099',
    ...overrides,
  };
}

export function mockExchangeRate(overrides: Partial<ExchangeRate> = {}): ExchangeRate {
  return {
    currency: 'EUR',
    buyRate: 116.5,
    sellRate: 118.5,
    middleRate: 117.5,
    date: '2026-04-03T10:00:00Z',
    ...overrides,
  };
}

export function mockCard(overrides: Partial<BankCard> = {}): BankCard {
  return {
    id: 1,
    cardNumber: '4111111111111234',
    cardType: 'VISA',
    cardName: 'Visa Debit',
    accountNumber: '265000000000000001',
    holderName: 'Marko Petrovic',
    expirationDate: '2028-12-31T00:00:00Z',
    status: 'ACTIVE',
    limit: 100000,
    createdAt: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

export function mockLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 1,
    loanType: 'GOTOVINSKI',
    amount: 1000000,
    repaymentPeriod: 24,
    interestRateType: 'FIKSNI',
    nominalRate: 7.75,
    effectiveRate: 8.25,
    monthlyPayment: 45000,
    startDate: '2025-06-01T00:00:00Z',
    endDate: '2027-06-01T00:00:00Z',
    remainingDebt: 750000,
    currency: 'RSD',
    status: 'ACTIVE',
    accountNumber: '265000000000000001',
    loanPurpose: 'Kupovina opreme',
    ...overrides,
  };
}

export function mockLoanRequest(overrides: Partial<LoanRequest> = {}): LoanRequest {
  return {
    id: 100,
    loanType: 'GOTOVINSKI',
    interestRateType: 'FIKSNI',
    amount: 500000,
    currency: 'RSD',
    loanPurpose: 'Licne potrebe',
    repaymentPeriod: 12,
    accountNumber: '265000000000000001',
    phoneNumber: '0611234567',
    status: 'PENDING',
    createdAt: '2026-03-20T10:00:00Z',
    ...overrides,
  };
}

export function mockInstallment(overrides: Partial<Installment> = {}): Installment {
  return {
    id: 1,
    loanNumber: 'LOAN-001',
    amount: 45000,
    principalAmount: 38000,
    interestAmount: 7000,
    interestRate: 7.75,
    currency: 'RSD',
    expectedDueDate: '2025-07-01T00:00:00Z',
    paid: true,
    ...overrides,
  };
}

export function paginatedResponse<T>(content: T[], totalElements?: number) {
  return {
    content,
    totalElements: totalElements ?? content.length,
    totalPages: Math.ceil((totalElements ?? content.length) / 10),
    size: 10,
    number: 0,
  };
}
