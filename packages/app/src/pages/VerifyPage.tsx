import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

interface VerifyResult {
  valid: boolean;
  data?: {
    reportHash?: string;
    deployId?: string;
    signedAt?: string;
    [key: string]: any;
  };
  error?: string;
}

export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const hash = searchParams.get('hash');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputHash, setInputHash] = useState(hash || '');
  const [signature, setSignature] = useState('');

  useEffect(() => {
    if (hash) {
      verifyHash(hash);
    }
  }, [hash]);

  const verifyHash = async (reportHash: string) => {
    setLoading(true);
    try {
      // 使用公钥验证（不需要签名，只需哈希）
      const res = await api.verifyReport('', reportHash);
      setResult(res);
    } catch (err: any) {
      setResult({ valid: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputHash.trim()) {
      verifyHash(inputHash.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">LabAnimal</h1>
          <p className="text-gray-500 mt-2">报告签名验证</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              报告哈希 (SHA-256)
            </label>
            <input
              type="text"
              value={inputHash}
              onChange={(e) => setInputHash(e.target.value)}
              placeholder="输入 64 位十六进制哈希..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !inputHash.trim()}
              className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '验证中...' : '验证'}
            </button>
          </form>
        </div>

        {result && (
          <div className={`rounded-xl border-2 p-6 ${
            result.valid
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{result.valid ? '✅' : '❌'}</span>
              <div>
                <h2 className={`text-lg font-bold ${result.valid ? 'text-green-800' : 'text-red-800'}`}>
                  {result.valid ? '签名验证通过' : '签名验证失败'}
                </h2>
                <p className={`text-sm ${result.valid ? 'text-green-600' : 'text-red-600'}`}>
                  {result.valid
                    ? '此报告的签名真实有效，内容未被篡改。'
                    : result.error === 'tampered'
                      ? '报告内容可能已被篡改，签名不匹配。'
                      : result.error === 'unverified'
                        ? '此报告未使用 RSA 私钥签名（可能是免费版或超限降级）。'
                        : `验证错误: ${result.error}`}
                </p>
              </div>
            </div>

            {result.data && (
              <div className="bg-white rounded-lg p-4 text-sm space-y-2">
                {result.data.deployId && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">部署 ID</span>
                    <span className="font-mono">{result.data.deployId}</span>
                  </div>
                )}
                {result.data.signedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">签名时间</span>
                    <span>{new Date(result.data.signedAt).toLocaleString('zh-CN')}</span>
                  </div>
                )}
                {result.data.reportHash && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">报告哈希</span>
                    <span className="font-mono text-xs break-all">{result.data.reportHash}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!result && !loading && (
          <div className="text-center text-sm text-gray-400">
            <p>输入报告哈希或扫描 PDF 中的二维码进行验证。</p>
          </div>
        )}
      </div>
    </div>
  );
}
