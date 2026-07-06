import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fresh DB lookup for the actual role — JWT may be stale after a promotion
    let dbRole = currentUser.role;
    try {
      const freshUser = await base44.asServiceRole.entities.User.get(currentUser.id);
      if (freshUser?.role) dbRole = freshUser.role;
    } catch (e) {
      // fall back to me() role
    }

    const isAdmin = dbRole === 'admin';

    let body = {};
    try {
      body = await req.json();
    } catch (e) {
      // empty body
    }

    const { action } = body;

    // checkStatus is lightweight — works for non-admins too
    if (action === 'checkStatus') {
      return Response.json({ isAdmin, role: dbRole });
    }

    // All other actions require admin
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden', message: 'Admin access required' }, { status: 403 });
    }

    if (action === 'list') {
      const users = await base44.asServiceRole.entities.User.list("-created_date", 200);
      return Response.json({ users: users || [] });
    }

    if (action === 'updateRole') {
      const { userId, role } = body;
      if (!userId || !role) {
        return Response.json({ error: 'Missing userId or role' }, { status: 400 });
      }
      if (userId === currentUser.id) {
        return Response.json({ error: 'Cannot change your own role' }, { status: 400 });
      }
      await base44.asServiceRole.entities.User.update(userId, { role });
      return Response.json({ success: true });
    }

    if (action === 'delete') {
      const { userId } = body;
      if (!userId) {
        return Response.json({ error: 'Missing userId' }, { status: 400 });
      }
      if (userId === currentUser.id) {
        return Response.json({ error: 'Cannot delete yourself' }, { status: 400 });
      }
      await base44.asServiceRole.entities.User.delete(userId);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});