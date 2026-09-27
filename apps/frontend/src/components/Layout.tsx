import { NavLink, Outlet } from 'react-router-dom';

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex-1 py-3 text-center text-sm tracking-wide ${isActive ? 'text-gold' : 'text-mist/60'}`;

export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <header className="flex items-center justify-center gap-2 pt-[max(env(safe-area-inset-top),1rem)] pb-2">
        <img src="/favicon.svg" alt="" className="h-7 w-7" />
        <span className="font-display text-2xl text-gold-soft">Third Eye</span>
      </header>
      <main className="flex-1 px-4 pb-24"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-lg border-t border-gold/20 bg-night/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <NavLink to="/" end className={tab}>Today</NavLink>
        <NavLink to="/history" className={tab}>History</NavLink>
        <NavLink to="/settings" className={tab}>Settings</NavLink>
      </nav>
    </div>
  );
}
