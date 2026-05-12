import {
  newPaymentSchema,
  transferSchema,
  exchangeSchema,
  createRecipientSchema,
  editRecipientSchema,
  newCardSchema,
  cardLimitSchema,
  accountLimitSchema,
  accountRenameSchema,
  loanApplicationSchema,
  createAccountSchema,
  editClientSchema,
  verificationSchema,
  transactionFilterSchema,
  REPAYMENT_PERIODS,
} from './validationSchemas.celina2';

// --- Helpers ---
const acct18 = '123456789012345678'; // valid 18-digit account number

describe('newPaymentSchema', () => {
  const valid = {
    fromAccountNumber: acct18,
    toAccountNumber: acct18,
    amount: 1000,
    recipientName: 'Petar',
    paymentCode: '289',
    paymentPurpose: 'Uplata',
  };

  it('accepts valid payment', () => {
    expect(newPaymentSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts payment with optional fields', () => {
    expect(newPaymentSchema.safeParse({ ...valid, referenceNumber: '123', model: '97', callNumber: '00' }).success).toBe(true);
  });

  it('rejects invalid account number (not 18 digits)', () => {
    expect(newPaymentSchema.safeParse({ ...valid, fromAccountNumber: '123' }).success).toBe(false);
  });

  it('rejects zero amount', () => {
    expect(newPaymentSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(newPaymentSchema.safeParse({ ...valid, amount: -100 }).success).toBe(false);
  });

  it('rejects amount exceeding max', () => {
    expect(newPaymentSchema.safeParse({ ...valid, amount: 9999999999999 }).success).toBe(false);
  });

  it('rejects invalid payment code (not 2xx)', () => {
    expect(newPaymentSchema.safeParse({ ...valid, paymentCode: '100' }).success).toBe(false);
    expect(newPaymentSchema.safeParse({ ...valid, paymentCode: '300' }).success).toBe(false);
  });

  it('rejects empty recipientName', () => {
    expect(newPaymentSchema.safeParse({ ...valid, recipientName: '' }).success).toBe(false);
  });

  it('rejects empty paymentPurpose', () => {
    expect(newPaymentSchema.safeParse({ ...valid, paymentPurpose: '' }).success).toBe(false);
  });

  it('rejects paymentPurpose over 256 chars', () => {
    expect(newPaymentSchema.safeParse({ ...valid, paymentPurpose: 'x'.repeat(257) }).success).toBe(false);
  });
});

describe('transferSchema', () => {
  const acct2 = '987654321098765432';
  const valid = { fromAccountNumber: acct18, toAccountNumber: acct2, amount: 500 };

  it('accepts valid transfer', () => {
    expect(transferSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects same from and to account', () => {
    expect(transferSchema.safeParse({ ...valid, toAccountNumber: acct18 }).success).toBe(false);
  });

  it('rejects zero amount', () => {
    expect(transferSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
  });

  it('rejects invalid account number', () => {
    expect(transferSchema.safeParse({ ...valid, fromAccountNumber: 'short' }).success).toBe(false);
  });
});

describe('exchangeSchema', () => {
  const valid = { fromCurrency: 'EUR', toCurrency: 'USD', amount: 100 };

  it('accepts valid exchange', () => {
    expect(exchangeSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts with optional accountNumber', () => {
    expect(exchangeSchema.safeParse({ ...valid, accountNumber: acct18 }).success).toBe(true);
  });

  it('rejects same currencies', () => {
    expect(exchangeSchema.safeParse({ ...valid, toCurrency: 'EUR' }).success).toBe(false);
  });

  it('rejects empty fromCurrency', () => {
    expect(exchangeSchema.safeParse({ ...valid, fromCurrency: '' }).success).toBe(false);
  });

  it('rejects zero amount', () => {
    expect(exchangeSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
  });
});

describe('createRecipientSchema', () => {
  it('accepts valid recipient', () => {
    expect(createRecipientSchema.safeParse({ name: 'Petar', accountNumber: acct18 }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createRecipientSchema.safeParse({ name: '', accountNumber: acct18 }).success).toBe(false);
  });

  it('rejects invalid account number', () => {
    expect(createRecipientSchema.safeParse({ name: 'Petar', accountNumber: '123' }).success).toBe(false);
  });
});

describe('editRecipientSchema', () => {
  it('accepts valid edit', () => {
    expect(editRecipientSchema.safeParse({ name: 'Ana', accountNumber: acct18 }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(editRecipientSchema.safeParse({ name: '', accountNumber: acct18 }).success).toBe(false);
  });
});

describe('newCardSchema', () => {
  it('accepts valid card request', () => {
    expect(newCardSchema.safeParse({ accountNumber: acct18, cardType: 'VISA' }).success).toBe(true);
  });

  it('accepts MASTERCARD', () => {
    expect(newCardSchema.safeParse({ accountNumber: acct18, cardType: 'MASTERCARD' }).success).toBe(true);
  });

  it('accepts DINACARD', () => {
    expect(newCardSchema.safeParse({ accountNumber: acct18, cardType: 'DINACARD' }).success).toBe(true);
  });

  it('accepts AMERICAN_EXPRESS', () => {
    expect(newCardSchema.safeParse({ accountNumber: acct18, cardType: 'AMERICAN_EXPRESS' }).success).toBe(true);
  });

  it('rejects invalid card type', () => {
    expect(newCardSchema.safeParse({ accountNumber: acct18, cardType: 'INVALID' }).success).toBe(false);
  });

  it('accepts optional authorizedPersonId', () => {
    expect(newCardSchema.safeParse({ accountNumber: acct18, cardType: 'VISA', authorizedPersonId: 5 }).success).toBe(true);
  });
});

describe('cardLimitSchema', () => {
  it('accepts valid limit', () => {
    expect(cardLimitSchema.safeParse({ limit: 50000 }).success).toBe(true);
  });

  it('accepts zero limit', () => {
    expect(cardLimitSchema.safeParse({ limit: 0 }).success).toBe(true);
  });

  it('rejects negative limit', () => {
    expect(cardLimitSchema.safeParse({ limit: -1 }).success).toBe(false);
  });

  it('rejects non-number', () => {
    expect(cardLimitSchema.safeParse({ limit: 'abc' }).success).toBe(false);
  });
});

describe('accountLimitSchema', () => {
  it('accepts valid limits', () => {
    expect(accountLimitSchema.safeParse({ dailyLimit: 1000, monthlyLimit: 30000 }).success).toBe(true);
  });

  it('accepts only dailyLimit', () => {
    expect(accountLimitSchema.safeParse({ dailyLimit: 500 }).success).toBe(true);
  });

  it('accepts empty object (both optional)', () => {
    expect(accountLimitSchema.safeParse({}).success).toBe(true);
  });

  it('rejects negative dailyLimit', () => {
    expect(accountLimitSchema.safeParse({ dailyLimit: -1 }).success).toBe(false);
  });
});

describe('accountRenameSchema', () => {
  it('accepts valid name', () => {
    expect(accountRenameSchema.safeParse({ name: 'Moj racun' }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(accountRenameSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    expect(accountRenameSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false);
  });
});

describe('loanApplicationSchema', () => {
  const valid = {
    loanType: 'GOTOVINSKI' as const,
    interestRateType: 'FIKSNI' as const,
    amount: 100000,
    currency: 'RSD',
    loanPurpose: 'Kupovina automobila',
    repaymentPeriod: 24,
    accountNumber: acct18,
    phoneNumber: '+381641234567',
  };

  it('accepts valid loan application', () => {
    expect(loanApplicationSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts with optional fields', () => {
    expect(loanApplicationSchema.safeParse({
      ...valid,
      employmentStatus: 'EMPLOYED',
      monthlyIncome: 100000,
      permanentEmployment: true,
      employmentPeriod: 36,
    }).success).toBe(true);
  });

  it('rejects invalid loanType', () => {
    expect(loanApplicationSchema.safeParse({ ...valid, loanType: 'INVALID' }).success).toBe(false);
  });

  it('rejects invalid interestRateType', () => {
    expect(loanApplicationSchema.safeParse({ ...valid, interestRateType: 'INVALID' }).success).toBe(false);
  });

  it('rejects zero amount', () => {
    expect(loanApplicationSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
  });

  it('rejects empty currency', () => {
    expect(loanApplicationSchema.safeParse({ ...valid, currency: '' }).success).toBe(false);
  });

  it('rejects empty loanPurpose', () => {
    expect(loanApplicationSchema.safeParse({ ...valid, loanPurpose: '' }).success).toBe(false);
  });

  it('rejects loanPurpose over 500 chars', () => {
    expect(loanApplicationSchema.safeParse({ ...valid, loanPurpose: 'x'.repeat(501) }).success).toBe(false);
  });

  it('rejects non-integer repaymentPeriod', () => {
    expect(loanApplicationSchema.safeParse({ ...valid, repaymentPeriod: 12.5 }).success).toBe(false);
  });

  it('rejects repaymentPeriod over 360', () => {
    expect(loanApplicationSchema.safeParse({ ...valid, repaymentPeriod: 361 }).success).toBe(false);
  });

  it('accepts STAMBENI type', () => {
    expect(loanApplicationSchema.safeParse({ ...valid, loanType: 'STAMBENI' }).success).toBe(true);
  });

  it('accepts VARIJABILNI interest', () => {
    expect(loanApplicationSchema.safeParse({ ...valid, interestRateType: 'VARIJABILNI' }).success).toBe(true);
  });
});

describe('REPAYMENT_PERIODS', () => {
  it('has correct periods for GOTOVINSKI', () => {
    expect(REPAYMENT_PERIODS.GOTOVINSKI).toEqual([12, 24, 36, 48, 60, 72, 84]);
  });

  it('has correct periods for STAMBENI', () => {
    expect(REPAYMENT_PERIODS.STAMBENI).toEqual([60, 120, 180, 240, 300, 360]);
  });

  it('has correct periods for STUDENTSKI', () => {
    expect(REPAYMENT_PERIODS.STUDENTSKI).toEqual([12, 24, 36, 48, 60]);
  });
});

describe('createAccountSchema', () => {
  // Spec Celina 2 §41-42 + Bug T2-001/T2-002 (12.05.2026): "Tip vlasnistva"
  // (LICNI/POSLOVNI) i "Tip racuna" (TEKUCI/DEVIZNI) su DVA ORTOGONALNA polja.
  // Pre 12.05.2026 jedan dropdown je mesao oba u TEKUCI/DEVIZNI/POSLOVNI sto
  // je onemogucavalo kombinaciju "Poslovni + Devizni". Sad imamo odvojena polja.
  const validLicniTekuci = {
    ownerEmail: 'test@banka.rs',
    ownershipType: 'LICNI' as const,
    accountType: 'TEKUCI' as const,
    accountSubtype: 'STANDARDNI',
    currency: 'RSD',
  };

  it('accepts valid LICNI + TEKUCI account', () => {
    expect(createAccountSchema.safeParse(validLicniTekuci).success).toBe(true);
  });

  it('rejects TEKUCI with non-RSD currency', () => {
    expect(createAccountSchema.safeParse({ ...validLicniTekuci, currency: 'EUR' }).success).toBe(false);
  });

  it('rejects LICNI with business subtype (DOO)', () => {
    expect(createAccountSchema.safeParse({ ...validLicniTekuci, accountSubtype: 'DOO' }).success).toBe(false);
  });

  it('accepts valid LICNI + DEVIZNI account', () => {
    expect(createAccountSchema.safeParse({
      ownerEmail: 'test@banka.rs',
      ownershipType: 'LICNI',
      accountType: 'DEVIZNI',
      accountSubtype: 'STANDARDNI',
      currency: 'EUR',
    }).success).toBe(true);
  });

  it('rejects DEVIZNI with RSD currency', () => {
    expect(createAccountSchema.safeParse({
      ownerEmail: 'test@banka.rs',
      ownershipType: 'LICNI',
      accountType: 'DEVIZNI',
      accountSubtype: 'STANDARDNI',
      currency: 'RSD',
    }).success).toBe(false);
  });

  it('rejects LICNI + DEVIZNI with business subtype', () => {
    expect(createAccountSchema.safeParse({
      ownerEmail: 'test@banka.rs',
      ownershipType: 'LICNI',
      accountType: 'DEVIZNI',
      accountSubtype: 'DOO',
      currency: 'EUR',
    }).success).toBe(false);
  });

  const validPoslovniTekuci = {
    ownerEmail: 'firma@banka.rs',
    ownershipType: 'POSLOVNI' as const,
    accountType: 'TEKUCI' as const,
    accountSubtype: 'DOO',
    currency: 'RSD',
    companyName: 'Test DOO',
    registrationNumber: '12345678',
    taxId: '123456789',
    activityCode: '62.01',
    firmAddress: 'Ulica 1',
    firmCity: 'Beograd',
    firmCountry: 'Srbija',
  };

  it('accepts valid POSLOVNI + TEKUCI account', () => {
    expect(createAccountSchema.safeParse(validPoslovniTekuci).success).toBe(true);
  });

  // Spec §41-42: ortogonalna kombinacija Poslovni + Devizni mora biti dozvoljena.
  // Pre fix-a 12.05.2026 nije bila moguca jer je accountType bio jedan dropdown.
  it('accepts valid POSLOVNI + DEVIZNI account (T2-002 fix)', () => {
    expect(createAccountSchema.safeParse({
      ...validPoslovniTekuci,
      accountType: 'DEVIZNI',
      currency: 'EUR',
    }).success).toBe(true);
  });

  it('rejects POSLOVNI without companyName', () => {
    expect(createAccountSchema.safeParse({ ...validPoslovniTekuci, companyName: '' }).success).toBe(false);
  });

  it('rejects POSLOVNI without registrationNumber', () => {
    expect(createAccountSchema.safeParse({ ...validPoslovniTekuci, registrationNumber: '' }).success).toBe(false);
  });

  it('rejects POSLOVNI without taxId', () => {
    expect(createAccountSchema.safeParse({ ...validPoslovniTekuci, taxId: '' }).success).toBe(false);
  });

  it('rejects POSLOVNI without activityCode', () => {
    expect(createAccountSchema.safeParse({ ...validPoslovniTekuci, activityCode: '' }).success).toBe(false);
  });

  it('rejects POSLOVNI with invalid activityCode format', () => {
    expect(createAccountSchema.safeParse({ ...validPoslovniTekuci, activityCode: '6201' }).success).toBe(false);
  });

  it('rejects POSLOVNI without firmAddress', () => {
    expect(createAccountSchema.safeParse({ ...validPoslovniTekuci, firmAddress: '' }).success).toBe(false);
  });

  it('rejects POSLOVNI without firmCity', () => {
    expect(createAccountSchema.safeParse({ ...validPoslovniTekuci, firmCity: '' }).success).toBe(false);
  });

  it('rejects POSLOVNI without firmCountry', () => {
    expect(createAccountSchema.safeParse({ ...validPoslovniTekuci, firmCountry: '' }).success).toBe(false);
  });

  it('rejects POSLOVNI with personal subtype', () => {
    expect(createAccountSchema.safeParse({ ...validPoslovniTekuci, accountSubtype: 'STANDARDNI' }).success).toBe(false);
  });

  it('accepts optional initialDeposit', () => {
    expect(createAccountSchema.safeParse({ ...validLicniTekuci, initialDeposit: 5000 }).success).toBe(true);
  });

  it('rejects negative initialDeposit', () => {
    expect(createAccountSchema.safeParse({ ...validLicniTekuci, initialDeposit: -100 }).success).toBe(false);
  });

  // Bug T2-003 (12.05.2026): polja za dnevni i mesecni limit.
  it('accepts optional dailyLimit and monthlyLimit', () => {
    expect(createAccountSchema.safeParse({ ...validLicniTekuci, dailyLimit: 250000, monthlyLimit: 1000000 }).success).toBe(true);
  });

  it('rejects negative dailyLimit', () => {
    expect(createAccountSchema.safeParse({ ...validLicniTekuci, dailyLimit: -100 }).success).toBe(false);
  });

  it('rejects dailyLimit greater than monthlyLimit', () => {
    expect(createAccountSchema.safeParse({ ...validLicniTekuci, dailyLimit: 2_000_000, monthlyLimit: 1_000_000 }).success).toBe(false);
  });

  it('accepts DEVIZNI with all foreign currencies', () => {
    for (const cur of ['EUR', 'CHF', 'USD', 'GBP', 'JPY', 'CAD', 'AUD']) {
      expect(createAccountSchema.safeParse({
        ownerEmail: 'test@banka.rs',
        ownershipType: 'LICNI',
        accountType: 'DEVIZNI',
        accountSubtype: 'STANDARDNI',
        currency: cur,
      }).success).toBe(true);
    }
  });

  it('accepts all personal subtypes for LICNI + TEKUCI', () => {
    for (const sub of ['STANDARDNI', 'STEDNI', 'PENZIONERSKI', 'ZA_MLADE', 'STUDENTSKI', 'ZA_NEZAPOSLENE']) {
      expect(createAccountSchema.safeParse({ ...validLicniTekuci, accountSubtype: sub }).success).toBe(true);
    }
  });
});

describe('editClientSchema', () => {
  const valid = {
    firstName: 'Marko',
    lastName: 'Petrovic',
    email: 'marko@banka.rs',
    phoneNumber: '+381641234567',
    address: 'Bulevar 1',
    dateOfBirth: '1990-01-01',
    gender: 'M',
  };

  it('accepts valid client data', () => {
    expect(editClientSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty firstName', () => {
    expect(editClientSchema.safeParse({ ...valid, firstName: '' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(editClientSchema.safeParse({ ...valid, email: 'invalid' }).success).toBe(false);
  });

  it('rejects empty address', () => {
    expect(editClientSchema.safeParse({ ...valid, address: '' }).success).toBe(false);
  });
});

describe('verificationSchema', () => {
  it('accepts valid 6-digit code', () => {
    expect(verificationSchema.safeParse({ code: '123456' }).success).toBe(true);
  });

  it('rejects empty code', () => {
    expect(verificationSchema.safeParse({ code: '' }).success).toBe(false);
  });

  it('rejects code with less than 6 digits', () => {
    expect(verificationSchema.safeParse({ code: '12345' }).success).toBe(false);
  });

  it('rejects code with more than 6 digits', () => {
    expect(verificationSchema.safeParse({ code: '1234567' }).success).toBe(false);
  });

  it('rejects code with non-digit characters', () => {
    expect(verificationSchema.safeParse({ code: 'abcdef' }).success).toBe(false);
  });
});

describe('transactionFilterSchema', () => {
  it('accepts empty filters', () => {
    expect(transactionFilterSchema.safeParse({}).success).toBe(true);
  });

  it('accepts all filter fields', () => {
    expect(transactionFilterSchema.safeParse({
      accountNumber: acct18,
      status: 'COMPLETED',
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
      amountMin: 100,
      amountMax: 50000,
    }).success).toBe(true);
  });

  it('accepts partial filters', () => {
    expect(transactionFilterSchema.safeParse({ status: 'PENDING' }).success).toBe(true);
  });
});
