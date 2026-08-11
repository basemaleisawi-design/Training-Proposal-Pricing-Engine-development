import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// GET BOQ items for a project
app.get('/project/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    const items = await c.env.DB.prepare(`SELECT * FROM boq_items WHERE project_id = ? ORDER BY item_number`).bind(projectId).all()
    return c.json({ success: true, data: items.results })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST add BOQ item
app.post('/project/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    const body = await c.req.json()
    
    // Get next item number
    const maxItem = await c.env.DB.prepare(`SELECT MAX(item_number) as max_num FROM boq_items WHERE project_id = ?`).bind(projectId).first() as any
    const itemNumber = (maxItem?.max_num || 0) + 1
    
    // Get VAT from DB
    const vatRowSingle = await c.env.DB.prepare(`SELECT value FROM cost_assumptions WHERE key = 'vat_percent'`).first() as any
    const vatRateSingle = (vatRowSingle?.value ?? 15) / 100
    const totalBeforeVat = (body.quantity || 0) * (body.selling_unit_price || 0)
    const vatAmount = totalBeforeVat * vatRateSingle
    const totalIncludingVat = totalBeforeVat + vatAmount
    
    const result = await c.env.DB.prepare(`
      INSERT INTO boq_items (project_id, item_number, category, description_ar, description_en, 
        quantity, unit, unit_cost, selling_unit_price, total_before_vat, vat_amount, total_including_vat, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      projectId, itemNumber, body.category || 'عام', body.description_ar || '',
      body.description_en || '', body.quantity || 0, body.unit || 'وحدة',
      body.unit_cost || 0, body.selling_unit_price || 0, totalBeforeVat, vatAmount,
      totalIncludingVat, body.notes || ''
    ).run()
    
    const item = await c.env.DB.prepare(`SELECT * FROM boq_items WHERE id = ?`).bind(result.meta.last_row_id).first()
    return c.json({ success: true, data: item }, 201)
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// PUT update BOQ item
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    
    // Get VAT from DB
    const vatRowUpdate = await c.env.DB.prepare(`SELECT value FROM cost_assumptions WHERE key = 'vat_percent'`).first() as any
    const vatRateUpdate = (vatRowUpdate?.value ?? 15) / 100
    const totalBeforeVat = (body.quantity || 0) * (body.selling_unit_price || 0)
    const vatAmount = totalBeforeVat * vatRateUpdate
    const totalIncludingVat = totalBeforeVat + vatAmount
    
    await c.env.DB.prepare(`
      UPDATE boq_items SET category=?, description_ar=?, description_en=?, quantity=?, unit=?,
        unit_cost=?, selling_unit_price=?, total_before_vat=?, vat_amount=?, total_including_vat=?, notes=?
      WHERE id=?
    `).bind(
      body.category, body.description_ar, body.description_en || '', body.quantity,
      body.unit, body.unit_cost, body.selling_unit_price, totalBeforeVat, vatAmount,
      totalIncludingVat, body.notes || '', id
    ).run()
    
    const item = await c.env.DB.prepare(`SELECT * FROM boq_items WHERE id = ?`).bind(id).first()
    return c.json({ success: true, data: item })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// DELETE BOQ item
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare(`DELETE FROM boq_items WHERE id = ?`).bind(id).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST bulk save BOQ
app.post('/project/:projectId/bulk', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    const items = await c.req.json() as any[]
    
    // Get VAT rate from cost assumptions (NOT hardcoded 15%)
    const vatRow = await c.env.DB.prepare(`SELECT value FROM cost_assumptions WHERE key = 'vat_percent'`).first() as any
    const vatRate = (vatRow?.value ?? 15) / 100
    
    // Delete existing and re-insert
    await c.env.DB.prepare(`DELETE FROM boq_items WHERE project_id = ?`).bind(projectId).run()
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const totalBeforeVat = (item.quantity || 0) * (item.selling_unit_price || 0)
      const vatAmount = totalBeforeVat * vatRate
      const totalIncludingVat = totalBeforeVat + vatAmount
      
      await c.env.DB.prepare(`
        INSERT INTO boq_items (project_id, item_number, category, description_ar, description_en, 
          quantity, unit, unit_cost, selling_unit_price, total_before_vat, vat_amount, total_including_vat, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        projectId, i + 1, item.category || 'عام', item.description_ar || '',
        item.description_en || '', item.quantity || 0, item.unit || 'وحدة',
        item.unit_cost || 0, item.selling_unit_price || 0, totalBeforeVat, vatAmount,
        totalIncludingVat, item.notes || ''
      ).run()
    }
    
    const updated = await c.env.DB.prepare(`SELECT * FROM boq_items WHERE project_id = ? ORDER BY item_number`).bind(projectId).all()
    return c.json({ success: true, data: updated.results })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

export default app
