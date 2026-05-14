import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, RotateCcw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/notify';
import { gameScoreService } from '@/services/gameScoreService';
import { useEffectiveTheme } from '@/hooks/useEffectiveTheme';

/**
 * Banker Dino — Chrome T-Rex stil endless jumper.
 * Spec: Info o predmetu/2026-05-14-waiting-room-games-design.md §4.1.
 *
 * Mehanika:
 *  - Spacebar / Click / Tap = jump
 *  - ↓ Arrow / S = duck (samo na zemlji ako leteca prepreka)
 *  - Score += 1 svaki frame koji prezivi (~60fps)
 *  - Speed se ubrzava sa distance (5px -> 12px po frame-u)
 *  - High score persist u localStorage + submit BE pri Game Over
 */

const CANVAS_W = 1100;
const CANVAS_H = 340;
const GROUND_Y = 280;
const GRAVITY = 0.7;
const JUMP_VEL = -13;
const INITIAL_SPEED = 5;
const MAX_SPEED = 12;
const SPEED_RAMP_PER_FRAME = 0.0008;

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'sign' | 'plane'; // sign = ground, plane = flying (mora ducknuti)
}

interface Coin {
  x: number;
  y: number;
  r: number;
}

interface DinoState {
  y: number;
  vy: number;
  ducking: boolean;
  alive: boolean;
}

interface BankerDinoGameProps {
  /** Compact mode: koristi se na 404 strani (300x100 inline). */
  compact?: boolean;
  /** Skip submit za 404 page (no auth context). */
  skipSubmit?: boolean;
}

export function BankerDinoGame({ compact = false, skipSubmit = false }: BankerDinoGameProps) {
  const width = compact ? 360 : CANVAS_W;
  const height = compact ? 130 : CANVAS_H;
  const groundY = compact ? 100 : GROUND_Y;
  const dinoW = compact ? 36 : 80;
  const dinoH = compact ? 50 : 110;
  const theme = useEffectiveTheme();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({
    dino: { y: groundY - dinoH, vy: 0, ducking: false, alive: true } as DinoState,
    obstacles: [] as Obstacle[],
    coins: [] as Coin[],
    speed: INITIAL_SPEED,
    score: 0,
    frame: 0,
    nextObstacleAt: 60,
    nextCoinAt: 120,
  });

  const [gameStatus, setGameStatus] = useState<'idle' | 'running' | 'gameover'>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return Number(localStorage.getItem('dino-highscore') ?? 0);
  });

  const resetState = useCallback(() => {
    stateRef.current = {
      dino: { y: groundY - dinoH, vy: 0, ducking: false, alive: true },
      obstacles: [],
      coins: [],
      speed: INITIAL_SPEED,
      score: 0,
      frame: 0,
      nextObstacleAt: 60,
      nextCoinAt: 120,
    };
    setScore(0);
  }, [groundY, dinoH]);

  /** Crta jedan frame. Sve graficki ide kroz canvas 2D context — sprites su crtanje preko path-ova. */
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    const isDark = theme === 'dark';
    ctx.clearRect(0, 0, width, height);

    // Pozadina: gradient — nocno violetno za dark, jutarnje plavo-rozove tonovi za light
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (isDark) {
      skyGrad.addColorStop(0, '#0b0b3b');
      skyGrad.addColorStop(0.5, '#1e1b4b');
      skyGrad.addColorStop(1, '#3730a3');
    } else {
      skyGrad.addColorStop(0, '#fef3c7'); // pale gold za nebo na vrhu
      skyGrad.addColorStop(0.5, '#fce7f3'); // pink horizon
      skyGrad.addColorStop(1, '#ddd6fe'); // soft violet
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Mesec (dark) / Sunce (light)
    const moonX = width - (compact ? 50 : 130);
    const moonY = compact ? 25 : 60;
    const moonR = compact ? 10 : 28;
    if (isDark) {
      const halo = ctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, moonR * 3);
      halo.addColorStop(0, 'rgba(253, 230, 138, 0.5)');
      halo.addColorStop(1, 'rgba(253, 230, 138, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      ctx.fill();
      // Kraterici
      ctx.fillStyle = 'rgba(146, 64, 14, 0.3)';
      ctx.beginPath(); ctx.arc(moonX - moonR * 0.3, moonY - moonR * 0.2, moonR * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(moonX + moonR * 0.25, moonY + moonR * 0.15, moonR * 0.12, 0, Math.PI * 2); ctx.fill();
    } else {
      // Sunce sa zracima
      const halo = ctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, moonR * 4);
      halo.addColorStop(0, 'rgba(251, 191, 36, 0.7)');
      halo.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      ctx.fill();
      // Zraci (rotirajuci)
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.lineWidth = 2;
      for (let r = 0; r < 8; r++) {
        const a = (r / 8) * Math.PI * 2 + s.frame * 0.005;
        ctx.beginPath();
        ctx.moveTo(moonX + Math.cos(a) * (moonR + 4), moonY + Math.sin(a) * (moonR + 4));
        ctx.lineTo(moonX + Math.cos(a) * (moonR + 12), moonY + Math.sin(a) * (moonR + 12));
        ctx.stroke();
      }
    }

    // Zvezde (samo dark) ili oblaci (light) sa paralax
    if (isDark) {
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 137 - s.frame * 0.3) % width + width) % width;
        const sy = (i * 31) % (groundY - 40);
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin((s.frame + i * 17) * 0.05));
        ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.6})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    } else {
      // Oblaci u sredisnjem planu
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 280 - s.frame * 0.4) % (width + 280) + width + 280) % (width + 280) - 280;
        const cy = 40 + (i * 11) % 40;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 50, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 35, cy - 7, 32, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - 25, cy + 4, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Daleke skyline + bliske kule (theme-aware boje)
    drawCityLayer(ctx, width, groundY, s.frame * 0.5, 0.2, isDark ? '#1e1b4b' : '#6366f1', compact);
    drawCityLayer(ctx, width, groundY, s.frame * 1.2, isDark ? 0.45 : 0.35, isDark ? '#2e1065' : '#4338ca', compact);

    // Ground: gradient pod + neon linija (theme-aware)
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
    if (isDark) {
      groundGrad.addColorStop(0, '#1e1b4b');
      groundGrad.addColorStop(1, '#0f0f3a');
    } else {
      groundGrad.addColorStop(0, '#c4b5fd');
      groundGrad.addColorStop(1, '#8b5cf6');
    }
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, width, height - groundY);
    // Glow ground linija
    ctx.shadowColor = isDark ? '#a78bfa' : '#fbbf24';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = isDark ? '#a78bfa' : '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Plocnik tackice
    ctx.fillStyle = isDark ? 'rgba(167, 139, 250, 0.35)' : 'rgba(255, 255, 255, 0.55)';
    for (let i = 0; i < width / 30; i++) {
      const dotX = ((i * 30 - s.frame * 1.5) % width + width) % width;
      ctx.fillRect(dotX, groundY + 6, 4, 1.5);
    }

    // Dino senka + render
    const dx = compact ? 30 : 80;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(dx + dinoW / 2, groundY + 4, dinoW * 0.45, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    drawBanker(ctx, dx, s.dino.y, dinoW, dinoH, s.dino.ducking, s.frame);

    // Obstacles
    for (const obs of s.obstacles) {
      if (obs.type === 'sign') drawErrorSign(ctx, obs.x, obs.y, obs.w, obs.h);
      else drawPlane(ctx, obs.x, obs.y, obs.w, obs.h, s.frame);
    }
    // Coins
    for (const coin of s.coins) {
      drawCoin(ctx, coin.x, coin.y, coin.r, s.frame);
    }

    // Score HUD — pozadinska tabla za citljivost u oba mode-a (isDark vec definisan iznad)
    ctx.fillStyle = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.7)';
    if (!compact) {
      ctx.fillRect(width - 180, 12, 168, 50);
    }
    ctx.fillStyle = isDark ? '#f1f5f9' : '#1e1b4b';
    ctx.font = `bold ${compact ? 12 : 22}px ui-monospace, monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE: ${s.score}`, width - 18, compact ? 16 : 36);
    if (highScore > 0) {
      ctx.fillStyle = isDark ? '#fbbf24' : '#b45309';
      ctx.font = `bold ${compact ? 10 : 14}px ui-monospace, monospace`;
      ctx.fillText(`HI: ${highScore}`, width - 18, compact ? 30 : 56);
    }
  }, [width, height, groundY, dinoW, dinoH, compact, highScore, theme]);

  /** Game step: fizika + spawn + collision. */
  const step = useCallback(() => {
    const s = stateRef.current;
    s.frame += 1;

    // Speed ramp
    s.speed = Math.min(MAX_SPEED, INITIAL_SPEED + s.frame * SPEED_RAMP_PER_FRAME);
    s.score = Math.floor(s.frame / 2);
    setScore(s.score);

    // Dino fizika
    s.dino.vy += GRAVITY;
    s.dino.y += s.dino.vy;
    const dinoEffectiveH = s.dino.ducking ? dinoH * 0.6 : dinoH;
    if (s.dino.y >= groundY - dinoEffectiveH) {
      s.dino.y = groundY - dinoEffectiveH;
      s.dino.vy = 0;
    }

    // Spawn obstacles
    if (s.frame >= s.nextObstacleAt) {
      const isFly = Math.random() < 0.25 && s.frame > 200; // posle 200 frame-a leteci se pojavljuju
      if (isFly) {
        s.obstacles.push({
          x: width,
          y: groundY - dinoH - 10, // gore — mora ducknuti
          w: compact ? 30 : 50,
          h: compact ? 15 : 24,
          type: 'plane',
        });
      } else {
        const sw = compact ? 24 : 36;
        const sh = compact ? 30 : 48;
        s.obstacles.push({
          x: width,
          y: groundY - sh,
          w: sw,
          h: sh,
          type: 'sign',
        });
      }
      // Sledeci spawn 50-110 frame-a kasnije (briska sa speed)
      const gap = 50 + Math.random() * 60;
      s.nextObstacleAt = s.frame + Math.floor(gap * (INITIAL_SPEED / s.speed));
    }

    // Spawn coins
    if (s.frame >= s.nextCoinAt) {
      const cr = compact ? 6 : 10;
      s.coins.push({
        x: width,
        y: groundY - 30 - Math.random() * 60,
        r: cr,
      });
      s.nextCoinAt = s.frame + 80 + Math.floor(Math.random() * 120);
    }

    // Move obstacles + coins
    for (const obs of s.obstacles) obs.x -= s.speed;
    for (const coin of s.coins) coin.x -= s.speed;
    s.obstacles = s.obstacles.filter((o) => o.x + o.w > 0);
    s.coins = s.coins.filter((c) => c.x + c.r > 0);

    // Collision detection
    const dx = compact ? 30 : 80;
    const dinoBox = {
      x: dx + 6,
      y: s.dino.y + (s.dino.ducking ? dinoH * 0.4 : 4),
      w: dinoW - 12,
      h: (s.dino.ducking ? dinoH * 0.5 : dinoH - 8),
    };
    for (const obs of s.obstacles) {
      if (
        dinoBox.x < obs.x + obs.w &&
        dinoBox.x + dinoBox.w > obs.x &&
        dinoBox.y < obs.y + obs.h &&
        dinoBox.y + dinoBox.h > obs.y
      ) {
        s.dino.alive = false;
        endGame(s.score);
        return;
      }
    }
    // Coin pickup
    s.coins = s.coins.filter((c) => {
      const cdx = c.x - (dinoBox.x + dinoBox.w / 2);
      const cdy = c.y - (dinoBox.y + dinoBox.h / 2);
      if (cdx * cdx + cdy * cdy < (c.r + dinoBox.w / 2) * (c.r + dinoBox.w / 2)) {
        s.score += 50;
        setScore(s.score);
        return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, dinoW, dinoH, groundY, compact]);

  /** Game over: persist + submit. */
  const endGame = useCallback((finalScore: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setGameStatus('gameover');
    if (finalScore > highScore) {
      setHighScore(finalScore);
      try { localStorage.setItem('dino-highscore', String(finalScore)); } catch { /* noop */ }
    }
    if (!skipSubmit && finalScore > 0) {
      gameScoreService.submit({ gameType: 'DINO', score: finalScore })
        .then(() => toast.success(`Score ${finalScore} sacuvan u leaderboard!`))
        .catch(() => { /* ignore — auth ili network */ });
    }
  }, [highScore, skipSubmit]);

  /** Game loop sa RAF. */
  const loop = useCallback(() => {
    if (stateRef.current.dino.alive) {
      step();
    }
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) draw(ctx);
    if (stateRef.current.dino.alive) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [step, draw]);

  const startGame = useCallback(() => {
    resetState();
    setGameStatus('running');
    rafRef.current = requestAnimationFrame(loop);
  }, [resetState, loop]);

  /** Cleanup. */
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /** Render idle frame even kad gameStatus='idle' da canvas nije prazan. */
  useEffect(() => {
    if (gameStatus === 'idle') {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) draw(ctx);
    }
  }, [gameStatus, draw]);

  /** Input handlers. */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameStatus === 'gameover' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        startGame();
        return;
      }
      if (gameStatus !== 'running') return;
      const s = stateRef.current;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (s.dino.y >= groundY - dinoH - 1) {
          s.dino.vy = JUMP_VEL;
        }
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        s.dino.ducking = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        stateRef.current.dino.ducking = false;
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStatus, startGame, groundY, dinoH]);

  const handleCanvasClick = () => {
    if (gameStatus === 'idle') {
      startGame();
      return;
    }
    if (gameStatus === 'gameover') {
      startGame();
      return;
    }
    if (gameStatus === 'running') {
      const s = stateRef.current;
      if (s.dino.y >= groundY - dinoH - 1) {
        s.dino.vy = JUMP_VEL;
      }
    }
  };

  return (
    <div className={compact ? 'inline-block' : 'flex flex-col items-center gap-4'}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        className="rounded-xl border shadow-lg cursor-pointer touch-none select-none"
        data-testid="banker-dino-canvas"
        style={{ maxWidth: '100%' }}
      />
      {!compact && (
        <div className="flex items-center gap-3">
          {gameStatus === 'idle' && (
            <Button onClick={startGame} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
              <Play className="mr-2 h-4 w-4" /> Pokreni
            </Button>
          )}
          {gameStatus === 'running' && (
            <p className="text-sm text-muted-foreground">Score: <span className="font-mono font-bold text-foreground">{score}</span></p>
          )}
          {gameStatus === 'gameover' && (
            <>
              <p className="text-sm">Game Over · Konacan score: <span className="font-mono font-bold text-foreground">{score}</span></p>
              <Button onClick={startGame} variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" /> Igraj ponovo
              </Button>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 rounded bg-muted">Space</kbd> = skok ·{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-muted">↓</kbd> = sagni
          </p>
        </div>
      )}
      {compact && gameStatus === 'idle' && (
        <p className="mt-2 text-center text-xs text-muted-foreground">Klikni za start</p>
      )}
      {!compact && highScore > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Trophy className="h-3 w-3 text-amber-500" />
          Tvoj rekord: <span className="font-mono font-bold">{highScore}</span>
        </p>
      )}
    </div>
  );
}

/* ── Crtanje sprites preko canvas-a (umesto SVG → bitmap optimizacija) ───── */

function drawBanker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ducking: boolean, frame: number) {
  ctx.save();
  ctx.translate(x, y);
  const dh = ducking ? h * 0.6 : h;
  const dy = ducking ? h * 0.4 : 0;
  // Sako (telo)
  ctx.fillStyle = '#1e293b'; // slate-800
  ctx.fillRect(w * 0.2, dy + dh * 0.35, w * 0.6, dh * 0.5);
  // Glava
  ctx.fillStyle = '#fbbf24'; // amber-400 (skin tone)
  ctx.beginPath();
  ctx.arc(w * 0.5, dy + dh * 0.22, w * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // Kosa
  ctx.fillStyle = '#451a03'; // brown
  ctx.beginPath();
  ctx.arc(w * 0.5, dy + dh * 0.16, w * 0.18, Math.PI, 0);
  ctx.fill();
  // Bela kosulja
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(w * 0.4, dy + dh * 0.4, w * 0.2, dh * 0.3);
  // Kravata (indigo)
  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.moveTo(w * 0.45, dy + dh * 0.4);
  ctx.lineTo(w * 0.55, dy + dh * 0.4);
  ctx.lineTo(w * 0.5, dy + dh * 0.6);
  ctx.closePath();
  ctx.fill();
  // Kufer (zlatni)
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(w * 0.75, dy + dh * 0.55, w * 0.2, dh * 0.18);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(w * 0.83, dy + dh * 0.5, w * 0.04, dh * 0.06);
  // Noge — animacija fram-by-frame (run cycle 2 frame-a)
  ctx.fillStyle = '#1e293b';
  const legPhase = ducking ? 0 : Math.floor(frame / 6) % 2;
  if (legPhase === 0) {
    ctx.fillRect(w * 0.3, dy + dh * 0.82, w * 0.12, dh * 0.18);
    ctx.fillRect(w * 0.58, dy + dh * 0.86, w * 0.12, dh * 0.14);
  } else {
    ctx.fillRect(w * 0.3, dy + dh * 0.86, w * 0.12, dh * 0.14);
    ctx.fillRect(w * 0.58, dy + dh * 0.82, w * 0.12, dh * 0.18);
  }
  ctx.restore();
}

function drawErrorSign(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  // Stalak
  ctx.fillStyle = '#71717a'; // zinc-500
  ctx.fillRect(x + w * 0.45, y + h * 0.6, w * 0.1, h * 0.4);
  // Trougao
  ctx.fillStyle = '#dc2626'; // red-600
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y);
  ctx.lineTo(x + w, y + h * 0.65);
  ctx.lineTo(x, y + h * 0.65);
  ctx.closePath();
  ctx.fill();
  // Border
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Uzvik
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(h * 0.4)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', x + w * 0.5, y + h * 0.45);
  ctx.restore();
}

function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: number) {
  ctx.save();
  const flap = Math.floor(frame / 8) % 2;
  // Telo aviona
  ctx.fillStyle = '#a78bfa'; // violet-400
  ctx.fillRect(x, y + h * 0.4, w, h * 0.4);
  // Krila
  ctx.fillStyle = '#7c3aed';
  if (flap === 0) {
    ctx.fillRect(x + w * 0.3, y, w * 0.4, h * 0.4);
  } else {
    ctx.fillRect(x + w * 0.3, y + h * 0.8, w * 0.4, h * 0.4);
  }
  // Nos
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.6);
  ctx.lineTo(x - w * 0.2, y + h * 0.6);
  ctx.lineTo(x, y + h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, frame: number) {
  ctx.save();
  // Spin animacija — varira sirina cirkla
  const scaleX = Math.abs(Math.cos((frame / 8) % (Math.PI * 2)));
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(x, y, r * (0.3 + scaleX * 0.7), r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // $ simbol
  if (scaleX > 0.5) {
    ctx.fillStyle = '#92400e';
    ctx.font = `bold ${Math.floor(r * 1.2)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', x, y);
  }
  ctx.restore();
}

/**
 * Parallax sloj siluete grada — repetira se beskonacno duz X-ose.
 * speed je vec frame-multiplied; opacity 0-1 kontrolise prozirnost (depth fog).
 */
function drawCityLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  groundY: number,
  scrollOffset: number,
  opacity: number,
  color: string,
  compact: boolean
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  const pattern = compact ? 60 : 100;
  // Tracenje skyline-a: cele zgrade tile-uju se duz X
  const off = ((scrollOffset % pattern) + pattern) % pattern;
  for (let x = -off; x < width + pattern; x += pattern) {
    // 2 zgrade po tile-u (kompozicija)
    const h1 = compact ? 35 : 60;
    const h2 = compact ? 25 : 45;
    const h3 = compact ? 45 : 75;
    ctx.fillRect(x + 5, groundY - h1, pattern * 0.25, h1);
    ctx.fillRect(x + pattern * 0.3, groundY - h3, pattern * 0.25, h3);
    ctx.fillRect(x + pattern * 0.6, groundY - h2, pattern * 0.3, h2);
    // Mali "krov" trougao za jednu od zgrada
    ctx.beginPath();
    ctx.moveTo(x + pattern * 0.3, groundY - h3);
    ctx.lineTo(x + pattern * 0.425, groundY - h3 - 10);
    ctx.lineTo(x + pattern * 0.55, groundY - h3);
    ctx.closePath();
    ctx.fill();
  }
  // Osvetljeni prozori (random ali deterministicki)
  ctx.globalAlpha = opacity * 0.8;
  ctx.fillStyle = '#fde68a';
  for (let x = -off; x < width + pattern; x += pattern) {
    for (let i = 0; i < 6; i++) {
      const wx = x + 8 + (i % 3) * 8;
      const wy = groundY - 30 - Math.floor(i / 3) * 10;
      // Deterministicki pattern (zgrada index + window index)
      const lit = (Math.floor(x / pattern) * 7 + i * 3) % 5 < 3;
      if (lit && wy < groundY - 6) {
        ctx.fillRect(wx, wy, compact ? 2 : 3, compact ? 2 : 3);
      }
    }
  }
  ctx.restore();
}

export default BankerDinoGame;
