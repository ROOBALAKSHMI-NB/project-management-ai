import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, getUserOrgRole } from '@/lib/auth';

async function getTaskProject(taskId: string) {
  const result = await query(
    'SELECT t.*, p.org_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = $1',
    [taskId]
  );
  return result.rows[0];
}

export async function GET(req: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const task = await getTaskProject(params.taskId);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const orgRole = await getUserOrgRole(currentUser.userId, task.org_id);
    if (!orgRole) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const fullTask = await query(
      `SELECT t.*,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email)) FILTER (WHERE u.id IS NOT NULL), '[]') as assignees
       FROM tasks t
       LEFT JOIN task_assignees ta ON t.id = ta.task_id
       LEFT JOIN users u ON ta.user_id = u.id
       WHERE t.id = $1 GROUP BY t.id`,
      [params.taskId]
    );

    return NextResponse.json({ task: fullTask.rows[0] });
  } catch (err) {
    console.error('Get task error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const task = await getTaskProject(params.taskId);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const orgRole = await getUserOrgRole(currentUser.userId, task.org_id);
    if (!orgRole || orgRole === 'guest') return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { title, description, status, priority, dueDate, timeEstimate, position, assigneeIds } = await req.json();

    const result = await query(
      `UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        due_date = COALESCE($5, due_date),
        time_estimate = COALESCE($6, time_estimate),
        position = COALESCE($7, position),
        updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [title, description, status, priority, dueDate, timeEstimate, position, params.taskId]
    );

    if (assigneeIds !== undefined) {
      await query('DELETE FROM task_assignees WHERE task_id = $1', [params.taskId]);
      for (const uid of assigneeIds) {
        await query('INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [params.taskId, uid]);
      }
    }

    return NextResponse.json({ task: result.rows[0] });
  } catch (err) {
    console.error('Update task error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const task = await getTaskProject(params.taskId);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const orgRole = await getUserOrgRole(currentUser.userId, task.org_id);
    if (!orgRole || orgRole === 'guest') return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    await query('DELETE FROM tasks WHERE id = $1', [params.taskId]);
    return NextResponse.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
