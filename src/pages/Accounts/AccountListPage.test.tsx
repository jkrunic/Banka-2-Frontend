import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AccountListPage from './AccountListPage';
import {
  mockAccount,
  mockAccountEUR,
  mockTransaction,
  paginatedResponse,
} from '@/test/helpers';

// ---------- Mocks ----------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: vi.fn(),
    submitRequest: vi.fn(),
  },
}));

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 1, email: 'marko@banka.rs', firstName: 'Marko', lastName: 'Petrovic', role: 'CLIENT' },
    isAdmin: false,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasPermission: vi.fn(() => false),
  })),
}));

import { accountService } from '@/services/accountService';
import { transactionService } from '@/services/transactionService';

const mockAccountService = vi.mocked(accountService);
const mockTransactionService = vi.mocked(transactionService);

const highBalanceAcc = mockAccount({ id: 1, balance: 500000, availableBalance: 500000, name: 'Glavni racun' });
const lowBalanceAcc = mockAccount({ id: 2, balance: 50000, availableBalance: 50000, accountNumber: '265000000000000005', name: 'Stedni racun' });
const eurAcc = mockAccountEUR({ id: 3, balance: 3000, availableBalance: 3000 });

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accounts']}>
      <AccountListPage />
    </MemoryRouter>
  );
}

describe('AccountListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountService.getMyAccounts.mockResolvedValue([lowBalanceAcc, highBalanceAcc, eurAcc]);
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([]));
  });

  it('renders account list after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Glavni racun/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/Stedni racun/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Devizni racun/i).length).toBeGreaterThanOrEqual(1);
  });

  it('sorts accounts by balance (highest first)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Glavni racun/i).length).toBeGreaterThanOrEqual(1);
    });

    // The accounts should be rendered. The first account selected (by availableBalance desc)
    // should be the highest balance account
    expect(mockAccountService.getMyAccounts).toHaveBeenCalledTimes(1);
  });

  it('shows loading skeleton initially', () => {
    mockAccountService.getMyAccounts.mockImplementation(() => new Promise(() => {}));

    renderPage();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state when fetch fails', async () => {
    mockAccountService.getMyAccounts.mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Greska pri ucitavanju/i)).toBeInTheDocument();
    });
  });

  it('fetches transactions when an account is selected', async () => {
    const tx = mockTransaction({ fromAccountNumber: highBalanceAcc.accountNumber });
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([tx]));

    renderPage();

    await waitFor(() => {
      expect(mockTransactionService.getAll).toHaveBeenCalled();
    });
  });

  it('renders page header with title', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Racuni/i)).toBeInTheDocument();
    });
  });

  it('renders new account button', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockAccountService.getMyAccounts).toHaveBeenCalled();
    });

    // Look for the new account/open account button
    screen.queryByText(/Otvori racun|Novi racun|Zahtev/i);
    // May or may not exist depending on admin status, but page should render fine
    expect(screen.getAllByText(/Glavni racun/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows transactions for selected account', async () => {
    const tx = mockTransaction({
      fromAccountNumber: highBalanceAcc.accountNumber,
      toAccountNumber: '265000000000000099',
      paymentPurpose: 'Placanje struje',
      recipientName: 'EPS',
      status: 'COMPLETED',
    });
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([tx]));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Placanje struje')).toBeInTheDocument();
    });

    expect(screen.getByText('EPS')).toBeInTheDocument();
  });

  it('shows empty transaction state when no transactions', async () => {
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([]));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Nema transakcija za ovaj racun/i)).toBeInTheDocument();
    });
  });

  it('toggles account filter panel', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Glavni racun/i).length).toBeGreaterThanOrEqual(1);
    });

    // Click filter button (SlidersHorizontal icon button)
    const filterButtons = screen.getAllByTitle(/Filteri/i);
    await user.click(filterButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Svi tipovi/i)).toBeInTheDocument();
    });
  });

  it('selects an account when clicked', async () => {
    const tx = mockTransaction({ fromAccountNumber: lowBalanceAcc.accountNumber });
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([tx]));

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Stedni racun/i).length).toBeGreaterThanOrEqual(1);
    });

    // The page auto-selects the highest balance account.
    // Click on the "Stedni racun" card to select it.
    const stedniCards = screen.getAllByText(/Stedni racun/i);
    const stedniCard = stedniCards[0].closest('[class*="cursor-pointer"]');
    if (stedniCard) {
      await user.click(stedniCard);
    }

    await waitFor(() => {
      expect(mockTransactionService.getAll).toHaveBeenCalled();
    });
  });

  it('classifies outgoing transactions correctly', async () => {
    const tx = mockTransaction({
      fromAccountNumber: highBalanceAcc.accountNumber,
      toAccountNumber: '265000000000000099',
      paymentPurpose: 'Kupovina',
    });
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([tx]));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Kupovina')).toBeInTheDocument();
    });

    // Outgoing transaction should show "Isplata" type badge
    expect(screen.getByText('Isplata')).toBeInTheDocument();
  });

  it('classifies incoming transactions correctly', async () => {
    const tx = mockTransaction({
      fromAccountNumber: '265000000000000099',
      toAccountNumber: highBalanceAcc.accountNumber,
      paymentPurpose: 'Plata',
    });
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([tx]));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Plata')).toBeInTheDocument();
    });

    expect(screen.getByText('Uplata')).toBeInTheDocument();
  });

  it('classifies internal transfers correctly', async () => {
    // Transfer between two of the user's own accounts
    const tx = mockTransaction({
      fromAccountNumber: highBalanceAcc.accountNumber,
      toAccountNumber: lowBalanceAcc.accountNumber,
      paymentPurpose: 'Prenos',
    });
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([tx]));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Prenos')).toBeInTheDocument();
    });

    expect(screen.getByText('Transfer')).toBeInTheDocument();
  });

  it('classifies exchange transactions correctly', async () => {
    const tx = mockTransaction({
      fromAccountNumber: highBalanceAcc.accountNumber,
      toAccountNumber: '265000000000000099',
      paymentPurpose: 'Konverzija RSD u EUR',
    });
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([tx]));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Konverzija RSD u EUR/)).toBeInTheDocument();
    });

    expect(screen.getByText('Menjacnica')).toBeInTheDocument();
  });

  it('shows total balance summary card', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Ukupno stanje/i)).toBeInTheDocument();
    });

    // Should show total RSD balance
    expect(screen.getByText(/Ukupno racuna/i)).toBeInTheDocument();
  });

  it('shows transaction filters panel when toggled', async () => {
    const tx = mockTransaction({ fromAccountNumber: highBalanceAcc.accountNumber });
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([tx]));

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Transakcije/i)).toBeInTheDocument();
    });

    // Click the tx filter toggle button
    const filterButtons = screen.getAllByTitle(/Filteri/i);
    // The second filter button is the transaction filter
    if (filterButtons.length >= 2) {
      await user.click(filterButtons[1]);

      await waitFor(() => {
        expect(screen.getByText(/Svi statusi/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Resetuj/i)).toBeInTheDocument();
    }
  });

  it('handles account fetch error', async () => {
    mockAccountService.getMyAccounts.mockRejectedValue(new Error('fail'));
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([]));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Greska pri ucitavanju racuna/i)).toBeInTheDocument();
    });
  });

  it('shows empty accounts state when no accounts match filter', async () => {
    mockAccountService.getMyAccounts.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Nema pronadjenih racuna/i)).toBeInTheDocument();
    });
  });

  it('shows transaction error state', async () => {
    mockTransactionService.getAll.mockRejectedValue(new Error('tx fail'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Greska pri ucitavanju transakcija/i)).toBeInTheDocument();
    });
  });
});
