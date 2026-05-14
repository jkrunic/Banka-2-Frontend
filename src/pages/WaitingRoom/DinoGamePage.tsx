import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BankerDinoGame } from '@/components/waiting-room/BankerDinoGame';

export default function DinoGamePage() {
  return (
    <div className="mx-auto py-6 space-y-6 max-w-[1180px] px-4">
      <div className="flex items-center gap-4">
        <Link
          to="/soba-za-cekanje"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Nazad na hub
        </Link>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
          Bankar Dino
        </h1>
        <p className="text-sm text-muted-foreground">
          Skoči preko ERROR znakova, sagni se od aviona, skupljaj novčanice za bonus score.
        </p>
      </div>

      <div className="flex justify-center">
        <BankerDinoGame />
      </div>

      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-4 text-xs space-y-1.5">
        <p className="font-semibold text-sm mb-2">Kako se igra</p>
        <p>· <kbd className="px-1.5 py-0.5 rounded bg-muted">Space</kbd> ili <kbd className="px-1.5 py-0.5 rounded bg-muted">↑</kbd> = skok</p>
        <p>· <kbd className="px-1.5 py-0.5 rounded bg-muted">↓</kbd> = sagni se (za leteca prepreke)</p>
        <p>· Klik na canvas takodje radi skok</p>
        <p>· Score raste sa razdaljinom + novcanice daju bonus +50</p>
        <p>· Brzina raste — postaje sve teze!</p>
      </div>
    </div>
  );
}
