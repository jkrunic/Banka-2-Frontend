import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';
import { renderWithProviders } from '../../test/test-utils';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockLogin = vi.fn();

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/AuthContext')>('../../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      hasPermission: () => false,
      isAdmin: false,
    }),
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password fields', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText(/email adresa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lozinka/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prijavi se/i })).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /prijavi se/i }));

    await waitFor(() => {
      expect(screen.getByText(/email je obavezan/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/lozinka je obavezna/i)).toBeInTheDocument();
  });

  it('shows email format error for invalid email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email adresa/i), 'invalid-email');
    await user.type(screen.getByLabelText(/lozinka/i), 'Test1234');
    await user.click(screen.getByRole('button', { name: /prijavi se/i }));

    await waitFor(() => {
      expect(screen.getByText(/validan email/i)).toBeInTheDocument();
    });
  });

  it('calls login with form data on valid submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email adresa/i), 'test@banka.rs');
    await user.type(screen.getByLabelText(/lozinka/i), 'Test1234');
    await user.click(screen.getByRole('button', { name: /prijavi se/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@banka.rs',
        password: 'Test1234',
      });
    });
  });

  it('shows loading state while submitting', async () => {
    // Make login hang so we can check the loading state
    mockLogin.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email adresa/i), 'test@banka.rs');
    await user.type(screen.getByLabelText(/lozinka/i), 'Test1234');
    await user.click(screen.getByRole('button', { name: /prijavi se/i }));

    await waitFor(() => {
      expect(screen.getByText(/prijavljivanje/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /prijavljivanje/i })).toBeDisabled();
  });

  it('navigates to /home on successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email adresa/i), 'test@banka.rs');
    await user.type(screen.getByLabelText(/lozinka/i), 'Test1234');
    await user.click(screen.getByRole('button', { name: /prijavi se/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });

  it('shows server error on failed login', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { message: 'Bad credentials' } },
    });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email adresa/i), 'test@banka.rs');
    await user.type(screen.getByLabelText(/lozinka/i), 'Test1234');
    await user.click(screen.getByRole('button', { name: /prijavi se/i }));

    await waitFor(() => {
      expect(screen.getByText('Bad credentials')).toBeInTheDocument();
    });
  });

  it('shows default error message when server returns no message', async () => {
    mockLogin.mockRejectedValueOnce({});
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email adresa/i), 'test@banka.rs');
    await user.type(screen.getByLabelText(/lozinka/i), 'Test1234');
    await user.click(screen.getByRole('button', { name: /prijavi se/i }));

    await waitFor(() => {
      // Posle Bug T1-013 fix-a (12.05.2026) poruka je preformulisana: pre je
      // bila "Pogrešan email ili lozinka", sad "Neispravan email ili lozinka."
      // (uskladjeno sa BE porukom koja je takodje SR).
      expect(screen.getByText(/neispravan email ili lozinka/i)).toBeInTheDocument();
    });
  });

  it('navigates to forgot password page when link is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByText(/zaboravili ste lozinku/i));

    expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');
  });

  it('navigates back to landing page when back button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /nazad na početnu/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const passwordInput = screen.getByLabelText(/lozinka/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByLabelText(/prikaži lozinku/i));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByLabelText(/sakrij lozinku/i));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
