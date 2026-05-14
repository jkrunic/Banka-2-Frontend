import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Banka2RushGame } from '@/components/waiting-room/Banka2RushGame';

export default function Banka2RushGamePage() {
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
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-purple-800 bg-clip-text text-transparent">
          Banka2Rush
        </h1>
        <p className="text-sm text-muted-foreground">
          Trci kroz lobby banke, skupljaj novcanice + zlatnike, izbegavaj sefove (skok) i turnskete (klizenje).
        </p>
      </div>

      <Banka2RushGame />
    </div>
  );
}
