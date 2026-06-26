import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const handleSendCode = async () => {
    if (!email) return;
    setError('');
    setCodeLoading(true);
    try {
      await api.sendVerificationCode(email);
      setCodeSent(true);
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to send code');
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user, token } = await api.register({ name, email, password, verificationCode: code });
      api.setToken(token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600">LabAnimal</h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="you@example.com"
                required
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={codeLoading || cooldown > 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
              >
                {codeLoading ? 'Sending...' : cooldown > 0 ? `${cooldown}s` : 'Send Code'}
              </button>
            </div>
          </div>

          {codeSent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tracking-widest text-center text-lg"
                placeholder="000000"
                maxLength={6}
                required
              />
              <p className="text-xs text-gray-400 mt-1">Check your inbox for the 6-digit code</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              minLength={8}
            />
            <p className="text-xs text-gray-400 mt-1">At least 8 characters with uppercase, lowercase and number</p>
          </div>

          <button
            type="submit"
            disabled={loading || !codeSent}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
