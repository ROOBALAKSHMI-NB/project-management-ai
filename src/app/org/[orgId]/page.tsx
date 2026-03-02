'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Organization, Project, User } from '@/types';

export default function OrgPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, [orgId]);

  async function fetchData() {
    try {
      const [meRes, orgRes, projRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch(`/api/organizations/${orgId}`),
        fetch(`/api/projects?orgId=${orgId}`),
      ]);
      if (!meRes.ok) { router.push('/auth/login'); return; }
      if (!orgRes.ok) { router.push('/dashboard'); return; }

      const meData = await meRes.json();
      const orgData = await orgRes.json();
      const projData = await projRes.json();

      setUser(meData.user);
      setOrg(orgData.organization);
      setProjects(projData.projects || []);
    } finally {
      setLoading(false);
    }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newProject, orgId }),
    });
    const data = await res.json();
    if (res.ok) {
      setProjects([data.project, ...projects]);
      setShowCreateProject(false);
      setNewProject({ name: '', description: '' });
    }
  }

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/organizations/${orgId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();
    setMessage(res.ok ? '✅ Member invited!' : `❌ ${data.error}`);
    if (res.ok) {
      setInviteEmail('');
      setTimeout(() => { setShowInvite(false); setMessage(''); }, 1500);
    }
  }

  const statusColors: Record<string, string> = {
    active: 'text-green-400 bg-green-400/10',
    archived: 'text-slate-400 bg-slate-400/10',
    completed: 'text-blue-400 bg-blue-400/10',
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-slate-400 animate-pulse">Loading...</div>
    </div>
  );

  const canManage = ['owner', 'admin'].includes(org?.role || '');
  const canCreate = org?.role !== 'guest';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
            ← Dashboard
          </Link>
          <span className="text-slate-600">/</span>
          <span className="font-semibold">{org?.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <button onClick={() => setShowInvite(true)} className="btn-secondary text-sm">
              + Invite Member
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowCreateProject(true)} className="btn-primary text-sm">
              + New Project
            </button>
          )}
          <span className="text-slate-400 text-sm">{user?.name}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{org?.name}</h2>
            {org?.description && <p className="text-slate-400 mt-1">{org.description}</p>}
            <span className={`inline-block mt-2 text-xs font-medium px-2 py-1 rounded-full bg-blue-500/10 text-blue-300`}>
              Your role: {org?.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <Link
              key={project.id}
              href={`/org/${orgId}/projects/${project.id}`}
              className="glass rounded-xl p-6 hover:border-blue-500/50 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center text-lg">
                  📋
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[project.status]}`}>
                  {project.status}
                </span>
              </div>
              <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors">{project.name}</h3>
              {project.description && (
                <p className="text-slate-400 text-sm mt-1 line-clamp-2">{project.description}</p>
              )}
              <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                <span>👥 {project.member_count || 0} members</span>
                <span>✅ {project.task_count || 0} tasks</span>
              </div>
              {project.role && (
                <div className="mt-2 text-xs text-slate-500">Role: {project.role}</div>
              )}
            </Link>
          ))}

          {canCreate && (
            <button
              onClick={() => setShowCreateProject(true)}
              className="glass rounded-xl p-6 border-dashed hover:border-blue-500/50 transition-all flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-blue-300 min-h-[180px]"
            >
              <span className="text-3xl">+</span>
              <span className="font-medium">New Project</span>
            </button>
          )}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-lg">No projects yet</p>
            <p className="text-sm mt-1">Create your first project to get started</p>
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Project</h3>
            <form onSubmit={createProject} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Project Name</label>
                <input
                  className="input"
                  placeholder="My Awesome Project"
                  value={newProject.name}
                  onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Description (optional)</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="What are you building?"
                  value={newProject.description}
                  onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateProject(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Invite Member</h3>
            {message && (
              <div className="mb-4 p-3 bg-slate-700/50 rounded-lg text-sm">{message}</div>
            )}
            <form onSubmit={inviteMember} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Email Address</label>
                <input
                  type="email"
                  className="input"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Role</label>
                <select
                  className="input"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="guest">Guest (view only)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Send Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
