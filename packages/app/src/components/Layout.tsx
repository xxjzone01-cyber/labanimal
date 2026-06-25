import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { BillingBanner } from './BillingBanner';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/animals', label: 'Animals', icon: '🐭' },
  { to: '/health-records', label: 'Health', icon: '🏥' },
  { to: '/medications', label: 'Medications', icon: '💊' },
  { to: '/breedings', label: 'Breeding', icon: '🍼' },
  { to: '/death-reports', label: 'Deaths', icon: '💀' },
  { to: '/rooms', label: 'Rooms', icon: '🏠' },
  { to: '/cages', label: 'Cages', icon: '📦' },
  { to: '/protocols', label: 'Protocols', icon: '📋' },
  { to: '/trainings', label: 'Training', icon: '🎓' },
  { to: '/audit-log', label: 'Audit Log', icon: '📝' },
  { to: '/signatures', label: 'Signatures', icon: '✍️' },
  { to: '/billing', label: 'Billing', icon: '💰' },
  { to: '/subscriptions', label: 'Subscriptions', icon: '💳' },
  { to: '/vet-workbench', label: 'Vet Workbench', icon: '🩺' },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    api.setToken(null);
    navigate('/login');
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">LabAnimal</h1>
          <p className="text-xs text-gray-500 mt-1">Lab Animal Management</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="p-8">
          <BillingBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
