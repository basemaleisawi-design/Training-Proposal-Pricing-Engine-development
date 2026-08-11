import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// GET scenarios for a project
app.get('/project/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    const scenarios = await c.env.DB.prepare(`SELECT * FROM pricing_scenarios WHERE project_id = ? ORDER BY id`).bind(projectId).all()
    return c.json({ success: true, data: scenarios.results })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// PUT update scenario (margin + recalculated values)
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    
    await c.env.DB.prepare(`
      UPDATE pricing_scenarios SET
        target_margin=?, total_cost=?, selling_price_before_vat=?, vat_amount=?,
        selling_price_including_vat=?, gross_profit=?, gross_margin=?,
        profit_per_participant=?, revenue_per_participant=?, revenue_per_training_day=?,
        is_recommended=?, is_locked=?
      WHERE id=?
    `).bind(
      body.target_margin, body.total_cost, body.selling_price_before_vat,
      body.vat_amount, body.selling_price_including_vat, body.gross_profit,
      body.gross_margin, body.profit_per_participant, body.revenue_per_participant,
      body.revenue_per_training_day, body.is_recommended || 0, body.is_locked || 0, id
    ).run()

    // If this scenario is set as recommended, unset others
    if (body.is_recommended) {
      const scenario = await c.env.DB.prepare(`SELECT project_id FROM pricing_scenarios WHERE id = ?`).bind(id).first() as any
      if (scenario) {
        await c.env.DB.prepare(`UPDATE pricing_scenarios SET is_recommended = 0 WHERE project_id = ? AND id != ?`)
          .bind(scenario.project_id, id).run()
      }
    }
    
    const updated = await c.env.DB.prepare(`SELECT * FROM pricing_scenarios WHERE id = ?`).bind(id).first()
    return c.json({ success: true, data: updated })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST bulk save all scenarios for a project
app.post('/project/:projectId/bulk', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    const scenarios = await c.req.json() as any[]
    
    for (const s of scenarios) {
      await c.env.DB.prepare(`
        INSERT INTO pricing_scenarios (project_id, scenario_type, label_ar, label_en, target_margin, 
          total_cost, selling_price_before_vat, vat_amount, selling_price_including_vat, 
          gross_profit, gross_margin, profit_per_participant, revenue_per_participant, 
          revenue_per_training_day, is_recommended, is_locked)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, scenario_type) DO UPDATE SET
          target_margin=excluded.target_margin, total_cost=excluded.total_cost,
          selling_price_before_vat=excluded.selling_price_before_vat, vat_amount=excluded.vat_amount,
          selling_price_including_vat=excluded.selling_price_including_vat, gross_profit=excluded.gross_profit,
          gross_margin=excluded.gross_margin, profit_per_participant=excluded.profit_per_participant,
          revenue_per_participant=excluded.revenue_per_participant,
          revenue_per_training_day=excluded.revenue_per_training_day,
          is_recommended=excluded.is_recommended, is_locked=excluded.is_locked
      `).bind(
        projectId, s.scenario_type, s.label_ar, s.label_en, s.target_margin,
        s.total_cost || 0, s.selling_price_before_vat || 0, s.vat_amount || 0,
        s.selling_price_including_vat || 0, s.gross_profit || 0, s.gross_margin || 0,
        s.profit_per_participant || 0, s.revenue_per_participant || 0,
        s.revenue_per_training_day || 0, s.is_recommended || 0, s.is_locked || 0
      ).run()
    }
    
    const updated = await c.env.DB.prepare(`SELECT * FROM pricing_scenarios WHERE project_id = ? ORDER BY id`).bind(projectId).all()
    return c.json({ success: true, data: updated.results })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

export default app
