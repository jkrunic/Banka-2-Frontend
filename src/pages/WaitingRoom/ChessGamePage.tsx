import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChessGame } from '@/components/waiting-room/ChessGame';

export default function ChessGamePage() {
  return (
    <div className="mx-auto py-6 space-y-6 max-w-[1240px] px-4">
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
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-500 to-zinc-700 bg-clip-text text-transparent">
          Šah
        </h1>
        <p className="text-sm text-muted-foreground">
          Vi igrate belim, AI je crni — povucite figuru na slobodno polje. Pobeda dolazi sa mat-om kralja.
        </p>
      </div>

      <ChessGame />
    </div>
  );
}
