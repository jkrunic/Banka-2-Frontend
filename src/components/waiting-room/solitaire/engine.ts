// Pure Klondike Solitaire engine — bez React zavisnosti, lako testabilno.
//
// Tipovi: 4 boje (S/H/D/C), 13 rangova (A-K). Standardni Klondike layout:
// 7 tableau kolona (1, 2, ..., 7 karata; samo poslednja okrenuta), 1 stock pile,
// 1 waste pile, 4 foundation slot-a (jedan po boji).

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  id: string; // npr "H7" (sedmica srca), "SK" (kralj pik)
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export type PileType = 'tableau' | 'foundation' | 'waste' | 'stock';

export interface PileRef {
  type: PileType;
  /** index za tableau (0-6) ili foundation (0-3); za stock/waste je 0 */
  index: number;
}

export interface GameState {
  tableau: Card[][]; // 7 kolona
  foundations: Card[][]; // 4 sloga (S/H/D/C — redom)
  stock: Card[];
  waste: Card[];
  moves: number;
  startedAt: number;
}

export const RED_SUITS: ReadonlySet<Suit> = new Set(['H', 'D']);
export const FOUNDATION_ORDER: readonly Suit[] = ['S', 'H', 'D', 'C'];

export function isRed(suit: Suit): boolean {
  return RED_SUITS.has(suit);
}

export function buildDeck(): Card[] {
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  const deck: Card[] = [];
  for (const s of suits) {
    for (let r = 1; r <= 13; r++) {
      deck.push({ id: `${s}${r}`, suit: s, rank: r as Rank, faceUp: false });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function newGame(rng: () => number = Math.random): GameState {
  const deck = shuffle(buildDeck(), rng);
  const tableau: Card[][] = [[], [], [], [], [], [], []];
  let cursor = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[cursor++] };
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }
  const stock = deck.slice(cursor).map((c) => ({ ...c, faceUp: false }));
  return {
    tableau,
    foundations: [[], [], [], []],
    stock,
    waste: [],
    moves: 0,
    startedAt: Date.now(),
  };
}

export function drawFromStock(state: GameState): GameState {
  if (state.stock.length === 0) {
    if (state.waste.length === 0) return state;
    // recikliraj waste u stock
    const newStock = state.waste.slice().reverse().map((c) => ({ ...c, faceUp: false }));
    return { ...state, stock: newStock, waste: [], moves: state.moves + 1 };
  }
  const stock = state.stock.slice();
  const card = { ...stock.pop()!, faceUp: true };
  const waste = [...state.waste, card];
  return { ...state, stock, waste, moves: state.moves + 1 };
}

/** Move single card or sequence; returns null ako move nije validan. */
export function moveCard(state: GameState, from: PileRef, fromCardIndex: number, to: PileRef): GameState | null {
  const sourcePile = getPile(state, from);
  if (!sourcePile || fromCardIndex < 0 || fromCardIndex >= sourcePile.length) return null;
  const moving = sourcePile.slice(fromCardIndex);
  if (moving.some((c) => !c.faceUp)) return null;

  if (!canPlaceOn(moving, getPile(state, to), to)) return null;

  // klonira state
  const tableau = state.tableau.map((c) => c.slice());
  const foundations = state.foundations.map((c) => c.slice());
  let waste = state.waste.slice();

  // ukloni iz source
  if (from.type === 'tableau') {
    tableau[from.index] = tableau[from.index].slice(0, fromCardIndex);
    // okreni novu top-kartu ako postoji i jos je face-down
    const top = tableau[from.index][tableau[from.index].length - 1];
    if (top && !top.faceUp) top.faceUp = true;
  } else if (from.type === 'foundation') {
    foundations[from.index] = foundations[from.index].slice(0, fromCardIndex);
  } else if (from.type === 'waste') {
    waste = waste.slice(0, fromCardIndex);
  }

  // dodaj u destination
  if (to.type === 'tableau') {
    tableau[to.index] = [...tableau[to.index], ...moving];
  } else if (to.type === 'foundation') {
    if (moving.length !== 1) return null;
    foundations[to.index] = [...foundations[to.index], ...moving];
  }

  return {
    ...state,
    tableau,
    foundations,
    waste,
    moves: state.moves + 1,
  };
}

function getPile(state: GameState, ref: PileRef): Card[] | null {
  if (ref.type === 'tableau') return state.tableau[ref.index] ?? null;
  if (ref.type === 'foundation') return state.foundations[ref.index] ?? null;
  if (ref.type === 'waste') return state.waste;
  if (ref.type === 'stock') return state.stock;
  return null;
}

function canPlaceOn(moving: Card[], destPile: Card[] | null, dest: PileRef): boolean {
  if (!destPile) return false;
  const first = moving[0];
  if (dest.type === 'foundation') {
    if (moving.length !== 1) return false;
    const expectedSuit = FOUNDATION_ORDER[dest.index];
    if (first.suit !== expectedSuit) return false;
    const top = destPile[destPile.length - 1];
    if (!top) return first.rank === 1; // mora biti as
    return first.rank === top.rank + 1;
  }
  if (dest.type === 'tableau') {
    const top = destPile[destPile.length - 1];
    if (!top) return first.rank === 13; // prazan tableau prima samo kralja
    if (!top.faceUp) return false;
    if (isRed(first.suit) === isRed(top.suit)) return false;
    return first.rank === top.rank - 1;
  }
  return false;
}

export function isWon(state: GameState): boolean {
  return state.foundations.every((p) => p.length === 13);
}

/** Score: 100 ako pobeda, plus bonus za malo poteza i kratko vreme. */
export function computeScore(state: GameState, endedAt: number): number {
  if (!isWon(state)) return 0;
  const seconds = Math.max(1, Math.floor((endedAt - state.startedAt) / 1000));
  const movesPenalty = Math.min(state.moves * 2, 400);
  const timePenalty = Math.min(seconds, 600);
  return Math.max(100, 2000 - movesPenalty - timePenalty);
}
