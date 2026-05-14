// Klondike Solitaire — Banka 2 stil. Click-to-move (umesto drag-and-drop)
// jer je svaki potez jednoznačan: prvo klik na izvornu kartu, pa klik na destinaciju.
// Auto-promote do foundation-a sa double-click-om.
import { useEffect, useMemo, useState } from 'react';
import { RotateCw, Trophy, Clock, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  newGame,
  drawFromStock,
  moveCard,
  isWon,
  computeScore,
  type GameState,
  type PileRef,
  FOUNDATION_ORDER,
} from './engine';
import { CardSvg, CardPlaceholder, CARD_W, CARD_H } from './CardSvg';
import { useAuth } from '@/context/AuthContext';
import { gameScoreService } from '@/services/gameScoreService';
import { toast } from '@/lib/notify';

interface Selection {
  pile: PileRef;
  cardIndex: number;
}

export function SolitaireGame() {
  const [state, setState] = useState<GameState>(() => newGame());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const { user } = useAuth();
  const won = useMemo(() => isWon(state), [state]);
  const finalScore = useMemo(() => (won ? computeScore(state, Date.now()) : 0), [state, won]);

  useEffect(() => {
    if (won) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - state.startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [state.startedAt, won]);

  useEffect(() => {
    if (won && !submitted && user) {
      gameScoreService
        .submit({ gameType: 'SOLITAIRE', score: finalScore })
        .then(() => toast.success(`Pobeda! Score ${finalScore} sacuvan u leaderboard.`))
        .catch(() => toast.error('Greska pri cuvanju score-a.'));
      setSubmitted(true);
    }
  }, [won, submitted, user, finalScore]);

  function reset() {
    setState(newGame());
    setSelection(null);
    setSubmitted(false);
    setElapsed(0);
  }

  function tryMoveTo(dest: PileRef) {
    if (!selection) return;
    const next = moveCard(state, selection.pile, selection.cardIndex, dest);
    if (next) {
      setState(next);
    } else {
      toast.error('Nedozvoljen potez.');
    }
    setSelection(null);
  }

  function autoToFoundation(from: PileRef, fromCardIndex: number) {
    // proba da ubaci u prvi validan foundation
    for (let i = 0; i < 4; i++) {
      const next = moveCard(state, from, fromCardIndex, { type: 'foundation', index: i });
      if (next) {
        setState(next);
        setSelection(null);
        return true;
      }
    }
    return false;
  }

  function clickCard(pile: PileRef, cardIndex: number, isTop: boolean) {
    if (selection) {
      // ako je vec selektovano nesto, ovaj klik je destinacija
      if (
        selection.pile.type === pile.type &&
        selection.pile.index === pile.index &&
        selection.cardIndex === cardIndex
      ) {
        setSelection(null);
        return;
      }
      tryMoveTo(pile);
      return;
    }
    // nova selekcija — samo gornje karte tableau-a ili top waste/foundation
    const sourcePile = pile.type === 'tableau' ? state.tableau[pile.index] :
                       pile.type === 'foundation' ? state.foundations[pile.index] :
                       pile.type === 'waste' ? state.waste : state.stock;
    const card = sourcePile[cardIndex];
    if (!card || !card.faceUp) return;
    // ako je top karta i ide na foundation, auto-promote
    if (isTop && autoToFoundation(pile, cardIndex)) return;
    setSelection({ pile, cardIndex });
  }

  function handleStockClick() {
    setSelection(null);
    setState(drawFromStock(state));
  }

  const isSelected = (pile: PileRef, idx: number): boolean =>
    !!selection &&
    selection.pile.type === pile.type &&
    selection.pile.index === pile.index &&
    selection.cardIndex === idx;

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {formatTime(elapsed)}</span>
          <span className="flex items-center gap-1.5"><Move className="h-4 w-4" /> {state.moves} poteza</span>
          {won && (
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <Trophy className="h-4 w-4" /> Score: {finalScore}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCw className="mr-2 h-4 w-4" /> Nova partija
        </Button>
      </div>

      {/* Top row: stock + waste + 4 foundations */}
      <div className="flex flex-wrap gap-3 mb-6 justify-center">
        <div
          onClick={handleStockClick}
          className="cursor-pointer relative"
          style={{ width: CARD_W, height: CARD_H }}
        >
          {state.stock.length > 0 ? (
            <CardSvg suit="S" rank={1} faceUp={false} />
          ) : (
            <CardPlaceholder label="⟲" />
          )}
        </div>
        <div className="relative" style={{ width: CARD_W, height: CARD_H }}>
          {state.waste.length === 0 ? (
            <CardPlaceholder label="Waste" />
          ) : (
            <CardSvg
              suit={state.waste[state.waste.length - 1].suit}
              rank={state.waste[state.waste.length - 1].rank}
              faceUp
              highlighted={isSelected({ type: 'waste', index: 0 }, state.waste.length - 1)}
              onClick={() => clickCard({ type: 'waste', index: 0 }, state.waste.length - 1, true)}
            />
          )}
        </div>

        <div className="w-6" /> {/* spacer */}

        {FOUNDATION_ORDER.map((suit, i) => {
          const pile = state.foundations[i];
          const top = pile[pile.length - 1];
          const isEmpty = pile.length === 0;
          return (
            <div
              key={suit}
              className="relative cursor-pointer"
              style={{ width: CARD_W, height: CARD_H }}
              onClick={() => {
                if (selection) tryMoveTo({ type: 'foundation', index: i });
              }}
            >
              {isEmpty ? (
                <CardPlaceholder label={suit} />
              ) : top && (
                <CardSvg
                  suit={top.suit}
                  rank={top.rank}
                  faceUp
                  onClick={(e?: React.MouseEvent) => {
                    e?.stopPropagation();
                    clickCard({ type: 'foundation', index: i }, pile.length - 1, true);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Tableau: 7 kolona, karte sa preklapanjem */}
      <div className="flex gap-3 justify-center">
        {state.tableau.map((col, colIdx) => (
          <div
            key={colIdx}
            className="relative cursor-pointer"
            style={{ width: CARD_W, minHeight: CARD_H + 28 * Math.max(col.length - 1, 0) }}
            onClick={() => {
              if (col.length === 0 && selection) tryMoveTo({ type: 'tableau', index: colIdx });
            }}
          >
            {col.length === 0 ? (
              <CardPlaceholder label="K" />
            ) : (
              col.map((card, rowIdx) => (
                <CardSvg
                  key={card.id}
                  suit={card.suit}
                  rank={card.rank}
                  faceUp={card.faceUp}
                  highlighted={isSelected({ type: 'tableau', index: colIdx }, rowIdx)}
                  style={{ position: 'absolute', top: rowIdx * 28, left: 0 }}
                  onClick={(e?: React.MouseEvent) => {
                    e?.stopPropagation();
                    clickCard({ type: 'tableau', index: colIdx }, rowIdx, rowIdx === col.length - 1);
                  }}
                />
              ))
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground text-center">
        Kliknite kartu da selektujete, pa kliknite ciljnu gomilu/karticu. Stock klik = vuci. Dvoklikom (auto) ide u foundation ako moze.
      </p>

      {won && (
        <div className="mt-4 rounded-2xl border bg-emerald-500/10 p-4 text-center">
          <p className="font-bold text-lg">Pobeda! Score: {finalScore}</p>
          <p className="text-sm text-muted-foreground">Vreme {formatTime(elapsed)} / {state.moves} poteza</p>
          <Button className="mt-3" onClick={reset}>Nova partija</Button>
        </div>
      )}
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
