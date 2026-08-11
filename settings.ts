import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// GET all settings
app.get('/', async (c) => {
  try {
    const settings = await c.env.DB.prepare(`SELECT * FROM app_settings`).all()
    const result: Record<string, string> = {}
    for (const s of settings.results as any[]) {
      result[s.key] = s.value
    }
    return c.json({ success: true, data: result })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST update settings
app.post('/', async (c) => {
  try {
    const body = await c.req.json()
    for (const [key, value] of Object.entries(body)) {
      await c.env.DB.prepare(`
        INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
      `).bind(key, String(value)).run()
    }
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

export default app
