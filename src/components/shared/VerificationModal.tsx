import { useEffect, useMemo, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/lib/notify';
import { transactionService } from '@/services/transactionService';
import { verificationSchema, type VerificationFormData } from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (otpCode: string) => Promise<void>;
}

/**
 * OTP Verification Modal
 *
 * Flow:
 * 1. Modal opens -> request OTP (code appears on mobile app)
 * 2. User enters 6-digit code
 * 3. User clicks "Potvrdi" -> calls onVerified(code) which is an async function
 * 4. Parent component (NewPaymentPage) sends POST /payments with the code
 * 5. If backend rejects -> error shown in modal, user can retry
 * 6. If backend accepts -> parent navigates away, modal closes
 * 7. "Otkaži" -> closes modal, NOTHING happens with money
 */
export default function VerificationModal({ isOpen, onClose, onVerified }: VerificationModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { code: '' },
  });

  // Request OTP when modal opens
  const sendOtp = useCallback(async () => {
    try {
      await transactionService.requestOtp();
      setOtpSent(true);
    } catch {
      toast.error('Greška pri slanju verifikacionog koda.');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSecondsLeft(300);
    setAttemptsLeft(3);
    setServerError('');
    setOtpSent(false);
    reset({ code: '' });
    sendOtp();
  }, [isOpen, reset, sendOtp]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || secondsLeft <= 0) return;
    const id = window.setInterval(() => setSecondsLeft(p => Math.max(0, p - 1)), 1000);
    return () => window.clearInterval(id);
  }, [isOpen, secondsLeft]);

  const formattedTime = useMemo(() => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
    const s = (secondsLeft % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [secondsLeft]);

  // Submit: pass code to parent, parent does the actual payment
  const onSubmit = async (data: VerificationFormData) => {
    if (secondsLeft === 0) {
      setServerError('Kod je istekao. Zatražite novi.');
      return;
    }
    if (attemptsLeft <= 0) {
      setServerError('Nema preostalih pokušaja.');
      return;
    }

    setIsSubmitting(true);
    setServerError('');

    try {
      // This calls NewPaymentPage's handler which does POST /payments with the OTP code
      // If backend rejects the code, it will throw an error
      await onVerified(data.code);
      // If we get here, payment succeeded - parent will navigate away
    } catch (err: unknown) {
      // Payment failed (wrong OTP, insufficient funds, etc)
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error.response?.data?.message || 'Verifikacija nije uspela. Pokušajte ponovo.';
      setServerError(msg);
      setAttemptsLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          toast.error('Maksimalan broj pokušaja. Transakcija otkazana.');
          setTimeout(() => onClose(), 1500);
        }
        return next;
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    setSecondsLeft(300);
    setAttemptsLeft(3);
    setServerError('');
    reset({ code: '' });
    await sendOtp();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-bold mb-1">Verifikacija transakcije</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {otpSent
            ? 'Otvorite mobilnu aplikaciju za verifikacioni kod.'
            : 'Slanje verifikacionog koda...'}
        </p>

        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Verifikacioni kod</Label>
            <Input
              {...register('code')}
              id="otp"
              inputMode="numeric"
              placeholder="Unesite 6-cifreni kod"
              className={errors.code ? 'border-destructive text-center' : 'text-center'}
              autoFocus
            />
            {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
          </div>

          <div className="rounded-md border p-3 text-sm space-y-1">
            <p>Kod važi još: <span className="font-semibold">{formattedTime}</span></p>
            <p>Preostalo pokušaja: <span className="font-semibold">{attemptsLeft}</span></p>
          </div>

          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={handleResend} disabled={secondsLeft > 0}
              className="text-primary disabled:text-muted-foreground">
              {secondsLeft > 0 ? `Pošalji ponovo za ${secondsLeft}s` : 'Pošalji ponovo'}
            </button>
            <button type="button" className="text-muted-foreground hover:text-primary transition-colors"
              onClick={async () => {
                try {
                  await transactionService.requestOtpViaEmail();
                  toast.info('Kod poslat na email.');
                } catch { toast.error('Greška.'); }
              }}>
              Pošaljite na email
            </button>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Otkaži
            </Button>
            <Button type="submit" disabled={isSubmitting || attemptsLeft <= 0 || secondsLeft === 0}>
              {isSubmitting ? 'Provera...' : 'Potvrdi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
