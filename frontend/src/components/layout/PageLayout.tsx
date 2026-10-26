import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function PageLayout() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="md:ml-64 mt-16 p-5 pb-28 md:p-8 md:pb-8 min-h-[calc(100vh-64px)]">
        <Outlet />
      </main>
    </div>
  );
}
