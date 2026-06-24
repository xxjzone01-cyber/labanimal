import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function DashboardPage() {
  const [stats, setStats] = useState({ animals: 0, rooms: 0, protocols: 0 });

  useEffect(() => {
    // TODO: fetch real stats from API
    setStats({ animals: 5, rooms: 1, protocols: 1 });
  }, []);

  const cards = [
    { label: 'Total Animals', value: stats.animals, icon: '🐭', color: 'bg-blue-50 text-blue-700' },
    { label: 'Rooms', value: stats.rooms, icon: '🏠', color: 'bg-green-50 text-green-700' },
    { label: 'Active Protocols', value: stats.protocols, icon: '📋', color: 'bg-purple-50 text-purple-700' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`${card.color} rounded-xl p-6`}
          >
            <div className="text-3xl mb-2">{card.icon}</div>
            <div className="text-3xl font-bold">{card.value}</div>
            <div className="text-sm opacity-75">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/animals" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center">
            <div className="text-2xl mb-1">➕</div>
            <div className="text-sm font-medium">Add Animal</div>
          </a>
          <a href="/rooms" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center">
            <div className="text-2xl mb-1">🏠</div>
            <div className="text-sm font-medium">Manage Rooms</div>
          </a>
          <a href="/protocols" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center">
            <div className="text-2xl mb-1">📋</div>
            <div className="text-sm font-medium">View Protocols</div>
          </a>
          <div className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center cursor-pointer">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-sm font-medium">Reports</div>
          </div>
        </div>
      </div>
    </div>
  );
}
