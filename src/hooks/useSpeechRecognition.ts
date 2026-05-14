/**
 * Phase 5 voice INPUT — MediaRecorder hook za snimanje audio Blob-a.
 *
 * Audio se salje kao multipart POST /assistant/chat-multipart → BE
 * base64-encoduje i prosledjuje Gemma 4 modelu preko Ollama-ovog
 * {@code images} polja (issue ollama#15333 cilja audio podrsku).
 *
 * NEMA browser-side STT, NEMA Whisper sidecar — sve ide kroz nas lokalni
 * Gemma 4 model. Razlog: ujednacen pristup, jedan model za sve.
 *
 * Bez podrske za MediaRecorder API (Firefox bez user permisije, vrlo stari
 * browseri), komponenta vraca {isSupported: false} i UI sakrije mic dugme.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface SpeechRecognitionState {
  /** True ako browser podrzava MediaRecorder API (ima `navigator.mediaDevices`). */
  isSupported: boolean;
  /** True dok se aktivno snima. */
  isListening: boolean;
  /** Greska (mikrofon permission denied, ne moze record, ...). */
  error: string | null;
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

/**
 * MediaRecorder hook za audio snimanje (Phase 5 voice INPUT).
 *
 * @param onAudioReady callback koji se zove kad je snimanje gotovo i blob je spreman.
 *                     Idealan trenutak za posalji-na-BE flow.
 */
export function useSpeechRecognition(
  onAudioReady?: (blob: Blob) => void
): SpeechRecognitionState {
  const isSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined';

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);

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
          onAudioReady(blob);
        }
      };

      recorder.start(250); // chunk every 250ms
      setIsListening(true);
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
    }
  }, [isSupported, cleanup, onAudioReady]);

  const stop = useCallback((): Promise<Blob | null> => {
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
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setIsListening(false);
    setError(null);
  }, [cleanup]);

  // Cleanup pri unmount-u
  useEffect(() => cleanup, [cleanup]);

  return { isSupported, isListening, error, start, stop, reset };
}
