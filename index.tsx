import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import projectsRoute from './routes/projects'
import costsRoute from './routes/costs'
import scenariosRoute from './routes/scenarios'
import boqRoute from './routes/boq'
import paymentsRoute from './routes/payments'
import settingsRoute from './routes/settings'
import reportsRoute from './routes/reports'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS
app.use('/api/*', cors())

// API Routes
app.route('/api/projects', projectsRoute)
app.route('/api/costs', costsRoute)
app.route('/api/scenarios', scenariosRoute)
app.route('/api/boq', boqRoute)
app.route('/api/payments', paymentsRoute)
app.route('/api/settings', settingsRoute)
app.route('/api/reports', reportsRoute)

// Static files
app.use('/static/*', serveStatic({ root: './public' }))

// SPA fallback - serve index.html for all non-API routes
app.get('/*', async (c) => {
  const html = await c.env.DB ? getAppHtml() : getAppHtml()
  return c.html(getAppHtml())
})

function getAppHtml(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>محرك التسعير والعروض التدريبية</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <div id="app"></div>
  <script src="/static/app.js"></script>
  <script src="/static/app2.js"></script>
  <script src="/static/app3.js"></script>
</body>
</html>`
}

export default app
