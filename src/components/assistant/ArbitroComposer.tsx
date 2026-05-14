/**
 * Composer — Liquid Glass textarea + send/stop + mic dugme (Phase 5).
 *
 * Voice INPUT: NIJE Web Speech API. Koristimo MediaRecorder da snimimo
 * audio blob i posaljemo ga **kroz nas lokalni Gemma 4 model** (Ollama
 * native multimodal API, issue ollama#15333). Gemma 4 ima native ASR
 * iz model card-a — transkribuje SAMA i odgovara u istom turn-u, bez
 * potrebe za zasebnim Whisper sidecar-om.
 *
 * Flow:
 *   1. Klik mic → MediaRecorder pocetak (16kHz mono, WebM/Opus codec)
 *   2. Pulsing crveni glow + "Slusam..." placeholder u textarea
 *   3. Klik mic ponovo → stop → snimljen Blob
 *   4. POST /assistant/chat-multipart sa media + (opciono) tekst
 *   5. BE base64-encoduje + ubaci u Gemma 4 messages.images polje
 *   6. Standardan SSE flow — token, tool_call, source events
 */
import { Mic, MicOff, Send, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useArbitro } from '../../context/useArbitro';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import './arbitro.css';

export function ArbitroComposer() {
  const { send, sendWithMedia, stop, isStreaming } = useArbitro();
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Phase 5 voice INPUT — hibridan pristup:
  //  1. MediaRecorder snima audio Blob (za fallback ako Ollama eventualno
  //     doda audio multimodal — issue #15333 i dalje otvoren u 0.23.2)
  //  2. Browser webkitSpeechRecognition daje real-time transcript
  //
  // PRIMARNI flow: posalji transcript kao TEXT (send()) — pouzdano, Ollama
  // chat endpoint radi bez problema. Ako transcript fali (Firefox/Safari
  // bez webkitSR), fallback na sendWithMedia(blob) — model ce verovatno
  // odgovoriti "ne vidim audio fajl" ali bar pokusava.
  const speech = useSpeechRecognition((blob, transcript) => {
    if (isStreaming) return;
    const accompanyingText = text.trim();
    if (transcript) {
      // Imamo browser SR text — kombinuj sa typed text-om (ako postoji) i posalji
      const combined = accompanyingText
        ? `${accompanyingText} ${transcript}`
        : transcript;
      send(combined);
    } else if (blob) {
      // Fallback: nema transcript-a (Firefox/Safari) — posalji audio Blob
      sendWithMedia(accompanyingText, blob);
    }
    setText('');
  });

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = '0px';
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 160)}px`;
  }, [text]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    if (speech.isListening) {
      void speech.stop(); // ako je snimao, prekini i ne salji audio
    }
    send(trimmed);
    setText('');
    speech.reset();
  };

  const handleMicToggle = () => {
    if (speech.isListening) {
      void speech.stop();
    } else {
      speech.start();
    }
  };

  return (
    <div className="arbitro-composer p-3.5 relative z-10">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder={
            speech.isListening
              ? (speech.liveTranscript || 'Slusam… (klikni mic ponovo da posaljes)')
              : 'Pitaj me o Banka 2 aplikaciji…'
          }
          className={`arbitro-textarea flex-1 ${speech.isListening ? 'arbitro-textarea-listening' : ''}`}
        />

        {/* Phase 5 voice INPUT — mic toggle (snima audio za Gemma 4 ASR) */}
        {speech.isSupported && !isStreaming && (
          <button
            type="button"
            onClick={handleMicToggle}
            className={`arbitro-mic-btn flex shrink-0 items-center justify-center ${
              speech.isListening ? 'arbitro-mic-listening' : ''
            }`}
            aria-label={speech.isListening ? 'Zaustavi i posalji' : 'Pokreni snimanje'}
            title={
              speech.isListening
                ? 'Zaustavi i posalji audio'
                : 'Govori (audio ide kroz Gemma 4 ASR)'
            }
          >
            {speech.isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        )}

        {isStreaming ? (
          <button
            type="button"
            onClick={stop}
            className="arbitro-stop-btn flex shrink-0 items-center justify-center"
            aria-label="Stop"
          >
            <Square className="h-4 w-4" fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim()}
            className="arbitro-send-btn flex shrink-0 items-center justify-center"
            aria-label="Posalji"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>

      {speech.error && (
        <div className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 px-2">
          {speech.error}
        </div>
      )}

      {/* Real-time transcript dok korisnik prica — browser webkitSpeechRecognition
          (best-effort, samo Chrome/Edge/Brave). Vizuelan feedback; BE Gemma 4 ASR
          ostaje glavni izvor. Prikazujemo samo dok je mic aktivan + ima content-a. */}
      {speech.isListening && speech.liveTranscript && (
        <div
          className="mt-2 text-xs px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 text-indigo-900 dark:text-indigo-100 italic"
          data-testid="arbitro-live-transcript"
        >
          <span className="text-[10px] uppercase tracking-wider not-italic opacity-60 mr-1.5">live</span>
          {speech.liveTranscript}
        </div>
      )}
    </div>
  );
}
