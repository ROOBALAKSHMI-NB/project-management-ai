'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Organization, User } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDesc, setNewOrgDesc] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [meRes, orgsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/organizations'),
      ]);
      if (!meRes.ok) { router.push('/auth/login'); return; }
      const meData = await meRes.json();
      const orgsData = await orgsRes.json();
      setUser(meData.user);
      setOrgs(orgsData.organizations || []);
    } finally {
      setLoading(false);
    }
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newOrgName, description: newOrgDesc }),
    });
    const data = await res.json();
    if (res.ok) {
      setOrgs([...orgs, data.organization]);
      setShowCreateOrg(false);
      setNewOrgName('');
      setNewOrgDesc('');
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth/login');
  }

  const roleColors: Record<string, string> = {
    owner: 'text-yellow-400',
    admin: 'text-blue-400',
    member: 'text-green-400',
    guest: 'text-slate-400',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚀</span>
          <h1 className="text-xl font-bold">ProjectAI</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">Hi, {user?.name}</span>
          <button onClick={logout} className="text-slate-400 hover:text-white text-sm transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">Your Organizations</h2>
          <p className="text-slate-400">Select an organization to view its projects</p>
        </div>

        {/* Org Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {orgs.map(org => (
            <Link
              key={org.id}
              href={`/org/${org.id}`}
              className="glass rounded-xl p-6 hover:border-blue-500/50 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center text-lg">
                  🏢
                </div>
                <span className={`text-xs font-medium uppercase ${roleColors[org.role || 'member']}`}>
                  {org.role}
                </span>
              </div>
              <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors">{org.name}</h3>
              {org.description && (
                <p className="text-slate-400 text-sm mt-1 line-clamp-2">{org.description}</p>
              )}
              <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                <span>→ Open workspace</span>
              </div>
            </Link>
          ))}

          {/* Create New Org Card */}
          <button
            onClick={() => setShowCreateOrg(true)}
            className="glass rounded-xl p-6 border-dashed hover:border-blue-500/50 transition-all flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-blue-300 min-h-[160px]"
          >
            <span className="text-3xl">+</span>
            <span className="font-medium">Create Organization</span>
          </button>
        </div>

        {orgs.length === 0 && !showCreateOrg && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-5xl mb-4">🏢</div>
            <p className="text-lg mb-2">No organizations yet</p>
            <p className="text-sm">Create your first organization to get started</p>
          </div>
        )}
      </main>

      {/* Create Org Modal */}
      {showCreateOrg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Organization</h3>
            <form onSubmit={createOrg} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Organization Name</label>
                <input
                  className="input"
                  placeholder="Acme Corp"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Description (optional)</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="What does your organization do?"
                  value={newOrgDesc}
                  onChange={e => setNewOrgDesc(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateOrg(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
