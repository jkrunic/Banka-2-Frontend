import { useEffect, useState } from 'react';
import { Trophy, Crown, Medal, Award } from 'lucide-react';
import { gameScoreService } from '@/services/gameScoreService';
import type { GameScore, GameType } from '@/types/games';
import { GAME_LABELS } from '@/types/games';

const TABS: GameType[] = ['DINO', 'SOLITAIRE', 'CHESS', 'BANKA2_RUSH'];

export function Leaderboard() {
  const [active, setActive] = useState<GameType>('DINO');
  const [scores, setScores] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    gameScoreService.leaderboard(active, 10)
      .then((data) => { if (!cancelled) setScores(data); })
      .catch(() => { if (!cancelled) setScores([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active]);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden" data-testid="waiting-room-leaderboard">
      <div className="border-b p-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h3 className="font-bold">Leaderboard</h3>
      </div>

      {/* Tabovi */}
      <div className="flex border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            data-testid={`leaderboard-tab-${t}`}
            className={`flex-1 px-3 py-2.5 text-xs font-semibold transition-colors ${
              active === t
                ? 'bg-gradient-to-b from-indigo-500/10 to-violet-500/10 text-indigo-600 dark:text-indigo-300 border-b-2 border-indigo-500'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {GAME_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="p-3">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : scores.length === 0 ? (
          <div className="py-8 text-center">
            <Trophy className="h-8 w-8 mx-auto text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground mt-2">Jos uvek nema rezultata za {GAME_LABELS[active]}.</p>
            <p className="text-xs text-muted-foreground/80">Budi prvi!</p>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {scores.map((s, idx) => {
              const rank = s.rank ?? idx + 1;
              return (
                <li
                  key={s.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    rank <= 3 ? 'bg-gradient-to-r from-amber-500/10 to-transparent' : 'hover:bg-muted/50'
                  }`}
                >
                  <span className="w-6 text-center">{rankIcon(rank)}</span>
                  <span className="flex-1 font-medium truncate">{s.playerName}</span>
                  <span className="font-mono font-bold tabular-nums text-indigo-600 dark:text-indigo-300">
                    {s.score.toLocaleString('sr-RS')}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function rankIcon(rank: number): React.ReactNode {
  if (rank === 1) return <Crown className="h-4 w-4 mx-auto text-amber-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 mx-auto text-slate-400" />;
  if (rank === 3) return <Award className="h-4 w-4 mx-auto text-amber-700" />;
  return <span className="text-xs font-bold text-muted-foreground">#{rank}</span>;
}

export default Leaderboard;
