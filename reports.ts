import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// GET full project report data
app.get('/project/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    
    const [project, scenarios, boq, payments, recommendation, overrides] = await Promise.all([
      c.env.DB.prepare(`SELECT * FROM projects WHERE project_id = ?`).bind(projectId).first(),
      c.env.DB.prepare(`SELECT * FROM pricing_scenarios WHERE project_id = ? ORDER BY id`).bind(projectId).all(),
      c.env.DB.prepare(`SELECT * FROM boq_items WHERE project_id = ? ORDER BY item_number`).bind(projectId).all(),
      c.env.DB.prepare(`SELECT * FROM payment_milestones WHERE project_id = ? ORDER BY milestone_number`).bind(projectId).all(),
      c.env.DB.prepare(`SELECT * FROM management_recommendations WHERE project_id = ?`).bind(projectId).first(),
      c.env.DB.prepare(`SELECT * FROM project_cost_overrides WHERE project_id = ?`).bind(projectId).all()
    ])
    
    const globals = await c.env.DB.prepare(`SELECT * FROM cost_assumptions ORDER BY category, id`).all()
    
    return c.json({
      success: true,
      data: {
        project,
        scenarios: scenarios.results,
        boq: boq.results,
        payments: payments.results,
        recommendation,
        overrides: overrides.results,
        globalCosts: globals.results
      }
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// GET dashboard summary (all projects)
app.get('/dashboard', async (c) => {
  try {
    const projects = await c.env.DB.prepare(`
      SELECT p.*,
        ps.selling_price_before_vat as recommended_price,
        ps.gross_margin,
        ps.gross_profit,
        ps.total_cost
      FROM projects p
      LEFT JOIN pricing_scenarios ps ON ps.project_id = p.project_id AND ps.is_recommended = 1
      WHERE p.status != 'archived'
      ORDER BY p.created_at DESC
    `).all()
    
    const totals = await c.env.DB.prepare(`
      SELECT 
        COUNT(DISTINCT p.project_id) as total_projects,
        SUM(ps.selling_price_before_vat) as total_revenue,
        SUM(ps.total_cost) as total_cost,
        SUM(ps.gross_profit) as total_profit,
        AVG(ps.gross_margin) as avg_margin
      FROM projects p
      LEFT JOIN pricing_scenarios ps ON ps.project_id = p.project_id AND ps.is_recommended = 1
      WHERE p.status != 'archived'
    `).first()
    
    return c.json({ success: true, data: { projects: projects.results, totals } })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

export default app
