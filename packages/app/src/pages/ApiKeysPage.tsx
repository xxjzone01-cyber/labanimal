import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  labId: string;
}

interface CreateApiKeyResponse extends ApiKey {
  key: string;
}

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKey, setNewKey] = useState<CreateApiKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState('read');
  const [expiresInDays, setExpiresInDays] = useState('90');

  const labId = localStorage.getItem('labId') || '';

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      setLoading(true);
      const data = await api.get<ApiKey[]>(`/api-keys?labId=${labId}`);
      setKeys(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      setError('');
      const data = await api.post<CreateApiKeyResponse>('/api-keys', {
        name,
        labId,
        permissions,
        expiresInDays: parseInt(expiresInDays) || undefined,
      });
      setNewKey(data);
      setShowCreateModal(false);
      setName('');
      setPermissions('read');
      setExpiresInDays('90');
      fetchKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to create API key');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这个 API Key 吗？使用此 Key 的所有应用将立即失去访问权限。')) {
      return;
    }
    try {
      await api.delete(`/api-keys/${id}`);
      fetchKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to delete API key');
    }
  }

  async function handleRotate(id: string) {
    if (!confirm('确定要轮换这个 API Key 吗？旧 Key 将立即失效。')) {
      return;
    }
    try {
      const data = await api.post<CreateApiKeyResponse>(`/api-keys/${id}/rotate`);
      setNewKey(data);
      fetchKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to rotate API key');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(date: string | null) {
    if (!date) return '永不';
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-500 mt-1">管理您的 API 访问密钥</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          创建 API Key
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* New Key Alert */}
      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-green-800">API Key 已创建</h3>
              <p className="text-sm text-green-600 mt-1">
                请立即复制此 Key，它不会再次显示。
              </p>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="text-green-600 hover:text-green-800"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 bg-white border border-green-200 rounded px-3 py-2 text-sm font-mono break-all">
              {newKey.key}
            </code>
            <button
              onClick={() => copyToClipboard(newKey.key)}
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition whitespace-nowrap"
            >
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>
      )}

      {/* Keys List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">还没有 API Key</div>
          <p className="text-sm text-gray-500">
            创建一个 API Key 以通过 API 访问 LabAnimal
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Key 前缀
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  权限
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  最后使用
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  过期时间
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {key.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                    {key.keyPrefix}...
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        key.permissions === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : key.permissions === 'write'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {key.permissions}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : '从未'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(key.expiresAt)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm space-x-2">
                    <button
                      onClick={() => handleRotate(key.id)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      轮换
                    </button>
                    <button
                      onClick={() => handleDelete(key.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">创建 API Key</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名称
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：CI/CD、测试脚本"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  权限
                </label>
                <select
                  value={permissions}
                  onChange={(e) => setPermissions(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="read">只读</option>
                  <option value="write">读写</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  有效期（天）
                </label>
                <input
                  type="number"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  placeholder="90"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
