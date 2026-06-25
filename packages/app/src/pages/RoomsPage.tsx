import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface RoomSummary {
  id: string;
  name: string;
  location: string | null;
  building: string | null;
  floor: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidityMin: number | null;
  humidityMax: number | null;
  rackCount: number;
  cageCount: number;
  occupiedCages: number;
  totalAnimals: number;
}

export function RoomsPage() {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    location: '',
    building: '',
    floor: '',
    temperatureMin: '',
    temperatureMax: '',
    humidityMin: '',
    humidityMax: '',
  });

  useEffect(() => {
    loadRooms();
  }, []);

  async function loadRooms() {
    try {
      setLoading(true);
      const data = await api.getRooms(api.getLabId());
      setRooms(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createRoom({
        labId: api.getLabId(),
        name: newRoom.name,
        location: newRoom.location || undefined,
        building: newRoom.building || undefined,
        floor: newRoom.floor ? parseInt(newRoom.floor) : undefined,
        temperatureMin: newRoom.temperatureMin ? parseFloat(newRoom.temperatureMin) : undefined,
        temperatureMax: newRoom.temperatureMax ? parseFloat(newRoom.temperatureMax) : undefined,
        humidityMin: newRoom.humidityMin ? parseFloat(newRoom.humidityMin) : undefined,
        humidityMax: newRoom.humidityMax ? parseFloat(newRoom.humidityMax) : undefined,
      });
      setShowAdd(false);
      setNewRoom({
        name: '',
        location: '',
        building: '',
        floor: '',
        temperatureMin: '',
        temperatureMax: '',
        humidityMin: '',
        humidityMax: '',
      });
      loadRooms();
    } catch (err: any) {
      console.error(err);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rooms</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Create Room
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Room</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                value={newRoom.name}
                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
              <input
                value={newRoom.building}
                onChange={(e) => setNewRoom({ ...newRoom, building: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
              <input
                value={newRoom.floor}
                onChange={(e) => setNewRoom({ ...newRoom, floor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                value={newRoom.location}
                onChange={(e) => setNewRoom({ ...newRoom, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temp Min (°C)</label>
              <input
                value={newRoom.temperatureMin}
                onChange={(e) => setNewRoom({ ...newRoom, temperatureMin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="number"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temp Max (°C)</label>
              <input
                value={newRoom.temperatureMax}
                onChange={(e) => setNewRoom({ ...newRoom, temperatureMax: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="number"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Humidity Min (%)
              </label>
              <input
                value={newRoom.humidityMin}
                onChange={(e) => setNewRoom({ ...newRoom, humidityMin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="number"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Humidity Max (%)
              </label>
              <input
                value={newRoom.humidityMax}
                onChange={(e) => setNewRoom({ ...newRoom, humidityMax: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="number"
                step="0.1"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : rooms.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No rooms found. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold">{room.name}</h3>
              <p className="text-sm text-gray-500">
                {room.building ? `${room.building}, ` : ''}
                {room.location || 'No location'}
                {room.floor ? `, Floor ${room.floor}` : ''}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{room.rackCount}</div>
                  <div className="text-xs text-gray-500">Racks</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{room.cageCount}</div>
                  <div className="text-xs text-gray-500">Cages</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{room.totalAnimals}</div>
                  <div className="text-xs text-gray-500">Animals</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{room.occupiedCages}</div>
                  <div className="text-xs text-gray-500">Occupied</div>
                </div>
              </div>

              {(room.temperatureMin != null || room.humidityMin != null) && (
                <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">
                  {room.temperatureMin != null && (
                    <div>
                      🌡️ {room.temperatureMin}–{room.temperatureMax}°C
                    </div>
                  )}
                  {room.humidityMin != null && (
                    <div>
                      💧 {room.humidityMin}–{room.humidityMax}% RH
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
