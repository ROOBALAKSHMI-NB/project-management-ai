import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, getUserOrgRole } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const myRole = await getUserOrgRole(currentUser.userId, params.orgId);
    if (!myRole || myRole === 'guest' || myRole === 'member') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { email, role = 'member' } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found with that email' }, { status: 404 });
    }

    const userId = userResult.rows[0].id;
    const existing = await getUserOrgRole(userId, params.orgId);
    if (existing) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
    }

    await query(
      'INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3)',
      [params.orgId, userId, role]
    );

    return NextResponse.json({ message: 'Member invited successfully' }, { status: 201 });
  } catch (err) {
    console.error('Invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
