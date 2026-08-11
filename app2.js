/* ============================================================
   Training Proposal & Pricing Engine
   Main Application - Part 2
   Cost Builder, Pricing Engine, Break-Even, Sensitivity
   ============================================================ */

// ============ SETTINGS PAGE ============
function renderSettings() {
  const t = App.t.bind(App);
  const cats = {
    trainers: { icon: 'fa-user-tie', label: t('معدلات المدربين', 'Trainer Rates') },
    staff: { icon: 'fa-users', label: t('الموظفون', 'Staff') },
    materials: { icon: 'fa-book', label: t('مواد التدريب', 'Training Materials') },
    venue: { icon: 'fa-building', label: t('القاعة والضيافة', 'Venue & Catering') },
    travel: { icon: 'fa-plane', label: t('السفر والإقامة', 'Travel & Accommodation') },
    technology: { icon: 'fa-laptop', label: t('التكنولوجيا', 'Technology') },
    other: { icon: 'fa-ellipsis-h', label: t('تكاليف أخرى', 'Other Costs') },
    overhead: { icon: 'fa-cogs', label: t('التكاليف العامة والنسب', 'Overhead & Percentages') },
  };

  const grouped = {};
  // Build from API data if available, otherwise use assumptions object
  Object.entries(App.costAssumptions).forEach(([key, value]) => {
    // We need the full assumption object - re-fetch from state
  });

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-cog"></i></div>
        ${t('الإعدادات العامة للتكاليف', 'Global Cost Settings')}
      </div>
      <button class="btn btn-accent" onclick="saveAllSettings()">
        <i class="fas fa-save"></i> ${t('حفظ الإعدادات', 'Save Settings')}
      </button>
    </div>

    <div class="alert alert-info">
      <i class="fas fa-info-circle"></i>
      <div>${t('هذه القيم الافتراضية العالمية تُستخدم في جميع المشاريع الجديدة. يمكن تجاوزها لكل مشروع على حدة.', 
        'These are global default values used in all new projects. They can be overridden per project.')}</div>
    </div>

    <div id="settingsGrid" style="display:grid;gap:20px">
      ${renderSettingsCategorized()}
    </div>
  `;
}

function renderSettingsCategorized() {
  const t = App.t.bind(App);
  const fullAssumptions = window._fullAssumptions || [];

  const cats = {
    trainers: { icon: 'fa-user-tie', label: t('معدلات المدربين اليومية', 'Trainer Day Rates') },
    staff: { icon: 'fa-users', label: t('الموظفون والإدارة', 'Staff & Management') },
    materials: { icon: 'fa-book', label: t('مواد التدريب والطباعة', 'Training Materials & Printing') },
    venue: { icon: 'fa-building', label: t('القاعة والضيافة', 'Venue & Catering') },
    travel: { icon: 'fa-plane', label: t('السفر والإقامة والمواصلات', 'Travel & Accommodation') },
    technology: { icon: 'fa-laptop', label: t('التكنولوجيا ونظام التعلم', 'Technology & LMS') },
    other: { icon: 'fa-ellipsis-h', label: t('تكاليف مباشرة أخرى', 'Other Direct Costs') },
    overhead: { icon: 'fa-percentage', label: t('النسب والتكاليف العامة', 'Overhead & Key Percentages') },
  };

  const grouped = {};
  fullAssumptions.forEach(a => {
    if (!grouped[a.category]) grouped[a.category] = [];
    grouped[a.category].push(a);
  });

  return Object.entries(cats).map(([cat, { icon, label }]) => {
    const items = grouped[cat] || [];
    if (items.length === 0) return '';
    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas ${icon}"></i> ${label}</div>
        </div>
        <div class="card-body">
          <div class="form-grid form-grid-3" style="gap:14px">
            ${items.map(item => `
              <div class="form-group">
                <label>${App.lang === 'ar' ? item.label_ar : item.label_en}</label>
                <div class="input-group">
                  <input type="number" id="setting_${item.key}" value="${item.value}" step="0.01" min="0"
                    onchange="updateSetting('${item.key}', this.value)">
                  <span class="input-addon">${item.unit || 'SAR'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function updateSetting(key, value) {
  // Update local assumptions immediately for live calculations
  App.costAssumptions[key] = parseFloat(value) || 0;
}

async function saveAllSettings() {
  const t = App.t.bind(App);
  const btn = document.querySelector('[onclick="saveAllSettings()"]');
  const restore = btn ? setButtonLoading(btn, t('جاري الحفظ...', 'Saving...')) : () => {};
  try {
    const updates = {};
    const fullAssumptions = window._fullAssumptions || [];
    fullAssumptions.forEach(item => {
      const el = document.getElementById(`setting_${item.key}`);
      if (el) updates[item.key] = parseFloat(el.value) || 0;
    });
    await API.post('/costs/bulk', updates);
    // Refresh assumptions
    Object.assign(App.costAssumptions, updates);
    // Also refresh window._fullAssumptions values for display
    (window._fullAssumptions || []).forEach(item => {
      if (updates[item.key] !== undefined) item.value = updates[item.key];
    });
    showToast(t('تم حفظ الإعدادات بنجاح', 'Settings saved successfully'));
  } catch(e) { showToast(e.message, 'error'); }
  finally { restore(); }
}
}

// ============ COST BUILDER PAGE ============
function renderCostBuilder() {
  const t = App.t.bind(App);
  const p = App.currentProject;
  const assumptions = App.costAssumptions;
  const overrides = window._projectOverrides || {};
  const calc = Calc.calcFull(p, assumptions, overrides);

  const costItems = [
    { key: 'trainers', label_ar: 'المدربون', label_en: 'Trainers', icon: 'fa-user-tie', value: calc.direct.trainers, cat: 'direct' },
    { key: 'coordinators', label_ar: 'المنسقون', label_en: 'Coordinators', icon: 'fa-user-check', value: calc.direct.coordinators, cat: 'direct' },
    { key: 'projectManagement', label_ar: 'إدارة المشروع', label_en: 'Project Management', icon: 'fa-project-diagram', value: calc.direct.projectManagement, cat: 'direct' },
    { key: 'venue', label_ar: 'القاعة/الفندق', label_en: 'Venue/Hotel', icon: 'fa-building', value: calc.direct.venue, cat: 'direct' },
    { key: 'catering', label_ar: 'الضيافة (استراحات)', label_en: 'Catering (Breaks)', icon: 'fa-coffee', value: calc.direct.catering, cat: 'direct' },
    { key: 'printing', label_ar: 'الطباعة والمواد', label_en: 'Printing & Materials', icon: 'fa-print', value: calc.direct.printing, cat: 'direct' },
    { key: 'stationery', label_ar: 'القرطاسية', label_en: 'Stationery', icon: 'fa-pen', value: calc.direct.stationery, cat: 'direct' },
    { key: 'certificates', label_ar: 'الشهادات', label_en: 'Certificates', icon: 'fa-certificate', value: calc.direct.certificates, cat: 'direct' },
    { key: 'assessments', label_ar: 'التقييم', label_en: 'Assessments', icon: 'fa-tasks', value: calc.direct.assessments, cat: 'direct' },
    { key: 'lmsTechnology', label_ar: 'نظام التعلم والتكنولوجيا', label_en: 'LMS & Technology', icon: 'fa-laptop', value: calc.direct.lmsTechnology, cat: 'direct' },
    { key: 'travel', label_ar: 'السفر (إجمالي)', label_en: 'Travel (Total)', icon: 'fa-plane', value: calc.direct.travel, cat: 'direct',
      sub: [
        { label_ar: 'الإقامة', label_en: 'Accommodation', value: calc.direct.accommodation },
        { label_ar: 'الطيران', label_en: 'Flights', value: calc.direct.flights },
        { label_ar: 'المواصلات', label_en: 'Transportation', value: calc.direct.transportation }
      ]
    },
    { key: 'equipment', label_ar: 'المعدات', label_en: 'Equipment', icon: 'fa-tools', value: calc.direct.equipment, cat: 'direct' },
    { key: 'consultants', label_ar: 'الاستشاريون الخارجيون', label_en: 'External Consultants', icon: 'fa-user-graduate', value: calc.direct.consultants, cat: 'direct' },
    { key: 'marketing', label_ar: 'التسويق', label_en: 'Marketing', icon: 'fa-bullhorn', value: calc.direct.marketing, cat: 'direct' },
    { key: 'photographer', label_ar: 'التصوير', label_en: 'Photography', icon: 'fa-camera', value: calc.direct.photographer, cat: 'direct' },
    { key: 'permits', label_ar: 'التصاريح', label_en: 'Permits', icon: 'fa-file-contract', value: calc.direct.permits, cat: 'direct' },
    { key: 'otherDirect', label_ar: 'تكاليف مباشرة أخرى', label_en: 'Other Direct Costs', icon: 'fa-plus-circle', value: calc.direct.otherDirect, cat: 'direct' },
  ];

  const overrideKeys = {
    trainers: 'trainer_general_day_rate',
    venue: 'hotel_venue_cost_per_person_per_day',
    catering: 'coffee_break_cost_per_person_per_day',
    printing: 'printing_cost_per_trainee',
    certificates: 'certificates_cost',
    assessments: 'assessment_cost',
    equipment: 'equipment_cost',
    consultants: 'external_consultants_cost',
    marketing: 'marketing_cost',
    otherDirect: 'other_direct_costs',
    projectManagement: 'project_manager_cost',
    coordinators: 'coordinator_day_rate',
  };

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-calculator"></i></div>
        ${t('بناء التكاليف', 'Cost Build-Up')}
      </div>
      <button class="btn btn-accent" onclick="saveProjectOverrides()">
        <i class="fas fa-save"></i> ${t('حفظ التجاوزات', 'Save Overrides')}
      </button>
    </div>

    <div class="alert alert-info">
      <i class="fas fa-info-circle"></i>
      <div>${t('التكاليف محسوبة تلقائياً بناءً على معاملات المشروع والمعدلات الافتراضية. يمكنك تجاوز أي معدل لهذا المشروع فقط دون تغيير الإعدادات العامة.',
        'Costs are auto-calculated based on project parameters and default rates. You can override any rate for this project only without changing global settings.')}</div>
    </div>

    <!-- Project Summary -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">${t('إجمالي التكاليف المباشرة', 'Total Direct Costs')}</div>
        <div class="kpi-value">${App.formatSAR(calc.direct.total)} <span class="sar">SAR</span></div>
        <div class="kpi-icon orange"><i class="fas fa-list"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('إجمالي التكاليف غير المباشرة', 'Total Indirect Costs')}</div>
        <div class="kpi-value">${App.formatSAR(calc.indirect.total)} <span class="sar">SAR</span></div>
        <div class="kpi-icon blue"><i class="fas fa-cogs"></i></div>
      </div>
      <div class="kpi-card success">
        <div class="kpi-label">${t('إجمالي تكلفة المشروع', 'Total Project Cost')}</div>
        <div class="kpi-value">${App.formatSAR(calc.totalCost)} <span class="sar">SAR</span></div>
        <div class="kpi-icon gold"><i class="fas fa-coins"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('التكلفة لكل متدرب', 'Cost per Participant')}</div>
        <div class="kpi-value">${App.formatSAR(calc.costPerParticipant)} <span class="sar">SAR</span></div>
        <div class="kpi-icon blue"><i class="fas fa-user"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('التكلفة لكل برنامج', 'Cost per Program')}</div>
        <div class="kpi-value">${App.formatSAR(calc.costPerProgram)} <span class="sar">SAR</span></div>
        <div class="kpi-icon blue"><i class="fas fa-book"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('التكلفة لكل يوم تدريب', 'Cost per Training Day')}</div>
        <div class="kpi-value">${App.formatSAR(calc.costPerTrainingDay)} <span class="sar">SAR</span></div>
        <div class="kpi-icon blue"><i class="fas fa-calendar-day"></i></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
      <!-- Direct Costs Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-list-alt"></i> ${t('أ. التكاليف المباشرة', 'A. Direct Costs')}</div>
          <span class="badge badge-gold">${App.formatSAR(calc.direct.total)} SAR</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>${t('البند', 'Item')}</th>
              <th>${t('التكلفة المحسوبة', 'Calculated Cost')}</th>
              <th>${t('تجاوز المعدل', 'Override Rate')}</th>
              <th>${t('النسبة', 'Share')}</th>
            </tr></thead>
            <tbody>
              ${costItems.map(item => {
                const pct = calc.direct.total > 0 ? (item.value / calc.direct.total * 100) : 0;
                const overrideKey = overrideKeys[item.key];
                const hasOverride = overrideKey && overrides[overrideKey] !== undefined;
                return `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:7px">
                        <i class="fas ${item.icon}" style="color:var(--text-muted);width:14px"></i>
                        <span style="font-weight:${item.value > 0 ? '600' : '400'}">${App.lang === 'ar' ? item.label_ar : item.label_en}</span>
                        ${hasOverride ? '<span class="editable-note"><i class="fas fa-pen"></i> '+App.t('مُعدَّل','Override')+'</span>' : ''}
                      </div>
                      ${item.sub ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px;padding-inline-start:21px">
                        ${item.sub.map(s => `${App.lang==='ar'?s.label_ar:s.label_en}: ${App.formatSAR(s.value)}`).join(' · ')}
                      </div>` : ''}
                    </td>
                    <td><strong class="${item.value > 0 ? 'text-primary' : 'text-muted'}">${App.formatSAR(item.value)} <span class="sar">SAR</span></strong></td>
                    <td>
                      ${overrideKey ? `
                        <input type="number" class="cost-override" data-key="${overrideKey}" 
                          value="${overrides[overrideKey] !== undefined ? overrides[overrideKey] : ''}"
                          placeholder="${App.formatSAR(App.costAssumptions[overrideKey] || 0)}"
                          style="width:110px;padding:4px 8px;font-size:12px;border:1px solid var(--border);border-radius:5px;direction:ltr"
                          onchange="handleCostOverride('${overrideKey}', this.value)">
                      ` : '-'}
                    </td>
                    <td>
                      <div style="display:flex;align-items:center;gap:6px">
                        <div style="width:60px;height:6px;background:#e2e8f0;border-radius:3px">
                          <div style="width:${Math.min(pct, 100)}%;height:100%;background:var(--accent);border-radius:3px"></div>
                        </div>
                        <span style="font-size:11px;color:var(--text-muted)">${pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr class="table-total">
                <td><strong>${t('إجمالي التكاليف المباشرة', 'Total Direct Costs')}</strong></td>
                <td><strong class="text-accent">${App.formatSAR(calc.direct.total)} SAR</strong></td>
                <td></td><td>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Indirect Costs + Summary -->
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-cogs"></i> ${t('ب. التكاليف غير المباشرة', 'B. Indirect Costs')}</div>
          </div>
          <div class="card-body">
            <div style="display:flex;flex-direction:column;gap:10px">
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light)">
                <span>${t('التكاليف الإدارية', 'Admin Overhead')}</span>
                <strong>${App.formatSAR(calc.indirect.adminOverhead)} <span class="sar">SAR</span></strong>
              </div>
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light)">
                <span>${t('الطوارئ والمخاطر', 'Contingency')}</span>
                <strong>${App.formatSAR(calc.indirect.contingency)} <span class="sar">SAR</span></strong>
              </div>
              <div style="display:flex;justify-content:space-between;padding:8px 0;background:#f8fafc;margin:4px -8px;padding:8px;border-radius:6px">
                <strong>${t('الإجمالي', 'Total Indirect')}</strong>
                <strong class="text-primary">${App.formatSAR(calc.indirect.total)} SAR</strong>
              </div>
              <div style="margin-top:8px;padding-top:8px;border-top:2px solid var(--border)">
                <div style="display:flex;justify-content:space-between;padding:8px 0">
                  <span style="font-size:12px;color:var(--text-muted)">${t('نسبة التكاليف الإدارية', 'Admin Overhead Rate')}</span>
                  <input type="number" class="cost-override" data-key="admin_overhead_percent"
                    value="${overrides.admin_overhead_percent !== undefined ? overrides.admin_overhead_percent : ''}"
                    placeholder="${App.costAssumptions.admin_overhead_percent || 12}"
                    style="width:60px;text-align:center;padding:4px;border:1px solid var(--border);border-radius:5px;font-size:12px;direction:ltr"
                    onchange="handleCostOverride('admin_overhead_percent', this.value)">
                </div>
                <div style="display:flex;justify-content:space-between;padding:8px 0">
                  <span style="font-size:12px;color:var(--text-muted)">${t('نسبة الطوارئ', 'Contingency Rate')}</span>
                  <input type="number" class="cost-override" data-key="contingency_percent"
                    value="${overrides.contingency_percent !== undefined ? overrides.contingency_percent : ''}"
                    placeholder="${App.costAssumptions.contingency_percent || 5}"
                    style="width:60px;text-align:center;padding:4px;border:1px solid var(--border);border-radius:5px;font-size:12px;direction:ltr"
                    onchange="handleCostOverride('contingency_percent', this.value)">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-sigma"></i> ${t('ملخص التكاليف', 'Cost Summary')}</div>
          </div>
          <div class="card-body">
            ${[
              [t('التكاليف المباشرة', 'Direct Costs'), calc.direct.total, 'var(--accent)'],
              [t('التكاليف غير المباشرة', 'Indirect Costs'), calc.indirect.total, 'var(--info-light)'],
              [t('إجمالي التكلفة', 'Total Cost'), calc.totalCost, 'var(--primary)'],
              [t('التكلفة/متدرب', 'Cost/Participant'), calc.costPerParticipant, 'var(--success-light)'],
              [t('التكلفة/يوم', 'Cost/Day'), calc.costPerTrainingDay, 'var(--success-light)'],
              [t('التكلفة/دفعة', 'Cost/Cohort'), calc.costPerCohort, 'var(--success-light)'],
            ].map(([l, v, color]) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-light)">
                <span style="font-size:13px;color:var(--text-secondary)">${l}</span>
                <strong style="color:${color}">${App.formatSAR(v)} <span style="font-size:10px;opacity:0.7">SAR</span></strong>
              </div>
            `).join('')}
          </div>
        </div>

        <button class="btn btn-accent" onclick="navigate('pricing')">
          ${t('الانتقال إلى محرك التسعير', 'Go to Pricing Engine')} <i class="fas fa-arrow-${App.lang==='ar'?'left':'right'}"></i>
        </button>
      </div>
    </div>
  `;
}

function handleCostOverride(key, value) {
  if (!window._projectOverrides) window._projectOverrides = {};
  if (value === '' || value === null || value === undefined) {
    // Remove override — revert to global assumption
    delete window._projectOverrides[key];
    // ✅ FIX: restore global value (don't delete it)
    // App.costAssumptions is left intact — the override is simply removed
  } else {
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return;
    window._projectOverrides[key] = numVal;
    // ✅ FIX: do NOT mutate global App.costAssumptions
    // The Calc engine uses getRate() which checks overrides first,
    // so we don't need to touch App.costAssumptions here.
  }
}

async function saveProjectOverrides() {
  const t = App.t.bind(App);
  const overrides = window._projectOverrides || {};
  // Also read all override inputs
  document.querySelectorAll('.cost-override').forEach(input => {
    if (input.value !== '') {
      overrides[input.dataset.key] = parseFloat(input.value);
    }
  });

  if (Object.keys(overrides).length === 0) {
    showToast(t('لا توجد تجاوزات للحفظ', 'No overrides to save'), 'info');
    return;
  }

  const btn = document.querySelector('[onclick="saveProjectOverrides()"]');
  const restore = btn ? setButtonLoading(btn, t('جاري الحفظ...', 'Saving...')) : () => {};
  try {
    await API.post(`/projects/${App.currentProject.project_id}/overrides`, overrides);
    window._projectOverrides = overrides;
    showToast(t('تم حفظ التجاوزات بنجاح', 'Overrides saved successfully'));
    // Recalculate and save scenarios
    await recalcAndSaveScenarios();
  } catch(e) { showToast(e.message, 'error'); }
  finally { restore(); }
}

async function recalcAndSaveScenarios() {
  const t = App.t.bind(App);
  const p = App.currentProject;
  const overrides = window._projectOverrides || {};
  const calc = Calc.calcFull(p, App.costAssumptions, overrides);
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  const scenarios = [
    { scenario_type: 'competitive', label_ar: 'السيناريو أ - تنافسي', label_en: 'Scenario A - Competitive',
      target_margin: 15, is_recommended: 0, ...mapScenario(calc.scenarios.competitive) },
    { scenario_type: 'recommended', label_ar: 'السيناريو ب - موصى به', label_en: 'Scenario B - Recommended',
      target_margin: 25, is_recommended: 1, ...mapScenario(calc.scenarios.recommended) },
    { scenario_type: 'premium', label_ar: 'السيناريو ج - مميز', label_en: 'Scenario C - Premium',
      target_margin: 35, is_recommended: 0, ...mapScenario(calc.scenarios.premium) },
  ];
  try {
    const saved = await API.post(`/scenarios/project/${p.project_id}/bulk`, scenarios);
    window._scenarios = saved;
    // Update project in list with new financials
    const rec = scenarios.find(s => s.is_recommended);
    if (rec) {
      const idx = App.projects.findIndex(pr => pr.project_id === p.project_id);
      if (idx >= 0) {
        App.projects[idx].recommended_price = rec.selling_price_before_vat;
        App.projects[idx].gross_margin = rec.gross_margin;
        App.projects[idx].gross_profit = rec.gross_profit;
        App.projects[idx].total_cost = rec.total_cost;
      }
    }
  } catch(e) { console.error('Error saving scenarios:', e); }
}

function mapScenario(s) {
  return {
    total_cost: s.totalCost,
    selling_price_before_vat: s.sellingPriceBeforeVat,
    vat_amount: s.vatAmount,
    selling_price_including_vat: s.sellingPriceIncludingVat,
    gross_profit: s.grossProfit,
    gross_margin: s.grossMargin,
    profit_per_participant: s.profitPerParticipant,
    revenue_per_participant: s.revenuePerParticipant,
    revenue_per_training_day: s.revenuePerTrainingDay,
  };
}

// ============ PRICING ENGINE PAGE ============
function renderPricingEngine() {
  const t = App.t.bind(App);
  const p = App.currentProject;
  const overrides = window._projectOverrides || {};
  const calc = Calc.calcFull(p, App.costAssumptions, overrides);
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;

  // Get custom margins from state or defaults
  const margins = window._customMargins || { competitive: 15, recommended: 25, premium: 35 };

  const scenariosData = [
    {
      type: 'competitive', typeLabel: t('تنافسي', 'Competitive'),
      label: t('السيناريو أ - تنافسي', 'Scenario A - Competitive'),
      margin: margins.competitive,
      headerColor: '#2563eb',
      recommended: false,
      desc: t('سعر منافس مناسب للمناقصات التنافسية', 'Competitive price suitable for competitive tenders')
    },
    {
      type: 'recommended', typeLabel: t('موصى به', 'Recommended'),
      label: t('السيناريو ب - موصى به', 'Scenario B - Recommended'),
      margin: margins.recommended,
      headerColor: '#c8973a',
      recommended: true,
      desc: t('سعر متوازن يحمي الجودة والهامش', 'Balanced price protecting quality and margin')
    },
    {
      type: 'premium', typeLabel: t('مميز', 'Premium'),
      label: t('السيناريو ج - مميز', 'Scenario C - Premium'),
      margin: margins.premium,
      headerColor: '#7c3aed',
      recommended: false,
      desc: t('تسعير عالي للبرامج المتخصصة والمميزة', 'Premium pricing for specialized delivery')
    }
  ].map(s => ({
    ...s,
    calc: Calc.calcScenario(calc.totalCost, s.margin, p.num_participants, p.num_training_days, vat)
  }));

  const minMargin = parseFloat(App.costAssumptions.minimum_margin_percent) || 15;

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-tags"></i></div>
        ${t('محرك التسعير', 'Pricing Engine')}
      </div>
      <button class="btn btn-accent" onclick="savePricingScenarios()">
        <i class="fas fa-save"></i> ${t('حفظ السيناريوهات', 'Save Scenarios')}
      </button>
    </div>

    <!-- Cost basis -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-body" style="padding:14px 20px">
        <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
          <div><span style="font-size:12px;color:var(--text-muted)">${t('إجمالي التكلفة الأساسي', 'Total Cost Base')}</span> <strong style="color:var(--primary);font-size:16px">${App.formatSAR(calc.totalCost)} SAR</strong></div>
          <div><span style="font-size:12px;color:var(--text-muted)">${t('عدد المتدربين', 'Participants')}</span> <strong>${p.num_participants}</strong></div>
          <div><span style="font-size:12px;color:var(--text-muted)">${t('أيام التدريب', 'Training Days')}</span> <strong>${p.num_training_days}</strong></div>
          <div><span style="font-size:12px;color:var(--text-muted)">${t('نسبة الضريبة', 'VAT Rate')}</span> <strong>${vat}%</strong></div>
          <div><span style="font-size:12px;color:var(--text-muted)">${t('الحد الأدنى للهامش', 'Min. Margin')}</span> <strong style="color:var(--warning)">${minMargin}%</strong></div>
        </div>
      </div>
    </div>

    <!-- Three Scenario Cards -->
    <div class="scenarios-grid">
      ${scenariosData.map(s => renderScenarioCard(s, calc.totalCost, minMargin, calc)).join('')}
    </div>

    <!-- Comparison Table -->
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-table"></i> ${t('جدول مقارنة السيناريوهات', 'Scenario Comparison Table')}</div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>${t('المؤشر', 'Metric')}</th>
              <th style="text-align:center">${t('أ - تنافسي', 'A - Competitive')}</th>
              <th style="text-align:center;background:rgba(200,151,58,0.08)">${t('ب - موصى به ★', 'B - Recommended ★')}</th>
              <th style="text-align:center">${t('ج - مميز', 'C - Premium')}</th>
            </tr>
          </thead>
          <tbody>
            ${[
              [t('هامش الربح المستهدف', 'Target Margin'), (s) => App.formatPct(s.margin)],
              [t('إجمالي التكلفة', 'Total Cost'), (s) => App.formatSAR(s.calc.totalCost) + ' SAR'],
              [t('السعر قبل الضريبة', 'Price Before VAT'), (s) => `<strong>${App.formatSAR(s.calc.sellingPriceBeforeVat)} SAR</strong>`],
              [t('ضريبة القيمة المضافة', 'VAT Amount'), (s) => App.formatSAR(s.calc.vatAmount) + ' SAR'],
              [t('السعر شامل الضريبة', 'Price Incl. VAT'), (s) => `<strong>${App.formatSAR(s.calc.sellingPriceIncludingVat)} SAR</strong>`],
              [t('الربح الإجمالي', 'Gross Profit'), (s) => `<span class="text-success fw-bold">${App.formatSAR(s.calc.grossProfit)} SAR</span>`],
              [t('هامش الربح الفعلي', 'Actual Gross Margin'), (s) => `<span class="badge ${s.calc.grossMargin >= 20 ? 'badge-success' : 'badge-warning'}">${App.formatPct(s.calc.grossMargin)}</span>`],
              [t('الربح لكل متدرب', 'Profit/Participant'), (s) => App.formatSAR(s.calc.profitPerParticipant) + ' SAR'],
              [t('الإيراد لكل متدرب', 'Revenue/Participant'), (s) => App.formatSAR(s.calc.revenuePerParticipant) + ' SAR'],
              [t('الإيراد لكل يوم', 'Revenue/Training Day'), (s) => App.formatSAR(s.calc.revenuePerTrainingDay) + ' SAR'],
            ].map(([label, fn]) => `
              <tr>
                <td style="font-weight:600;color:var(--text-secondary)">${label}</td>
                ${scenariosData.map((s, i) => `<td style="text-align:center${i===1?';background:rgba(200,151,58,0.04)':''}">${fn(s)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- VAT Settings Note -->
    <div class="card mt-16">
      <div class="card-body" style="padding:14px 20px">
        <div style="display:flex;align-items:center;gap:12px">
          <i class="fas fa-info-circle" style="color:var(--info-light)"></i>
          <span style="font-size:13px;color:var(--text-secondary)">${t('نسبة ضريبة القيمة المضافة:', 'VAT Rate:')} <strong>${vat}%</strong> · ${t('الحد الأدنى المقبول للهامش:', 'Minimum Acceptable Margin:')} <strong>${minMargin}%</strong> · ${t('يمكن تعديل هذه القيم في الإعدادات', 'These can be changed in Settings')}</span>
          <button class="btn btn-ghost btn-xs" onclick="navigate('settings')"><i class="fas fa-cog"></i></button>
        </div>
      </div>
    </div>
  `;
}

function renderScenarioCard(s, totalCost, minMargin, calc) {
  const t = App.t.bind(App);
  const hasWarning = s.margin < minMargin;
  const isBelowCost = s.calc.sellingPriceBeforeVat <= totalCost && totalCost > 0;

  return `
    <div class="scenario-card ${s.recommended ? 'recommended' : ''}">
      <div class="scenario-header" style="background:${s.headerColor}">
        <div class="scenario-type">${s.typeLabel}</div>
        <div class="scenario-label">${s.label}</div>
        ${s.recommended ? `<div class="recommended-badge">★ ${t('الموصى به', 'RECOMMENDED')}</div>` : ''}
        <div style="font-size:11px;opacity:0.75;margin-top:4px">${s.desc}</div>
      </div>
      <div class="scenario-body">
        ${hasWarning ? `<div class="alert alert-warning" style="margin-bottom:10px;padding:8px 12px;font-size:12px">
          <i class="fas fa-exclamation-triangle"></i> ${t('الهامش أقل من الحد الأدنى', 'Margin below minimum')}
        </div>` : ''}

        ${[
          [t('السعر قبل الضريبة', 'Price Before VAT'), App.formatSAR(s.calc.sellingPriceBeforeVat) + ' SAR', 'highlight'],
          [t('ضريبة القيمة المضافة', 'VAT'), App.formatSAR(s.calc.vatAmount) + ' SAR', ''],
          [t('السعر شامل الضريبة', 'Price Incl. VAT'), App.formatSAR(s.calc.sellingPriceIncludingVat) + ' SAR', 'highlight'],
          [t('الربح الإجمالي', 'Gross Profit'), App.formatSAR(s.calc.grossProfit) + ' SAR', 'success'],
          [t('هامش الربح', 'Gross Margin'), App.formatPct(s.calc.grossMargin), 'success'],
          [t('الإيراد/متدرب', 'Revenue/Participant'), App.formatSAR(s.calc.revenuePerParticipant) + ' SAR', ''],
          [t('الربح/متدرب', 'Profit/Participant'), App.formatSAR(s.calc.profitPerParticipant) + ' SAR', ''],
          [t('الإيراد/يوم', 'Revenue/Day'), App.formatSAR(s.calc.revenuePerTrainingDay) + ' SAR', ''],
        ].map(([l, v, cls]) => `
          <div class="scenario-row">
            <span class="sr-label">${l}</span>
            <span class="sr-value ${cls}">${v}</span>
          </div>
        `).join('')}

        <div class="margin-input">
          <label>${t('تعديل الهامش %:', 'Adjust Margin %:')}</label>
          <input type="number" id="margin_${s.type}" value="${s.margin}" min="0" max="80" step="0.5"
            onchange="updateScenarioMargin('${s.type}', this.value)">
          <span style="font-size:11px;color:var(--text-muted)">%</span>
        </div>
      </div>
    </div>
  `;
}

function updateScenarioMargin(type, value) {
  if (!window._customMargins) window._customMargins = { competitive: 15, recommended: 25, premium: 35 };
  window._customMargins[type] = parseFloat(value) || 0;
  // Re-render pricing page
  const content = document.querySelector('.page-content');
  if (content && App.currentPage === 'pricing') {
    content.innerHTML = renderPricingEngine();
    attachEventListeners();
  }
}

async function savePricingScenarios() {
  const t = App.t.bind(App);
  const p = App.currentProject;
  const overrides = window._projectOverrides || {};
  const margins = window._customMargins || { competitive: 15, recommended: 25, premium: 35 };
  const calc = Calc.calcFull(p, App.costAssumptions, overrides);
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;

  const scenarios = ['competitive', 'recommended', 'premium'].map((type, i) => {
    const s = Calc.calcScenario(calc.totalCost, margins[type], p.num_participants, p.num_training_days, vat);
    return {
      scenario_type: type,
      label_ar: type === 'competitive' ? 'السيناريو أ - تنافسي' : type === 'recommended' ? 'السيناريو ب - موصى به' : 'السيناريو ج - مميز',
      label_en: type === 'competitive' ? 'Scenario A - Competitive' : type === 'recommended' ? 'Scenario B - Recommended' : 'Scenario C - Premium',
      target_margin: margins[type],
      is_recommended: type === 'recommended' ? 1 : 0,
      ...mapScenario(s)
    };
  });

  const btn = document.querySelector('[onclick="savePricingScenarios()"]');
  const restore = btn ? setButtonLoading(btn, t('جاري الحفظ...', 'Saving...')) : () => {};
  try {
    await API.post(`/scenarios/project/${p.project_id}/bulk`, scenarios);
    // Update project in list with live financial data
    const rec = scenarios.find(s => s.is_recommended);
    if (rec) {
      const idx = App.projects.findIndex(pr => pr.project_id === p.project_id);
      if (idx >= 0) {
        App.projects[idx].recommended_price = rec.selling_price_before_vat;
        App.projects[idx].gross_margin = rec.gross_margin;
        App.projects[idx].gross_profit = rec.gross_profit;
        App.projects[idx].total_cost = rec.total_cost;
      }
    }
    showToast(t('تم حفظ السيناريوهات بنجاح', 'Scenarios saved successfully'));
  } catch(e) { showToast(e.message, 'error'); }
  finally { restore(); }
}

// ============ BREAK-EVEN PAGE ============
function renderBreakEven() {
  const t = App.t.bind(App);
  const p = App.currentProject;
  const overrides = window._projectOverrides || {};
  const calc = Calc.calcFull(p, App.costAssumptions, overrides);
  const be = calc.breakEven;
  const margins = window._customMargins || { competitive: 15, recommended: 25, premium: 35 };
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  const recScenario = Calc.calcScenario(calc.totalCost, margins.recommended, p.num_participants, p.num_training_days, vat);
  const safetyMargin = recScenario.sellingPriceBeforeVat - be.breakEvenPrice;
  const safetyPct = be.breakEvenPrice > 0 ? (safetyMargin / be.breakEvenPrice * 100) : 0;

  const isBelowMin = recScenario.sellingPriceBeforeVat < be.minAcceptablePrice;
  const isBelowBreakEven = recScenario.sellingPriceBeforeVat < be.breakEvenPrice;

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-chart-line"></i></div>
        ${t('تحليل التعادل', 'Break-Even Analysis')}
      </div>
    </div>

    ${isBelowBreakEven ? `
      <div class="alert alert-danger">
        <i class="fas fa-times-circle"></i>
        <strong>${t('تحذير خطير: السعر الموصى به أقل من تكلفة التعادل!', 'CRITICAL WARNING: Recommended price is below break-even cost!')}</strong>
      </div>
    ` : isBelowMin ? `
      <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle"></i>
        <strong>${t('تحذير: السعر الموصى به أقل من الحد الأدنى المقبول للهامش', 'Warning: Recommended price is below the minimum acceptable margin')}</strong>
      </div>
    ` : `
      <div class="alert alert-success">
        <i class="fas fa-check-circle"></i>
        ${t('السعر الموصى به فوق نقطة التعادل والحد الأدنى للهامش المقبول', 'Recommended price is above break-even and minimum acceptable margin')}
      </div>
    `}

    <div class="kpi-grid">
      <div class="kpi-card ${isBelowBreakEven ? 'danger' : 'success'}">
        <div class="kpi-label">${t('سعر التعادل', 'Break-Even Price')}</div>
        <div class="kpi-value">${App.formatSAR(be.breakEvenPrice)} <span class="sar">SAR</span></div>
        <div class="kpi-sub">${t('(الهامش = صفر)', '(Margin = 0%)')}</div>
        <div class="kpi-icon red"><i class="fas fa-balance-scale"></i></div>
      </div>
      <div class="kpi-card warning">
        <div class="kpi-label">${t('الحد الأدنى المقبول', 'Minimum Acceptable Price')}</div>
        <div class="kpi-value">${App.formatSAR(be.minAcceptablePrice)} <span class="sar">SAR</span></div>
        <div class="kpi-sub">${t('(الهامش =', '(Margin =')} ${be.minMarginPct}%)</div>
        <div class="kpi-icon orange"><i class="fas fa-exclamation-triangle"></i></div>
      </div>
      <div class="kpi-card success">
        <div class="kpi-label">${t('السعر الموصى به', 'Recommended Price')}</div>
        <div class="kpi-value">${App.formatSAR(recScenario.sellingPriceBeforeVat)} <span class="sar">SAR</span></div>
        <div class="kpi-sub">${t('هامش', 'Margin')} ${App.formatPct(margins.recommended)}</div>
        <div class="kpi-icon gold"><i class="fas fa-tag"></i></div>
      </div>
      <div class="kpi-card ${safetyMargin >= 0 ? '' : 'danger'}">
        <div class="kpi-label">${t('هامش الأمان فوق التعادل', 'Safety Margin Above B-E')}</div>
        <div class="kpi-value">${App.formatSAR(Math.abs(safetyMargin))} <span class="sar">SAR</span></div>
        <div class="kpi-sub">${App.formatPct(Math.abs(safetyPct))}</div>
        <div class="kpi-icon ${safetyMargin >= 0 ? 'green' : 'red'}"><i class="fas fa-shield-alt"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('التعادل/متدرب', 'Break-Even/Participant')}</div>
        <div class="kpi-value">${App.formatSAR(be.breakEvenPerParticipant)} <span class="sar">SAR</span></div>
        <div class="kpi-icon blue"><i class="fas fa-user"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('الحد الأدنى/متدرب', 'Min. Price/Participant')}</div>
        <div class="kpi-value">${App.formatSAR(be.minAcceptablePricePerParticipant)} <span class="sar">SAR</span></div>
        <div class="kpi-icon orange"><i class="fas fa-user-shield"></i></div>
      </div>
    </div>

    <!-- Break-even visual -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-chart-bar"></i> ${t('تحليل السعر والهامش', 'Price & Margin Analysis')}</div>
      </div>
      <div class="card-body">
        <canvas id="chartBreakEven" height="120"></canvas>
      </div>
    </div>

    <!-- Detailed table -->
    <div class="card mt-16">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-table"></i> ${t('مقارنة نقاط السعر', 'Price Point Comparison')}</div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>${t('السيناريو / نقطة السعر', 'Scenario / Price Point')}</th>
            <th>${t('السعر قبل الضريبة', 'Price Before VAT')}</th>
            <th>${t('السعر شامل الضريبة', 'Price Incl. VAT')}</th>
            <th>${t('الربح / (الخسارة)', 'Profit / (Loss)')}</th>
            <th>${t('هامش الربح', 'Margin %')}</th>
            <th>${t('الحالة', 'Status')}</th>
          </tr></thead>
          <tbody>
            ${[
              { label: t('التعادل (صفر هامش)', 'Break-Even (Zero Margin)'), price: be.breakEvenPrice, vat: vat },
              { label: t('الحد الأدنى المقبول', 'Min. Acceptable Price'), price: be.minAcceptablePrice, vat: vat },
              ...['competitive','recommended','premium'].map(type => ({
                label: type === 'competitive' ? t('السيناريو أ - تنافسي', 'Scenario A - Competitive') :
                       type === 'recommended' ? t('السيناريو ب - موصى به ★', 'Scenario B - Recommended ★') :
                                               t('السيناريو ج - مميز', 'Scenario C - Premium'),
                price: Calc.calcScenario(calc.totalCost, margins[type], p.num_participants, p.num_training_days, vat).sellingPriceBeforeVat,
                vat: vat
              }))
            ].map(row => {
              const profit = row.price - calc.totalCost;
              const margin = row.price > 0 ? (profit / row.price * 100) : 0;
              const incl = row.price * (1 + row.vat / 100);
              const statusOk = row.price >= be.minAcceptablePrice;
              const statusBe = row.price >= be.breakEvenPrice;
              return `<tr>
                <td><strong>${row.label}</strong></td>
                <td>${App.formatSAR(row.price)} SAR</td>
                <td>${App.formatSAR(incl)} SAR</td>
                <td class="${profit >= 0 ? 'text-success' : 'text-danger'} fw-bold">${profit >= 0 ? '' : '('}${App.formatSAR(Math.abs(profit))} SAR${profit < 0 ? ')' : ''}</td>
                <td><span class="badge ${margin >= be.minMarginPct ? 'badge-success' : margin >= 0 ? 'badge-warning' : 'badge-danger'}">${App.formatPct(margin)}</span></td>
                <td>${statusOk ? `<span class="badge badge-success"><i class="fas fa-check"></i> ${t('مقبول', 'Acceptable')}</span>` :
                     statusBe ? `<span class="badge badge-warning"><i class="fas fa-exclamation"></i> ${t('عند الحد الأدنى', 'At Minimum')}</span>` :
                                `<span class="badge badge-danger"><i class="fas fa-times"></i> ${t('تحت التعادل', 'Below B-E')}</span>`}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <script>
      // Render break-even chart after DOM update
      setTimeout(function() {
        const ctx = document.getElementById('chartBreakEven');
        if (ctx && typeof Chart !== 'undefined') {
          if (App.charts.breakEven) App.charts.breakEven.destroy();
          App.charts.breakEven = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: ['${t('تكلفة التعادل', 'Break-Even')}', '${t('الحد الأدنى', 'Min. Price')}', '${t('تنافسي', 'Competitive')}', '${t('موصى به', 'Recommended')}', '${t('مميز', 'Premium')}'],
              datasets: [{
                label: 'SAR',
                data: [${be.breakEvenPrice.toFixed(0)}, ${be.minAcceptablePrice.toFixed(0)}, ${Calc.calcScenario(calc.totalCost, margins.competitive, p.num_participants, p.num_training_days, vat).sellingPriceBeforeVat.toFixed(0)}, ${recScenario.sellingPriceBeforeVat.toFixed(0)}, ${Calc.calcScenario(calc.totalCost, margins.premium, p.num_participants, p.num_training_days, vat).sellingPriceBeforeVat.toFixed(0)}],
                backgroundColor: ['#ef4444','#f59e0b','#3b82f6','#c8973a','#7c3aed'],
                borderRadius: 6
              }]
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: { ticks: { callback: v => v.toLocaleString() } }
              }
            }
          });
        }
      }, 100);
    </script>
  `;
}

// ============ SENSITIVITY ANALYSIS PAGE ============
function renderSensitivity() {
  const t = App.t.bind(App);
  const p = App.currentProject;
  const overrides = window._projectOverrides || {};
  const baseCalc = Calc.calcFull(p, App.costAssumptions, overrides);
  const baseMargin = (window._customMargins || {}).recommended || 25;
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;

  // Sensitivity parameters
  const sens = window._sensitivityParams || {
    num_participants: p.num_participants,
    trainer_rate: App.costAssumptions.trainer_general_day_rate || 3000,
    venue_cost: App.costAssumptions.hotel_venue_cost_per_person_per_day || 500,
    catering_cost: App.costAssumptions.coffee_break_cost_per_person_per_day || 120,
    num_days: p.num_training_days,
    num_cohorts: p.num_cohorts,
    travel_cost: App.costAssumptions.flights_cost || 1200,
    margin: baseMargin
  };

  // Build modified project with sensitivity params
  const modProject = {
    ...p,
    num_participants: parseInt(sens.num_participants) || p.num_participants,
    num_training_days: parseInt(sens.num_days) || p.num_training_days,
    num_cohorts: parseInt(sens.num_cohorts) || p.num_cohorts,
  };
  const modOverrides = {
    ...overrides,
    trainer_general_day_rate: parseFloat(sens.trainer_rate),
    trainer_specialized_day_rate: parseFloat(sens.trainer_rate) * 1.5,
    trainer_leadership_day_rate: parseFloat(sens.trainer_rate) * 2.5,
    hotel_venue_cost_per_person_per_day: parseFloat(sens.venue_cost),
    coffee_break_cost_per_person_per_day: parseFloat(sens.catering_cost),
    flights_cost: parseFloat(sens.travel_cost),
  };
  const modCalc = Calc.calcFull(modProject, App.costAssumptions, modOverrides);
  const modScenario = Calc.calcScenario(modCalc.totalCost, parseFloat(sens.margin), modProject.num_participants, modProject.num_training_days, vat);

  const baseScenario = Calc.calcScenario(baseCalc.totalCost, baseMargin, p.num_participants, p.num_training_days, vat);

  const diffCost = modCalc.totalCost - baseCalc.totalCost;
  const diffPrice = modScenario.sellingPriceBeforeVat - baseScenario.sellingPriceBeforeVat;
  const diffProfit = modScenario.grossProfit - baseScenario.grossProfit;

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-sliders-h"></i></div>
        ${t('تحليل الحساسية', 'Sensitivity Analysis')}
      </div>
      <button class="btn btn-outline btn-sm" onclick="resetSensitivity()">
        <i class="fas fa-undo"></i> ${t('إعادة تعيين', 'Reset')}
      </button>
    </div>

    <div class="alert alert-info">
      <i class="fas fa-info-circle"></i>
      ${t('اضبط المعاملات أدناه لرؤية التأثير الفوري على التكاليف والأسعار والأرباح', 'Adjust parameters below to see immediate impact on costs, prices, and profits')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <!-- Controls -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-sliders-h"></i> ${t('المتغيرات', 'Variables')}</div>
        </div>
        <div class="card-body">
          ${[
            { key: 'num_participants', label: t('عدد المتدربين', 'Participant Count'), min: 1, max: 500, step: 1, unit: t('متدرب', 'trainees'), base: p.num_participants },
            { key: 'num_days', label: t('عدد أيام التدريب', 'Training Days'), min: 1, max: 100, step: 1, unit: t('يوم', 'days'), base: p.num_training_days },
            { key: 'num_cohorts', label: t('عدد الدفعات', 'Number of Cohorts'), min: 1, max: 20, step: 1, unit: t('دفعة', 'cohorts'), base: p.num_cohorts },
            { key: 'trainer_rate', label: t('معدل المدرب اليومي', 'Trainer Day Rate'), min: 500, max: 20000, step: 100, unit: 'SAR', base: App.costAssumptions.trainer_general_day_rate || 3000 },
            { key: 'venue_cost', label: t('تكلفة القاعة/شخص/يوم', 'Venue Cost/Person/Day'), min: 0, max: 2000, step: 50, unit: 'SAR', base: App.costAssumptions.hotel_venue_cost_per_person_per_day || 500 },
            { key: 'catering_cost', label: t('تكلفة الضيافة/شخص/يوم', 'Catering/Person/Day'), min: 0, max: 500, step: 10, unit: 'SAR', base: App.costAssumptions.coffee_break_cost_per_person_per_day || 120 },
            { key: 'travel_cost', label: t('تكلفة السفر', 'Travel Cost'), min: 0, max: 10000, step: 100, unit: 'SAR', base: App.costAssumptions.flights_cost || 1200 },
            { key: 'margin', label: t('هامش الربح %', 'Profit Margin %'), min: 0, max: 70, step: 0.5, unit: '%', base: baseMargin },
          ].map(param => `
            <div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <span style="font-size:13px;font-weight:600;color:var(--text-secondary)">${param.label}</span>
                <div style="display:flex;align-items:center;gap:6px">
                  <input type="number" id="sens_${param.key}" value="${sens[param.key]}" min="${param.min}" max="${param.max}" step="${param.step}"
                    style="width:75px;padding:3px 7px;border:1.5px solid var(--border);border-radius:6px;font-size:12.5px;text-align:center;direction:ltr"
                    oninput="updateSensitivity('${param.key}', this.value)">
                  <span style="font-size:11px;color:var(--text-muted)">${param.unit}</span>
                </div>
              </div>
              <input type="range" class="sensitivity-slider" id="sens_range_${param.key}"
                min="${param.min}" max="${param.max}" step="${param.step}" value="${sens[param.key]}"
                oninput="syncSensitivity('${param.key}', this.value)">
              <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:2px">
                <span>${t('القاعدة:', 'Base:')} ${param.base}</span>
                <span>${param.min} - ${param.max}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Live Results -->
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="kpi-grid" style="grid-template-columns:1fr 1fr">
          ${[
            [t('إجمالي التكلفة المعدّلة', 'Adjusted Total Cost'), modCalc.totalCost, diffCost, 'orange'],
            [t('السعر قبل الضريبة', 'Price Before VAT'), modScenario.sellingPriceBeforeVat, diffPrice, 'gold'],
            [t('الربح الإجمالي', 'Gross Profit'), modScenario.grossProfit, diffProfit, 'green'],
            [t('هامش الربح', 'Gross Margin %'), modScenario.grossMargin, modScenario.grossMargin - baseScenario.grossMargin, 'blue'],
            [t('التكلفة/متدرب', 'Cost/Participant'), modCalc.costPerParticipant, modCalc.costPerParticipant - baseCalc.costPerParticipant, 'blue'],
          ].map(([l, v, diff, color]) => {
            const fromBase = App.t('من القاعدة', 'from base');
            const noChange = App.t('بدون تغيير', 'No change');
            const diffText = Math.abs(diff) > 0.01 
              ? (diff > 0 ? '▲ +' : '▼ ') + (l.includes('%') ? App.formatPct(Math.abs(diff)) : App.formatSAR(Math.abs(diff))) + ' ' + fromBase 
              : noChange;
            return `
            <div class="kpi-card">
              <div class="kpi-label">${l}</div>
              <div class="kpi-value" style="font-size:18px">${l.includes('%') ? App.formatPct(v) : App.formatSAR(v) + ' SAR'}</div>
              <div class="kpi-sub ${diff > 0.01 ? 'text-danger' : diff < -0.01 ? 'text-success' : ''}">
                ${diffText}
              </div>
              <div class="kpi-icon ${color}"><i class="fas fa-chart-line"></i></div>
            </div>
          `;
          }).join('')}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-chart-bar"></i> ${t('مقارنة القاعدة مقابل المعدّل', 'Base vs Adjusted')}</div>
          </div>
          <div class="card-body">
            <canvas id="chartSensitivity" height="200"></canvas>
          </div>
        </div>
      </div>
    </div>

    <script>
      setTimeout(function() {
        const ctx = document.getElementById('chartSensitivity');
        if (ctx && typeof Chart !== 'undefined') {
          if (App.charts.sensitivity) App.charts.sensitivity.destroy();
          App.charts.sensitivity = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: ['${t('التكلفة', 'Cost')}', '${t('السعر', 'Price')}', '${t('الربح', 'Profit')}'],
              datasets: [
                { label: '${t('القاعدة', 'Base')}', data: [${baseCalc.totalCost.toFixed(0)}, ${baseScenario.sellingPriceBeforeVat.toFixed(0)}, ${baseScenario.grossProfit.toFixed(0)}], backgroundColor: 'rgba(26,46,74,0.7)', borderRadius: 5 },
                { label: '${t('المعدّل', 'Adjusted')}', data: [${modCalc.totalCost.toFixed(0)}, ${modScenario.sellingPriceBeforeVat.toFixed(0)}, ${modScenario.grossProfit.toFixed(0)}], backgroundColor: 'rgba(200,151,58,0.8)', borderRadius: 5 }
              ]
            },
            options: {
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { ticks: { callback: v => v.toLocaleString() } } }
            }
          });
        }
      }, 100);
    </script>
  `;
}

function updateSensitivity(key, value) {
  if (!window._sensitivityParams) {
    const p = App.currentProject;
    window._sensitivityParams = {
      num_participants: p.num_participants,
      trainer_rate: App.costAssumptions.trainer_general_day_rate || 3000,
      venue_cost: App.costAssumptions.hotel_venue_cost_per_person_per_day || 500,
      catering_cost: App.costAssumptions.coffee_break_cost_per_person_per_day || 120,
      num_days: p.num_training_days,
      num_cohorts: p.num_cohorts,
      travel_cost: App.costAssumptions.flights_cost || 1200,
      margin: 25
    };
  }
  window._sensitivityParams[key] = parseFloat(value) || 0;
  // Sync slider
  const range = document.getElementById(`sens_range_${key}`);
  if (range) range.value = value;
  // Re-render sensitivity page
  const content = document.querySelector('.page-content');
  if (content && App.currentPage === 'sensitivity') {
    content.innerHTML = renderSensitivity();
    attachEventListeners();
  }
}

function syncSensitivity(key, value) {
  const input = document.getElementById(`sens_${key}`);
  if (input) input.value = value;
  updateSensitivity(key, value);
}

function resetSensitivity() {
  window._sensitivityParams = null;
  const content = document.querySelector('.page-content');
  if (content && App.currentPage === 'sensitivity') {
    content.innerHTML = renderSensitivity();
    attachEventListeners();
  }
}

// ============ EVENT LISTENERS ============
function attachEventListeners() {
  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });
}
