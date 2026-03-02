import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, getUserOrgRole } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const taskResult = await query(
      'SELECT t.*, p.org_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = $1',
      [params.taskId]
    );
    if (taskResult.rows.length === 0) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const orgRole = await getUserOrgRole(currentUser.userId, taskResult.rows[0].org_id);
    if (!orgRole) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const commentsResult = await query(
      `SELECT c.*, u.name as user_name, u.email as user_email, u.avatar_url as user_avatar
       FROM comments c JOIN users u ON c.user_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [params.taskId]
    );

    return NextResponse.json({ comments: commentsResult.rows });
  } catch (err) {
    console.error('Get comments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const taskResult = await query(
      'SELECT t.*, p.org_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = $1',
      [params.taskId]
    );
    if (taskResult.rows.length === 0) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const orgRole = await getUserOrgRole(currentUser.userId, taskResult.rows[0].org_id);
    if (!orgRole || orgRole === 'guest') return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { content, parentId } = await req.json();
    if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });

    const result = await query(
      `INSERT INTO comments (task_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4)
       RETURNING *, (SELECT name FROM users WHERE id = $2) as user_name`,
      [params.taskId, currentUser.userId, content.trim(), parentId || null]
    );

    return NextResponse.json({ comment: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('Add comment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
