import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FundDetailsPage from './FundDetailsPage';
import { renderWithProviders } from '@/test/test-utils';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockGet = vi.fn();
const mockGetPerformance = vi.fn();
const mockMyPositions = vi.fn();
const mockBankPositions = vi.fn();
const mockListFunds = vi.fn();
const mockGetFundStatistics = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '101' }),
  };
});

vi.mock('@/context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/context/AuthContext')>();
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

vi.mock('@/services/investmentFundService', () => ({
  default: {
    get: (...a: unknown[]) => mockGet(...a),
    getPerformance: (...a: unknown[]) => mockGetPerformance(...a),
    list: (...a: unknown[]) => mockListFunds(...a),
    myPositions: (...a: unknown[]) => mockMyPositions(...a),
    bankPositions: (...a: unknown[]) => mockBankPositions(...a),
  },
}));

vi.mock('@/services/fundStatisticsService', () => ({
  default: {
    getFundStatistics: (...a: unknown[]) => mockGetFundStatistics(...a),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./FundInvestDialog', () => ({ default: () => null }));
vi.mock('./FundWithdrawDialog', () => ({ default: () => null }));

const FUND = {
  id: 101,
  name: 'Alpha Growth',
  description: 'IT sektor',
  managerEmployeeId: 7,
  managerName: 'Marko Petrovic',
  fundValue: 5_000_000,
  liquidAmount: 1_000_000,
  profit: 250_000,
  minimumContribution: 1000,
  accountNumber: '111-222-333',
  inceptionDate: '2024-01-01',
  holdings: [
    {
      listingId: 1,
      ticker: 'AAPL',
      name: 'Apple Inc',
      currentPrice: 200,
      change: 1.5,
      quantity: 10,
      initialMarginCost: 110,
      acquisitionDate: '2024-06-01',
    },
  ],
};

const PERFORMANCE = [
  { date: '2026-01-01', fundValue: 4_800_000, profit: 0 },
  { date: '2026-02-01', fundValue: 4_950_000, profit: 150_000 },
  { date: '2026-03-01', fundValue: 5_000_000, profit: 200_000 },
];

const FUND_STATS = {
  fundId: 101,
  fundName: 'Alpha Growth',
  snapshotCount: 90,
  annualizedReturnPercent: 12.34,
  volatilityPercent: 4.2,
  maxDrawdownPercent: -8.5,
  rewardToVariabilityRatio: 2.94,
  sufficientHistory: true,
};

describe('FundDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 7, role: 'EMPLOYEE' }, isSupervisor: true });
    mockGet.mockResolvedValue(FUND);
    mockGetPerformance.mockResolvedValue(PERFORMANCE);
    mockMyPositions.mockResolvedValue([]);
    mockBankPositions.mockResolvedValue([]);
    mockListFunds.mockResolvedValue([{ id: 101 }, { id: 102 }]);
    mockGetFundStatistics.mockResolvedValue(FUND_STATS);
  });

  it('prikazuje loading skeleton dok ucitava', () => {
    let resolve: (v: unknown) => void = () => {};
    mockGet.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { container } = renderWithProviders(<FundDetailsPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    resolve(FUND);
  });

  it('prikazuje sve KPI kartice (Vrednost, Likvidnost, Profit, Min. ulog)', async () => {
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() => expect(screen.getByText('Alpha Growth')).toBeInTheDocument());
    expect(screen.getByText(/Vrednost fonda/)).toBeInTheDocument();
    expect(screen.getByText('Likvidnost')).toBeInTheDocument();
    expect(screen.getByText('Profit')).toBeInTheDocument();
    expect(screen.getByText(/Minimalni ulog/)).toBeInTheDocument();
  });

  it('prikazuje listu hartija u fondu', async () => {
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument());
    expect(screen.getByText('Apple Inc')).toBeInTheDocument();
  });

  it('owner supervisor vidi Prodaj dugme za hartije', async () => {
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument());
    expect(screen.getByText('Prodaj')).toBeInTheDocument();
  });

  it('Prodaj dugme navigira na new order URL sa fundId param-om', async () => {
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() => expect(screen.getByText('Prodaj')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Prodaj'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/orders/new?listingId=1&direction=SELL&fundId=101')
    );
  });

  it('non-owner supervisor (drugi manager) NE vidi Prodaj dugme', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 99, role: 'EMPLOYEE' }, isSupervisor: true });
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument());
    expect(screen.queryByText('Prodaj')).not.toBeInTheDocument();
  });

  it('promena perioda re-fetchuje performance', async () => {
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() => expect(mockGetPerformance).toHaveBeenCalled());
    // getPerformance zovu i glavni efekat i benchmark efekat (FE4 7.2), pa
    // proveravamo da promena perioda pokreće NOV fetch, ne tačan broj poziva.
    mockGetPerformance.mockClear();
    await userEvent.click(screen.getByText('1G'));
    await waitFor(() => expect(mockGetPerformance).toHaveBeenCalled());
  });

  it('back arrow dugme navigira na /funds', async () => {
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() => expect(screen.getByText('Alpha Growth')).toBeInTheDocument());
    const backBtn = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-arrow-left'));
    expect(backBtn).toBeTruthy();
    await userEvent.click(backBtn!);
    expect(mockNavigate).toHaveBeenCalledWith('/funds');
  });

  it('greska u get() pokrece toast.error i navigaciju nazad', async () => {
    mockGet.mockRejectedValue(new Error('500'));
    const { toast } = await import('@/lib/notify');
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/funds');
  });

  it('empty state se renderuje kad fond nema hartija', async () => {
    mockGet.mockResolvedValue({ ...FUND, holdings: [] });
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() => expect(screen.getByText(/Fond trenutno nema hartija/i)).toBeInTheDocument());
  });

  it('empty state za performance kad nema podataka', async () => {
    mockGetPerformance.mockResolvedValue([]);
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() => expect(screen.getByText(/Nema podataka o performansama/i)).toBeInTheDocument());
  });

  it('client role pokrece myPositions umesto bankPositions', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 50, role: 'CLIENT' }, isSupervisor: false });
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    await waitFor(() => expect(mockMyPositions).toHaveBeenCalled());
    expect(mockBankPositions).not.toHaveBeenCalled();
  });

  // --- FE4 (7.2) — statistika fondova ---

  it('prikazuje karticu Metrike performansi sa metrikama (B12)', async () => {
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() =>
      expect(screen.getByText('Metrike performansi')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByTestId('fund-stats-grid')).toBeInTheDocument(),
    );
    expect(screen.getByText('Godišnji prinos')).toBeInTheDocument();
    expect(screen.getByText('Volatilnost')).toBeInTheDocument();
  });

  it('prikazuje poruku kad B12 metrike nisu dostupne (404)', async () => {
    mockGetFundStatistics.mockRejectedValue({ response: { status: 404 } });
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('fund-stats-unavailable')).toBeInTheDocument(),
    );
  });

  it('renderuje uporedni grafik (Poređenje sa prosekom fondova)', async () => {
    renderWithProviders(<FundDetailsPage />);
    await waitFor(() =>
      expect(screen.getByText('Poređenje sa prosekom fondova')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByTestId('fund-comparison-chart')).toBeInTheDocument(),
    );
  });
});
