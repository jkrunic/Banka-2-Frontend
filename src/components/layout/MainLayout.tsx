import { Outlet } from 'react-router-dom';
import ClientSidebar from '../shared/ClientSidebar';
import RouteErrorBoundary from '../shared/RouteErrorBoundary';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen">
      <ClientSidebar />
      <main className="min-w-0 flex-1 bg-muted/40">
        <div className="container py-6">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </div>
      </main>
    </div>
  );
}
