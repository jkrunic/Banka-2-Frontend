import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OtcNegotiationHistoryPage from './OtcNegotiationHistoryPage';
import { renderWithProviders } from '@/test/test-utils';

const mockGetHistory = vi.fn();
const mockGetChain = vi.fn();

vi.mock('@/services/otcService', () => ({
  default: {
    getNegotiationHistory: (...a: unknown[]) => mockGetHistory(...a),
    getNegotiationHistoryById: (...a: unknown[]) => mockGetChain(...a),
  },
}));

const ENTRY_A = {
  id: 1,
  negotiationId: 10,
  quantity: 5,
  pricePerShare: 100,
  premium: 12,
  settlementDate: '2026-06-30',
  status: 'ACTIVE',
  modifiedById: 7,
  modifiedByName: 'Marko Petrović',
  createdAt: '2026-05-10T10:00:00',
};

const ENTRY_B = {
  id: 2,
  negotiationId: 11,
  quantity: 8,
  pricePerShare: 220,
  premium: 30,
  settlementDate: '2026-07-15',
  status: 'ACCEPTED',
  modifiedById: 9,
  modifiedByName: 'Jelena Đorđević',
  createdAt: '2026-05-12T14:00:00',
};

const PAGE = {
  content: [ENTRY_A, ENTRY_B],
  totalElements: 2,
  totalPages: 1,
  number: 0,
  size: 20,
};

describe('OtcNegotiationHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHistory.mockResolvedValue(PAGE);
    mockGetChain.mockResolvedValue([ENTRY_A]);
  });

  it('renderuje page header sa naslovom "Istorija OTC pregovora"', () => {
    renderWithProviders(<OtcNegotiationHistoryPage />);
    expect(screen.getByText('Istorija OTC pregovora')).toBeInTheDocument();
  });

  it('prikazuje skeleton dok se učitava', () => {
    mockGetHistory.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OtcNegotiationHistoryPage />);
    expect(screen.getByTestId('otc-history-loading')).toBeInTheDocument();
  });

  it('prikazuje tabelu zapisa posle uspešnog fetch-a', async () => {
    renderWithProviders(<OtcNegotiationHistoryPage />);
    await waitFor(() => expect(screen.getByText('#10')).toBeInTheDocument());
    expect(screen.getByText('#11')).toBeInTheDocument();
    expect(screen.getByText('Marko Petrović')).toBeInTheDocument();
    expect(screen.getByText('Jelena Đorđević')).toBeInTheDocument();
  });

  it('prikazuje prazno stanje kad nema zapisa', async () => {
    mockGetHistory.mockResolvedValue({ ...PAGE, content: [], totalElements: 0 });
    renderWithProviders(<OtcNegotiationHistoryPage />);
    await waitFor(() =>
      expect(screen.getByTestId('otc-history-empty')).toBeInTheDocument(),
    );
  });

  it('badge statusa ACCEPTED prikazuje labelu "Prihvaćen"', async () => {
    renderWithProviders(<OtcNegotiationHistoryPage />);
    await waitFor(() => expect(screen.getByText('#11')).toBeInTheDocument());
    // "Prihvaćen" je i opcija u filteru i badge u redu — skopiraj na red #11.
    const row = screen.getByText('#11').closest('tr')!;
    expect(within(row).getByText('Prihvaćen')).toBeInTheDocument();
  });

  it('promena filtera statusa šalje status param BE-u', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OtcNegotiationHistoryPage />);
    await waitFor(() => expect(screen.getByText('#10')).toBeInTheDocument());

    await user.selectOptions(screen.getByTestId('otc-history-status-filter'), 'ACCEPTED');

    await waitFor(() => {
      const lastCall = mockGetHistory.mock.calls[mockGetHistory.mock.calls.length - 1][0];
      expect(lastCall.status).toBe('ACCEPTED');
    });
  });

  it('pretraga po drugoj strani filtrira redove client-side', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OtcNegotiationHistoryPage />);
    await waitFor(() => expect(screen.getByText('#10')).toBeInTheDocument());

    await user.type(screen.getByTestId('otc-history-counterparty-search'), 'marko');

    await waitFor(() => expect(screen.queryByText('#11')).not.toBeInTheDocument());
    expect(screen.getByText('#10')).toBeInTheDocument();
  });

  it('expand reda učitava i prikazuje lanac kontraponuda', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OtcNegotiationHistoryPage />);
    await waitFor(() => expect(screen.getByTestId('otc-history-toggle-1')).toBeInTheDocument());

    await user.click(screen.getByTestId('otc-history-toggle-1'));

    expect(mockGetChain).toHaveBeenCalledWith(10);
    await waitFor(() =>
      expect(screen.getByTestId('otc-chain-table')).toBeInTheDocument(),
    );
  });

  it('prikazuje poruku kad B10 endpoint vrati 404', async () => {
    mockGetHistory.mockRejectedValue({ response: { status: 404 } });
    renderWithProviders(<OtcNegotiationHistoryPage />);
    await waitFor(() =>
      expect(screen.getByTestId('otc-history-unavailable')).toBeInTheDocument(),
    );
  });

  it('prikazuje grešku kad fetch padne sa ne-404 greškom', async () => {
    mockGetHistory.mockRejectedValue({ response: { status: 500 } });
    renderWithProviders(<OtcNegotiationHistoryPage />);
    await waitFor(() =>
      expect(screen.getByTestId('otc-history-error')).toBeInTheDocument(),
    );
  });
});
