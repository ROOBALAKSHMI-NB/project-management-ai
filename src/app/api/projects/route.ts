import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, getUserOrgRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

    const orgRole = await getUserOrgRole(currentUser.userId, orgId);
    if (!orgRole) return NextResponse.json({ error: 'Not a member of this org' }, { status: 403 });

    const result = await query(
      `SELECT p.*, pm.role,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        u.name as creator_name
       FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.org_id = $2
       ORDER BY p.created_at DESC`,
      [currentUser.userId, orgId]
    );

    return NextResponse.json({ projects: result.rows });
  } catch (err) {
    console.error('Get projects error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, description, orgId } = await req.json();
    if (!name || !orgId) return NextResponse.json({ error: 'Name and orgId required' }, { status: 400 });

    const orgRole = await getUserOrgRole(currentUser.userId, orgId);
    if (!orgRole || orgRole === 'guest') return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

    const projectResult = await query(
      'INSERT INTO projects (org_id, name, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [orgId, name, description || null, currentUser.userId]
    );

    const project = projectResult.rows[0];

    // Add creator as project manager
    await query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.id, currentUser.userId, 'manager']
    );

    return NextResponse.json({ project: { ...project, role: 'manager' } }, { status: 201 });
  } catch (err) {
    console.error('Create project error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
