import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserOrgRole } from '@/lib/auth';
import { query } from '@/lib/db';
import { analyzeProject, suggestTasks, breakdownTask, parseNaturalLanguageTask } from '@/lib/groq';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, projectId, taskTitle, text } = await req.json();

    // Verify access to project
    const projectResult = await query(
      'SELECT p.*, o.name as org_name FROM projects p JOIN organizations o ON p.org_id = o.id WHERE p.id = $1',
      [projectId]
    );
    if (projectResult.rows.length === 0) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const project = projectResult.rows[0];
    const orgRole = await getUserOrgRole(currentUser.userId, project.org_id);
    if (!orgRole) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // Get project data
    const tasksResult = await query(
      `SELECT t.title, t.status, t.priority, t.due_date,
        (SELECT name FROM users WHERE id = (SELECT user_id FROM task_assignees WHERE task_id = t.id LIMIT 1)) as assignee
       FROM tasks t WHERE t.project_id = $1`,
      [projectId]
    );

    const membersResult = await query(
      `SELECT u.name FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = $1`,
      [projectId]
    );

    const tasks = tasksResult.rows;
    const members = membersResult.rows.map((m: { name: string }) => m.name);

    let result;
    switch (action) {
      case 'analyze':
        result = await analyzeProject({
          name: project.name,
          tasks: tasks.map((t: { title: string; status: string; priority: string; assignee?: string; due_date?: string }) => ({
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignee: t.assignee,
            due_date: t.due_date,
          })),
          members,
        });
        break;

      case 'suggest':
        result = await suggestTasks({
          name: project.name,
          description: project.description || '',
          existingTasks: tasks.map((t: { title: string }) => t.title),
        });
        break;

      case 'breakdown':
        if (!taskTitle) return NextResponse.json({ error: 'taskTitle required' }, { status: 400 });
        result = await breakdownTask(taskTitle, `Project: ${project.name}. ${project.description || ''}`);
        break;

      case 'parse_nl':
        if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
        result = await parseNaturalLanguageTask(text, members);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (err) {
    console.error('AI error:', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
