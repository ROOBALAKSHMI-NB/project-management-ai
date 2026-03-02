'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Task, Project, User, Comment, TaskStatus, TaskPriority } from '@/types';

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-500' },
  { id: 'todo', label: 'To Do', color: 'bg-blue-500' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-purple-500' },
  { id: 'review', label: 'Review', color: 'bg-yellow-500' },
  { id: 'done', label: 'Done', color: 'bg-green-500' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

const PRIORITY_ICONS: Record<string, string> = {
  low: '▽',
  medium: '◇',
  high: '△',
  critical: '⬆',
};

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createInStatus, setCreateInStatus] = useState<TaskStatus>('todo');
  const [showAI, setShowAI] = useState(false);
  const [aiLoading, setAILoading] = useState(false);
  const [aiResult, setAIResult] = useState<Record<string, unknown> | null>(null);
  const [aiAction, setAIAction] = useState<'analyze' | 'suggest' | 'breakdown' | 'parse_nl'>('analyze');
  const [nlText, setNlText] = useState('');
  const [breakdownTitle, setBreakdownTitle] = useState('');
  const [newTask, setNewTask] = useState({
    title: '', description: '', priority: 'medium' as TaskPriority,
    dueDate: '', timeEstimate: '', assigneeIds: [] as string[],
  });

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/tasks`);
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks || []);
    }
  }, [projectId]);

  useEffect(() => {
    async function init() {
      const [meRes, projRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch(`/api/projects/${projectId}`),
      ]);
      if (!meRes.ok) { router.push('/auth/login'); return; }
      if (!projRes.ok) { router.push(`/org/${orgId}`); return; }

      const meData = await meRes.json();
      const projData = await projRes.json();
      setCurrentUser(meData.user);
      setProject(projData.project);
      setMembers(projData.members || []);
      await fetchTasks();
      setLoading(false);
    }
    init();
  }, [projectId, orgId, router, fetchTasks]);

  // Real-time polling every 5 seconds
  useEffect(() => {
    if (!projectId) return;
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [projectId, fetchTasks]);

  function getTasksByStatus(status: TaskStatus) {
    return tasks
      .filter(t => t.status === status)
      .sort((a, b) => a.position - b.position);
  }

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as TaskStatus;
    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === draggableId ? { ...t, status: newStatus, position: destination.index } : t
    ));

    await fetch(`/api/tasks/${draggableId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, position: destination.index }),
    });
  }

  async function openTask(task: Task) {
    setSelectedTask(task);
    const res = await fetch(`/api/tasks/${task.id}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments || []);
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;
    const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments([...comments, { ...data.comment, user_name: currentUser?.name }]);
      setNewComment('');
    }
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (selectedTask?.id === taskId) setSelectedTask(prev => prev ? { ...prev, status } : null);
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return;
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTask(null);
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newTask,
        status: createInStatus,
        timeEstimate: newTask.timeEstimate ? parseInt(newTask.timeEstimate) : undefined,
        dueDate: newTask.dueDate || undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks(prev => [...prev, data.task]);
      setShowCreateTask(false);
      setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', timeEstimate: '', assigneeIds: [] });
    }
  }

  async function runAI(action: typeof aiAction) {
    setAILoading(true);
    setAIResult(null);
    try {
      const body: Record<string, unknown> = { action, projectId };
      if (action === 'parse_nl') body.text = nlText;
      if (action === 'breakdown') body.taskTitle = breakdownTitle;

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) setAIResult(data.result);
    } finally {
      setAILoading(false);
    }
  }

  async function createTaskFromSuggestion(suggestion: { title: string; description: string; priority: string; estimatedHours: number }) {
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: suggestion.title,
        description: suggestion.description,
        priority: suggestion.priority,
        timeEstimate: suggestion.estimatedHours,
        status: 'backlog',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks(prev => [...prev, data.task]);
    }
  }

  async function createFromNL() {
    if (!aiResult) return;
    const parsed = aiResult as { title: string; description?: string; priority: string; dueDate?: string; estimatedHours?: number };
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: parsed.title,
        description: parsed.description || '',
        priority: parsed.priority || 'medium',
        dueDate: parsed.dueDate || undefined,
        timeEstimate: parsed.estimatedHours || undefined,
        status: 'todo',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks(prev => [...prev, data.task]);
      setNlText('');
      setAIResult(null);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-slate-400 animate-pulse">Loading project...</div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href={`/org/${orgId}`} className="text-slate-400 hover:text-white text-sm transition-colors">
            ← {project?.name?.slice(0, 20)}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {members.slice(0, 5).map(m => (
              <div key={m.id} title={m.name}
                className="w-8 h-8 bg-blue-600 rounded-full border-2 border-slate-900 flex items-center justify-center text-xs font-medium">
                {m.name[0].toUpperCase()}
              </div>
            ))}
          </div>
          <button
            onClick={() => { setShowAI(true); setAIAction('analyze'); setAIResult(null); }}
            className="ml-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 text-purple-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
          >
            🤖 AI Assistant
          </button>
          <span className="text-slate-400 text-sm ml-2">{currentUser?.name}</span>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 min-w-max h-full">
            {COLUMNS.map(col => {
              const colTasks = getTasksByStatus(col.id);
              return (
                <div key={col.id} className="w-72 flex flex-col">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                      <span className="font-medium text-sm">{col.label}</span>
                      <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
                        {colTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => { setCreateInStatus(col.id); setShowCreateTask(true); }}
                      className="text-slate-400 hover:text-white text-lg leading-none"
                      title="Add task"
                    >+</button>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 space-y-2 p-2 rounded-xl min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-slate-800/50' : ''}`}
                      >
                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => openTask(task)}
                                className={`task-card ${snapshot.isDragging ? 'shadow-xl rotate-1 border-blue-500/70' : ''}`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h4 className="text-sm font-medium line-clamp-2 flex-1">{task.title}</h4>
                                  <span className={`text-xs shrink-0 ${PRIORITY_COLORS[task.priority]}`} title={task.priority}>
                                    {PRIORITY_ICONS[task.priority]}
                                  </span>
                                </div>
                                {task.description && (
                                  <p className="text-xs text-slate-400 line-clamp-2 mb-2">{task.description}</p>
                                )}
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex -space-x-1">
                                    {(task.assignees || []).slice(0, 3).map(a => (
                                      <div key={a.id} title={a.name}
                                        className="w-5 h-5 bg-blue-600 rounded-full border border-slate-800 flex items-center justify-center text-[9px] font-medium">
                                        {a.name[0]}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    {task.due_date && (
                                      <span>{new Date(task.due_date).toLocaleDateString()}</span>
                                    )}
                                    {Number(task.comment_count) > 0 && (
                                      <span>💬 {task.comment_count}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-700 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold flex-1">{selectedTask.title}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => deleteTask(selectedTask.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                  <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-white text-xl">×</button>
                </div>
              </div>
              {/* Status + Priority */}
              <div className="flex items-center gap-3 mt-3">
                <select
                  className="input w-auto text-sm"
                  value={selectedTask.status}
                  onChange={e => updateTaskStatus(selectedTask.id, e.target.value as TaskStatus)}
                >
                  {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <span className={`text-sm font-medium ${PRIORITY_COLORS[selectedTask.priority]}`}>
                  {PRIORITY_ICONS[selectedTask.priority]} {selectedTask.priority}
                </span>
                {selectedTask.due_date && (
                  <span className="text-xs text-slate-400">Due: {new Date(selectedTask.due_date).toLocaleDateString()}</span>
                )}
                {selectedTask.time_estimate && (
                  <span className="text-xs text-slate-400">Est: {selectedTask.time_estimate}h</span>
                )}
              </div>
              {/* Assignees */}
              {selectedTask.assignees && selectedTask.assignees.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-slate-400">Assigned to:</span>
                  {selectedTask.assignees.map(a => (
                    <span key={a.id} className="text-xs bg-slate-700 px-2 py-1 rounded-full">{a.name}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {selectedTask.description && (
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">Description</h4>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{selectedTask.description}</p>
                </div>
              )}

              {/* Comments */}
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase mb-3">
                  Comments ({comments.length})
                </h4>
                <div className="space-y-3 mb-4">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
                        {(c.user_name || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-300">{c.user_name || 'User'}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 bg-slate-800 rounded-lg p-3">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-xs text-slate-500">No comments yet. Be the first!</p>
                  )}
                </div>

                <form onSubmit={addComment} className="flex gap-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                  />
                  <button type="submit" className="btn-primary text-sm px-3">Post</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">
              Create Task in <span className="text-blue-300">{COLUMNS.find(c => c.id === createInStatus)?.label}</span>
            </h3>
            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Title *</label>
                <input
                  className="input"
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Description</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="What needs to be done?"
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Priority</label>
                  <select
                    className="input"
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Status</label>
                  <select
                    className="input"
                    value={createInStatus}
                    onChange={e => setCreateInStatus(e.target.value as TaskStatus)}
                  >
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Due Date</label>
                  <input
                    type="date"
                    className="input"
                    value={newTask.dueDate}
                    onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Estimate (hours)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="4"
                    min="1"
                    value={newTask.timeEstimate}
                    onChange={e => setNewTask({ ...newTask, timeEstimate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Assignees</label>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        const ids = newTask.assigneeIds.includes(m.id)
                          ? newTask.assigneeIds.filter(id => id !== m.id)
                          : [...newTask.assigneeIds, m.id];
                        setNewTask({ ...newTask, assigneeIds: ids });
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        newTask.assigneeIds.includes(m.id)
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateTask(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {showAI && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-slate-700 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🤖</span>
                  <h3 className="text-lg font-semibold">AI Assistant</h3>
                  <span className="text-xs text-purple-300 bg-purple-900/30 px-2 py-0.5 rounded-full">Powered by Groq llama-3.3-70b</span>
                </div>
                <button onClick={() => setShowAI(false)} className="text-slate-400 hover:text-white text-xl">×</button>
              </div>

              {/* Action Tabs */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {[
                  { id: 'analyze', label: '📊 Risk Analysis', desc: 'Analyze project health' },
                  { id: 'suggest', label: '💡 Suggest Tasks', desc: 'Get task recommendations' },
                  { id: 'breakdown', label: '🔧 Breakdown Task', desc: 'Split task into subtasks' },
                  { id: 'parse_nl', label: '✍️ Natural Language', desc: 'Create task from text' },
                ].map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setAIAction(a.id as typeof aiAction); setAIResult(null); }}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                      aiAction === a.id
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* NL Input */}
              {aiAction === 'parse_nl' && (
                <div className="mb-4">
                  <label className="text-sm text-slate-400 mb-2 block">Describe the task in plain English:</label>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    placeholder='e.g. "Create a high-priority task for Sarah to implement user authentication by next Friday"'
                    value={nlText}
                    onChange={e => setNlText(e.target.value)}
                  />
                </div>
              )}

              {/* Breakdown Input */}
              {aiAction === 'breakdown' && (
                <div className="mb-4">
                  <label className="text-sm text-slate-400 mb-2 block">Task to break down:</label>
                  <input
                    className="input"
                    placeholder="e.g. Implement user authentication system"
                    value={breakdownTitle}
                    onChange={e => setBreakdownTitle(e.target.value)}
                  />
                </div>
              )}

              <button
                onClick={() => runAI(aiAction)}
                disabled={aiLoading || (aiAction === 'parse_nl' && !nlText.trim()) || (aiAction === 'breakdown' && !breakdownTitle.trim())}
                className="btn-primary mb-6 flex items-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    <span>Analyzing with Groq AI...</span>
                  </>
                ) : (
                  <>
                    <span>🤖</span>
                    <span>
                      {aiAction === 'analyze' && 'Analyze Project'}
                      {aiAction === 'suggest' && 'Get Suggestions'}
                      {aiAction === 'breakdown' && 'Break Down Task'}
                      {aiAction === 'parse_nl' && 'Parse & Create Task'}
                    </span>
                  </>
                )}
              </button>

              {/* AI Results */}
              {aiResult && aiAction === 'analyze' && (() => {
                const r = aiResult as { riskLevel?: string; timelineStatus?: string; summary?: string; risks?: string[]; workloadIssues?: string[]; recommendations?: string[] };
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">Risk Level</div>
                        <div className={`font-semibold ${
                          r.riskLevel === 'high' ? 'text-red-400' :
                          r.riskLevel === 'medium' ? 'text-yellow-400' : 'text-green-400'
                        }`}>{r.riskLevel?.toUpperCase()}</div>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">Timeline</div>
                        <div className={`font-semibold ${
                          r.timelineStatus === 'delayed' ? 'text-red-400' :
                          r.timelineStatus === 'at_risk' ? 'text-yellow-400' : 'text-green-400'
                        }`}>{r.timelineStatus?.replace('_', ' ').toUpperCase()}</div>
                      </div>
                    </div>
                    {r.summary && (
                      <div className="bg-slate-800 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">Summary</div>
                        <p className="text-sm">{r.summary}</p>
                      </div>
                    )}
                    {r.risks && r.risks.length > 0 && (
                      <div>
                        <div className="text-xs text-slate-400 uppercase mb-2">⚠️ Risks</div>
                        <ul className="space-y-1">
                          {r.risks.map((risk: string, i: number) => (
                            <li key={i} className="text-sm text-red-300 bg-red-900/20 rounded px-3 py-1.5">• {risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {r.recommendations && r.recommendations.length > 0 && (
                      <div>
                        <div className="text-xs text-slate-400 uppercase mb-2">💡 Recommendations</div>
                        <ul className="space-y-1">
                          {r.recommendations.map((rec: string, i: number) => (
                            <li key={i} className="text-sm text-green-300 bg-green-900/20 rounded px-3 py-1.5">✓ {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}

              {aiResult && aiAction === 'suggest' && (() => {
                const r = aiResult as { suggestions?: Array<{ title: string; description: string; priority: string; estimatedHours: number }> };
                return (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Suggested Tasks:</h4>
                    <div className="space-y-3">
                      {(r.suggestions || []).map((s, i: number) => (
                        <div key={i} className="bg-slate-800 rounded-lg p-4 flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{s.title}</span>
                              <span className={`text-xs ${PRIORITY_COLORS[s.priority]}`}>{s.priority}</span>
                            </div>
                            <p className="text-xs text-slate-400">{s.description}</p>
                            {s.estimatedHours && (
                              <span className="text-xs text-slate-500 mt-1 block">Est: {s.estimatedHours}h</span>
                            )}
                          </div>
                          <button
                            onClick={() => createTaskFromSuggestion(s)}
                            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg shrink-0"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {aiResult && aiAction === 'breakdown' && (() => {
                const r = aiResult as { subtasks?: Array<{ title: string; description: string; priority: string; estimatedHours: number }> };
                return (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Subtasks:</h4>
                    <div className="space-y-2">
                      {(r.subtasks || []).map((s, i: number) => (
                        <div key={i} className="bg-slate-800 rounded-lg p-3 flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{i + 1}. {s.title}</span>
                              <span className={`text-xs ${PRIORITY_COLORS[s.priority]}`}>{s.priority}</span>
                            </div>
                            {s.description && <p className="text-xs text-slate-400 mt-1">{s.description}</p>}
                          </div>
                          <button
                            onClick={() => createTaskFromSuggestion(s)}
                            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg shrink-0"
                          >+ Add</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {aiResult && aiAction === 'parse_nl' && (() => {
                const r = aiResult as { title?: string; description?: string; priority?: string; dueDate?: string; estimatedHours?: number; assignee?: string };
                return (
                  <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                    <h4 className="text-sm font-medium text-slate-300">Parsed Task:</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-slate-400">Title:</span> <span className="text-white">{r.title}</span></div>
                      {r.description && <div><span className="text-slate-400">Description:</span> <span className="text-white">{r.description}</span></div>}
                      {r.priority && <div><span className="text-slate-400">Priority:</span> <span className={PRIORITY_COLORS[r.priority]}>{r.priority}</span></div>}
                      {r.dueDate && <div><span className="text-slate-400">Due:</span> <span className="text-white">{r.dueDate}</span></div>}
                      {r.assignee && <div><span className="text-slate-400">Assignee:</span> <span className="text-white">{r.assignee}</span></div>}
                    </div>
                    <button onClick={createFromNL} className="btn-primary text-sm">✓ Create This Task</button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
