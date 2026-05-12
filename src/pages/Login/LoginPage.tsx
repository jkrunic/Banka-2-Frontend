import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, ArrowLeft, Lock } from 'lucide-react';
import { loginSchema, type LoginFormData } from '../../utils/validationSchemas';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AuthPageLayout from '@/components/layout/AuthPageLayout';

// Opc.2 — Account lockout: BE AccountLockoutService zakljuca email posle 5
// neuspesnih pokusaja na 15 min. BE poruka pocinje sa "Nalog je privremeno
// zakljucan" (SR — pre 12.05.2026 bila je engleska, Bug T1-017). FE detektuje
// tu prefix-iranu poruku i prikazuje specifican amber alert sa Lock ikonicom
// (umesto generickog "Pogresan email").
const LOCKOUT_PREFIXES = ['Nalog je privremeno zakljucan', 'Account temporarily locked'];

function isLockoutMessage(msg: string): boolean {
  return LOCKOUT_PREFIXES.some((prefix) => msg.startsWith(prefix));
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoSpin, setLogoSpin] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError('');
    setIsLocked(false);
    setIsSubmitting(true);
    try {
      await login(data);
      navigate('/home');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      const beMessage = error.response?.data?.message ?? error.message ?? '';
      // Spec Sc 2 (Bug T1-013 prijavljen 12.05.2026): polje "Lozinka" se mora
      // ocistiti posle neuspesnog login-a. Email ostavljamo da korisnik ne mora
      // ponovo da kuca. setValue iz react-hook-form-a triggeruje re-render +
      // ocisti DOM input value.
      setValue('password', '', { shouldValidate: false, shouldDirty: false });
      // Opc.2 — BE AccountLockoutService.AccountLockedException puca sa porukom
      // koja pocinje "Nalog je privremeno zakljucan..." (od 12.05.2026; pre toga
      // bila je engleska "Account temporarily locked"). FE detektuje prefix u
      // oba jezika radi backwards-compat i prikazuje amber lockout alert.
      if (isLockoutMessage(beMessage)) {
        setIsLocked(true);
        setServerError(beMessage);
      } else {
        setServerError(beMessage || 'Neispravan email ili lozinka. Pokusajte ponovo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout>
      <div className="mx-auto w-full max-w-[440px] space-y-4 animate-fade-up">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Nazad na početnu
        </Button>

        <Card className="shadow-2xl shadow-indigo-500/5">
          <CardHeader className="text-center space-y-2">
            <img
              src="/logo.svg"
              alt="BANKA 2025 • TIM 2"
              className="mx-auto h-16 w-16 cursor-pointer transition-transform duration-700 ease-in-out"
              style={{ transform: logoSpin ? 'rotateY(360deg)' : 'rotateY(0deg)' }}
              onClick={() => { setLogoSpin(true); setTimeout(() => setLogoSpin(false), 700); }}
            />
            <CardTitle className="text-2xl">BANKA 2025 <span className="text-indigo-500">•</span> TIM 2</CardTitle>
            <CardDescription>Prijavite se na vaš nalog</CardDescription>
          </CardHeader>
          <CardContent>
            {serverError && (
              isLocked ? (
                <Alert variant="warning" className="mb-4" data-testid="login-lockout-alert">
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Nalog je privremeno zakljucan</AlertTitle>
                  <AlertDescription>
                    Vise neuspesnih pokusaja je detektovano. Pokusajte ponovo kasnije ili koristite "Zaboravili ste lozinku".
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email adresa</Label>
                <Input
                  {...register('email')}
                  id="email"
                  type="email"
                  placeholder="ime@primer.com"
                  autoComplete="email"
                  autoFocus
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Lozinka</Label>
                <div className="relative">
                  <Input
                    {...register('password')}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:scale-[1.01]"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Prijavljivanje...
                  </>
                ) : (
                  'Prijavi se'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors"
              >
                Zaboravili ste lozinku?
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthPageLayout>
  );
}
