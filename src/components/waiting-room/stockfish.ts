// Stockfish UCI klijent — tanki wrapper oko Web Worker-a koji ucitava
// stockfish-18-lite-single.js iz public/stockfish/ (kopirano kroz npm prebuild).
//
// API:
//   const sf = await createStockfish();
//   sf.setSkill(15);
//   const move = await sf.getBestMove(fen, { depth: 8, movetime: 1500 });
//   sf.quit();
//
// "single" varijanta ne zahteva COOP/COEP headere niti SharedArrayBuffer —
// radi u svakom modernom browseru bez specijalne nginx konfiguracije.

const SF_URL = '/stockfish/stockfish-18-lite-single.js';

export interface SearchOpts {
  depth?: number; // dubina (1-20)
  movetime?: number; // millisekundi (alternative; bilo koje od dva)
}

export interface DifficultyConfig {
  /** Stockfish Skill Level 0-20 (vise = jace) */
  skill: number;
  /** Ako > 0, kapacira Elo igracevu jacinu (Stockfish UCI_Elo, ~1320-2850) */
  elo?: number;
}

export interface StockfishClient {
  setSkill: (level: number) => void; // 0-20 (legacy single-knob)
  /** Postavlja Skill Level + opcionalno UCI_LimitStrength + UCI_Elo. Pozeljnije od setSkill. */
  setDifficulty: (cfg: DifficultyConfig) => void;
  getBestMove: (fen: string, opts?: SearchOpts) => Promise<string>;
  quit: () => void;
}

/**
 * Inicijalizuje Stockfish worker. Ne resava se dok engine ne odgovori "uciok"
 * (potvrdjuje da je WASM ucitan + UCI handshake gotov).
 */
export async function createStockfish(): Promise<StockfishClient> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(SF_URL);
    } catch (e) {
      reject(new Error(`Failed to start Stockfish worker: ${e instanceof Error ? e.message : e}`));
      return;
    }

    let readyForUci = false;
    let pendingMoveResolve: ((m: string) => void) | null = null;

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      if (line === 'uciok') {
        readyForUci = true;
        // Idemo na 'isready' da finalizujemo init
        worker.postMessage('isready');
      } else if (line === 'readyok' && readyForUci) {
        // Engine spreman — resolve client
        resolve({
          setSkill: (level: number) => {
            const clamped = Math.max(0, Math.min(20, Math.round(level)));
            worker.postMessage(`setoption name Skill Level value ${clamped}`);
          },
          setDifficulty: (cfg: DifficultyConfig) => {
            const skill = Math.max(0, Math.min(20, Math.round(cfg.skill)));
            worker.postMessage(`setoption name Skill Level value ${skill}`);
            if (cfg.elo != null && cfg.elo > 0) {
              // Stockfish UCI_Elo radi samo kad je UCI_LimitStrength = true
              worker.postMessage('setoption name UCI_LimitStrength value true');
              const elo = Math.max(1320, Math.min(2850, Math.round(cfg.elo)));
              worker.postMessage(`setoption name UCI_Elo value ${elo}`);
            } else {
              worker.postMessage('setoption name UCI_LimitStrength value false');
            }
          },
          getBestMove: (fen, opts = {}) =>
            new Promise<string>((res, rej) => {
              if (pendingMoveResolve) {
                rej(new Error('Stockfish busy — prethodni search jos traje.'));
                return;
              }
              pendingMoveResolve = res;
              worker.postMessage(`position fen ${fen}`);
              if (opts.movetime != null) {
                worker.postMessage(`go movetime ${opts.movetime}`);
              } else {
                worker.postMessage(`go depth ${opts.depth ?? 8}`);
              }
            }),
          quit: () => {
            worker.postMessage('quit');
            worker.terminate();
          },
        });
      } else if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        const move = parts[1] ?? '';
        const resolver = pendingMoveResolve;
        pendingMoveResolve = null;
        if (resolver) resolver(move);
      }
    };

    worker.onerror = (e) => {
      reject(new Error(`Stockfish worker error: ${e.message}`));
    };

    // UCI handshake
    worker.postMessage('uci');
  });
}
