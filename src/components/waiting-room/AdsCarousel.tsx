import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdSlide {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaPath: string;
  gradient: string;
  icon: React.ReactNode;
}

const SLIDES: AdSlide[] = [
  {
    title: 'Stedna knjizica do 5% kamate',
    subtitle: 'Orocite sredstva i ostvarite siguran prinos do 5% godisnje. Bez fee-ja, bez papirologije.',
    ctaLabel: 'Otvori depozit',
    ctaPath: '/savings/new',
    gradient: 'from-emerald-500 via-teal-600 to-green-700',
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="h-16 w-16">
        <path d="M3 21h18v-2H3v2zM5 19V9l7-4 7 4v10h-2v-7H7v7H5z" />
      </svg>
    ),
  },
  {
    title: 'Inter-bank placanja za 30 sekundi',
    subtitle: '2PC protokol omogucava sigurnu transakciju izmedju banaka u tren oka.',
    ctaLabel: 'Posalji novac',
    ctaPath: '/payments/new',
    gradient: 'from-indigo-500 via-violet-600 to-purple-700',
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="h-16 w-16">
        <path d="M2 12l5-5v3h10V7l5 5-5 5v-3H7v3l-5-5z" />
      </svg>
    ),
  },
  {
    title: 'OTC trgovina sa drugim bankama',
    subtitle: 'Direktna kupoprodaja akcija mimo berze — bolji uslovi, vise kontrole.',
    ctaLabel: 'Pretrazi ponude',
    ctaPath: '/otc',
    gradient: 'from-amber-500 via-orange-600 to-red-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="h-16 w-16">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
  },
  {
    title: 'Investicioni fondovi za pasivni prihod',
    subtitle: 'Diversifikujte ulaganja kroz fondove kojima upravljaju Banka 2 supervizori.',
    ctaLabel: 'Otkrij fondove',
    ctaPath: '/funds',
    gradient: 'from-sky-500 via-blue-600 to-cyan-700',
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="h-16 w-16">
        <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
      </svg>
    ),
  },
  {
    title: 'Mobilna aplikacija — Banka 2 svuda sa tobom',
    subtitle: 'iOS i Android — sva placanja, krediti, OTC trgovina u dzepu.',
    ctaLabel: 'Skini app',
    ctaPath: '/branches',
    gradient: 'from-pink-500 via-rose-600 to-fuchsia-700',
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="h-16 w-16">
        <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" />
      </svg>
    ),
  },
  {
    title: 'Banka2Rush — novi izazov',
    subtitle: 'Trči kroz lobby banke, sakupljaj vrece sa novcem i postavi rekord!',
    ctaLabel: 'Igraj sada',
    ctaPath: '/soba-za-cekanje/banka-rush',
    gradient: 'from-violet-600 via-purple-700 to-indigo-900',
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="h-16 w-16">
        <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z" />
      </svg>
    ),
  },
];

const AUTO_ROTATE_MS = 5500;

export function AdsCarousel() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  // Force re-mount cyclic key da ken-burns animacija restartuje za svaku slajd
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setDirection('next');
      setIndex((i) => (i + 1) % SLIDES.length);
      setAnimKey((k) => k + 1);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused]);

  function go(toIndex: number, dir: 'next' | 'prev') {
    setDirection(dir);
    setIndex(toIndex);
    setAnimKey((k) => k + 1);
  }

  const slide = SLIDES[index];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border shadow-2xl group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      data-testid="waiting-room-ads-carousel"
    >
      {/* Background sa ken-burns zoom efektom + slide-in iz strane */}
      <div
        key={animKey}
        className={`relative bg-gradient-to-br ${slide.gradient} p-8 text-white min-h-[240px] flex items-center gap-6 overflow-hidden ${direction === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
      >
        {/* Animated decorative blobs */}
        <span className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-3xl animate-pulse" />
        <span className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-white/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        {/* Floating sparkles (CSS pseudo-particle) */}
        <span className="absolute top-1/4 left-1/3 h-1.5 w-1.5 rounded-full bg-white/60 animate-float-1" />
        <span className="absolute top-2/3 left-2/3 h-1 w-1 rounded-full bg-white/40 animate-float-2" />
        <span className="absolute top-1/3 right-1/4 h-2 w-2 rounded-full bg-white/50 animate-float-3" />

        {/* Ken Burns ikona — slow zoom-in + rotate */}
        <div className="flex-shrink-0 z-10 animate-ken-burns drop-shadow-2xl">{slide.icon}</div>

        <div className="flex-1 space-y-3 z-10">
          <h3 className="text-2xl md:text-3xl font-bold drop-shadow-md animate-fade-in-up">
            {slide.title}
          </h3>
          <p className="text-white/90 max-w-xl animate-fade-in-up" style={{ animationDelay: '120ms' }}>
            {slide.subtitle}
          </p>
          <button
            onClick={() => navigate(slide.ctaPath)}
            className="group/cta inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-white hover:text-slate-900 hover:scale-105 transition-all duration-300 border border-white/30 shadow-lg animate-fade-in-up"
            style={{ animationDelay: '240ms' }}
          >
            {slide.ctaLabel}
            <span className="inline-block transition-transform duration-300 group-hover/cta:translate-x-1">→</span>
          </button>
        </div>
      </div>

      {/* Prev/Next dugmad sa fade-in on hover */}
      <button
        onClick={() => go((index - 1 + SLIDES.length) % SLIDES.length, 'prev')}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/50"
        aria-label="Prethodna reklama"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => go((index + 1) % SLIDES.length, 'next')}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/50"
        aria-label="Sledeca reklama"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dot indicators sa animiranim progress bar-om za current slide */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i, i > index ? 'next' : 'prev')}
            aria-label={`Reklama ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 overflow-hidden ${
              i === index ? 'w-8 bg-white/30' : 'w-2 bg-white/40 hover:bg-white/60'
            }`}
          >
            {i === index && !paused && (
              <span
                key={animKey}
                className="block h-full bg-white animate-progress-bar"
                style={{ animationDuration: `${AUTO_ROTATE_MS}ms` }}
              />
            )}
            {i === index && paused && <span className="block h-full bg-white" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export default AdsCarousel;
