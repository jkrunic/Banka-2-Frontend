import { useNavigate } from 'react-router-dom';
import { FileQuestion, Home, LogIn, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AuthPageLayout from '@/components/layout/AuthPageLayout';
import { BankerDinoGame } from '@/components/waiting-room/BankerDinoGame';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <AuthPageLayout>
      <div className="mx-auto w-full max-w-2xl animate-fade-up text-center">
        <Card className="shadow-2xl shadow-indigo-500/5">
          <CardContent className="space-y-6 py-10 px-6 md:px-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10 ring-1 ring-orange-500/30">
              <FileQuestion className="h-8 w-8 text-orange-500" />
            </div>

            <div className="space-y-2">
              <p className="text-6xl font-extrabold tracking-tight bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent sm:text-7xl">
                404
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Stranica nije pronađena
              </h1>
              <p className="text-muted-foreground">
                Stranica koju pokušavate da otvorite ne postoji. U medjuvremenu — igraj Bankar Dino!
              </p>
            </div>

            {/* 404 dino integration — instant playable compact game */}
            <div className="flex justify-center">
              <BankerDinoGame compact skipSubmit />
            </div>

            <p className="text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted">Space</kbd> ili klik = skok.
              Vise igara u <button type="button" onClick={() => navigate('/soba-za-cekanje')} className="underline hover:text-indigo-500">Sobi za cekanje</button>.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold"
                onClick={() => navigate('/')}
              >
                <Home className="mr-2 h-4 w-4" />
                Nazad na početnu
              </Button>
              <Button variant="outline" onClick={() => navigate('/soba-za-cekanje')}>
                <Gamepad2 className="mr-2 h-4 w-4" />
                Soba za čekanje
              </Button>
              <Button variant="ghost" onClick={() => navigate('/login')}>
                <LogIn className="mr-2 h-4 w-4" />
                Prijavi se
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthPageLayout>
  );
}
