import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function PageLayout() {
  // The live interview fills the screen edge to edge (no padding, no bottom tab bar)
  const inInterviewRoom = /^\/interview\/[^/]+/.test(useLocation().pathname);

  return (
    <div className="min-h-dvh">
      <Navbar />
      <Sidebar />
      <main
        className={
          inInterviewRoom
            ? 'md:ml-64 pt-14'
            : 'md:ml-64 mt-14 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-8 md:pb-8 min-h-[calc(100dvh-56px)]'
        }
      >
        <Outlet />
      </main>
    </div>
  );
}
