import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, getUserOrgRole } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await getUserOrgRole(currentUser.userId, params.orgId);
    if (!role) return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });

    const orgResult = await query('SELECT * FROM organizations WHERE id = $1', [params.orgId]);
    if (orgResult.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const membersResult = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url, om.role, om.joined_at
       FROM org_members om JOIN users u ON om.user_id = u.id
       WHERE om.org_id = $1 ORDER BY om.joined_at`,
      [params.orgId]
    );

    return NextResponse.json({
      organization: { ...orgResult.rows[0], role },
      members: membersResult.rows,
    });
  } catch (err) {
    console.error('Get org error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await getUserOrgRole(currentUser.userId, params.orgId);
    if (role !== 'owner') return NextResponse.json({ error: 'Only owners can delete organizations' }, { status: 403 });

    await query('DELETE FROM organizations WHERE id = $1', [params.orgId]);
    return NextResponse.json({ message: 'Organization deleted' });
  } catch (err) {
    console.error('Delete org error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
