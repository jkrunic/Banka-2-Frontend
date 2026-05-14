/**
 * Phase 5 voice INPUT — MediaRecorder hook (NIJE Web Speech API).
 *
 * Korisnik prica → mic → MediaRecorder API snima audio → blob (WebM/Opus
 * sto je default Chrome/Edge codec, BE konvertuje u WAV ako treba) →
 * posalje multipart na BE → BE prosleduje Gemma 4 modelu (Ollama
 * multimodal images polje, issue ollama#15333) → Gemma transkribuje
 * NATIVE i odgovara u istom turn-u.
 *
 * NEMA browser-side STT, NEMA Whisper sidecar — sve ide kroz nas lokalni
 * Gemma 4 model. Razlog: ujednacen pristup, jedan model za sve.
 *
 * Bez podrske Web Speech API-ja, ova komponenta vraca {isSupported: false}
 * i UI sakrije mic dugme.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface SpeechRecognitionState {
  /** True ako browser podrzava MediaRecorder API (ima `navigator.mediaDevices`). */
  isSupported: boolean;
  /** True dok se aktivno snima. */
  isListening: boolean;
  /** Greska (mikrofon permission denied, ne moze record, ...). */
  error: string | null;
  /**
   * Real-time interim transcript za UI feedback dok korisnik prica.
   * Koristi browser webkitSpeechRecognition (Chrome/Edge/Brave) za sirov SR text.
   * BE Gemma 4 ASR ostaje GLAVNI — ovaj transcript je SAMO vizuelni feedback i
   * resetuje se kad korisnik stop-uje. Prazan string ako browser ne podrzava
   * SpeechRecognition (npr. Firefox/Safari) ili je tek startovano.
   */
  liveTranscript: string;
  /** Pokrene snimanje. */
  start: () => void;
  /**
   * Zaustavi snimanje. Vraca Promise koji rezolvira u snimljen audio Blob
   * kad je MediaRecorder zatvorio stream. Rezolvira null ako nije bilo
   * snimanja ili je doslo do greske.
   */
  stop: () => Promise<Blob | null>;
  /** Resetuje state (briseuje grešku, ali ne zaustavlja snimanje). */
  reset: () => void;
}

// Web Speech API type augmentation (TS lib.dom nema definicije).
interface WebSpeechRecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface WebSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<WebSpeechRecognitionResult> & { length: number };
}
interface WebSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface WindowWithSpeech extends Window {
  webkitSpeechRecognition?: { new (): WebSpeechRecognition };
  SpeechRecognition?: { new (): WebSpeechRecognition };
}

/**
 * MediaRecorder hook za audio snimanje (Phase 5 voice INPUT).
 *
 * @param onAudioReady callback koji se zove kad je snimanje gotovo i blob je spreman.
 *                     Idealan trenutak za posalji-na-BE flow.
 */
export function useSpeechRecognition(
  /**
   * Callback se zove kad korisnik zaustavi snimanje. Prima:
   * - `blob`: snimljen audio (WebM/Opus) za BE Gemma 4 ASR ako Ollama
   *   eventualno doda audio podrsku (issue #15333 jos otvoren u 0.23.2)
   * - `transcript`: browser webkitSpeechRecognition rezultat (cleaned text)
   *   — koristi ovo kao primary fallback dok Ollama ne podrzi audio
   */
  onAudioReady?: (blob: Blob, transcript: string) => void
): SpeechRecognitionState {
  const isSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined';

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  // Ref koji prati liveTranscript za pristup iz callback-ova bez stale closure
  const liveTranscriptRef = useRef('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);
  const speechRecRef = useRef<WebSpeechRecognition | null>(null);

  // Helper za browser-side real-time SR (Chrome/Edge/Brave webkitSpeechRecognition)
  // Pokrenuti paralelno sa MediaRecorder-om radi UI feedback-a. BE Gemma 4 ASR
  // ostaje glavni — ovaj rezultat se NE salje, samo prikazuje korisniku.
  const startBrowserSr = useCallback(() => {
    if (typeof window === 'undefined') return;
    const w = window as WindowWithSpeech;
    const Ctor = w.webkitSpeechRecognition ?? w.SpeechRecognition;
    if (!Ctor) return; // Firefox/Safari — nema browser SR, samo MediaRecorder
    try {
      const rec = new Ctor();
      rec.lang = 'sr-Latn-RS'; // srpski latinica; fallback na 'sr-RS' ako browser ne podrzava
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else interim += result[0].transcript;
        }
        setLiveTranscript((prev) => {
          const next = (finalText ? prev + finalText + ' ' : prev) + interim;
          liveTranscriptRef.current = next;
          return next;
        });
      };
      rec.onerror = () => {
        // Tih fail — browser SR je samo UI feedback, ne kritican
      };
      rec.onend = () => {
        speechRecRef.current = null;
      };
      rec.start();
      speechRecRef.current = rec;
    } catch {
      // Initialization failed (CSP, permission, ...) — tih fail
    }
  }, []);

  const stopBrowserSr = useCallback(() => {
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch { /* noop */ }
      speechRecRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (recorderRef.current) {
      try {
        if (recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      } catch {
        /* noop */
      }
      recorderRef.current = null;
    }
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) {
      setError('MediaRecorder API nije podrzan');
      return;
    }
    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, // mono za Gemma 4 ASR (16kHz mono je preporuceno)
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Biraj najbolji dostupan codec — Chrome default je audio/webm;codecs=opus.
      // BE prima i WebM/Opus i WAV (ffmpeg konvertuje ako treba).
      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        '',
      ];
      const mimeType = mimeCandidates.find(
        (m) => m === '' || (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(m))
      ) ?? '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onerror = (e: Event) => {
        const err = e as Event & { error?: { name?: string; message?: string } };
        setError(err.error?.message ?? 'MediaRecorder error');
        setIsListening(false);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        cleanup();
        setIsListening(false);
        if (stopResolverRef.current) {
          stopResolverRef.current(blob.size > 0 ? blob : null);
          stopResolverRef.current = null;
        }
        if (blob.size > 0 && onAudioReady) {
          // Prosledi i blob (raw audio) i transcript (browser SR rezultat).
          // Caller odlucuje da li ce poslati kao tekst (preporuceno dok Ollama
          // nema audio multimodal) ili kao audio blob.
          onAudioReady(blob, liveTranscriptRef.current.trim());
        }
      };

      recorder.start(250); // chunk every 250ms
      setIsListening(true);
      // Paralelno start-uj browser SR za real-time UI feedback (best effort)
      setLiveTranscript('');
      liveTranscriptRef.current = '';
      startBrowserSr();
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Mikrofon permisija odbijena');
      } else if (err.name === 'NotFoundError') {
        setError('Mikrofon nije dostupan');
      } else {
        setError(err.message ?? 'Greska pri pokretanju snimanja');
      }
      cleanup();
      setIsListening(false);
      stopBrowserSr();
    }
  }, [isSupported, cleanup, onAudioReady, startBrowserSr, stopBrowserSr]);

  const stop = useCallback((): Promise<Blob | null> => {
    stopBrowserSr();
    return new Promise((resolve) => {
      if (!recorderRef.current || recorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }
      stopResolverRef.current = resolve;
      try {
        recorderRef.current.stop();
      } catch {
        cleanup();
        setIsListening(false);
        stopResolverRef.current = null;
        resolve(null);
      }
    });
  }, [cleanup, stopBrowserSr]);

  const reset = useCallback(() => {
    cleanup();
    stopBrowserSr();
    setIsListening(false);
    setError(null);
    setLiveTranscript('');
    liveTranscriptRef.current = '';
  }, [cleanup, stopBrowserSr]);

  // Cleanup pri unmount-u
  useEffect(() => cleanup, [cleanup]);

  return { isSupported, isListening, error, liveTranscript, start, stop, reset };
}
