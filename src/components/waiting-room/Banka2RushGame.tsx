// Banka2Rush — endless 3-lane runner, Subway Surfers stil.
// Canvas + requestAnimationFrame, sve grafika vector (Canvas 2D path-ovi)
// nacrtana iz koda — bez teksturisanih sprite-ova. Banka 2 estetika.
//
// Kontrole:
//   ← / A  — promeni traku ulevo
//   → / D  — promeni traku udesno
//   ↑ / W / Space — skok
//   ↓ / S — klizi (3 frejma niska poza)
//
// Mehanika:
//   - 3 trake (left/center/right) na perspektivnom "hodniku" banke
//   - Prepreke: SEF (pun blok — preskok), TURNSKET (low — klizi)
//   - Pickup-i: NOVCANICA (+50 base), ZLATNIK (+200, redak)
//   - Power-up: SAFEDOOR (5s nepostradan)
//   - Brzina linearno raste sa distancom
//   - 3 zivota (collision sa preprekom -1; pickup-ovi ne smanjuju)
//   - Game over kad lives = 0; score se submituje na BE.

import { useEffect, useRef, useState } from 'react';
import { Heart, Trophy, RotateCw, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { gameScoreService } from '@/services/gameScoreService';
import { toast } from '@/lib/notify';
import { useEffectiveTheme } from '@/hooks/useEffectiveTheme';

const CANVAS_W = 1100;
const CANVAS_H = 620;
const LANES = 3;
const LANE_BOTTOM_Y = 540; // y na vrhu trake na dnu
const LANE_TOP_Y = 180; // gornja granica perspektive
const PLAYER_BASE_HEIGHT = 90;
const PLAYER_SLIDE_HEIGHT = 50;
const GRAVITY = 0.9;
const JUMP_VELOCITY = -16;
const LANE_CHANGE_DURATION = 8; // frejmova za animaciju
const INITIAL_SPEED = 4.5;
const MAX_SPEED = 11;
const SPEED_RAMP_PER_FRAME = 0.0006;

type ObstacleType = 'SEF' | 'TURNSKET';
type PickupType = 'NOVCANICA' | 'ZLATNIK';

interface Obstacle {
  id: number;
  lane: number;
  z: number; // 1 = daleko, 0 = blizu igraca
  type: ObstacleType;
}

interface Pickup {
  id: number;
  lane: number;
  z: number;
  type: PickupType;
}

interface GameRef {
  player: {
    lane: number;
    targetLane: number;
    laneAnim: number; // 0-LANE_CHANGE_DURATION
    velY: number;
    posY: number; // 0 = stoji, > 0 = u vazduhu
    sliding: number; // brojac frejmova preostalo
  };
  obstacles: Obstacle[];
  pickups: Pickup[];
  speed: number;
  score: number;
  lives: number;
  frame: number;
  spawnObstacleAt: number;
  spawnPickupAt: number;
  nextId: number;
  invincibleFrames: number;
  status: 'idle' | 'playing' | 'gameover';
}

function newGame(): GameRef {
  return {
    player: { lane: 1, targetLane: 1, laneAnim: 0, velY: 0, posY: 0, sliding: 0 },
    obstacles: [],
    pickups: [],
    speed: INITIAL_SPEED,
    score: 0,
    lives: 3,
    frame: 0,
    spawnObstacleAt: 60,
    spawnPickupAt: 30,
    nextId: 1,
    invincibleFrames: 60,
    status: 'idle',
  };
}

// Mapira lane (0/1/2) + z (0-1) u canvas screen koordinate (centar trake).
function projectLane(lane: number, z: number): { x: number; y: number; scale: number } {
  // perspektiva: na z=1 (daleko) trake su uske u sredini, na z=0 (blizu) razdvojene
  const yProgress = z; // 1 = vrh, 0 = dno
  const y = LANE_TOP_Y + (LANE_BOTTOM_Y - LANE_TOP_Y) * (1 - yProgress);
  const farLeftX = CANVAS_W / 2 - 60;
  const farRightX = CANVAS_W / 2 + 60;
  const nearLeftX = 140;
  const nearRightX = CANVAS_W - 140;
  const leftX = farLeftX + (nearLeftX - farLeftX) * (1 - yProgress);
  const rightX = farRightX + (nearRightX - farRightX) * (1 - yProgress);
  const laneCenter = leftX + ((rightX - leftX) / LANES) * (lane + 0.5);
  const scale = 0.4 + 0.7 * (1 - yProgress);
  return { x: laneCenter, y, scale };
}

export function Banka2RushGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameRef>(newGame());
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [submitted, setSubmitted] = useState(false);
  const { user } = useAuth();
  const theme = useEffectiveTheme();
  // useRef da loop function moze citati trenutnu theme bez restartovanja RAF-a
  const themeRef = useRef<'light' | 'dark'>(theme);
  themeRef.current = theme;

  function start() {
    gameRef.current = newGame();
    gameRef.current.status = 'playing';
    setStatus('playing');
    setScore(0);
    setLives(3);
    setSubmitted(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const g = gameRef.current;
      if (g.status === 'idle' && (e.key === ' ' || e.key === 'Enter')) {
        start();
        return;
      }
      if (g.status !== 'playing') return;
      const k = e.key.toLowerCase();
      if ((e.key === 'ArrowLeft' || k === 'a') && g.player.targetLane > 0) {
        g.player.targetLane -= 1;
        g.player.laneAnim = LANE_CHANGE_DURATION;
      } else if ((e.key === 'ArrowRight' || k === 'd') && g.player.targetLane < LANES - 1) {
        g.player.targetLane += 1;
        g.player.laneAnim = LANE_CHANGE_DURATION;
      } else if ((e.key === 'ArrowUp' || k === 'w' || e.key === ' ') && g.player.posY === 0) {
        g.player.velY = JUMP_VELOCITY;
        e.preventDefault();
      } else if ((e.key === 'ArrowDown' || k === 's') && g.player.posY === 0) {
        g.player.sliding = 24;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    function loop() {
      const g = gameRef.current;
      if (!ctx) return;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      drawBackground(ctx, g.frame, themeRef.current);

      if (g.status === 'idle') {
        drawIdleScreen(ctx);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (g.status === 'gameover') {
        drawGameOverScreen(ctx, g.score);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      g.frame++;
      g.speed = Math.min(MAX_SPEED, g.speed + SPEED_RAMP_PER_FRAME);

      // Spawn
      if (g.frame >= g.spawnObstacleAt) {
        const lane = Math.floor(Math.random() * LANES);
        const type: ObstacleType = Math.random() < 0.5 ? 'SEF' : 'TURNSKET';
        g.obstacles.push({ id: g.nextId++, lane, z: 1, type });
        const gap = Math.max(45, 90 - g.speed * 4);
        g.spawnObstacleAt = g.frame + gap + Math.floor(Math.random() * 30);
      }
      if (g.frame >= g.spawnPickupAt) {
        const lane = Math.floor(Math.random() * LANES);
        const type: PickupType = Math.random() < 0.1 ? 'ZLATNIK' : 'NOVCANICA';
        g.pickups.push({ id: g.nextId++, lane, z: 1, type });
        g.spawnPickupAt = g.frame + 40 + Math.floor(Math.random() * 25);
      }

      // Move
      const zStep = g.speed / 600; // 0.0075 base ~ 130 frejmova da prodje z=1→0
      g.obstacles.forEach((o) => (o.z -= zStep));
      g.pickups.forEach((p) => (p.z -= zStep));
      g.obstacles = g.obstacles.filter((o) => o.z > -0.2);
      g.pickups = g.pickups.filter((p) => p.z > -0.2);

      // Player physics
      if (g.player.laneAnim > 0) {
        g.player.laneAnim -= 1;
        g.player.lane =
          g.player.targetLane +
          ((g.player.targetLane > g.player.lane ? -1 : g.player.targetLane < g.player.lane ? 1 : 0) *
            g.player.laneAnim) / LANE_CHANGE_DURATION;
        if (g.player.laneAnim === 0) g.player.lane = g.player.targetLane;
      }
      g.player.velY += GRAVITY;
      g.player.posY = Math.max(0, g.player.posY - g.player.velY * 0.1);
      // posY > 0 znaci da je u vazduhu — ali u screen koordinatama "iznad" = manje
      if (g.player.posY < 0) {
        g.player.posY = 0;
        g.player.velY = 0;
      }
      // Jednostavnije: ako je velY < 0 i posY = 0, lansiraj
      if (g.player.velY < 0 || g.player.posY > 0) {
        g.player.posY -= g.player.velY;
        g.player.velY += GRAVITY;
        if (g.player.posY <= 0) {
          g.player.posY = 0;
          g.player.velY = 0;
        }
      }
      if (g.player.sliding > 0) g.player.sliding -= 1;
      if (g.invincibleFrames > 0) g.invincibleFrames -= 1;

      // Collisions
      const playerHitbox = Math.round(g.player.targetLane);
      g.obstacles.forEach((o) => {
        if (o.z > 0.25 || o.z < 0.0) return;
        if (o.lane !== playerHitbox) return;
        // Sef: mora skok; turnsket: mora klizenje
        const inAir = g.player.posY > 30;
        const isSliding = g.player.sliding > 0;
        const collided =
          (o.type === 'SEF' && !inAir) ||
          (o.type === 'TURNSKET' && !isSliding);
        if (collided && g.invincibleFrames === 0) {
          g.lives -= 1;
          g.invincibleFrames = 60;
          setLives(g.lives);
          if (g.lives <= 0) {
            g.status = 'gameover';
            setStatus('gameover');
          }
        }
        // ukloni prepreku ili je puštamo da prodje
      });
      g.pickups = g.pickups.filter((p) => {
        if (p.z > 0.25 || p.z < 0.0) return true;
        if (p.lane !== playerHitbox) return true;
        const value = p.type === 'ZLATNIK' ? 200 : 50;
        g.score += value;
        return false;
      });

      // Distance score
      g.score += Math.floor(g.speed);
      setScore(g.score);

      // Draw
      drawLanes(ctx, themeRef.current);
      // Draw obstacles + pickups sorted by z DESC (daleko prvo)
      const drawList: Array<{ z: number; render: () => void }> = [];
      g.obstacles.forEach((o) => drawList.push({ z: o.z, render: () => drawObstacle(ctx, o) }));
      g.pickups.forEach((p) => drawList.push({ z: p.z, render: () => drawPickup(ctx, p, g.frame) }));
      drawList.sort((a, b) => b.z - a.z);
      drawList.forEach((d) => d.render());

      drawPlayer(ctx, g);
      drawHud(ctx, g);

      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Submit score on game over
  useEffect(() => {
    if (status === 'gameover' && !submitted && user) {
      const finalScore = gameRef.current.score;
      gameScoreService
        .submit({ gameType: 'BANKA2_RUSH', score: finalScore })
        .then(() => toast.success(`Game over. Score ${finalScore} sacuvan!`))
        .catch(() => toast.error('Greska pri cuvanju score-a.'));
      setSubmitted(true);
    }
  }, [status, submitted, user]);

  return (
    <div className="w-full max-w-[800px] mx-auto">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 font-semibold">
            <Trophy className="h-4 w-4 text-amber-500" /> {score}
          </span>
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`h-4 w-4 ${i < lives ? 'fill-rose-500 text-rose-500' : 'text-slate-300'}`}
              />
            ))}
          </span>
        </div>
        {status !== 'playing' && (
          <Button size="sm" onClick={start}>
            {status === 'idle' ? <Play className="mr-2 h-4 w-4" /> : <RotateCw className="mr-2 h-4 w-4" />}
            {status === 'idle' ? 'Start' : 'Nova igra'}
          </Button>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden border shadow-lg bg-gradient-to-b from-violet-700 to-indigo-900 dark:from-violet-900 dark:to-indigo-950">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block w-full"
          onClick={() => {
            if (gameRef.current.status === 'idle') start();
          }}
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground text-center">
        <kbd className="px-1.5 py-0.5 rounded bg-muted">←/→</kbd> trake ·
        <kbd className="px-1.5 py-0.5 rounded bg-muted mx-1">Space</kbd> skok ·
        <kbd className="px-1.5 py-0.5 rounded bg-muted">↓</kbd> klizi
      </p>
    </div>
  );
}

/* ─────────── render helpers (sve crta iz koda — vektor stil) ───────────── */

function drawBackground(ctx: CanvasRenderingContext2D, frame: number, theme: 'light' | 'dark') {
  const isDark = theme === 'dark';
  // Gradient nebo
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  if (isDark) {
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.4, '#3730a3');
    grad.addColorStop(0.7, '#5b21b6');
    grad.addColorStop(1, '#0f172a');
  } else {
    grad.addColorStop(0, '#dbeafe'); // light sky-blue
    grad.addColorStop(0.4, '#e0e7ff');
    grad.addColorStop(0.7, '#ede9fe');
    grad.addColorStop(1, '#cffafe');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Suncev odsjaj sa halo
  const sunX = CANVAS_W / 2;
  const sunY = 160;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 160);
  if (isDark) {
    sunGrad.addColorStop(0, 'rgba(251, 191, 36, 0.5)');
    sunGrad.addColorStop(0.4, 'rgba(251, 191, 36, 0.15)');
    sunGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
  } else {
    sunGrad.addColorStop(0, 'rgba(253, 224, 71, 0.85)');
    sunGrad.addColorStop(0.4, 'rgba(253, 224, 71, 0.3)');
    sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
  }
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 160, 0, Math.PI * 2);
  ctx.fill();
  // Sunce kao centralni krug u light mode-u
  if (!isDark) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 32, 0, Math.PI * 2);
    ctx.fill();
  }

  // Daleke kule banke (paralax sloj 1)
  ctx.fillStyle = isDark ? 'rgba(67, 56, 202, 0.4)' : 'rgba(99, 102, 241, 0.45)';
  for (let i = 0; i < 11; i++) {
    const x = ((i * 110 - frame * 0.2) % (CANVAS_W + 110) + CANVAS_W + 110) % (CANVAS_W + 110) - 110;
    const buildH = 60 + ((i * 17) % 40);
    ctx.fillRect(x, 130 - (buildH - 60), 70, buildH);
    ctx.fillRect(x + 25, 125 - (buildH - 60), 20, 12);
  }

  // Bliske kule banke (paralax sloj 2)
  ctx.fillStyle = isDark ? 'rgba(91, 33, 182, 0.6)' : 'rgba(67, 56, 202, 0.55)';
  for (let i = 0; i < 8; i++) {
    const x = ((i * 160 - frame * 0.6) % (CANVAS_W + 160) + CANVAS_W + 160) % (CANVAS_W + 160) - 160;
    const buildH = 95 + ((i * 23) % 50);
    ctx.fillRect(x, 170 - (buildH - 95), 110, buildH);
    ctx.fillRect(x + 50, 165 - (buildH - 95) - 18, 5, 18);
  }

  // Osvetljeni prozori na bliskim kulama (paralax 2)
  ctx.fillStyle = isDark ? 'rgba(253, 230, 138, 0.75)' : 'rgba(254, 240, 138, 0.95)';
  for (let i = 0; i < 8; i++) {
    const x = ((i * 160 - frame * 0.6) % (CANVAS_W + 160) + CANVAS_W + 160) % (CANVAS_W + 160) - 160;
    for (let wy = 0; wy < 10; wy++) {
      for (let wx = 0; wx < 8; wx++) {
        const lit = (i * 13 + wy * 7 + wx * 3) % 5 < 2;
        if (lit) {
          ctx.fillRect(x + 12 + wx * 12, 190 + wy * 9, 4, 4);
        }
      }
    }
  }

  // Oblaci (paralax sloj 3) — vidljiviji u light mode-u
  ctx.fillStyle = isDark ? 'rgba(165, 180, 252, 0.18)' : 'rgba(255, 255, 255, 0.85)';
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 280 - frame * 0.4) % (CANVAS_W + 280) + CANVAS_W + 280) % (CANVAS_W + 280) - 280;
    const cy = 50 + (i * 13) % 30;
    ctx.beginPath(); ctx.ellipse(cx, cy, 65, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 30, cy - 8, 42, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - 22, cy + 4, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawLanes(ctx: CanvasRenderingContext2D, theme: 'light' | 'dark') {
  const isDark = theme === 'dark';
  // Kontura hodnika (perspektivni trapez)
  ctx.beginPath();
  ctx.moveTo(CANVAS_W / 2 - 60, LANE_TOP_Y);
  ctx.lineTo(CANVAS_W / 2 + 60, LANE_TOP_Y);
  ctx.lineTo(CANVAS_W - 140, LANE_BOTTOM_Y);
  ctx.lineTo(140, LANE_BOTTOM_Y);
  ctx.closePath();
  const gradHall = ctx.createLinearGradient(0, LANE_TOP_Y, 0, LANE_BOTTOM_Y);
  if (isDark) {
    gradHall.addColorStop(0, 'rgba(79, 70, 229, 0.4)');
    gradHall.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  } else {
    gradHall.addColorStop(0, 'rgba(199, 210, 254, 0.5)');
    gradHall.addColorStop(1, 'rgba(76, 29, 149, 0.55)');
  }
  ctx.fillStyle = gradHall;
  ctx.fill();

  // Linije izmedju traka
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;
  for (let lane = 1; lane < LANES; lane++) {
    const top = projectLane(lane - 0.5, 1);
    const bot = projectLane(lane - 0.5, 0);
    ctx.beginPath();
    ctx.moveTo(top.x + ((LANES * 80) / (LANES * 2)) * 0, top.y);
    // jednostavnije: koristi projectLane za levu ivicu trake
    const topEdge = projectLane(lane - 1, 1);
    const botEdge = projectLane(lane - 1, 0);
    const topEdgeX = topEdge.x + 27; // pomak na ivicu
    const botEdgeX = botEdge.x + 100;
    ctx.moveTo(topEdgeX - 13, top.y);
    ctx.lineTo(botEdgeX - 100, bot.y);
    ctx.stroke();
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const p = projectLane(o.lane, o.z);
  const w = 60 * p.scale;
  const h = 60 * p.scale;
  if (o.type === 'SEF') {
    // Senka pod sefom
    ctx.fillStyle = `rgba(0,0,0,${0.45 * p.scale})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 3 * p.scale, w * 0.55, 5 * p.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    // SEF telo (gradient)
    const grad = ctx.createLinearGradient(p.x - w / 2, p.y - h, p.x + w / 2, p.y);
    grad.addColorStop(0, '#475569');
    grad.addColorStop(0.5, '#1f2937');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(p.x - w / 2, p.y - h, w, h);
    // Highlight gornji rub
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(p.x - w / 2, p.y - h, w, 2);
    // Unutrasnja kocka (lice sefa)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x - w / 2 + 4, p.y - h + 4, w - 8, h - 8);
    // Tocak (combination dial)
    ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    ctx.arc(p.x, p.y - h / 2, w * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(p.x, p.y - h / 2, w * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    // 4 spoke
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(p.x, p.y - h / 2);
      ctx.rotate((i * Math.PI) / 2);
      ctx.fillRect(-0.7, -w * 0.18, 1.4, w * 0.36);
      ctx.restore();
    }
    // $ logo iznad
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${Math.floor(w * 0.18)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('$', p.x, p.y - h + w * 0.2);
    // Donja rucka
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(p.x - w * 0.15, p.y - h * 0.18, w * 0.3, h * 0.05);
  } else {
    // TURNSKET — niska prepreka sa crveno-zutim trakama i metalnim stubom
    // Senka
    ctx.fillStyle = `rgba(0,0,0,${0.4 * p.scale})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 3 * p.scale, w * 0.55, 4 * p.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    // Stubovi
    ctx.fillStyle = '#475569';
    ctx.fillRect(p.x - w / 2 - 2, p.y - h * 0.5, 4, h * 0.5);
    ctx.fillRect(p.x + w / 2 - 2, p.y - h * 0.5, 4, h * 0.5);
    // Glavna prepreka (red + zuti dijagonalni pruge)
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(p.x - w / 2, p.y - h * 0.45, w, h * 0.25);
    // Zute dijagonalne pruge
    ctx.fillStyle = '#fbbf24';
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x - w / 2, p.y - h * 0.45, w, h * 0.25);
    ctx.clip();
    for (let i = -2; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(p.x - w / 2 + i * 12, p.y - h * 0.45);
      ctx.lineTo(p.x - w / 2 + i * 12 + 6, p.y - h * 0.45);
      ctx.lineTo(p.x - w / 2 + i * 12 + 12, p.y - h * 0.2);
      ctx.lineTo(p.x - w / 2 + i * 12 + 6, p.y - h * 0.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(p.x - w / 2, p.y - h * 0.45, w, 2);
  }
}

function drawPickup(ctx: CanvasRenderingContext2D, p: Pickup, frame: number) {
  const pos = projectLane(p.lane, p.z);
  const size = 24 * pos.scale;
  const bob = Math.sin((frame + p.id * 7) * 0.15) * 4 * pos.scale;
  const cy = pos.y - 30 * pos.scale + bob;
  if (p.type === 'ZLATNIK') {
    // Glow halo
    const glowGrad = ctx.createRadialGradient(pos.x, cy, 0, pos.x, cy, size * 2);
    glowGrad.addColorStop(0, 'rgba(251, 191, 36, 0.6)');
    glowGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(pos.x, cy, size * 2, 0, Math.PI * 2);
    ctx.fill();
    // Spin animacija — width oscillates
    const spinScale = Math.abs(Math.cos((frame + p.id * 3) * 0.15));
    const w = size * (0.4 + 0.6 * spinScale);
    // Zlatnik (gradient — daje dubinu)
    const coinGrad = ctx.createRadialGradient(pos.x - w * 0.3, cy - size * 0.3, 0, pos.x, cy, size);
    coinGrad.addColorStop(0, '#fef3c7');
    coinGrad.addColorStop(0.5, '#fbbf24');
    coinGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = coinGrad;
    ctx.beginPath();
    ctx.ellipse(pos.x, cy, w, size, 0, 0, Math.PI * 2);
    ctx.fill();
    // Edge
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // $ simbol (sakriva se kad je usko)
    if (spinScale > 0.45) {
      ctx.fillStyle = '#7c2d12';
      ctx.font = `bold ${size * 1.1}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', pos.x, cy);
    }
  } else {
    // NOVCANICA — zelena pravougaonik sa detaljima (Banka 2 stilizovana)
    ctx.save();
    const tilt = Math.sin((frame + p.id * 5) * 0.12) * 0.08;
    ctx.translate(pos.x, cy);
    ctx.rotate(tilt);
    // Senka iza
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-size + 2, -size / 2 + 2, size * 2, size);
    // Glavna ploca novcanice (gradient)
    const billGrad = ctx.createLinearGradient(-size, 0, size, 0);
    billGrad.addColorStop(0, '#059669');
    billGrad.addColorStop(0.5, '#10b981');
    billGrad.addColorStop(1, '#047857');
    ctx.fillStyle = billGrad;
    ctx.fillRect(-size, -size / 2, size * 2, size);
    // Granicni okvir
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-size, -size / 2, size * 2, size);
    // Krug u sredini (kao portret)
    ctx.fillStyle = '#a7f3d0';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#065f46';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // $ centralno
    ctx.fillStyle = '#064e3b';
    ctx.font = `bold ${size * 0.55}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0);
    // "B2" oznake u uglovima
    ctx.font = `bold ${size * 0.3}px sans-serif`;
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('B2', -size + size * 0.3, -size / 2 + size * 0.3);
    ctx.fillText('B2', size - size * 0.3, size / 2 - size * 0.1);
    ctx.restore();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, g: GameRef) {
  const lanePos = projectLane(g.player.lane, 0);
  const x = lanePos.x;
  const baseY = lanePos.y;
  const jumpOffset = g.player.posY;
  const isSliding = g.player.sliding > 0;
  const h = isSliding ? PLAYER_SLIDE_HEIGHT : PLAYER_BASE_HEIGHT;
  const w = 40;
  const y = baseY - jumpOffset;

  // Senka ispod igraca (povecava se kad skace)
  const shadowScale = 1 - jumpOffset / 200;
  ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * shadowScale})`;
  ctx.beginPath();
  ctx.ellipse(x, baseY + 4, (w / 2) * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trepere ako je nepostradan
  if (g.invincibleFrames > 0 && Math.floor(g.frame / 5) % 2 === 0) return;

  // Run cycle: noge se naizmenicno pomeraju
  const runPhase = isSliding ? 0 : Math.floor(g.frame / 6) % 2;
  const inAir = jumpOffset > 5;

  // Cipele + noge
  ctx.fillStyle = '#0f172a';
  if (inAir) {
    // U vazduhu — obe noge zajedno
    ctx.fillRect(x - 8, y - 8, 7, 10);
    ctx.fillRect(x + 1, y - 8, 7, 10);
  } else if (isSliding) {
    // Klizenje — noge napred
    ctx.fillRect(x - 14, y - 6, 14, 6);
  } else {
    if (runPhase === 0) {
      ctx.fillRect(x - 10, y - 12, 8, 12); // leva napred
      ctx.fillRect(x + 2, y - 6, 8, 6);    // desna nazad
    } else {
      ctx.fillRect(x - 10, y - 6, 8, 6);
      ctx.fillRect(x + 2, y - 12, 8, 12);
    }
  }

  // Pantalone (tamno sive)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x - w / 2 + 4, y - h * 0.5, w - 8, h * 0.45);

  // Sako (indigo) sa rever sa V-shaped opening
  ctx.fillStyle = '#3730a3';
  ctx.fillRect(x - w / 2 + 2, y - h * 0.95, w - 4, h * 0.5);
  // Sako border highlight
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - w / 2 + 2, y - h * 0.95, w - 4, h * 0.5);

  // Bela kosulja (V neckline)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(x - 5, y - h * 0.9);
  ctx.lineTo(x + 5, y - h * 0.9);
  ctx.lineTo(x + 4, y - h * 0.55);
  ctx.lineTo(x - 4, y - h * 0.55);
  ctx.closePath();
  ctx.fill();

  // Kravata sa zlatnom kopcom
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(x - 2, y - h * 0.88);
  ctx.lineTo(x + 2, y - h * 0.88);
  ctx.lineTo(x + 3, y - h * 0.78);
  ctx.lineTo(x - 3, y - h * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 3, y - h * 0.78);
  ctx.lineTo(x + 3, y - h * 0.78);
  ctx.lineTo(x + 4, y - h * 0.6);
  ctx.lineTo(x, y - h * 0.55);
  ctx.lineTo(x - 4, y - h * 0.6);
  ctx.closePath();
  ctx.fill();
  // Kravata kopca
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(x - 2, y - h * 0.79, 4, 1.5);

  // Glava sa sjenku
  const headY = y - h;
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.arc(x + 1, headY + 1, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(x, headY, 13, 0, Math.PI * 2);
  ctx.fill();
  // Kosa (zacesljana)
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(x, headY - 5, 13, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x - 13, headY - 5, 26, 4);
  // Oci (male tacke)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x - 5, headY - 1, 2, 2);
  ctx.fillRect(x + 3, headY - 1, 2, 2);
  // Osmijeh (kratak luk)
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, headY + 4, 3, 0, Math.PI);
  ctx.stroke();

  // Kufer (u ruci) sa zlatnom kopcom
  if (!isSliding) {
    const briefY = y - h * 0.6 + Math.sin(g.frame * 0.3) * 1.5; // mini bob
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x + w / 2 - 2, briefY, 12, 14);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(x + w / 2 - 2, briefY, 12, 2);
    // Ručka
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + w / 2 + 4, briefY - 1, 3, Math.PI, 0);
    ctx.stroke();
    // Kopca
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + w / 2 + 2, briefY + 5, 4, 3);
  }
}

function drawHud(ctx: CanvasRenderingContext2D, g: GameRef) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(10, 10, 200, 30);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${g.score}`, 20, 30);
  ctx.fillText(`Speed: ${g.speed.toFixed(1)}`, 110, 30);
}

function drawIdleScreen(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Banka2Rush', CANVAS_W / 2, CANVAS_H / 2 - 30);
  ctx.font = '18px sans-serif';
  ctx.fillText('Pritisni Space ili klik za start', CANVAS_W / 2, CANVAS_H / 2 + 10);
  ctx.font = '14px sans-serif';
  ctx.fillText('← → trake · ↑/Space skok · ↓ klizi', CANVAS_W / 2, CANVAS_H / 2 + 40);
}

function drawGameOverScreen(ctx: CanvasRenderingContext2D, score: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 60px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 20);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`Score: ${score}`, CANVAS_W / 2, CANVAS_H / 2 + 30);
}
