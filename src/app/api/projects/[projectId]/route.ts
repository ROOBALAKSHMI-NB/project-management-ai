import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, getUserOrgRole, getUserProjectRole } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectResult = await query('SELECT * FROM projects WHERE id = $1', [params.projectId]);
    if (projectResult.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const project = projectResult.rows[0];
    const orgRole = await getUserOrgRole(currentUser.userId, project.org_id);
    if (!orgRole) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const projectRole = await getUserProjectRole(currentUser.userId, params.projectId);

    const membersResult = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url, pm.role
       FROM project_members pm JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1`,
      [params.projectId]
    );

    return NextResponse.json({
      project: { ...project, role: projectRole || orgRole },
      members: membersResult.rows,
    });
  } catch (err) {
    console.error('Get project error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await getUserProjectRole(currentUser.userId, params.projectId);
    if (role !== 'manager') return NextResponse.json({ error: 'Only managers can update project' }, { status: 403 });

    const { name, description, status } = await req.json();
    const result = await query(
      'UPDATE projects SET name = COALESCE($1, name), description = COALESCE($2, description), status = COALESCE($3, status), updated_at = NOW() WHERE id = $4 RETURNING *',
      [name, description, status, params.projectId]
    );

    return NextResponse.json({ project: result.rows[0] });
  } catch (err) {
    console.error('Update project error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await getUserProjectRole(currentUser.userId, params.projectId);
    if (role !== 'manager') return NextResponse.json({ error: 'Only managers can delete project' }, { status: 403 });

    await query('DELETE FROM projects WHERE id = $1', [params.projectId]);
    return NextResponse.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('Delete project error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
