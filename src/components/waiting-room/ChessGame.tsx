// Klasicni sah, igrac (beli) vs Stockfish 18 (lite-single WASM).
// chess.js za validaciju, react-chessboard 5.x za UI, Stockfish worker za AI.
// Polish: difficulty slider, captured pieces side panels, move hints (legal squares),
// promotion picker, check + checkmate animations.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs, type PieceHandlerArgs } from 'react-chessboard';
import { RotateCw, Trophy, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { gameScoreService } from '@/services/gameScoreService';
import { toast } from '@/lib/notify';
import { createStockfish, type StockfishClient } from './stockfish';

type Outcome = 'in_progress' | 'white_win' | 'black_win' | 'draw';
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
type PieceColor = 'w' | 'b';

interface Difficulty {
  label: string;
  skill: number;       // Stockfish Skill Level 0-20
  elo?: number;        // Ako postoji, kapacira UCI_Elo (1320-2850); inace full strength
  depth: number;       // search depth fallback
  movetime?: number;   // ms — preferira se ako je dato
  randomChance?: number; // 0-1 — vrac random potez umesto engine output-a (poseban za Lakso)
}

const DIFFICULTIES: Difficulty[] = [
  // Lakso: Stockfish kapaciran na 1320 Elo (minimum) + 60% sansa da odigra
  //        cisto random potez umesto engine-ovog — pravo za pocetnike.
  { label: 'Lakso', skill: 0, elo: 1320, depth: 2, movetime: 100, randomChance: 0.6 },
  // Lako: 1500 Elo + 25% random
  { label: 'Lako', skill: 4, elo: 1500, depth: 5, movetime: 250, randomChance: 0.25 },
  // Srednje: 1700 Elo, bez random-a
  { label: 'Srednje', skill: 10, elo: 1700, depth: 8, movetime: 700 },
  // Tesko: 2000 Elo
  { label: 'Tesko', skill: 15, elo: 2000, depth: 12, movetime: 1500 },
  // Ekspert: full strength (no Elo cap)
  { label: 'Ekspert', skill: 20, depth: 16, movetime: 3000 },
];

// Standard piece values za sortiranje captured listi (najjaca prva)
const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Unicode glyphs za captured pieces panel
const PIECE_GLYPH: Record<PieceColor, Record<PieceType, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

const PROMOTION_CHOICES: PieceType[] = ['q', 'r', 'b', 'n'];

interface PendingPromotion {
  from: Square;
  to: Square;
  color: PieceColor;
}

export function ChessGame() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [outcome, setOutcome] = useState<Outcome>('in_progress');
  const [submitted, setSubmitted] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [difficultyIndex, setDifficultyIndex] = useState(2);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [capturedByWhite, setCapturedByWhite] = useState<PieceType[]>([]); // crne figure koje je beli pojeo
  const [capturedByBlack, setCapturedByBlack] = useState<PieceType[]>([]);
  const [inCheck, setInCheck] = useState(false);
  const [boardFlash, setBoardFlash] = useState<'none' | 'check' | 'mate'>('none');
  const engineRef = useRef<StockfishClient | null>(null);
  const { user } = useAuth();

  const difficulty = DIFFICULTIES[difficultyIndex];

  // Inicijalizacija Stockfish-a (jednom)
  useEffect(() => {
    let cancelled = false;
    createStockfish()
      .then((client) => {
        if (cancelled) {
          client.quit();
          return;
        }
        engineRef.current = client;
        const cfg = DIFFICULTIES[difficultyIndex];
        client.setDifficulty({ skill: cfg.skill, elo: cfg.elo });
        setEngineReady(true);
      })
      .catch((e: Error) => {
        if (!cancelled) setEngineError(e.message);
      });
    return () => {
      cancelled = true;
      engineRef.current?.quit();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Promena tezine — primeni i Skill Level i UCI_LimitStrength/Elo
  useEffect(() => {
    const cfg = DIFFICULTIES[difficultyIndex];
    engineRef.current?.setDifficulty({ skill: cfg.skill, elo: cfg.elo });
  }, [difficultyIndex]);

  const finalScore = useMemo(() => {
    const bonus = (difficulty.skill + 1) * 50;
    if (outcome === 'white_win') return Math.max(100, 1500 + bonus - moveCount * 5);
    if (outcome === 'draw') return 300 + Math.floor(bonus / 2);
    return 50;
  }, [outcome, moveCount, difficulty]);

  const evaluateOutcome = useCallback((): Outcome => {
    const g = gameRef.current;
    if (g.isCheckmate()) return g.turn() === 'b' ? 'white_win' : 'black_win';
    if (g.isDraw() || g.isStalemate() || g.isThreefoldRepetition() || g.isInsufficientMaterial()) return 'draw';
    return 'in_progress';
  }, []);

  /** Update captured pieces listi posle bilo kog poteza */
  const refreshCapturedAndChecks = useCallback(() => {
    const g = gameRef.current;
    // Inicijalna kombinacija figura
    const expected: Record<PieceColor, Record<PieceType, number>> = {
      w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
      b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
    };
    // Brojimo trenutne figure na tabli
    const current: Record<PieceColor, Record<PieceType, number>> = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    };
    // board() vraca 8x8 matricu (rank 8 → rank 1, file a→h)
    for (const row of g.board()) {
      for (const sq of row) {
        if (sq) current[sq.color][sq.type] += 1;
      }
    }
    // Crne figure koje je beli pojeo = ono sto fali u expected (za crne)
    const blackCaptured: PieceType[] = [];
    const whiteCaptured: PieceType[] = [];
    (Object.keys(expected.b) as PieceType[]).forEach((t) => {
      const missing = expected.b[t] - current.b[t];
      for (let i = 0; i < missing; i++) blackCaptured.push(t);
    });
    (Object.keys(expected.w) as PieceType[]).forEach((t) => {
      const missing = expected.w[t] - current.w[t];
      for (let i = 0; i < missing; i++) whiteCaptured.push(t);
    });
    // Sortiraj jaca prva
    blackCaptured.sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
    whiteCaptured.sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
    setCapturedByWhite(blackCaptured);
    setCapturedByBlack(whiteCaptured);

    setInCheck(g.inCheck());
    if (g.isCheckmate()) {
      setBoardFlash('mate');
      setTimeout(() => setBoardFlash('none'), 2000);
    } else if (g.inCheck()) {
      setBoardFlash('check');
      setTimeout(() => setBoardFlash('none'), 700);
    }
  }, []);

  const aiMove = useCallback(async () => {
    const g = gameRef.current;
    const engine = engineRef.current;
    // Random override za lakse nivoe — Stockfish Skill 0 + Elo 1320 i dalje moze
    // odigrati dobre opening poteze; ovo dodatno smanjuje jacinu za pocetnike.
    const rollRandom = difficulty.randomChance && Math.random() < difficulty.randomChance;
    if (!engine || rollRandom) {
      const moves = g.moves({ verbose: true });
      if (moves.length === 0) return;
      // Cisto random — bez prednosti za capture (osim ako nema engine-a uopste)
      const pool = engine ? moves : (moves.filter((m) => m.flags.includes('c') || m.flags.includes('e')).length > 0
        ? moves.filter((m) => m.flags.includes('c') || m.flags.includes('e'))
        : moves);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      g.move({ from: pick.from, to: pick.to, promotion: pick.promotion });
      setLastMove({ from: pick.from as Square, to: pick.to as Square });
    } else {
      try {
        const uci = await engine.getBestMove(g.fen(), { depth: difficulty.depth, movetime: difficulty.movetime });
        if (!uci || uci === '(none)') return;
        const from = uci.slice(0, 2) as Square;
        const to = uci.slice(2, 4) as Square;
        const promotion = uci.length >= 5 ? uci[4] : undefined;
        g.move({ from, to, promotion });
        setLastMove({ from, to });
      } catch (e) {
        console.error('Stockfish search error', e);
      }
    }
    setFen(g.fen());
    setMoveCount((m) => m + 1);
    setOutcome(evaluateOutcome());
    setThinking(false);
    refreshCapturedAndChecks();
  }, [evaluateOutcome, difficulty, refreshCapturedAndChecks]);

  /**
   * Izvrsava potez bele strane. Ako je pijun do kraja (8th rank) — otvara promotion dialog.
   * Vraca true ako je potez izvrsen ili pending na promociju, false ako je nevalidan.
   */
  const tryWhiteMove = useCallback(
    (from: Square, to: Square, explicitPromotion?: PieceType): boolean => {
      const g = gameRef.current;
      if (g.turn() !== 'w' || outcome !== 'in_progress') return false;
      const piece = g.get(from);
      if (!piece) return false;
      // Pijun na 8th rank — promotion
      const targetRank = to[1];
      if (piece.type === 'p' && targetRank === '8' && !explicitPromotion) {
        // Pre nego sto pitamo, proveri da je move legal
        const moves = g.moves({ square: from, verbose: true });
        const valid = moves.some((m) => m.to === to);
        if (!valid) return false;
        setPendingPromotion({ from, to, color: 'w' });
        return true;
      }
      try {
        const result = g.move({ from, to, promotion: explicitPromotion ?? 'q' });
        if (!result) return false;
      } catch {
        return false;
      }
      setFen(g.fen());
      setMoveCount((c) => c + 1);
      setLastMove({ from, to });
      setSelectedSquare(null);
      setLegalMoves([]);
      const next = evaluateOutcome();
      setOutcome(next);
      refreshCapturedAndChecks();
      if (next === 'in_progress') {
        setThinking(true);
        setTimeout(() => { void aiMove(); }, 280);
      }
      return true;
    },
    [outcome, evaluateOutcome, aiMove, refreshCapturedAndChecks]
  );

  /**
   * Centralni handler — koristi se i za `onSquareClick` i za `onPieceClick`
   * (react-chessboard 5 ponekad ne okida onSquareClick kad je piece klik-ovan
   * jer drag detektor proguta event; oba ga sad pozivaju).
   */
  function handleSquareSelect(sq: Square) {
    if (outcome !== 'in_progress' || thinking) return;
    const g = gameRef.current;
    if (selectedSquare) {
      if (sq === selectedSquare) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }
      if (tryWhiteMove(selectedSquare, sq)) return;
      const piece = g.get(sq);
      if (piece && piece.color === 'w') {
        setSelectedSquare(sq);
        const moves = g.moves({ square: sq, verbose: true });
        setLegalMoves(moves.map((m) => m.to as Square));
        return;
      }
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }
    const piece = g.get(sq);
    if (piece && piece.color === 'w' && g.turn() === 'w') {
      setSelectedSquare(sq);
      const moves = g.moves({ square: sq, verbose: true });
      setLegalMoves(moves.map((m) => m.to as Square));
    }
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    handleSquareSelect(square as Square);
  }
  function handlePieceClick({ square }: PieceHandlerArgs) {
    if (!square) return;
    handleSquareSelect(square as Square);
  }

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare) return false;
      return tryWhiteMove(sourceSquare as Square, targetSquare as Square);
    },
    [tryWhiteMove]
  );

  function confirmPromotion(piece: PieceType) {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    tryWhiteMove(from, to, piece);
  }

  useEffect(() => {
    if (outcome !== 'in_progress' && !submitted && user) {
      gameScoreService
        .submit({ gameType: 'CHESS', score: finalScore })
        .then(() => toast.success(`Partija zavrsena. Score ${finalScore} sacuvan.`))
        .catch(() => toast.error('Greska pri cuvanju score-a.'));
      setSubmitted(true);
    }
  }, [outcome, submitted, user, finalScore]);

  function reset() {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setOutcome('in_progress');
    setSubmitted(false);
    setMoveCount(0);
    setThinking(false);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPendingPromotion(null);
    setCapturedByWhite([]);
    setCapturedByBlack([]);
    setInCheck(false);
    setBoardFlash('none');
  }

  const outcomeLabel: Record<Outcome, string> = {
    in_progress: thinking
      ? `${difficulty.label} AI razmislja...`
      : inCheck
      ? 'Sah! Vas potez (beli)'
      : 'Vas potez (beli)',
    white_win: 'Pobeda! ♔',
    black_win: `${difficulty.label} AI pobedio`,
    draw: 'Remi',
  };

  // Kalkulisi square styles za highlights + last move + check
  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: 'radial-gradient(circle, rgba(251, 191, 36, 0.4) 30%, transparent 70%)' };
      styles[lastMove.to] = { background: 'rgba(251, 191, 36, 0.45)' };
    }
    if (selectedSquare) {
      styles[selectedSquare] = { background: 'rgba(99, 102, 241, 0.55)', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.6)' };
    }
    for (const m of legalMoves) {
      const isCapture = !!gameRef.current.get(m);
      styles[m] = isCapture
        ? {
            // Capture target — debeli crveni prsten oko enemy figure
            background:
              'radial-gradient(circle, transparent 48%, rgba(220, 38, 38, 0.9) 49%, rgba(220, 38, 38, 0.9) 60%, transparent 61%)',
            boxShadow: 'inset 0 0 0 2px rgba(220, 38, 38, 0.4)',
          }
        : {
            // Move target — veci jaci plavi krug
            background:
              'radial-gradient(circle, rgba(67, 56, 202, 0.85) 0%, rgba(67, 56, 202, 0.85) 26%, transparent 27%)',
          };
    }
    // Highlight kralja u check-u
    if (inCheck) {
      const g = gameRef.current;
      const turn = g.turn(); // ovaj cije je vreme da odbrani sah
      // Pronadji kralja
      for (const row of g.board()) {
        for (const sq of row) {
          if (sq && sq.type === 'k' && sq.color === turn) {
            styles[sq.square] = {
              ...styles[sq.square],
              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.7) 40%, rgba(239, 68, 68, 0.3) 80%)',
              animation: 'pulse-glow 0.7s ease-in-out infinite',
            };
          }
        }
      }
    }
    return styles;
  }, [lastMove, selectedSquare, legalMoves, inCheck, fen]); // fen kao trigger za rerender

  // Boardflash overlay class
  const boardFlashClass =
    boardFlash === 'mate'
      ? 'animate-board-mate'
      : boardFlash === 'check'
      ? 'animate-board-check'
      : '';

  return (
    <div className="w-full max-w-[1200px] mx-auto">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className={`font-semibold ${inCheck && outcome === 'in_progress' ? 'text-red-600 dark:text-red-400' : ''}`}>
            {outcomeLabel[outcome]}
          </p>
          <p className="text-xs text-muted-foreground">Potezi: {moveCount}</p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCw className="mr-2 h-4 w-4" /> Nova partija
        </Button>
      </div>

      {/* Difficulty slider */}
      <div className="mb-4 rounded-xl border bg-card/50 p-3">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="chess-difficulty" className="text-sm font-medium">
            Tezina protivnika:{' '}
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{difficulty.label}</span>
          </label>
          <span className="text-xs text-muted-foreground">
            {difficulty.elo ? `~${difficulty.elo} Elo` : 'Full strength'} · Skill {difficulty.skill}/20
            {difficulty.randomChance ? ` · ${Math.round(difficulty.randomChance * 100)}% random` : ''}
          </span>
        </div>
        <input
          id="chess-difficulty"
          type="range"
          min={0}
          max={DIFFICULTIES.length - 1}
          step={1}
          value={difficultyIndex}
          onChange={(e) => setDifficultyIndex(Number(e.target.value))}
          className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          aria-label="Tezina protivnika"
        />
        <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
          {DIFFICULTIES.map((d) => (
            <span key={d.label}>{d.label}</span>
          ))}
        </div>
      </div>

      {engineError && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span>Stockfish nije uspeo da se ucita ({engineError}). Koristi se fallback AI.</span>
        </div>
      )}

      {!engineReady && !engineError && (
        <div className="mb-3 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground text-center">
          Ucitavam Stockfish engine...
        </div>
      )}

      {/* Layout: leva = captured by white (gornja) + tabla + captured by black (donja); desno panel sa hint-ima */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
        <div className="flex flex-col gap-3 items-center">
          <CapturedRow pieces={capturedByWhite} color="b" label="Crni izgubili" />
          <div className={`relative rounded-2xl border bg-card p-3 shadow-md w-full max-w-[720px] ${boardFlashClass}`}>
            <Chessboard
              options={{
                position: fen,
                onPieceDrop,
                onSquareClick: handleSquareClick,
                onPieceClick: handlePieceClick,
                squareStyles,
                boardStyle: { borderRadius: '0.75rem' },
                darkSquareStyle: { backgroundColor: '#6366f1' },
                lightSquareStyle: { backgroundColor: '#e0e7ff' },
                allowDragging: outcome === 'in_progress' && !thinking && !pendingPromotion,
                id: 'banka-chess',
              }}
            />
            {pendingPromotion && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/55 backdrop-blur-sm">
                <div className="rounded-2xl border bg-card p-5 shadow-2xl">
                  <p className="mb-3 text-center text-sm font-semibold">Izaberi figuru za promociju:</p>
                  <div className="flex gap-2">
                    {PROMOTION_CHOICES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => confirmPromotion(p)}
                        className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-100 text-5xl hover:scale-110 hover:border-indigo-500 transition-all dark:from-indigo-900/40 dark:to-violet-900/40 dark:border-indigo-700"
                        aria-label={`Promotuj u ${p}`}
                      >
                        {PIECE_GLYPH[pendingPromotion.color][p]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Check/mate overlay banner */}
            {(inCheck || outcome !== 'in_progress') && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {outcome === 'white_win' && (
                  <span className="rounded-full bg-emerald-500/90 px-4 py-2 text-lg font-bold text-white shadow-2xl animate-pop-in">
                    ŠAH-MAT! Pobeda
                  </span>
                )}
                {outcome === 'black_win' && (
                  <span className="rounded-full bg-red-600/90 px-4 py-2 text-lg font-bold text-white shadow-2xl animate-pop-in">
                    ŠAH-MAT! AI je pobedio
                  </span>
                )}
                {outcome === 'draw' && (
                  <span className="rounded-full bg-slate-600/90 px-4 py-2 text-lg font-bold text-white shadow-2xl animate-pop-in">
                    Remi
                  </span>
                )}
                {outcome === 'in_progress' && inCheck && (
                  <span className="rounded-full bg-amber-500/90 px-3 py-1 text-sm font-bold text-white shadow-xl animate-pop-in">
                    ŠAH!
                  </span>
                )}
              </div>
            )}
          </div>
          <CapturedRow pieces={capturedByBlack} color="w" label="Beli izgubili" />
        </div>

        {/* Pomocni panel */}
        <aside className="rounded-2xl border bg-card/60 p-4 text-sm space-y-3 h-fit">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Status</p>
            <p className="font-bold">{outcomeLabel[outcome]}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Materijalna prednost</p>
            <p className="font-mono text-sm">
              {(() => {
                const mat =
                  capturedByWhite.reduce((s, p) => s + PIECE_VALUE[p], 0) -
                  capturedByBlack.reduce((s, p) => s + PIECE_VALUE[p], 0);
                if (mat > 0) return <span className="text-emerald-600 dark:text-emerald-400">+{mat} (vi)</span>;
                if (mat < 0) return <span className="text-red-600 dark:text-red-400">{mat} (AI)</span>;
                return <span className="text-muted-foreground">0 (izjednaceno)</span>;
              })()}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-2.5 text-xs space-y-1">
            <p className="font-semibold">Saveti</p>
            <p>· Kliknite figuru da vidite legalne poteze</p>
            <p>· Plavi krug = polje · crveni prsten = capture</p>
            <p>· Drag-and-drop ili klik-klik radi</p>
            <p>· Pijun na 8. red → izbor promocije</p>
          </div>
        </aside>
      </div>

      {outcome !== 'in_progress' && (
        <div className="mt-5 rounded-2xl border bg-emerald-500/10 p-4 text-center">
          <p className="font-bold text-lg flex items-center justify-center gap-2">
            <Trophy className="h-5 w-5" /> {outcomeLabel[outcome]} — Score: {finalScore}
          </p>
          <Button className="mt-3" onClick={reset}>Nova partija</Button>
        </div>
      )}
    </div>
  );
}

/**
 * Red sa pojedenim figurama. Sortirano jaca prva, "+N" kraci view ako preko 8 figura.
 */
function CapturedRow({ pieces, color, label }: { pieces: PieceType[]; color: PieceColor; label: string }) {
  const totalValue = pieces.reduce((s, p) => s + PIECE_VALUE[p], 0);
  return (
    <div className="w-full max-w-[720px] flex items-center gap-2 rounded-xl border bg-card/40 px-3 py-2 min-h-[44px]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap gap-0.5 items-center">
        {pieces.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">nijedna</span>
        ) : (
          pieces.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className={`text-2xl leading-none ${color === 'b' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
              aria-label={`Figura ${p}`}
            >
              {PIECE_GLYPH[color][p]}
            </span>
          ))
        )}
      </div>
      {totalValue > 0 && (
        <span className="text-xs font-mono text-muted-foreground shrink-0">+{totalValue}</span>
      )}
    </div>
  );
}
