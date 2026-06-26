import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { BillingBanner } from './BillingBanner';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: '📊' },
    { to: '/animals', label: t('nav.animals'), icon: '🐭' },
    { to: '/health-records', label: t('nav.health'), icon: '🏥' },
    { to: '/medications', label: t('nav.medications'), icon: '💊' },
    { to: '/breedings', label: t('nav.breedings'), icon: '🍼' },
    { to: '/death-reports', label: t('nav.deathReports'), icon: '💀' },
    { to: '/rooms', label: t('nav.facilities'), icon: '🏠' },
    { to: '/cages', label: t('nav.cages'), icon: '📦' },
    { to: '/protocols', label: t('nav.protocols'), icon: '📋' },
    { to: '/trainings', label: t('nav.trainings'), icon: '🎓' },
    { to: '/audit-log', label: t('nav.auditLog'), icon: '📝' },
    { to: '/signatures', label: t('nav.signatures'), icon: '✍️' },
    { to: '/billing', label: t('nav.billing'), icon: '💰' },
    { to: '/subscriptions', label: t('nav.subscriptions'), icon: '💳' },
    { to: '/vet-workbench', label: t('nav.vetWorkbench'), icon: '🩺' },
    { to: '/api-keys', label: t('nav.apiKeys'), icon: '🔑' },
    { to: '/admin', label: t('nav.admin'), icon: '⚙️' },
  ];

  const handleLogout = () => {
    api.setToken(null);
    navigate('/login');
  };

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(next);
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

        <div className="p-4 border-t border-gray-200 space-y-1">
          <button
            onClick={toggleLanguage}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {i18n.language === 'en' ? '中文' : 'English'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {t('nav.logout')}
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
