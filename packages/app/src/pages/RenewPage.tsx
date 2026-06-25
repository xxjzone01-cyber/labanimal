import { useState } from 'react';
import { api } from '../lib/api';

export function RenewPage() {
  const [deployId, setDeployId] = useState('');
  const [result, setResult] = useState<{ renewalCode: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployId.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.renewLicense(deployId.trim());
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate renewal code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.renewalCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the text
      const el = document.getElementById('renewal-code');
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">LabAnimal</h1>
          <p className="text-gray-500 mt-2">离线续期 — Offline Renewal</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <p className="text-sm text-gray-600 mb-4">
            输入您的部署 ID (deploy_id) 生成 7 天续期码。将此码输入到您的离线 LabAnimal
            实例中以解除只读模式。
          </p>

          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              部署 ID (Deploy ID)
            </label>
            <input
              type="text"
              value={deployId}
              onChange={(e) => setDeployId(e.target.value)}
              placeholder="例如: open-source, prod-server-01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !deployId.trim()}
              className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '生成中...' : '生成续期码'}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-6">
            <p className="text-red-800 font-medium">生成失败</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{'\u2705'}</span>
              <div>
                <h2 className="text-lg font-bold text-green-800">续期码已生成</h2>
                <p className="text-sm text-green-600">
                  有效期至 {new Date(result.expiresAt).toLocaleString('zh-CN')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 mb-4">
              <label className="block text-xs text-gray-500 mb-1">续期码 (7天有效)</label>
              <div className="flex items-center gap-2">
                <code
                  id="renewal-code"
                  className="flex-1 text-sm font-mono break-all bg-gray-50 p-2 rounded select-all"
                >
                  {result.renewalCode}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
                >
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              <p>
                <strong>使用方法：</strong>
              </p>
              <ol className="list-decimal ml-5 space-y-1">
                <li>复制上方续期码</li>
                <li>
                  在离线环境的 LabAnimal 中打开{' '}
                  <code className="bg-gray-100 px-1 rounded">/renew</code> 页面
                </li>
                <li>粘贴续期码并提交</li>
                <li>系统将解除只读模式，恢复 7 天正常使用</li>
              </ol>
            </div>
          </div>
        )}

        {!result && !loading && !error && (
          <div className="text-center text-sm text-gray-400">
            <p>续期码仅用于离线部署环境。在线部署会自动续期。</p>
          </div>
        )}
      </div>
    </div>
  );
}
