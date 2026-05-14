/**
 * Arbitro state container.
 *
 * Drzi:
 *  - isOpen panela
 *  - listu poruka (history + tekuci stream)
 *  - streaming phase (idle | thinking | tool | writing)
 *  - pageContext (auto-trackovan iz useLocation + activityTracker)
 *  - health snapshot
 *  - conversationUuid (lokalno generisan na prvu poruku)
 *
 * Reference: Info o predmetu/LLM_Asistent_Plan.txt v3.3 §8.
 */
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

import {
  cancelWizard as cancelWizardApi,
  confirmAgentAction,
  fetchHealth,
  fetchMessages,
  fetchTtsAudio,
  rejectAgentAction,
  selectWizardSlot,
  streamChat,
  streamChatWithMedia,
} from '../services/assistantService';
import type {
  AgentActionPreview,
  AgentActionResult,
  ArbitroHealth,
  ArbitroMessage,
  ArbitroPageContext,
  ArbitroStreamingPhase,
  ArbitroToolCallIndicator,
  WizardPrompt,
  WizardSlotSelectResponse,
} from '../types/arbitro';
import { useAuth } from './AuthContext';
import { activityTracker } from '../utils/activityTracker';
import { pageNameForRoute } from '../components/assistant/pageNames';

const SESSION_KEY_CONV = 'arbitro:conversationUuid';
const SESSION_KEY_AGENTIC = 'arbitro:agenticMode';
const SESSION_KEY_TTS_ENABLED = 'arbitro:ttsEnabled';
const SESSION_KEY_TTS_VOICE = 'arbitro:ttsVoice';
const DEFAULT_TTS_VOICE = 'af_bella';

export interface ArbitroContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  health: ArbitroHealth | null;
  messages: ArbitroMessage[];
  isStreaming: boolean;
  phase: ArbitroStreamingPhase;
  send: (text: string) => void;
  /**
   * Phase 5 multimodal — salje user poruku sa audio/image blob-om.
   * BE prosledjuje base64 Gemma 4 modelu kroz multimodal `images` polje.
   */
  sendWithMedia: (text: string, mediaBlob: Blob) => void;
  stop: () => void;
  clear: () => void;
  loadConversation: (uuid: string) => Promise<void>;
  pageContext: ArbitroPageContext;
  setUiSummary: (summary: string) => void;
  /** Phase 4 v3.5 — agentic mode toggle (sessionStorage persisted). */
  agenticMode: boolean;
  setAgenticMode: (b: boolean) => void;
  /** Trenutno PENDING agentic akcija ciji preview modal treba prikazati, null ako nema. */
  pendingAction: AgentActionPreview | null;
  /** Confirm pending action — vraca rezultat (EXECUTED/FAILED). */
  confirmAction: (otpCode?: string, editedParameters?: Record<string, unknown>) => Promise<AgentActionResult>;
  /** Reject pending action — postavlja status REJECTED. */
  rejectAction: () => Promise<void>;
  /** Phase 5 — TTS auto-play state (sessionStorage persisted). */
  ttsEnabled: boolean;
  setTtsEnabled: (b: boolean) => void;
  ttsVoice: string;
  setTtsVoice: (v: string) => void;
  /** Phase 4.5 — aktivan wizard prompt (multi-step interaktivni izbor u chat-u). */
  wizardPrompt: WizardPrompt | null;
  /** Phase 4.5 — submituj user-ov izbor / unos slot-u, advance wizard. */
  submitWizardChoice: (wizardId: string, slotName: string, value: string) => Promise<void>;
  /** Phase 4.5 — otkazi aktivan wizard. */
  cancelWizard: (wizardId: string) => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ArbitroContext = createContext<ArbitroContextValue | null>(null);

/**
 * Phase 5 — fetch TTS audio i playback. Pre-empt-uje prethodni playback.
 * Markdown linkovi i emoji se ostavljaju Kokoro phonemizer-u — on ih
 * tretira kao tihe pauze.
 */
async function playTtsAsync(
  text: string,
  voice: string,
  audioRef: { current: HTMLAudioElement | null }
): Promise<void> {
  // Stripuj #action: linkove (ne treba TTS-u)
  const cleaned = text.replace(/\[([^\]]+)\]\(#action:[^)]+\)/g, '$1');
  if (cleaned.trim().length === 0) return;
  // Stop prethodni playback ako jos traje
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current = null;
  }
  const blob = await fetchTtsAudio(cleaned, voice);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener('ended', () => URL.revokeObjectURL(url));
  audio.addEventListener('error', () => URL.revokeObjectURL(url));
  audioRef.current = audio;
  try {
    await audio.play();
  } catch {
    // Browser autoplay policy moze blokirati ako user nije interagovao —
    // tih fail, korisnik moze klik-nuti play dugme rucno (Phase 5 polish).
  }
}

export function ArbitroProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  const [isOpen, setOpen] = useState(false);
  const [messages, setMessages] = useState<ArbitroMessage[]>([]);
  const [phase, setPhase] = useState<ArbitroStreamingPhase>('idle');
  const [health, setHealth] = useState<ArbitroHealth | null>(null);
  const [uiSummaryByRoute, setUiSummaryByRoute] = useState<Record<string, string>>({});
  const [recentActions, setRecentActions] = useState<string[]>(() => activityTracker.getRecent());
  const [agenticMode, setAgenticModeState] = useState<boolean>(() => {
    // Plan v3.6 §Task 6 — default agentic mode ON (bilo OFF). Korisnik moze
    // explicitno da iskljuci u hero toggle-u; vrednost se cuva u sessionStorage.
    // Cuvamo "true" i "false" eksplicitno da bismo razlikovali "user iskljucio"
    // od "nije nikad podesio" (kad explicitly OFF, nemoj override-ovati na ON).
    const stored = sessionStorage.getItem(SESSION_KEY_AGENTIC);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return true; // default ON
  });
  const [pendingAction, setPendingAction] = useState<AgentActionPreview | null>(null);
  // Phase 4.5 — wizard state. Null kad nema aktivnog wizard-a.
  const [wizardPrompt, setWizardPrompt] = useState<WizardPrompt | null>(null);
  const [ttsEnabled, setTtsEnabledState] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_KEY_TTS_ENABLED) === 'true';
  });
  const [ttsVoice, setTtsVoiceState] = useState<string>(() => {
    return sessionStorage.getItem(SESSION_KEY_TTS_VOICE) ?? DEFAULT_TTS_VOICE;
  });
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  // Persistovan UUID — preživi reload, izgubljen na logout/clear.
  const conversationUuidRef = useRef<string | undefined>(
    sessionStorage.getItem(SESSION_KEY_CONV) ?? undefined
  );
  const streamControllerRef = useRef<AbortController | null>(null);

  // Activity tracker subscription — setState samo iz event handler-a (subscribe callback).
  useEffect(() => activityTracker.subscribe(setRecentActions), []);

  // Pri prvom mount-u (ili kad korisnik dodje na repo posle reload-a),
  // ako vec postoji conversationUuid u sessionStorage — povuci poslednje
  // poruke da panel ne bude prazan. Tako razgovor preživi reload.
  useEffect(() => {
    if (!user) return;
    const uuid = conversationUuidRef.current;
    if (!uuid) return;
    let cancelled = false;
    fetchMessages(uuid)
      .then((loaded) => {
        if (!cancelled && loaded.length > 0) setMessages(loaded);
      })
      .catch(() => {
        // 404 = conversation obrisana ili istekla; cisti stale UUID
        if (!cancelled) {
          sessionStorage.removeItem(SESSION_KEY_CONV);
          conversationUuidRef.current = undefined;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Health probe — koristi ref umesto closure-state da panel toggle moze
  // da pozove `probe()` direktno (bez 60s cekanja kad je BE upravo restartovao).
  const probeHealthRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const probe = async () => {
      try {
        const h = await fetchHealth();
        if (!cancelled) setHealth(h);
      } catch {
        if (!cancelled) {
          setHealth({
            provider: 'unknown',
            model: '',
            llmReachable: false,
            wikipediaToolReachable: false,
            ragToolReachable: false,
          });
        }
      }
    };
    probeHealthRef.current = probe;
    void probe();
    // Skraceno na 20s (sa 60s) — kad BE restartuje, FE brze pokupi novi
    // status. Plus probe se trigeruje i kad korisnik otvori panel (vidi
    // toggle/open dole).
    const interval = window.setInterval(() => void probe(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user]);

  // Derived health: kad korisnik nije logovan, prikazi null bez explicit reset-a.
  const effectiveHealth = user ? health : null;

  const pageContext = useMemo<ArbitroPageContext>(
    () => {
      const summary = uiSummaryByRoute[location.pathname];
      return {
        route: location.pathname,
        pageName: pageNameForRoute(location.pathname),
        uiSummary: summary && summary.length > 0 ? summary : undefined,
        lastActions: recentActions,
      };
    },
    [location.pathname, uiSummaryByRoute, recentActions]
  );

  const setUiSummary = useCallback((summary: string) => {
    setUiSummaryByRoute((prev) => ({ ...prev, [location.pathname]: summary }));
  }, [location.pathname]);

  const stop = useCallback(() => {
    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
    }
    setPhase('idle');
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || phase !== 'idle') return;

      const userMsg: ArbitroMessage = {
        key: `user-${Date.now()}`,
        role: 'USER',
        content: trimmed,
        status: 'done',
      };
      const assistantMsg: ArbitroMessage = {
        key: `assistant-${Date.now()}`,
        role: 'ASSISTANT',
        content: '',
        status: 'streaming',
        toolCalls: [],
        sources: [],
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setPhase('thinking');

      // RAF-throttled token buffer — coalesce vise token chunkova u jedan
      // render frame (svaki ~16ms umesto svaki token). Bez ovoga, BE moze
      // emitovati 100+ tokena za sekundu, sto pravi 100 React re-rendera
      // i blokira main thread (UI freeze).
      let tokenBuffer = '';
      let rafScheduled = false;
      const flushTokens = () => {
        rafScheduled = false;
        if (!tokenBuffer) return;
        const chunk = tokenBuffer;
        tokenBuffer = '';
        setMessages((prev) =>
          prev.map((m) =>
            m.key === assistantMsg.key ? { ...m, content: m.content + chunk } : m
          )
        );
      };

      // Aktuelni stream
      streamControllerRef.current = streamChat(
        {
          conversationUuid: conversationUuidRef.current,
          message: trimmed,
          pageContext,
          agenticMode,
        },
        (event) => {
          switch (event.type) {
            case 'thinking_start':
              setPhase('thinking');
              break;
            case 'thinking_end':
              setPhase('writing');
              break;
            case 'tool_call':
              setPhase('tool');
              setMessages((prev) =>
                prev.map((m) =>
                  m.key === assistantMsg.key
                    ? {
                        ...m,
                        toolCalls: [
                          ...(m.toolCalls ?? []),
                          { name: event.name, args: event.args } as ArbitroToolCallIndicator,
                        ],
                      }
                    : m
                )
              );
              break;
            case 'tool_result':
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.key !== assistantMsg.key) return m;
                  const updated = (m.toolCalls ?? []).slice();
                  // Pronadji poslednji nepopunjen entry sa istim imenom
                  for (let i = updated.length - 1; i >= 0; i--) {
                    if (updated[i].name === event.name && updated[i].ok === undefined) {
                      updated[i] = { ...updated[i], ok: event.ok, summary: event.summary };
                      break;
                    }
                  }
                  return { ...m, toolCalls: updated };
                })
              );
              break;
            case 'token':
              tokenBuffer += event.text;
              if (!rafScheduled) {
                rafScheduled = true;
                requestAnimationFrame(flushTokens);
              }
              setPhase('writing'); // React bails out ako je vec 'writing' (Object.is)
              break;
            case 'source':
              setMessages((prev) =>
                prev.map((m) =>
                  m.key === assistantMsg.key
                    ? {
                        ...m,
                        sources: [
                          ...(m.sources ?? []),
                          { type: event.sourceType, title: event.title, url: event.url },
                        ],
                      }
                    : m
                )
              );
              break;
            case 'done':
              // Flush bilo kakav buffer-ovan tekst pre nego sto markdown render krene
              flushTokens();
              // Sacuvaj UUID za sledeci chat poziv + reload survivability
              if (event.conversationUuid) {
                conversationUuidRef.current = event.conversationUuid;
                sessionStorage.setItem(SESSION_KEY_CONV, event.conversationUuid);
              }
              setMessages((prev) => {
                // Phase 5: TTS auto-play posle done event-a
                const finalMsg = prev.find((m) => m.key === assistantMsg.key);
                if (ttsEnabled && finalMsg && finalMsg.content.trim().length > 0) {
                  void playTtsAsync(finalMsg.content, ttsVoice, ttsAudioRef);
                }
                return prev.map((m) =>
                  m.key === assistantMsg.key
                    ? { ...m, status: 'done', id: event.messageId }
                    : m
                );
              });
              setPhase('idle');
              streamControllerRef.current = null;
              break;
            case 'error':
              flushTokens();
              setMessages((prev) =>
                prev.map((m) =>
                  m.key === assistantMsg.key
                    ? {
                        ...m,
                        status: 'error',
                        errorMessage: event.message,
                      }
                    : m
                )
              );
              setPhase('idle');
              streamControllerRef.current = null;
              break;
            case 'action_preview':
              setPendingAction({
                actionUuid: event.actionUuid,
                tool: event.tool,
                summary: event.summary,
                parameters: event.parameters,
                warnings: event.warnings,
                requiresOtp: event.requiresOtp,
                expiresAt: event.expiresAt,
                planStepIndex: event.planStepIndex,
                planTotalSteps: event.planTotalSteps,
                parentActionUuid: event.parentActionUuid,
              });
              break;
            case 'action_executed':
              // Posle confirm-a, FE vec ima rezultat — clear pending if matching
              setPendingAction((prev) =>
                prev && prev.actionUuid === event.actionUuid ? null : prev
              );
              break;
            case 'action_rejected':
              setPendingAction((prev) =>
                prev && prev.actionUuid === event.actionUuid ? null : prev
              );
              break;
            case 'agent_choice':
              // Phase 4.5: wizard zapocet — prikazi choice card u chat-u.
              setWizardPrompt({
                wizardId: event.wizardId,
                toolName: event.toolName,
                title: event.title,
                slotName: event.slotName,
                prompt: event.prompt,
                slotType: event.slotType,
                options: event.options,
                stepIndex: event.stepIndex,
                totalSteps: event.totalSteps,
                previousSelections: event.previousSelections,
                errorMessage: event.errorMessage,
              });
              break;
          }
        },
        (error) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.key === assistantMsg.key
                ? { ...m, status: 'error', errorMessage: error.message }
                : m
            )
          );
          setPhase('idle');
          streamControllerRef.current = null;
        },
        () => {
          setPhase('idle');
          streamControllerRef.current = null;
        }
      );
    },
    [pageContext, phase, agenticMode, ttsEnabled, ttsVoice]
  );

  /**
   * Phase 5 multimodal — kao `send`, ali salje + media blob (audio ili
   * sliku) preko multipart endpoint-a. BE prosleduje blob Gemma 4 modelu
   * koji ima native ASR + image-to-text. Reuses isti SSE event flow.
   */
  const sendWithMedia = useCallback(
    (text: string, mediaBlob: Blob) => {
      if (phase !== 'idle' || !mediaBlob) return;
      const userMsg: ArbitroMessage = {
        key: `user-${Date.now()}`,
        role: 'USER',
        content: text.trim() || '🎙️ (audio)',
        status: 'done',
      };
      const assistantMsg: ArbitroMessage = {
        key: `assistant-${Date.now()}`,
        role: 'ASSISTANT',
        content: '',
        status: 'streaming',
        toolCalls: [],
        sources: [],
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setPhase('thinking');

      // Isti RAF-throttled token buffer kao u `send` — sprecava UI freeze
      // pri brzo emitovanim token chunkovima.
      let tokenBuffer = '';
      let rafScheduled = false;
      const flushTokens = () => {
        rafScheduled = false;
        if (!tokenBuffer) return;
        const chunk = tokenBuffer;
        tokenBuffer = '';
        setMessages((prev) =>
          prev.map((m) =>
            m.key === assistantMsg.key ? { ...m, content: m.content + chunk } : m
          )
        );
      };

      streamControllerRef.current = streamChatWithMedia(
        {
          conversationUuid: conversationUuidRef.current,
          message: text.trim(),
          pageContext,
          agenticMode,
        },
        mediaBlob,
        (event) => {
          // Reuses identican event handler logiku kao `send` — kopiramo
          // referencu na switch tela; jednostavnije je pozvati internal
          // handler vec implementiran u `streamChat` flow-u, ali da bi se
          // ovo radilo, refactor-isalo bi se znacajno. Za sada — switch ovde.
          switch (event.type) {
            case 'thinking_start':
              setPhase('thinking');
              break;
            case 'thinking_end':
              setPhase('writing');
              break;
            case 'tool_call':
              setPhase('tool');
              setMessages((prev) =>
                prev.map((m) =>
                  m.key === assistantMsg.key
                    ? {
                        ...m,
                        toolCalls: [
                          ...(m.toolCalls ?? []),
                          { name: event.name, args: event.args } as ArbitroToolCallIndicator,
                        ],
                      }
                    : m
                )
              );
              break;
            case 'tool_result':
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.key !== assistantMsg.key) return m;
                  const updated = (m.toolCalls ?? []).slice();
                  for (let i = updated.length - 1; i >= 0; i--) {
                    if (updated[i].name === event.name && updated[i].ok === undefined) {
                      updated[i] = { ...updated[i], ok: event.ok, summary: event.summary };
                      break;
                    }
                  }
                  return { ...m, toolCalls: updated };
                })
              );
              break;
            case 'token':
              tokenBuffer += event.text;
              if (!rafScheduled) {
                rafScheduled = true;
                requestAnimationFrame(flushTokens);
              }
              setPhase('writing'); // React bails out ako je vec 'writing' (Object.is)
              break;
            case 'source':
              setMessages((prev) =>
                prev.map((m) =>
                  m.key === assistantMsg.key
                    ? {
                        ...m,
                        sources: [
                          ...(m.sources ?? []),
                          { type: event.sourceType, title: event.title, url: event.url },
                        ],
                      }
                    : m
                )
              );
              break;
            case 'done':
              flushTokens();
              if (event.conversationUuid) {
                conversationUuidRef.current = event.conversationUuid;
                sessionStorage.setItem(SESSION_KEY_CONV, event.conversationUuid);
              }
              setMessages((prev) => {
                const finalMsg = prev.find((m) => m.key === assistantMsg.key);
                // Voice-IN → voice-OUT: kad je korisnik govorio kroz mic, uvek
                // procitaj odgovor kroz TTS (bez obzira na toggle). Korisnik je
                // jasno indikovao da preferira audio modalitet.
                if (finalMsg && finalMsg.content.trim().length > 0) {
                  void playTtsAsync(finalMsg.content, ttsVoice, ttsAudioRef);
                }
                return prev.map((m) =>
                  m.key === assistantMsg.key ? { ...m, status: 'done', id: event.messageId } : m
                );
              });
              setPhase('idle');
              streamControllerRef.current = null;
              break;
            case 'error':
              flushTokens();
              setMessages((prev) =>
                prev.map((m) =>
                  m.key === assistantMsg.key
                    ? { ...m, status: 'error', errorMessage: event.message }
                    : m
                )
              );
              setPhase('idle');
              streamControllerRef.current = null;
              break;
            case 'action_preview':
              setPendingAction({
                actionUuid: event.actionUuid,
                tool: event.tool,
                summary: event.summary,
                parameters: event.parameters,
                warnings: event.warnings,
                requiresOtp: event.requiresOtp,
                expiresAt: event.expiresAt,
                planStepIndex: event.planStepIndex,
                planTotalSteps: event.planTotalSteps,
                parentActionUuid: event.parentActionUuid,
              });
              break;
            case 'action_executed':
            case 'action_rejected':
              setPendingAction((prev) =>
                prev && prev.actionUuid === event.actionUuid ? null : prev
              );
              break;
            case 'agent_choice':
              setWizardPrompt({
                wizardId: event.wizardId,
                toolName: event.toolName,
                title: event.title,
                slotName: event.slotName,
                prompt: event.prompt,
                slotType: event.slotType,
                options: event.options,
                stepIndex: event.stepIndex,
                totalSteps: event.totalSteps,
                previousSelections: event.previousSelections,
                errorMessage: event.errorMessage,
              });
              break;
          }
        },
        (error) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.key === assistantMsg.key ? { ...m, status: 'error', errorMessage: error.message } : m
            )
          );
          setPhase('idle');
          streamControllerRef.current = null;
        },
        () => {
          setPhase('idle');
          streamControllerRef.current = null;
        }
      );
    },
    [pageContext, phase, agenticMode, ttsEnabled, ttsVoice]
  );

  /* ============================== WIZARD (Phase 4.5) ============================== */

  /**
   * Submit user choice/input to active wizard. BE returns either next slot
   * prompt (AWAITING_NEXT_SLOT) or final action preview (COMPLETED).
   */
  const submitWizardChoice = useCallback(
    async (wizardId: string, slotName: string, value: string) => {
      try {
        const resp: WizardSlotSelectResponse = await selectWizardSlot(wizardId, slotName, value);
        // Normalize BE field name: SlotPromptDto.type → slotType (FE convention).
        // BE serijalizuje record polje `type` kao "type" u JSON-u, ali FE
        // koristi `slotType` da izbegne kolizu sa discriminated union tag-om.
        const normalize = (p: WizardPrompt | undefined): WizardPrompt | undefined => {
          if (!p) return p;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = p as unknown as Record<string, any>;
          if (raw.slotType) return p;
          return { ...p, slotType: raw.type ?? 'CHOICE' };
        };
        const next = normalize(resp.nextSlot);
        if (resp.status === 'AWAITING_NEXT_SLOT' && next) {
          setWizardPrompt(next);
        } else if (resp.status === 'INVALID' && next) {
          // Re-prompt with error message
          setWizardPrompt(next);
        } else if (resp.status === 'COMPLETED' && resp.actionPreview) {
          setWizardPrompt(null);
          setPendingAction({
            actionUuid: resp.actionPreview.actionUuid,
            tool: resp.actionPreview.tool,
            summary: resp.actionPreview.summary,
            parameters: resp.actionPreview.parameters,
            warnings: resp.actionPreview.warnings,
            requiresOtp: resp.actionPreview.requiresOtp,
            expiresAt: resp.actionPreview.expiresAt,
            planStepIndex: resp.actionPreview.planStepIndex,
            planTotalSteps: resp.actionPreview.planTotalSteps,
            parentActionUuid: resp.actionPreview.parentActionUuid,
          });
        } else {
          // EXPIRED / REJECTED / unknown → clear wizard
          setWizardPrompt(null);
        }
      } catch (e) {
        // BE error → clear wizard, leave error in console
        // eslint-disable-next-line no-console
        console.error('Wizard select failed', e);
        setWizardPrompt(null);
      }
    },
    []
  );

  /** Cancel active wizard — closes the choice card. */
  const cancelWizard = useCallback(async (wizardId: string) => {
    try {
      await cancelWizardApi(wizardId);
    } catch {
      /* no-op — close UI regardless */
    }
    setWizardPrompt(null);
  }, []);

  /* ============================== TTS settings ============================== */

  const setTtsEnabled = useCallback((b: boolean) => {
    sessionStorage.setItem(SESSION_KEY_TTS_ENABLED, b ? 'true' : 'false');
    setTtsEnabledState(b);
    if (!b && ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
  }, []);

  const setTtsVoice = useCallback((v: string) => {
    sessionStorage.setItem(SESSION_KEY_TTS_VOICE, v);
    setTtsVoiceState(v);
  }, []);

  /* ============================== AGENTIC ============================== */

  const setAgenticMode = useCallback((b: boolean) => {
    sessionStorage.setItem(SESSION_KEY_AGENTIC, b ? 'true' : 'false');
    setAgenticModeState(b);
    if (!b) {
      // Iskljucenje toggle-a — odbaci pending action ako postoji
      setPendingAction(null);
    }
  }, []);

  const confirmAction = useCallback(
    async (otpCode?: string, editedParameters?: Record<string, unknown>): Promise<AgentActionResult> => {
      const action = pendingAction;
      if (!action) {
        return { status: 'FAILED', error: 'Nema aktivne pending akcije' };
      }
      try {
        const result = await confirmAgentAction(action.actionUuid, { otpCode, editedParameters });
        // Result je ono sto BE vraca; cisti pending action u oba slucaja
        setPendingAction(null);
        return result;
      } catch (err) {
        return {
          status: 'FAILED',
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [pendingAction]
  );

  const rejectAction = useCallback(async () => {
    const action = pendingAction;
    if (!action) return;
    try {
      await rejectAgentAction(action.actionUuid);
    } finally {
      setPendingAction(null);
    }
  }, [pendingAction]);

  const clear = useCallback(() => {
    stop();
    setMessages([]);
    conversationUuidRef.current = undefined;
    sessionStorage.removeItem(SESSION_KEY_CONV);
  }, [stop]);

  const loadConversation = useCallback(
    async (uuid: string) => {
      stop();
      try {
        const loaded = await fetchMessages(uuid);
        conversationUuidRef.current = uuid;
        sessionStorage.setItem(SESSION_KEY_CONV, uuid);
        setMessages(loaded);
      } catch (e) {
        // Stale UUID — cisti i ostavi panel u empty state-u
        sessionStorage.removeItem(SESSION_KEY_CONV);
        conversationUuidRef.current = undefined;
        setMessages([]);
        throw e;
      }
    },
    [stop]
  );

  const value = useMemo<ArbitroContextValue>(
    () => ({
      isOpen,
      open: () => {
        // Trigger immediate health probe — BE-server status moze da bude
        // promenjen od poslednjeg interval tick-a (npr. user-restart).
        void probeHealthRef.current();
        setOpen(true);
      },
      close: () => setOpen(false),
      toggle: () => {
        setOpen((p) => {
          if (!p) void probeHealthRef.current(); // probe at moment of opening
          return !p;
        });
      },
      health: effectiveHealth,
      messages,
      isStreaming: phase !== 'idle',
      phase,
      send,
      sendWithMedia,
      stop,
      clear,
      loadConversation,
      pageContext,
      setUiSummary,
      agenticMode,
      setAgenticMode,
      pendingAction,
      confirmAction,
      rejectAction,
      ttsEnabled,
      setTtsEnabled,
      ttsVoice,
      setTtsVoice,
      wizardPrompt,
      submitWizardChoice,
      cancelWizard,
    }),
    [
      isOpen,
      effectiveHealth,
      messages,
      phase,
      send,
      sendWithMedia,
      stop,
      clear,
      loadConversation,
      pageContext,
      setUiSummary,
      agenticMode,
      setAgenticMode,
      pendingAction,
      confirmAction,
      rejectAction,
      ttsEnabled,
      setTtsEnabled,
      ttsVoice,
      setTtsVoice,
      wizardPrompt,
      submitWizardChoice,
      cancelWizard,
    ]
  );

  return <ArbitroContext.Provider value={value}>{children}</ArbitroContext.Provider>;
}
