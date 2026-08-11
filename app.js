/* ============================================================
   Training Proposal & Pricing Engine
   Main Application JavaScript - Part 1
   App Core, Navigation, Project Management
   ============================================================ */

'use strict';

// ============ APP STATE ============
const App = {
  lang: 'ar',
  currentPage: 'dashboard',
  currentProject: null,
  projects: [],
  costAssumptions: {},
  settings: {},
  charts: {},

  t(ar, en) {
    return this.lang === 'ar' ? ar : en;
  },

  formatNum(n, decimals = 0) {
    if (n == null || isNaN(n)) return '0';
    return Number(n).toLocaleString('ar-SA', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },

  formatSAR(n, decimals = 0) {
    if (n == null || isNaN(n)) return '0';
    const formatted = Number(n).toLocaleString('en-SA', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return `${formatted}`;
  },

  formatPct(n, decimals = 1) {
    if (n == null || isNaN(n)) return '0.0%';
    return Number(n).toFixed(decimals) + '%';
  }
};

// ============ API HELPERS ============
const API = {
  base: '/api',
  async get(path) {
    const res = await fetch(`${this.base}${path}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'API Error');
    return data.data;
  },
  async post(path, body) {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'API Error');
    return data.data;
  },
  async put(path, body) {
    const res = await fetch(`${this.base}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'API Error');
    return data.data;
  },
  async delete(path) {
    const res = await fetch(`${this.base}${path}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'API Error');
    return data.data;
  }
};

// ============ TOAST NOTIFICATIONS ============
function showToast(msg, type = 'success') {
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ============ MODAL HELPERS ============
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ============ BUTTON LOADING STATE HELPERS ============
/**
 * Disable a button and show a spinner + loading text.
 * @param {HTMLElement|string} btnOrSelector - button element or CSS selector
 * @param {string} [loadingText] - optional loading label
 * @returns {Function} restore — call to re-enable the button
 */
function setButtonLoading(btnOrSelector, loadingText) {
  const btn = typeof btnOrSelector === 'string'
    ? document.querySelector(btnOrSelector)
    : btnOrSelector;
  if (!btn) return () => {};
  const original = btn.innerHTML;
  const originalDisabled = btn.disabled;
  btn.disabled = true;
  btn.style.opacity = '0.7';
  btn.style.pointerEvents = 'none';
  if (loadingText) {
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
  } else {
    btn.innerHTML = btn.innerHTML.replace(/<i[^>]*><\/i>/, '<i class="fas fa-spinner fa-spin"></i>');
  }
  return function restore() {
    btn.disabled = originalDisabled;
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
    btn.innerHTML = original;
  };
}

/**
 * Run an async function with button loading state.
 * Usage: withLoading(btn, async () => { ... })
 */
async function withLoading(btn, fn) {
  const restore = setButtonLoading(btn);
  try {
    return await fn();
  } finally {
    restore();
  }
}

// ============ LANGUAGE TOGGLE ============
function toggleLang() {
  App.lang = App.lang === 'ar' ? 'en' : 'ar';
  document.documentElement.lang = App.lang;
  document.documentElement.dir = App.lang === 'ar' ? 'rtl' : 'ltr';
  if (App.lang === 'en') {
    document.body.classList.add('lang-en');
  } else {
    document.body.classList.remove('lang-en');
  }
  renderApp();
}

// ============ NAVIGATION ============
function navigate(page, projectId = null) {
  App.currentPage = page;
  if (projectId) App.currentProject = App.projects.find(p => p.project_id === projectId) || App.currentProject;
  renderApp();
}

// ============ FINANCIAL CALCULATIONS ENGINE ============
const Calc = {
  // Get effective cost value (project override or global)
  getRate(key, assumptions, overrides = {}) {
    if (overrides[key] !== undefined) return Number(overrides[key]);
    const found = assumptions[key];
    if (found !== undefined) return Number(found);
    return 0;
  },

  // Calculate all direct costs for a project
  calcDirectCosts(project, assumptions, overrides = {}) {
    const g = (key) => this.getRate(key, assumptions, overrides);
    const p = project;
    const numDays = Number(p.num_training_days) || 0;
    const numParticipants = Number(p.num_participants) || 0;
    const numCohorts = Number(p.num_cohorts) || 1;
    const numPrograms = Number(p.num_programs) || 1;

    // Trainers (estimated 1 trainer per program per day)
    const trainerRate = p.trainer_type === 'specialized' ? g('trainer_specialized_day_rate') :
                       p.trainer_type === 'leadership' ? g('trainer_leadership_day_rate') :
                       g('trainer_general_day_rate');
    const trainerCost = trainerRate * numDays * numCohorts;

    // Coordinators (1 coordinator per cohort per day)
    const coordinatorCost = g('coordinator_day_rate') * numDays * numCohorts;

    // Project Management (fixed per project)
    const pmCost = g('project_manager_cost');

    // Venue / Hotel
    const venueCost = g('hotel_venue_cost_per_person_per_day') * numParticipants * numDays * numCohorts;

    // Catering (coffee breaks)
    const cateringCost = g('coffee_break_cost_per_person_per_day') * numParticipants * numDays * numCohorts;

    // Printing
    const printingCost = g('printing_cost_per_trainee') * numParticipants * numCohorts;

    // Certificates
    const certsCost = g('certificates_cost') * numParticipants * numCohorts;

    // Assessments
    const assessCost = g('assessment_cost') * numParticipants * numCohorts;

    // LMS & Technology
    const lmsCost = g('lms_cost') + g('technology_cost');

    // Travel
    const accommodationCost = g('accommodation_per_night') * numDays;
    const flightsCost = g('flights_cost');
    const transportCost = g('ground_transportation') * numDays;
    const travelCost = accommodationCost + flightsCost + transportCost;

    // Other
    const equipmentCost = g('equipment_cost');
    const consultantsCost = g('external_consultants_cost');
    const marketingCost = g('marketing_cost');
    const otherDirect = g('other_direct_costs');
    const photographerCost = g('photographer_cost');
    const permitsCost = g('permits_cost');
    const stationeryCost = g('stationery_cost') * numParticipants * numCohorts;

    const totalDirect = trainerCost + coordinatorCost + pmCost + venueCost + cateringCost +
      printingCost + certsCost + assessCost + lmsCost + travelCost +
      equipmentCost + consultantsCost + marketingCost + otherDirect +
      photographerCost + permitsCost + stationeryCost;

    return {
      trainers: trainerCost,
      coordinators: coordinatorCost,
      projectManagement: pmCost,
      venue: venueCost,
      catering: cateringCost,
      printing: printingCost,
      certificates: certsCost,
      assessments: assessCost,
      lmsTechnology: lmsCost,
      travel: travelCost,
      accommodation: accommodationCost,
      flights: flightsCost,
      transportation: transportCost,
      equipment: equipmentCost,
      consultants: consultantsCost,
      marketing: marketingCost,
      stationery: stationeryCost,
      photographer: photographerCost,
      permits: permitsCost,
      otherDirect: otherDirect,
      total: totalDirect
    };
  },

  // Calculate indirect costs
  calcIndirectCosts(directTotal, assumptions, overrides = {}) {
    const g = (key) => this.getRate(key, assumptions, overrides);
    const adminOverhead = directTotal * (g('admin_overhead_percent') / 100);
    const contingency = directTotal * (g('contingency_percent') / 100);
    return {
      adminOverhead,
      contingency,
      other: 0,
      total: adminOverhead + contingency
    };
  },

  // Calculate pricing scenario
  calcScenario(totalCost, targetMarginPct, numParticipants, numTrainingDays, vatPct) {
    if (totalCost <= 0) return {
      totalCost: 0, sellingPriceBeforeVat: 0, vatAmount: 0,
      sellingPriceIncludingVat: 0, grossProfit: 0, grossMargin: 0,
      profitPerParticipant: 0, revenuePerParticipant: 0, revenuePerTrainingDay: 0
    };
    const margin = Math.max(0, Math.min(99, Number(targetMarginPct) || 0));
    const sellingPriceBeforeVat = totalCost / (1 - margin / 100);
    const vatAmount = sellingPriceBeforeVat * (vatPct / 100);
    const sellingPriceIncludingVat = sellingPriceBeforeVat + vatAmount;
    const grossProfit = sellingPriceBeforeVat - totalCost;
    const grossMargin = (grossProfit / sellingPriceBeforeVat) * 100;
    const n = Number(numParticipants) || 1;
    const d = Number(numTrainingDays) || 1;
    return {
      totalCost,
      sellingPriceBeforeVat,
      vatAmount,
      sellingPriceIncludingVat,
      grossProfit,
      grossMargin,
      profitPerParticipant: grossProfit / n,
      revenuePerParticipant: sellingPriceBeforeVat / n,
      revenuePerTrainingDay: sellingPriceBeforeVat / d
    };
  },

  // Calculate break-even
  calcBreakEven(totalCost, numParticipants, assumptions, overrides = {}) {
    const g = (key) => this.getRate(key, assumptions, overrides);
    const minMargin = g('minimum_margin_percent');
    const breakEvenPrice = totalCost; // margin = 0
    const minAcceptablePrice = totalCost / (1 - minMargin / 100);
    const n = Number(numParticipants) || 1;
    return {
      breakEvenPrice,
      minAcceptablePrice,
      breakEvenPerParticipant: breakEvenPrice / n,
      minAcceptablePricePerParticipant: minAcceptablePrice / n,
      minMarginPct: minMargin
    };
  },

  // Full project calculation
  calcFull(project, assumptions, overrides = {}) {
    const direct = this.calcDirectCosts(project, assumptions, overrides);
    const indirect = this.calcIndirectCosts(direct.total, assumptions, overrides);
    const totalCost = direct.total + indirect.total;
    const g = (key) => this.getRate(key, assumptions, overrides);
    const vatPct = g('vat_percent');
    const n = Number(project.num_participants) || 1;
    const d = Number(project.num_training_days) || 1;
    const c = Number(project.num_cohorts) || 1;
    const prog = Number(project.num_programs) || 1;

    const scenarios = {
      competitive: this.calcScenario(totalCost, 15, n, d, vatPct),
      recommended: this.calcScenario(totalCost, 25, n, d, vatPct),
      premium: this.calcScenario(totalCost, 35, n, d, vatPct)
    };

    const breakEven = this.calcBreakEven(totalCost, n, assumptions, overrides);

    return {
      direct,
      indirect,
      totalCost,
      costPerProgram: totalCost / prog,
      costPerCohort: totalCost / c,
      costPerTrainingDay: totalCost / d,
      costPerParticipant: totalCost / n,
      scenarios,
      breakEven,
      vatPct
    };
  }
};

// ============ RENDER APP ============
function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar()}
      <div class="main-content">
        ${renderTopbar()}
        <div class="page-content">
          ${renderPage()}
        </div>
      </div>
    </div>
    <div class="toast-container" id="toastContainer"></div>
    <div id="modalContainer"></div>
  `;
  // attachEventListeners is defined in app2.js - call safely
  if (typeof attachEventListeners === 'function') {
    attachEventListeners();
  }
  renderCharts();
}

// ============ SIDEBAR ============
function renderSidebar() {
  const t = App.t.bind(App);
  const navItems = [
    { id: 'dashboard', icon: 'fa-tachometer-alt', label: t('لوحة التحكم', 'Dashboard'), section: null },
    { id: 'projects', icon: 'fa-briefcase', label: t('المشاريع', 'Projects'), section: null },
    ...(App.currentProject ? [
      { id: 'project-overview', icon: 'fa-info-circle', label: t('نظرة عامة', 'Overview'), section: t('المشروع الحالي', 'Current Project') },
      { id: 'cost-builder', icon: 'fa-calculator', label: t('بناء التكاليف', 'Cost Build-Up'), section: null },
      { id: 'pricing', icon: 'fa-tags', label: t('محرك التسعير', 'Pricing Engine'), section: null },
      { id: 'breakeven', icon: 'fa-chart-line', label: t('تحليل التعادل', 'Break-Even'), section: null },
      { id: 'sensitivity', icon: 'fa-sliders-h', label: t('تحليل الحساسية', 'Sensitivity'), section: null },
      { id: 'boq', icon: 'fa-list-ol', label: t('جدول الكميات BOQ', 'Bill of Quantities'), section: null },
      { id: 'payments', icon: 'fa-calendar-check', label: t('جدول الدفعات', 'Payment Schedule'), section: null },
      { id: 'cashflow', icon: 'fa-chart-area', label: t('التدفق النقدي', 'Cash Flow'), section: null },
      { id: 'exec-dashboard', icon: 'fa-chart-pie', label: t('لوحة التنفيذيين', 'Executive Dashboard'), section: null },
      { id: 'recommendation', icon: 'fa-star', label: t('توصية الإدارة', 'Management Recommendation'), section: null },
      { id: 'reports', icon: 'fa-file-alt', label: t('التقارير', 'Reports'), section: null },
    ] : []),
    { id: 'settings', icon: 'fa-cog', label: t('الإعدادات', 'Settings'), section: t('الإعدادات', 'Settings') },
  ];

  let lastSection = '';
  let navHtml = '';
  for (const item of navItems) {
    if (item.section && item.section !== lastSection) {
      navHtml += `<div class="nav-section-title">${item.section}</div>`;
      lastSection = item.section;
    } else if (!item.section && lastSection) {
      lastSection = '';
    }
    navHtml += `
      <div class="nav-item ${App.currentPage === item.id ? 'active' : ''}" onclick="navigate('${item.id}')">
        <i class="fas ${item.icon}"></i>
        <span>${item.label}</span>
      </div>
    `;
  }

  const projectName = App.currentProject
    ? `<div style="padding:10px 18px;font-size:11px;color:rgba(255,255,255,0.4);border-bottom:1px solid rgba(255,255,255,0.06)">
         <div style="color:rgba(255,255,255,0.6);font-weight:600;font-size:12px;margin-bottom:2px">${t('المشروع الحالي', 'Current Project')}</div>
         <div style="color:var(--accent-light)">${App.currentProject.project_name}</div>
       </div>`
    : '';

  return `
    <div class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon"><i class="fas fa-graduation-cap"></i></div>
        <div class="logo-text">
          <div class="logo-title">${t('محرك التسعير والعروض التدريبية', 'Training Pricing Engine')}</div>
          <div class="logo-sub">v1.0 · ${t('نظام تجاري داخلي', 'Internal Commercial System')}</div>
        </div>
      </div>
      ${projectName}
      <nav class="sidebar-nav">${navHtml}</nav>
      <div class="sidebar-footer">
        <button class="lang-btn" onclick="toggleLang()">
          <i class="fas fa-globe"></i>
          <span>${App.lang === 'ar' ? 'English' : 'عربي'}</span>
        </button>
      </div>
    </div>
  `;
}

// ============ TOPBAR ============
function renderTopbar() {
  const t = App.t.bind(App);
  const titles = {
    'dashboard': t('لوحة التحكم الرئيسية', 'Main Dashboard'),
    'projects': t('إدارة المشاريع', 'Project Management'),
    'project-overview': t('نظرة عامة على المشروع', 'Project Overview'),
    'cost-builder': t('بناء التكاليف', 'Cost Build-Up'),
    'pricing': t('محرك التسعير', 'Pricing Engine'),
    'breakeven': t('تحليل التعادل', 'Break-Even Analysis'),
    'sensitivity': t('تحليل الحساسية', 'Sensitivity Analysis'),
    'boq': t('جدول الكميات', 'Bill of Quantities'),
    'payments': t('جدول الدفعات', 'Payment Schedule'),
    'cashflow': t('التدفق النقدي', 'Cash Flow'),
    'exec-dashboard': t('لوحة التحكم التنفيذية', 'Executive Dashboard'),
    'recommendation': t('توصية الإدارة', 'Management Recommendation'),
    'reports': t('التقارير', 'Reports'),
    'settings': t('الإعدادات العامة', 'Global Settings'),
  };

  const projectBadge = App.currentProject
    ? `<span class="topbar-badge">${App.currentProject.project_id}</span>
       <span style="font-size:13px;color:var(--text-secondary)">${App.currentProject.project_name}</span>`
    : '';

  return `
    <div class="topbar">
      <div class="topbar-title">${titles[App.currentPage] || ''}</div>
      ${projectBadge}
      <div class="topbar-actions">
        ${App.currentProject ? `
          <button class="btn btn-outline btn-sm" onclick="navigate('projects')">
            <i class="fas fa-arrow-${App.lang === 'ar' ? 'right' : 'left'}"></i>
            ${t('المشاريع', 'Projects')}
          </button>
        ` : ''}
        <button class="btn btn-accent btn-sm" onclick="showNewProjectModal()">
          <i class="fas fa-plus"></i>
          ${t('مشروع جديد', 'New Project')}
        </button>
      </div>
    </div>
  `;
}

// ============ PAGE ROUTER ============
function renderPage() {
  switch (App.currentPage) {
    case 'dashboard': return renderDashboardPage();
    case 'projects': return renderProjectsPage();
    case 'project-overview': return App.currentProject ? renderProjectOverview() : renderProjectsPage();
    case 'cost-builder': return App.currentProject ? renderCostBuilder() : renderProjectsPage();
    case 'pricing': return App.currentProject ? renderPricingEngine() : renderProjectsPage();
    case 'breakeven': return App.currentProject ? renderBreakEven() : renderProjectsPage();
    case 'sensitivity': return App.currentProject ? renderSensitivity() : renderProjectsPage();
    case 'boq': return renderAsyncPage(() => renderBOQ());
    case 'payments': return renderAsyncPage(() => renderPayments());
    case 'cashflow': return renderAsyncPage(() => renderCashFlow());
    case 'exec-dashboard': return renderAsyncPage(() => renderExecDashboard());
    case 'recommendation': return renderAsyncPage(() => renderRecommendation());
    case 'reports': return App.currentProject ? renderReports() : renderProjectsPage();
    case 'settings': return renderAsyncPage(() => renderSettingsPage());
    default: return renderDashboardPage();
  }
}

// Helper to handle async page renders
function renderAsyncPage(asyncFn) {
  const loadingHtml = `<div style="display:flex;align-items:center;justify-content:center;padding:60px;gap:12px">
    <div class="loading-spinner"></div>
    <span style="color:var(--text-muted)">${App.lang === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</span>
  </div>`;
  // Execute async function and update page content
  setTimeout(async () => {
    try {
      if (!App.currentProject && ['boq','payments','cashflow','exec-dashboard','recommendation'].includes(App.currentPage)) {
        navigate('projects');
        return;
      }
      const html = await asyncFn();
      const pageContent = document.querySelector('.page-content');
      if (pageContent && html) {
        pageContent.innerHTML = html;
        if (typeof attachEventListeners === 'function') attachEventListeners();
      }
    } catch(e) {
      const pageContent = document.querySelector('.page-content');
      if (pageContent) pageContent.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${e.message}</div>`;
    }
  }, 0);
  return loadingHtml;
}

// Wrapper for settings (it's now sync but needs full assumptions)
async function renderSettingsPage() {
  if (!window._fullAssumptions || window._fullAssumptions.length === 0) {
    await loadFullSettings();
  }
  return renderSettings();
}

// ============ DASHBOARD PAGE ============
function renderDashboardPage() {
  const t = App.t.bind(App);
  const projects = App.projects.filter(p => p.status !== 'archived');
  const totalRevenue = projects.reduce((s, p) => s + (Number(p.recommended_price) || 0), 0);
  const totalProfit = projects.reduce((s, p) => s + (Number(p.gross_profit) || 0), 0);
  const totalCost = projects.reduce((s, p) => s + (Number(p.total_cost) || 0), 0);
  const avgMargin = projects.filter(p => p.gross_margin).length > 0
    ? projects.reduce((s, p) => s + (Number(p.gross_margin) || 0), 0) / projects.filter(p => p.gross_margin).length
    : 0;

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-tachometer-alt"></i></div>
        ${t('لوحة التحكم الرئيسية', 'Main Dashboard')}
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">${t('إجمالي المشاريع', 'Total Projects')}</div>
        <div class="kpi-value large">${projects.length}</div>
        <div class="kpi-sub">${t('مشروع نشط', 'Active Projects')}</div>
        <div class="kpi-icon blue"><i class="fas fa-briefcase"></i></div>
      </div>
      <div class="kpi-card success">
        <div class="kpi-label">${t('إجمالي قيمة المشاريع', 'Total Project Value')}</div>
        <div class="kpi-value large">${App.formatSAR(totalRevenue)}</div>
        <div class="kpi-sub">SAR ${t('قبل الضريبة', 'Before VAT')}</div>
        <div class="kpi-icon gold"><i class="fas fa-coins"></i></div>
      </div>
      <div class="kpi-card info">
        <div class="kpi-label">${t('إجمالي التكاليف', 'Total Costs')}</div>
        <div class="kpi-value large">${App.formatSAR(totalCost)}</div>
        <div class="kpi-sub">SAR</div>
        <div class="kpi-icon orange"><i class="fas fa-file-invoice-dollar"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('إجمالي الربح الإجمالي', 'Total Gross Profit')}</div>
        <div class="kpi-value large">${App.formatSAR(totalProfit)}</div>
        <div class="kpi-sub">SAR</div>
        <div class="kpi-icon green"><i class="fas fa-chart-line"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('متوسط هامش الربح', 'Avg. Gross Margin')}</div>
        <div class="kpi-value large">${App.formatPct(avgMargin)}</div>
        <div class="kpi-sub">${t('عبر جميع المشاريع', 'Across All Projects')}</div>
        <div class="kpi-icon gold"><i class="fas fa-percentage"></i></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-briefcase"></i> ${t('المشاريع الأخيرة', 'Recent Projects')}</div>
          <button class="btn btn-outline btn-sm" onclick="navigate('projects')">
            ${t('عرض الكل', 'View All')} <i class="fas fa-arrow-${App.lang === 'ar' ? 'left' : 'right'}"></i>
          </button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>${t('رقم المشروع', 'Project ID')}</th>
                <th>${t('اسم المشروع', 'Project Name')}</th>
                <th>${t('العميل', 'Client')}</th>
                <th>${t('السعر الموصى به', 'Recommended Price')}</th>
                <th>${t('الهامش', 'Margin')}</th>
                <th>${t('الحالة', 'Status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${projects.slice(0, 6).map(p => `
                <tr>
                  <td><code style="font-size:11px;color:var(--text-muted)">${p.project_id}</code></td>
                  <td><strong>${p.project_name}</strong></td>
                  <td>${p.client_name}</td>
                  <td><strong class="text-accent">${App.formatSAR(p.recommended_price)} <span class="sar">SAR</span></strong></td>
                  <td>${p.gross_margin ? `<span class="badge ${Number(p.gross_margin) >= 20 ? 'badge-success' : 'badge-warning'}">${App.formatPct(p.gross_margin)}</span>` : '-'}</td>
                  <td>${renderStatusBadge(p.status)}</td>
                  <td><button class="btn btn-ghost btn-xs" onclick="openProject('${p.project_id}')"><i class="fas fa-arrow-${App.lang === 'ar' ? 'left' : 'right'}"></i></button></td>
                </tr>
              `).join('') || `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:30px">${t('لا توجد مشاريع', 'No projects yet')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-chart-donut"></i> ${t('توزيع المشاريع', 'Project Distribution')}</div>
          </div>
          <div class="card-body" style="padding:16px">
            <canvas id="chartProjectTypes" height="180"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-bolt"></i> ${t('إجراءات سريعة', 'Quick Actions')}</div>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:8px;padding:16px">
            <button class="btn btn-primary" onclick="showNewProjectModal()">
              <i class="fas fa-plus"></i> ${t('مشروع جديد', 'New Project')}
            </button>
            <button class="btn btn-outline" onclick="navigate('settings')">
              <i class="fas fa-cog"></i> ${t('إعدادات التكاليف', 'Cost Settings')}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderStatusBadge(status) {
  const map = {
    active: ['badge-success', 'نشط', 'Active'],
    draft: ['badge-warning', 'مسودة', 'Draft'],
    archived: ['badge-primary', 'مؤرشف', 'Archived'],
    won: ['badge-success', 'مكتسب', 'Won'],
    lost: ['badge-danger', 'خسرنا', 'Lost'],
    pending: ['badge-info', 'قيد الانتظار', 'Pending'],
  };
  const [cls, ar, en] = map[status] || ['badge-primary', status, status];
  return `<span class="badge ${cls}">${App.lang === 'ar' ? ar : en}</span>`;
}

// ============ PROJECTS PAGE ============
function renderProjectsPage() {
  const t = App.t.bind(App);
  const projectTypes = {
    corporate: t('برامج الشركات', 'Corporate Programs'),
    government: t('مناقصات حكومية', 'Government Tenders'),
    job_readiness: t('التهيئة الوظيفية', 'Job Readiness'),
    certification: t('شهادات مهنية', 'Professional Certification'),
    consulting: t('استشارات', 'Consulting'),
    large_scale: t('عقود كبيرة', 'Large Scale Contracts'),
  };

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-briefcase"></i></div>
        ${t('المشاريع', 'Projects')}
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-outline btn-sm" onclick="loadSampleProject()">
          <i class="fas fa-flask"></i> ${t('تحميل مشروع تجريبي', 'Load Sample')}
        </button>
        <button class="btn btn-accent" onclick="showNewProjectModal()">
          <i class="fas fa-plus"></i> ${t('مشروع جديد', 'New Project')}
        </button>
      </div>
    </div>

    ${App.projects.length === 0 ? `
      <div class="card">
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <h3>${t('لا توجد مشاريع بعد', 'No Projects Yet')}</h3>
          <p>${t('أنشئ مشروعك الأول أو حمّل المشروع التجريبي', 'Create your first project or load the sample project')}</p>
          <div style="display:flex;gap:12px;justify-content:center;margin-top:20px">
            <button class="btn btn-accent" onclick="showNewProjectModal()">
              <i class="fas fa-plus"></i> ${t('مشروع جديد', 'New Project')}
            </button>
            <button class="btn btn-outline" onclick="loadSampleProject()">
              <i class="fas fa-flask"></i> ${t('مشروع تجريبي', 'Sample Project')}
            </button>
          </div>
        </div>
      </div>
    ` : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px">
        ${App.projects.map(p => renderProjectCard(p)).join('')}
      </div>
    `}

    ${renderNewProjectModal()}
  `;
}

function renderProjectCard(p) {
  const t = App.t.bind(App);
  const typeMap = {
    corporate: t('برامج الشركات', 'Corporate'),
    government: t('حكومي', 'Government'),
    job_readiness: t('تهيئة وظيفية', 'Job Readiness'),
    certification: t('شهادات مهنية', 'Certification'),
    consulting: t('استشارات', 'Consulting'),
    large_scale: t('عقود كبيرة', 'Large Scale'),
  };
  const deliveryMap = {
    in_person: ['fa-map-marker-alt', t('حضوري', 'In-Person')],
    virtual: ['fa-laptop', t('افتراضي', 'Virtual')],
    hybrid: ['fa-code-branch', t('هجين', 'Hybrid')],
  };
  const [delivIcon, delivLabel] = deliveryMap[p.delivery_mode] || ['fa-question', '-'];

  return `
    <div class="project-card" onclick="openProject('${p.project_id}')">
      <div class="pc-header">
        <div>
          <div class="pc-id">${p.project_id}</div>
          <div class="pc-name">${p.project_name}</div>
          <div class="pc-client"><i class="fas fa-building" style="font-size:10px;color:var(--text-muted)"></i> ${p.client_name}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
          ${renderStatusBadge(p.status)}
          ${p.contract_type === 'tender' ? `<span class="badge badge-warning"><i class="fas fa-gavel"></i> ${t('مناقصة', 'Tender')}</span>` : ''}
        </div>
      </div>
      <div class="pc-meta">
        <span class="pc-tag"><i class="fas fa-users"></i> ${p.num_participants || 0} ${t('متدرب', 'Trainees')}</span>
        <span class="pc-tag"><i class="fas fa-calendar-day"></i> ${p.num_training_days || 0} ${t('يوم', 'Days')}</span>
        <span class="pc-tag"><i class="fas ${delivIcon}"></i> ${delivLabel}</span>
        ${p.city ? `<span class="pc-tag"><i class="fas fa-map-pin"></i> ${p.city}</span>` : ''}
      </div>
      <div class="pc-financials">
        <div class="pc-fin-item">
          <div class="label">${t('السعر الموصى به', 'Rec. Price')}</div>
          <div class="value text-accent">${p.recommended_price ? App.formatSAR(p.recommended_price) : '-'}</div>
        </div>
        <div class="pc-fin-item">
          <div class="label">${t('هامش الربح', 'Margin')}</div>
          <div class="value ${p.gross_margin >= 20 ? 'text-success' : 'text-warning'}">${p.gross_margin ? App.formatPct(p.gross_margin) : '-'}</div>
        </div>
        <div class="pc-fin-item">
          <div class="label">${t('الربح الإجمالي', 'Gross Profit')}</div>
          <div class="value">${p.gross_profit ? App.formatSAR(p.gross_profit) : '-'}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:12px;justify-content:flex-end" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-xs" title="${t('تعديل', 'Edit')}" onclick="showEditProjectModal('${p.project_id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-ghost btn-xs" title="${t('نسخ', 'Duplicate')}" onclick="duplicateProject('${p.project_id}')"><i class="fas fa-copy"></i></button>
        <button class="btn btn-ghost btn-xs" title="${t('أرشفة', 'Archive')}" onclick="archiveProject('${p.project_id}')"><i class="fas fa-archive"></i></button>
        <button class="btn btn-ghost btn-xs" title="${t('حذف', 'Delete')}" onclick="deleteProject('${p.project_id}')" style="color:var(--danger-light)"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `;
}

// ============ NEW PROJECT MODAL ============
function renderNewProjectModal() {
  const t = App.t.bind(App);
  return `
    <div class="modal-overlay" id="modalNewProject" style="display:none">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title"><i class="fas fa-plus-circle"></i> ${t('مشروع جديد', 'New Project')}</div>
          <button class="btn btn-ghost btn-sm" onclick="closeModal('modalNewProject')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-grid form-grid-2" style="gap:14px">
            <div class="form-group">
              <label>${t('اسم العميل *', 'Client Name *')}</label>
              <input type="text" id="np_client" placeholder="${t('مثال: أرامكو السعودية', 'e.g. Saudi Aramco')}" required>
            </div>
            <div class="form-group">
              <label>${t('اسم المشروع *', 'Project Name *')}</label>
              <input type="text" id="np_name" placeholder="${t('مثال: برنامج القيادة التنفيذية', 'e.g. Executive Leadership Program')}" required>
            </div>
            <div class="form-group">
              <label>${t('نوع المشروع', 'Project Type')}</label>
              <select id="np_type">
                <option value="corporate">${t('برامج الشركات', 'Corporate Programs')}</option>
                <option value="government">${t('مناقصات حكومية', 'Government Tenders')}</option>
                <option value="job_readiness">${t('التهيئة الوظيفية', 'Job Readiness')}</option>
                <option value="certification">${t('شهادات مهنية', 'Professional Certification')}</option>
                <option value="consulting">${t('استشارات', 'Consulting')}</option>
                <option value="large_scale">${t('عقود كبيرة', 'Large Scale Contracts')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${t('نوع العقد', 'Contract Type')}</label>
              <select id="np_contract">
                <option value="direct">${t('عقد مباشر', 'Direct Contract')}</option>
                <option value="tender">${t('مناقصة', 'Tender')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${t('المدينة', 'City')}</label>
              <input type="text" id="np_city" placeholder="${t('الرياض', 'Riyadh')}">
            </div>
            <div class="form-group">
              <label>${t('طريقة التقديم', 'Delivery Mode')}</label>
              <select id="np_delivery">
                <option value="in_person">${t('حضوري', 'In-Person')}</option>
                <option value="virtual">${t('افتراضي', 'Virtual')}</option>
                <option value="hybrid">${t('هجين', 'Hybrid')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${t('تاريخ البدء', 'Start Date')}</label>
              <input type="date" id="np_start">
            </div>
            <div class="form-group">
              <label>${t('تاريخ الانتهاء', 'End Date')}</label>
              <input type="date" id="np_end">
            </div>
            <div class="form-group">
              <label>${t('عدد البرامج', 'No. of Programs')}</label>
              <input type="number" id="np_programs" value="1" min="1">
            </div>
            <div class="form-group">
              <label>${t('عدد الدفعات', 'No. of Cohorts')}</label>
              <input type="number" id="np_cohorts" value="1" min="1">
            </div>
            <div class="form-group">
              <label>${t('عدد المتدربين', 'No. of Participants')}</label>
              <input type="number" id="np_participants" value="20" min="1">
            </div>
            <div class="form-group">
              <label>${t('عدد أيام التدريب', 'No. of Training Days')}</label>
              <input type="number" id="np_days" value="5" min="1">
            </div>
            <div class="form-group">
              <label>${t('ساعات التدريب اليومية', 'Hours per Day')}</label>
              <input type="number" id="np_hours" value="8" min="1" max="12">
            </div>
            <div class="form-group">
              <label>${t('نوع المدرب', 'Trainer Type')}</label>
              <select id="np_trainer_type">
                <option value="general">${t('مدرب عام', 'General')}</option>
                <option value="specialized">${t('مدرب متخصص', 'Specialized')}</option>
                <option value="leadership">${t('مدرب قيادة', 'Leadership')}</option>
              </select>
            </div>
            <div class="form-group" style="grid-column:span 2">
              <label>${t('ملاحظات', 'Notes')}</label>
              <textarea id="np_notes" rows="2" placeholder="${t('أي ملاحظات إضافية...', 'Any additional notes...')}"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeModal('modalNewProject')">${t('إلغاء', 'Cancel')}</button>
          <button class="btn btn-accent" onclick="createProject()">
            <i class="fas fa-plus"></i> ${t('إنشاء المشروع', 'Create Project')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function showNewProjectModal() {
  if (!document.getElementById('modalNewProject')) {
    document.getElementById('modalContainer').innerHTML = renderNewProjectModal();
  }
  openModal('modalNewProject');
}

async function createProject() {
  const t = App.t.bind(App);
  const client = document.getElementById('np_client')?.value?.trim();
  const name = document.getElementById('np_name')?.value?.trim();
  if (!client || !name) { showToast(t('يرجى إدخال اسم العميل واسم المشروع', 'Please enter client name and project name'), 'error'); return; }

  const btn = document.querySelector('#modalNewProject .btn-accent');
  await withLoading(btn, async () => {
    try {
      const data = {
        client_name: client,
        project_name: name,
        project_type: document.getElementById('np_type').value,
        contract_type: document.getElementById('np_contract').value,
        city: document.getElementById('np_city').value,
        delivery_mode: document.getElementById('np_delivery').value,
        start_date: document.getElementById('np_start').value || null,
        end_date: document.getElementById('np_end').value || null,
        num_programs: parseInt(document.getElementById('np_programs').value) || 1,
        num_cohorts: parseInt(document.getElementById('np_cohorts').value) || 1,
        num_participants: parseInt(document.getElementById('np_participants').value) || 20,
        num_training_days: parseInt(document.getElementById('np_days').value) || 5,
        hours_per_day: parseFloat(document.getElementById('np_hours').value) || 8,
        trainer_type: document.getElementById('np_trainer_type').value,
        notes: document.getElementById('np_notes').value,
        status: 'active'
      };
      const project = await API.post('/projects', data);
      App.projects.unshift(project);
      App.currentProject = project;
      closeModal('modalNewProject');
      showToast(t('تم إنشاء المشروع بنجاح', 'Project created successfully'));
      navigate('cost-builder');
    } catch (e) { showToast(e.message, 'error'); }
  });
}

async function openProject(projectId) {
  try {
    const project = await API.get(`/projects/${projectId}`);
    // Clear all project-specific cache when switching projects
    if (!App.currentProject || App.currentProject.project_id !== projectId) {
      window._boqItems = null;
      window._milestones = null;
      window._projectOverrides = null;
      window._scenarios = null;
      window._sensitivityParams = null;
      window._customMargins = null;
    }
    App.currentProject = project;
    // Update in list
    const idx = App.projects.findIndex(p => p.project_id === projectId);
    if (idx >= 0) App.projects[idx] = project;
    // Auto-load overrides
    try {
      const overrides = await API.get(`/projects/${projectId}/overrides`);
      window._projectOverrides = overrides;
    } catch(e) { window._projectOverrides = {}; }
    navigate('project-overview');
  } catch (e) { showToast(e.message, 'error'); }
}

async function duplicateProject(projectId) {
  const t = App.t.bind(App);
  try {
    const newProject = await API.post(`/projects/${projectId}/duplicate`, {});
    App.projects.unshift(newProject);
    showToast(t('تم نسخ المشروع بنجاح', 'Project duplicated successfully'));
    renderApp();
  } catch (e) { showToast(e.message, 'error'); }
}

async function archiveProject(projectId) {
  const t = App.t.bind(App);
  if (!confirm(t('هل تريد أرشفة هذا المشروع؟', 'Archive this project?'))) return;
  try {
    const p = App.projects.find(p => p.project_id === projectId);
    if (p) {
      await API.put(`/projects/${projectId}`, { ...p, status: 'archived' });
      p.status = 'archived';
      showToast(t('تم أرشفة المشروع', 'Project archived'));
      renderApp();
    }
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteProject(projectId) {
  const t = App.t.bind(App);
  if (!confirm(t('هل تريد حذف هذا المشروع نهائياً؟', 'Delete this project permanently?'))) return;
  try {
    await API.delete(`/projects/${projectId}`);
    App.projects = App.projects.filter(p => p.project_id !== projectId);
    if (App.currentProject?.project_id === projectId) App.currentProject = null;
    showToast(t('تم حذف المشروع', 'Project deleted'));
    renderApp();
  } catch (e) { showToast(e.message, 'error'); }
}

// ============ PROJECT OVERVIEW ============
function renderProjectOverview() {
  const t = App.t.bind(App);
  const p = App.currentProject;
  const assumptions = App.costAssumptions;
  const calc = Calc.calcFull(p, assumptions);

  const typeLabels = {
    corporate: t('برامج الشركات', 'Corporate Programs'),
    government: t('مناقصات حكومية', 'Government Tenders'),
    job_readiness: t('التهيئة الوظيفية', 'Job Readiness'),
    certification: t('شهادات مهنية', 'Professional Certification'),
    consulting: t('استشارات', 'Consulting'),
    large_scale: t('عقود كبيرة', 'Large Scale Contracts'),
  };

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-info-circle"></i></div>
        ${t('نظرة عامة', 'Project Overview')}
        ${p.notes ? '<span class="sample-badge">'+t('بيانات تجريبية', 'SAMPLE DATA')+'</span>' : ''}
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">${t('إجمالي التكاليف', 'Total Cost')}</div>
        <div class="kpi-value">${App.formatSAR(calc.totalCost)} <span class="sar">SAR</span></div>
        <div class="kpi-icon orange"><i class="fas fa-receipt"></i></div>
      </div>
      <div class="kpi-card success">
        <div class="kpi-label">${t('السعر الموصى به', 'Recommended Price')}</div>
        <div class="kpi-value">${App.formatSAR(calc.scenarios.recommended.sellingPriceBeforeVat)} <span class="sar">SAR</span></div>
        <div class="kpi-icon gold"><i class="fas fa-tag"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('هامش الربح الإجمالي', 'Gross Margin')}</div>
        <div class="kpi-value">${App.formatPct(calc.scenarios.recommended.grossMargin)}</div>
        <div class="kpi-icon green"><i class="fas fa-percentage"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('التكلفة لكل متدرب', 'Cost/Participant')}</div>
        <div class="kpi-value">${App.formatSAR(calc.costPerParticipant)} <span class="sar">SAR</span></div>
        <div class="kpi-icon blue"><i class="fas fa-user"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('التكلفة لكل يوم تدريب', 'Cost/Training Day')}</div>
        <div class="kpi-value">${App.formatSAR(calc.costPerTrainingDay)} <span class="sar">SAR</span></div>
        <div class="kpi-icon blue"><i class="fas fa-calendar-day"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('سعر التعادل', 'Break-Even Price')}</div>
        <div class="kpi-value">${App.formatSAR(calc.breakEven.breakEvenPrice)} <span class="sar">SAR</span></div>
        <div class="kpi-icon red"><i class="fas fa-balance-scale"></i></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-info"></i> ${t('بيانات المشروع', 'Project Details')}</div>
          <button class="btn btn-outline btn-sm" onclick="showEditProjectModal('${p.project_id}')">
            <i class="fas fa-edit"></i> ${t('تعديل', 'Edit')}
          </button>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${[
              [t('رقم المشروع', 'Project ID'), p.project_id],
              [t('اسم العميل', 'Client'), p.client_name],
              [t('نوع المشروع', 'Type'), typeLabels[p.project_type] || p.project_type],
              [t('نوع العقد', 'Contract'), p.contract_type === 'tender' ? t('مناقصة', 'Tender') : t('مباشر', 'Direct')],
              [t('المدينة', 'City'), p.city || '-'],
              [t('طريقة التقديم', 'Delivery'), p.delivery_mode === 'in_person' ? t('حضوري', 'In-Person') : p.delivery_mode === 'virtual' ? t('افتراضي', 'Virtual') : t('هجين', 'Hybrid')],
              [t('تاريخ البدء', 'Start Date'), p.start_date || '-'],
              [t('تاريخ الانتهاء', 'End Date'), p.end_date || '-'],
            ].map(([l, v]) => `<div><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">${l}</div><div style="font-weight:600;font-size:13.5px">${v}</div></div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-sliders-h"></i> ${t('مؤشرات التدريب', 'Training Parameters')}</div>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${[
              [t('عدد البرامج', 'Programs'), p.num_programs],
              [t('عدد الدفعات', 'Cohorts'), p.num_cohorts],
              [t('عدد المتدربين', 'Participants'), p.num_participants],
              [t('أيام التدريب', 'Training Days'), p.num_training_days],
              [t('ساعات اليومية', 'Hours/Day'), p.hours_per_day],
              [t('إجمالي ساعات التدريب', 'Total Hours'), (p.num_training_days * p.hours_per_day).toFixed(0)],
            ].map(([l, v]) => `<div><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">${l}</div><div style="font-weight:700;font-size:16px;color:var(--primary)">${v}</div></div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    ${p.notes ? `
      <div class="alert alert-info mt-16">
        <i class="fas fa-info-circle"></i>
        <div><strong>${t('ملاحظة:', 'Note:')}</strong> ${p.notes}</div>
      </div>
    ` : ''}

    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="navigate('cost-builder')"><i class="fas fa-calculator"></i> ${t('بناء التكاليف', 'Cost Build-Up')}</button>
      <button class="btn btn-accent" onclick="navigate('pricing')"><i class="fas fa-tags"></i> ${t('محرك التسعير', 'Pricing Engine')}</button>
      <button class="btn btn-outline" onclick="navigate('exec-dashboard')"><i class="fas fa-chart-pie"></i> ${t('لوحة التنفيذيين', 'Exec Dashboard')}</button>
    </div>
  `;
}

async function showEditProjectModal(projectId) {
  const t = App.t.bind(App);
  const p = App.projects.find(pr => pr.project_id === projectId);
  if (!p) return;
  const modalContainer = document.getElementById('modalContainer');
  modalContainer.innerHTML = `
    <div class="modal-overlay" id="modalEditProject" style="display:flex">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="modal-title"><i class="fas fa-edit"></i> ${t('تعديل المشروع', 'Edit Project')}: ${p.project_id}</div>
          <button class="btn btn-ghost btn-sm" onclick="closeModal('modalEditProject')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-grid form-grid-2" style="gap:14px">
            <div class="form-group">
              <label>${t('اسم العميل', 'Client Name')}</label>
              <input type="text" id="ep_client" value="${p.client_name}">
            </div>
            <div class="form-group">
              <label>${t('اسم المشروع', 'Project Name')}</label>
              <input type="text" id="ep_name" value="${p.project_name}">
            </div>
            <div class="form-group">
              <label>${t('نوع المشروع', 'Project Type')}</label>
              <select id="ep_type">
                ${[
                  ['corporate', t('برامج الشركات', 'Corporate Programs')],
                  ['government', t('مناقصات حكومية', 'Government Tenders')],
                  ['job_readiness', t('التهيئة الوظيفية', 'Job Readiness')],
                  ['certification', t('شهادات مهنية', 'Professional Certification')],
                  ['consulting', t('استشارات', 'Consulting')],
                  ['large_scale', t('عقود كبيرة', 'Large Scale Contracts')],
                ].map(([v, label]) => `<option value="${v}" ${p.project_type===v?'selected':''}>${label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>${t('نوع العقد', 'Contract Type')}</label>
              <select id="ep_contract">
                <option value="direct" ${p.contract_type==='direct'?'selected':''}>${t('مباشر', 'Direct')}</option>
                <option value="tender" ${p.contract_type==='tender'?'selected':''}>${t('مناقصة', 'Tender')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${t('المدينة', 'City')}</label>
              <input type="text" id="ep_city" value="${p.city || ''}">
            </div>
            <div class="form-group">
              <label>${t('طريقة التقديم', 'Delivery Mode')}</label>
              <select id="ep_delivery">
                <option value="in_person" ${p.delivery_mode==='in_person'?'selected':''}>${t('حضوري', 'In-Person')}</option>
                <option value="virtual" ${p.delivery_mode==='virtual'?'selected':''}>${t('افتراضي', 'Virtual')}</option>
                <option value="hybrid" ${p.delivery_mode==='hybrid'?'selected':''}>${t('هجين', 'Hybrid')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${t('تاريخ البدء', 'Start Date')}</label>
              <input type="date" id="ep_start" value="${p.start_date || ''}">
            </div>
            <div class="form-group">
              <label>${t('تاريخ الانتهاء', 'End Date')}</label>
              <input type="date" id="ep_end" value="${p.end_date || ''}">
            </div>
            <div class="form-group">
              <label>${t('عدد البرامج', 'Programs')}</label>
              <input type="number" id="ep_programs" value="${p.num_programs}" min="1">
            </div>
            <div class="form-group">
              <label>${t('عدد الدفعات', 'Cohorts')}</label>
              <input type="number" id="ep_cohorts" value="${p.num_cohorts}" min="1">
            </div>
            <div class="form-group">
              <label>${t('عدد المتدربين', 'Participants')}</label>
              <input type="number" id="ep_participants" value="${p.num_participants}" min="1">
            </div>
            <div class="form-group">
              <label>${t('أيام التدريب', 'Training Days')}</label>
              <input type="number" id="ep_days" value="${p.num_training_days}" min="1">
            </div>
            <div class="form-group">
              <label>${t('ساعات اليومية', 'Hours/Day')}</label>
              <input type="number" id="ep_hours" value="${p.hours_per_day}" min="1" max="12">
            </div>
            <div class="form-group">
              <label>${t('نوع المدرب', 'Trainer Type')}</label>
              <select id="ep_trainer_type">
                <option value="general" ${(p.trainer_type||'general')==='general'?'selected':''}>${t('عام', 'General')}</option>
                <option value="specialized" ${p.trainer_type==='specialized'?'selected':''}>${t('متخصص', 'Specialized')}</option>
                <option value="leadership" ${p.trainer_type==='leadership'?'selected':''}>${t('قيادة', 'Leadership')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${t('الحالة', 'Status')}</label>
              <select id="ep_status">
                ${[
                  ['active', t('نشط', 'Active')],
                  ['draft', t('مسودة', 'Draft')],
                  ['pending', t('قيد الانتظار', 'Pending')],
                  ['won', t('مكتسب', 'Won')],
                  ['lost', t('خسرنا', 'Lost')],
                  ['archived', t('مؤرشف', 'Archived')],
                ].map(([v, label]) => `<option value="${v}" ${p.status===v?'selected':''}>${label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="grid-column:span 2">
              <label>${t('ملاحظات', 'Notes')}</label>
              <textarea id="ep_notes" rows="2">${p.notes || ''}</textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeModal('modalEditProject')">${t('إلغاء', 'Cancel')}</button>
          <button class="btn btn-accent" onclick="saveEditProject('${projectId}')">
            <i class="fas fa-save"></i> ${t('حفظ التغييرات', 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  `;
}

async function saveEditProject(projectId) {
  const t = App.t.bind(App);
  const btn = document.querySelector('#modalEditProject .btn-accent');
  await withLoading(btn, async () => {
    try {
      const p = App.projects.find(pr => pr.project_id === projectId);
      const updated = {
        ...p,
        client_name: document.getElementById('ep_client').value,
        project_name: document.getElementById('ep_name').value,
        project_type: document.getElementById('ep_type').value,
        contract_type: document.getElementById('ep_contract').value,
        city: document.getElementById('ep_city').value,
        delivery_mode: document.getElementById('ep_delivery').value,
        start_date: document.getElementById('ep_start').value || null,
        end_date: document.getElementById('ep_end').value || null,
        num_programs: parseInt(document.getElementById('ep_programs').value) || 1,
        num_cohorts: parseInt(document.getElementById('ep_cohorts').value) || 1,
        num_participants: parseInt(document.getElementById('ep_participants').value) || 1,
        num_training_days: parseInt(document.getElementById('ep_days').value) || 1,
        hours_per_day: parseFloat(document.getElementById('ep_hours').value) || 8,
        trainer_type: document.getElementById('ep_trainer_type')?.value || p.trainer_type || 'general',
        status: document.getElementById('ep_status').value,
        notes: document.getElementById('ep_notes').value,
      };
      const saved = await API.put(`/projects/${projectId}`, updated);
      const idx = App.projects.findIndex(pr => pr.project_id === projectId);
      if (idx >= 0) App.projects[idx] = saved;
      if (App.currentProject?.project_id === projectId) App.currentProject = saved;
      // Clear caches so recalculations use new project params
      window._projectOverrides = null;
      window._scenarios = null;
      window._customMargins = null;
      closeModal('modalEditProject');
      showToast(t('تم حفظ التغييرات', 'Changes saved'));
      renderApp();
    } catch (e) { showToast(e.message, 'error'); }
  });
}

// ============ CHART RENDERING ============
function renderCharts() {
  // Destroy existing charts
  Object.values(App.charts).forEach(c => { try { c.destroy(); } catch(e){} });
  App.charts = {};

  // Dashboard - Project Types Chart
  const ctx = document.getElementById('chartProjectTypes');
  if (ctx) {
    const types = {};
    App.projects.forEach(p => {
      types[p.project_type] = (types[p.project_type] || 0) + 1;
    });
    const typeLabels = {
      corporate: 'شركات', government: 'حكومي', job_readiness: 'توظيف',
      certification: 'شهادات', consulting: 'استشارات', large_scale: 'عقود كبيرة'
    };
    App.charts.projectTypes = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(types).map(k => typeLabels[k] || k),
        datasets: [{ data: Object.values(types), backgroundColor: ['#1a2e4a','#c8973a','#3b82f6','#10b981','#7c3aed','#ef4444'], borderWidth: 0 }]
      },
      options: { plugins: { legend: { position: 'bottom', labels: { font: { family: 'Tajawal', size: 11 }, padding: 10 } } }, cutout: '65%' }
    });
  }
}

// ============ INIT ============
async function initApp() {
  try {
    // Load global settings and cost assumptions
    const [costs, settings] = await Promise.all([
      API.get('/costs').catch(() => []),
      API.get('/settings').catch(() => ({}))
    ]);

    App.settings = settings || {};
    App.costAssumptions = {};
    (costs || []).forEach(c => { App.costAssumptions[c.key] = c.value; });

    // Load projects
    App.projects = await API.get('/projects').catch(() => []);

    renderApp();
  } catch (e) {
    console.error('Init error:', e);
    document.getElementById('app').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;font-family:Tajawal,sans-serif">
        <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#f59e0b"></i>
        <h2 style="color:#1a2e4a">جاري تحميل قاعدة البيانات...</h2>
        <p style="color:#8898aa;text-align:center">يرجى الانتظار لحظة أو إعادة تحميل الصفحة</p>
        <button onclick="location.reload()" style="padding:10px 24px;background:#1a2e4a;color:white;border:none;border-radius:8px;cursor:pointer;font-family:Tajawal">إعادة تحميل</button>
      </div>
    `;
  }
}

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', initApp);
