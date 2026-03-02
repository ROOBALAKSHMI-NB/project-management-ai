import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await query(
      `SELECT o.*, om.role, 
        (SELECT COUNT(*) FROM org_members WHERE org_id = o.id) as member_count
       FROM organizations o
       JOIN org_members om ON o.id = om.org_id
       WHERE om.user_id = $1
       ORDER BY o.created_at DESC`,
      [currentUser.userId]
    );

    return NextResponse.json({ organizations: result.rows });
  } catch (err) {
    console.error('Get orgs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, description } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    // Generate slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

    const orgResult = await query(
      'INSERT INTO organizations (name, slug, description) VALUES ($1, $2, $3) RETURNING *',
      [name, slug, description || null]
    );

    const org = orgResult.rows[0];

    // Add creator as owner
    await query(
      'INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3)',
      [org.id, currentUser.userId, 'owner']
    );

    return NextResponse.json({ organization: { ...org, role: 'owner' } }, { status: 201 });
  } catch (err) {
    console.error('Create org error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
