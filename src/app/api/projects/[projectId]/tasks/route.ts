import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, getUserOrgRole, getUserProjectRole } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectResult = await query('SELECT org_id FROM projects WHERE id = $1', [params.projectId]);
    if (projectResult.rows.length === 0) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const orgRole = await getUserOrgRole(currentUser.userId, projectResult.rows[0].org_id);
    if (!orgRole) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const tasksResult = await query(
      `SELECT t.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email, 'avatar_url', u.avatar_url))
          FILTER (WHERE u.id IS NOT NULL), '[]'
        ) as assignees,
        (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comment_count
       FROM tasks t
       LEFT JOIN task_assignees ta ON t.id = ta.task_id
       LEFT JOIN users u ON ta.user_id = u.id
       WHERE t.project_id = $1
       GROUP BY t.id
       ORDER BY t.status, t.position, t.created_at`,
      [params.projectId]
    );

    return NextResponse.json({ tasks: tasksResult.rows });
  } catch (err) {
    console.error('Get tasks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectResult = await query('SELECT org_id FROM projects WHERE id = $1', [params.projectId]);
    if (projectResult.rows.length === 0) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const orgRole = await getUserOrgRole(currentUser.userId, projectResult.rows[0].org_id);
    const projectRole = await getUserProjectRole(currentUser.userId, params.projectId);
    if (!orgRole || orgRole === 'guest' || projectRole === 'viewer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { title, description, status = 'todo', priority = 'medium', dueDate, timeEstimate, assigneeIds = [] } = await req.json();
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

    // Get max position for the status column
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM tasks WHERE project_id = $1 AND status = $2',
      [params.projectId, status]
    );

    const taskResult = await query(
      `INSERT INTO tasks (project_id, title, description, status, priority, created_by, due_date, time_estimate, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [params.projectId, title, description || null, status, priority, currentUser.userId,
       dueDate || null, timeEstimate || null, posResult.rows[0].next_pos]
    );

    const task = taskResult.rows[0];

    // Add assignees
    if (assigneeIds.length > 0) {
      for (const uid of assigneeIds) {
        await query('INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [task.id, uid]);
      }
    }

    // Get full task with assignees
    const fullTask = await query(
      `SELECT t.*, COALESCE(json_agg(DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email))
        FILTER (WHERE u.id IS NOT NULL), '[]') as assignees
       FROM tasks t
       LEFT JOIN task_assignees ta ON t.id = ta.task_id
       LEFT JOIN users u ON ta.user_id = u.id
       WHERE t.id = $1 GROUP BY t.id`,
      [task.id]
    );

    return NextResponse.json({ task: fullTask.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('Create task error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
