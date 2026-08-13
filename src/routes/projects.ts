import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// GET all projects
app.get('/', async (c) => {
  try {
    const projects = await c.env.DB.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM pricing_scenarios WHERE project_id = p.project_id) as scenarios_count,
        (SELECT selling_price_before_vat FROM pricing_scenarios WHERE project_id = p.project_id AND is_recommended = 1 LIMIT 1) as recommended_price,
        (SELECT gross_margin FROM pricing_scenarios WHERE project_id = p.project_id AND is_recommended = 1 LIMIT 1) as gross_margin,
        (SELECT gross_profit FROM pricing_scenarios WHERE project_id = p.project_id AND is_recommended = 1 LIMIT 1) as gross_profit,
        (SELECT total_cost FROM pricing_scenarios WHERE project_id = p.project_id AND is_recommended = 1 LIMIT 1) as total_cost
      FROM projects p ORDER BY p.created_at DESC
    `).all()
    return c.json({ success: true, data: projects.results })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// GET single project
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const project = await c.env.DB.prepare(`SELECT * FROM projects WHERE project_id = ?`).bind(id).first()
    if (!project) return c.json({ success: false, error: 'Project not found' }, 404)
    return c.json({ success: true, data: project })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST create project
app.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const projectId = body.project_id || `PRJ-${Date.now()}`
    
    await c.env.DB.prepare(`
      INSERT INTO projects (project_id, client_name, project_name, project_type, contract_type, city, 
        start_date, end_date, duration_days, num_programs, num_cohorts, num_participants, 
        num_training_days, hours_per_day, delivery_mode, trainer_type, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      projectId, body.client_name, body.project_name, body.project_type || 'corporate',
      body.contract_type || 'direct', body.city || '', body.start_date || null,
      body.end_date || null, body.duration_days || 0, body.num_programs || 1,
      body.num_cohorts || 1, body.num_participants || 0, body.num_training_days || 0,
      body.hours_per_day || 8, body.delivery_mode || 'in_person',
      body.trainer_type || 'general', body.status || 'active', body.notes || ''
    ).run()

    // Create default pricing scenarios
    const defaultScenarios = [
      { type: 'competitive', label_ar: 'السيناريو أ - تنافسي', label_en: 'Scenario A - Competitive', margin: 15, recommended: 0 },
      { type: 'recommended', label_ar: 'السيناريو ب - موصى به', label_en: 'Scenario B - Recommended', margin: 25, recommended: 1 },
      { type: 'premium', label_ar: 'السيناريو ج - مميز', label_en: 'Scenario C - Premium', margin: 35, recommended: 0 }
    ]
    for (const s of defaultScenarios) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO pricing_scenarios (project_id, scenario_type, label_ar, label_en, target_margin, is_recommended)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(projectId, s.type, s.label_ar, s.label_en, s.margin, s.recommended).run()
    }

    const project = await c.env.DB.prepare(`SELECT * FROM projects WHERE project_id = ?`).bind(projectId).first()
    return c.json({ success: true, data: project }, 201)
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// PUT update project
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    
    await c.env.DB.prepare(`
      UPDATE projects SET client_name=?, project_name=?, project_type=?, contract_type=?,
        city=?, start_date=?, end_date=?, duration_days=?, num_programs=?, num_cohorts=?,
        num_participants=?, num_training_days=?, hours_per_day=?, delivery_mode=?,
        trainer_type=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE project_id=?
    `).bind(
      body.client_name, body.project_name, body.project_type, body.contract_type,
      body.city, body.start_date || null, body.end_date || null, body.duration_days || 0,
      body.num_programs, body.num_cohorts, body.num_participants, body.num_training_days,
      body.hours_per_day, body.delivery_mode,
      body.trainer_type || 'general', body.status, body.notes || '', id
    ).run()

    const project = await c.env.DB.prepare(`SELECT * FROM projects WHERE project_id = ?`).bind(id).first()
    return c.json({ success: true, data: project })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST duplicate project
app.post('/:id/duplicate', async (c) => {
  try {
    const id = c.req.param('id')
    const original = await c.env.DB.prepare(`SELECT * FROM projects WHERE project_id = ?`).bind(id).first() as any
    if (!original) return c.json({ success: false, error: 'Project not found' }, 404)
    
    const newId = `PRJ-${Date.now()}`
    await c.env.DB.prepare(`
      INSERT INTO projects (project_id, client_name, project_name, project_type, contract_type, city, 
        start_date, end_date, duration_days, num_programs, num_cohorts, num_participants, 
        num_training_days, hours_per_day, delivery_mode, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).bind(
      newId, original.client_name, `${original.project_name} (نسخة)`,
      original.project_type, original.contract_type, original.city,
      original.start_date, original.end_date, original.duration_days,
      original.num_programs, original.num_cohorts, original.num_participants,
      original.num_training_days, original.hours_per_day, original.delivery_mode, original.notes
    ).run()

    // Duplicate scenarios
    const scenarios = await c.env.DB.prepare(`SELECT * FROM pricing_scenarios WHERE project_id = ?`).bind(id).all()
    for (const s of scenarios.results as any[]) {
      await c.env.DB.prepare(`
        INSERT INTO pricing_scenarios (project_id, scenario_type, label_ar, label_en, target_margin, is_recommended)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(newId, s.scenario_type, s.label_ar, s.label_en, s.target_margin, s.is_recommended).run()
    }

    // Duplicate cost overrides
    const overrides = await c.env.DB.prepare(`SELECT * FROM project_cost_overrides WHERE project_id = ?`).bind(id).all()
    for (const o of overrides.results as any[]) {
      await c.env.DB.prepare(`INSERT INTO project_cost_overrides (project_id, key, value) VALUES (?, ?, ?)`).bind(newId, o.key, o.value).run()
    }

    const newProject = await c.env.DB.prepare(`SELECT * FROM projects WHERE project_id = ?`).bind(newId).first()
    return c.json({ success: true, data: newProject }, 201)
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// DELETE project
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare(`DELETE FROM pricing_scenarios WHERE project_id = ?`).bind(id).run()
    await c.env.DB.prepare(`DELETE FROM project_cost_overrides WHERE project_id = ?`).bind(id).run()
    await c.env.DB.prepare(`DELETE FROM project_costs WHERE project_id = ?`).bind(id).run()
    await c.env.DB.prepare(`DELETE FROM boq_items WHERE project_id = ?`).bind(id).run()
    await c.env.DB.prepare(`DELETE FROM payment_milestones WHERE project_id = ?`).bind(id).run()
    await c.env.DB.prepare(`DELETE FROM management_recommendations WHERE project_id = ?`).bind(id).run()
    await c.env.DB.prepare(`DELETE FROM projects WHERE project_id = ?`).bind(id).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// GET project cost overrides
app.get('/:id/overrides', async (c) => {
  try {
    const id = c.req.param('id')
    const overrides = await c.env.DB.prepare(`SELECT * FROM project_cost_overrides WHERE project_id = ?`).bind(id).all()
    const result: Record<string, number> = {}
    for (const o of overrides.results as any[]) {
      result[o.key] = o.value
    }
    return c.json({ success: true, data: result })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST save project cost overrides
app.post('/:id/overrides', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    for (const [key, value] of Object.entries(body)) {
      await c.env.DB.prepare(`
        INSERT INTO project_cost_overrides (project_id, key, value) VALUES (?, ?, ?)
        ON CONFLICT(project_id, key) DO UPDATE SET value = excluded.value
      `).bind(id, key, value as number).run()
    }
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// GET management recommendation
app.get('/:id/recommendation', async (c) => {
  try {
    const id = c.req.param('id')
    const rec = await c.env.DB.prepare(`SELECT * FROM management_recommendations WHERE project_id = ?`).bind(id).first()
    return c.json({ success: true, data: rec })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST save management recommendation
app.post('/:id/recommendation', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    await c.env.DB.prepare(`
      INSERT INTO management_recommendations (project_id, recommended_price, recommended_scenario, 
        expected_gross_profit, gross_margin, major_cost_drivers, commercial_risks, 
        pricing_observations, margin_warning, suggested_decision, is_custom, custom_content, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(project_id) DO UPDATE SET
        recommended_price=excluded.recommended_price, recommended_scenario=excluded.recommended_scenario,
        expected_gross_profit=excluded.expected_gross_profit, gross_margin=excluded.gross_margin,
        major_cost_drivers=excluded.major_cost_drivers, commercial_risks=excluded.commercial_risks,
        pricing_observations=excluded.pricing_observations, margin_warning=excluded.margin_warning,
        suggested_decision=excluded.suggested_decision, is_custom=excluded.is_custom,
        custom_content=excluded.custom_content, updated_at=CURRENT_TIMESTAMP
    `).bind(
      id, body.recommended_price || 0, body.recommended_scenario || 'recommended',
      body.expected_gross_profit || 0, body.gross_margin || 0,
      body.major_cost_drivers || '', body.commercial_risks || '',
      body.pricing_observations || '', body.margin_warning || '',
      body.suggested_decision || '', body.is_custom || 0, body.custom_content || ''
    ).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

export default app
