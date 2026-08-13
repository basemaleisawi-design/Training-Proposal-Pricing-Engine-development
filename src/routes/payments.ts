import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// GET payment milestones for a project
app.get('/project/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    const milestones = await c.env.DB.prepare(`SELECT * FROM payment_milestones WHERE project_id = ? ORDER BY milestone_number`).bind(projectId).all()
    return c.json({ success: true, data: milestones.results })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST add milestone
app.post('/project/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    const body = await c.req.json()
    
    const maxMilestone = await c.env.DB.prepare(`SELECT MAX(milestone_number) as max_num FROM payment_milestones WHERE project_id = ?`).bind(projectId).first() as any
    const milestoneNumber = (maxMilestone?.max_num || 0) + 1
    
    // Get VAT from DB (NOT hardcoded)
    const vatRowP = await c.env.DB.prepare(`SELECT value FROM cost_assumptions WHERE key = 'vat_percent'`).first() as any
    const vatRateP = (vatRowP?.value ?? 15) / 100
    const vatAmount = (body.amount_before_vat || 0) * vatRateP
    const totalAmount = (body.amount_before_vat || 0) + vatAmount
    
    const result = await c.env.DB.prepare(`
      INSERT INTO payment_milestones (project_id, milestone_number, milestone_name_ar, milestone_name_en,
        description, percentage, amount_before_vat, vat_amount, total_amount, expected_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      projectId, milestoneNumber, body.milestone_name_ar || '', body.milestone_name_en || '',
      body.description || '', body.percentage || 0, body.amount_before_vat || 0,
      vatAmount, totalAmount, body.expected_date || null, body.status || 'pending', body.notes || ''
    ).run()
    
    const milestone = await c.env.DB.prepare(`SELECT * FROM payment_milestones WHERE id = ?`).bind(result.meta.last_row_id).first()
    return c.json({ success: true, data: milestone }, 201)
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST bulk save milestones
app.post('/project/:projectId/bulk', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    const milestones = await c.req.json() as any[]
    
    await c.env.DB.prepare(`DELETE FROM payment_milestones WHERE project_id = ?`).bind(projectId).run()
    
    // Get VAT rate from DB once for all milestones
    const vatRowBulk = await c.env.DB.prepare(`SELECT value FROM cost_assumptions WHERE key = 'vat_percent'`).first() as any
    const vatRateBulk = (vatRowBulk?.value ?? 15) / 100
    
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i]
      const vatAmount = (m.amount_before_vat || 0) * vatRateBulk
      const totalAmount = (m.amount_before_vat || 0) + vatAmount
      
      await c.env.DB.prepare(`
        INSERT INTO payment_milestones (project_id, milestone_number, milestone_name_ar, milestone_name_en,
          description, percentage, amount_before_vat, vat_amount, total_amount, expected_date, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        projectId, i + 1, m.milestone_name_ar || '', m.milestone_name_en || '',
        m.description || '', m.percentage || 0, m.amount_before_vat || 0,
        vatAmount, totalAmount, m.expected_date || null, m.status || 'pending', m.notes || ''
      ).run()
    }
    
    const updated = await c.env.DB.prepare(`SELECT * FROM payment_milestones WHERE project_id = ? ORDER BY milestone_number`).bind(projectId).all()
    return c.json({ success: true, data: updated.results })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// PUT update milestone
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    // Get VAT from DB
    const vatRowUpd = await c.env.DB.prepare(`SELECT value FROM cost_assumptions WHERE key = 'vat_percent'`).first() as any
    const vatRateUpd = (vatRowUpd?.value ?? 15) / 100
    const vatAmount = (body.amount_before_vat || 0) * vatRateUpd
    const totalAmount = (body.amount_before_vat || 0) + vatAmount
    
    await c.env.DB.prepare(`
      UPDATE payment_milestones SET milestone_name_ar=?, milestone_name_en=?, description=?,
        percentage=?, amount_before_vat=?, vat_amount=?, total_amount=?, expected_date=?, status=?, notes=?
      WHERE id=?
    `).bind(
      body.milestone_name_ar, body.milestone_name_en || '', body.description || '',
      body.percentage, body.amount_before_vat, vatAmount, totalAmount,
      body.expected_date || null, body.status, body.notes || '', id
    ).run()
    
    const milestone = await c.env.DB.prepare(`SELECT * FROM payment_milestones WHERE id = ?`).bind(id).first()
    return c.json({ success: true, data: milestone })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// DELETE milestone
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare(`DELETE FROM payment_milestones WHERE id = ?`).bind(id).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

export default app
