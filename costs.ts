import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// GET all cost assumptions
app.get('/', async (c) => {
  try {
    const costs = await c.env.DB.prepare(`SELECT * FROM cost_assumptions ORDER BY category, id`).all()
    return c.json({ success: true, data: costs.results })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// PUT update cost assumption
app.put('/:key', async (c) => {
  try {
    const key = c.req.param('key')
    const body = await c.req.json()
    await c.env.DB.prepare(`UPDATE cost_assumptions SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`)
      .bind(body.value, key).run()
    const updated = await c.env.DB.prepare(`SELECT * FROM cost_assumptions WHERE key = ?`).bind(key).first()
    return c.json({ success: true, data: updated })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST bulk update
app.post('/bulk', async (c) => {
  try {
    const body = await c.req.json()
    const updates: D1PreparedStatement[] = []
    for (const [key, value] of Object.entries(body)) {
      updates.push(c.env.DB.prepare(`UPDATE cost_assumptions SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`).bind(value, key))
    }
    if (updates.length > 0) {
      await c.env.DB.batch(updates)
    }
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// GET effective costs for a project (global + project overrides)
app.get('/project/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    const globals = await c.env.DB.prepare(`SELECT * FROM cost_assumptions ORDER BY category, id`).all()
    const overrides = await c.env.DB.prepare(`SELECT * FROM project_cost_overrides WHERE project_id = ?`).bind(projectId).all()
    
    const overrideMap: Record<string, number> = {}
    for (const o of overrides.results as any[]) {
      overrideMap[o.key] = o.value
    }
    
    const effective = (globals.results as any[]).map(g => ({
      ...g,
      effective_value: overrideMap[g.key] !== undefined ? overrideMap[g.key] : g.value,
      has_override: overrideMap[g.key] !== undefined
    }))
    
    return c.json({ success: true, data: effective })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

export default app
