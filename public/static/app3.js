/* ============================================================
   Training Proposal & Pricing Engine
   Main Application - Part 3
   BOQ, Payments, Cash Flow, Executive Dashboard, 
   Recommendation, Reports, Sample Data
   ============================================================ */

// ============ BOQ PAGE ============
async function renderBOQ() {
  const t = App.t.bind(App);
  const p = App.currentProject;

  // Load BOQ items
  let boqItems = window._boqItems;
  if (!boqItems) {
    try {
      boqItems = await API.get(`/boq/project/${p.project_id}`);
      window._boqItems = boqItems;
    } catch(e) { boqItems = []; }
  }

  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  const totalBeforeVat = boqItems.reduce((s, i) => s + (Number(i.total_before_vat) || 0), 0);
  const totalVat = boqItems.reduce((s, i) => s + (Number(i.vat_amount) || 0), 0);
  const totalIncl = boqItems.reduce((s, i) => s + (Number(i.total_including_vat) || 0), 0);

  const categories = ['خدمات التدريب', 'المدربون', 'القاعات والضيافة', 'المواد التدريبية', 'التقنية', 'السفر', 'الإدارة', 'أخرى'];

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-list-ol"></i></div>
        ${t('جدول الكميات BOQ', 'Bill of Quantities')}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline btn-sm" onclick="generateBOQFromCosts()">
          <i class="fas fa-magic"></i> ${t('توليد تلقائي', 'Auto-Generate')}
        </button>
        <button class="btn btn-outline btn-sm" onclick="addBOQItem()">
          <i class="fas fa-plus"></i> ${t('إضافة بند', 'Add Item')}
        </button>
        <button class="btn btn-accent btn-sm" onclick="saveBOQ()">
          <i class="fas fa-save"></i> ${t('حفظ', 'Save')}
        </button>
      </div>
    </div>

    <!-- Totals Summary -->
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      <div class="kpi-card">
        <div class="kpi-label">${t('الإجمالي قبل الضريبة', 'Total Before VAT')}</div>
        <div class="kpi-value">${App.formatSAR(totalBeforeVat)} <span class="sar">SAR</span></div>
        <div class="kpi-icon gold"><i class="fas fa-file-invoice"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('ضريبة القيمة المضافة', 'VAT')} (${vat}%)</div>
        <div class="kpi-value">${App.formatSAR(totalVat)} <span class="sar">SAR</span></div>
        <div class="kpi-icon orange"><i class="fas fa-percentage"></i></div>
      </div>
      <div class="kpi-card success">
        <div class="kpi-label">${t('الإجمالي شامل الضريبة', 'Total Including VAT')}</div>
        <div class="kpi-value">${App.formatSAR(totalIncl)} <span class="sar">SAR</span></div>
        <div class="kpi-icon green"><i class="fas fa-coins"></i></div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table id="boqTable">
          <thead>
            <tr>
              <th style="width:40px">#</th>
              <th>${t('الفئة', 'Category')}</th>
              <th>${t('الوصف', 'Description')}</th>
              <th style="width:80px">${t('الكمية', 'Qty')}</th>
              <th style="width:80px">${t('الوحدة', 'Unit')}</th>
              <th>${t('سعر التكلفة', 'Unit Cost')}</th>
              <th>${t('سعر البيع', 'Selling Price')}</th>
              <th>${t('الإجمالي قبل ض', 'Total Before VAT')}</th>
              <th>${t('الضريبة', 'VAT')}</th>
              <th>${t('الإجمالي شامل ض', 'Total Incl. VAT')}</th>
              <th style="width:70px">${t('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody id="boqBody">
            ${boqItems.length === 0 ? `
              <tr><td colspan="11" style="text-align:center;padding:30px;color:var(--text-muted)">
                ${t('لا توجد بنود. أضف بنداً أو ولّد تلقائياً من بناء التكاليف.', 'No items. Add an item or auto-generate from cost build-up.')}
              </td></tr>
            ` : boqItems.map((item, i) => renderBOQRow(item, i)).join('')}
          </tbody>
          <tfoot>
            <tr class="table-total">
              <td colspan="7"><strong>${t('المجموع الكلي', 'Grand Total')}</strong></td>
              <td><strong>${App.formatSAR(totalBeforeVat)} SAR</strong></td>
              <td><strong>${App.formatSAR(totalVat)} SAR</strong></td>
              <td><strong class="text-accent">${App.formatSAR(totalIncl)} SAR</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

function renderBOQRow(item, idx) {
  const t = App.t.bind(App);
  return `
    <tr id="boq_row_${idx}" data-idx="${idx}">
      <td>${item.item_number || idx + 1}</td>
      <td>
        <select onchange="updateBOQItem(${idx}, 'category', this.value)" style="min-width:110px">
          ${['خدمات التدريب','المدربون','القاعات والضيافة','المواد التدريبية','التقنية','السفر','الإدارة','أخرى'].map(c =>
            `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </td>
      <td>
        <input type="text" value="${item.description_ar || ''}" placeholder="${t('وصف البند', 'Item description')}"
          onchange="updateBOQItem(${idx}, 'description_ar', this.value)" style="min-width:160px">
      </td>
      <td><input type="number" value="${item.quantity || 0}" min="0" step="0.01" onchange="updateBOQItem(${idx}, 'quantity', this.value)"></td>
      <td>
        <select onchange="updateBOQItem(${idx}, 'unit', this.value)">
          ${['وحدة','يوم','شخص','مجموعة','مشروع','دورة','ساعة','شهر'].map(u =>
            `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`
          ).join('')}
        </select>
      </td>
      <td><input type="number" value="${item.unit_cost || 0}" min="0" step="0.01" onchange="updateBOQItem(${idx}, 'unit_cost', this.value)"></td>
      <td><input type="number" value="${item.selling_unit_price || 0}" min="0" step="0.01" onchange="updateBOQItem(${idx}, 'selling_unit_price', this.value)"></td>
      <td><strong>${App.formatSAR(item.total_before_vat)} SAR</strong></td>
      <td>${App.formatSAR(item.vat_amount)} SAR</td>
      <td><strong class="text-accent">${App.formatSAR(item.total_including_vat)} SAR</strong></td>
      <td>
        <div style="display:flex;gap:3px">
          <button class="btn btn-ghost btn-xs" onclick="dupBOQItem(${idx})" title="${t('نسخ', 'Duplicate')}"><i class="fas fa-copy"></i></button>
          <button class="btn btn-ghost btn-xs" onclick="removeBOQItem(${idx})" style="color:var(--danger-light)" title="${t('حذف', 'Delete')}"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `;
}

function addBOQItem() {
  if (!window._boqItems) window._boqItems = [];
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  window._boqItems.push({
    item_number: window._boqItems.length + 1,
    category: 'خدمات التدريب',
    description_ar: '',
    quantity: 1,
    unit: 'وحدة',
    unit_cost: 0,
    selling_unit_price: 0,
    total_before_vat: 0,
    vat_amount: 0,
    total_including_vat: 0,
    notes: ''
  });
  refreshBOQTable();
}

function updateBOQItem(idx, field, value) {
  const item = window._boqItems[idx];
  if (!item) return;
  item[field] = field === 'quantity' || field === 'unit_cost' || field === 'selling_unit_price' ? parseFloat(value) || 0 : value;
  // Recalculate
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  item.total_before_vat = (item.quantity || 0) * (item.selling_unit_price || 0);
  item.vat_amount = item.total_before_vat * (vat / 100);
  item.total_including_vat = item.total_before_vat + item.vat_amount;
  refreshBOQTable();
}

function dupBOQItem(idx) {
  const item = { ...window._boqItems[idx] };
  window._boqItems.splice(idx + 1, 0, item);
  refreshBOQTable();
}

function removeBOQItem(idx) {
  window._boqItems.splice(idx, 1);
  refreshBOQTable();
}

function refreshBOQTable() {
  const t = App.t.bind(App);
  const items = window._boqItems || [];
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  const totalBeforeVat = items.reduce((s, i) => s + (Number(i.total_before_vat) || 0), 0);
  const totalVat = items.reduce((s, i) => s + (Number(i.vat_amount) || 0), 0);
  const totalIncl = items.reduce((s, i) => s + (Number(i.total_including_vat) || 0), 0);

  const tbody = document.getElementById('boqBody');
  const tfoot = document.querySelector('#boqTable tfoot tr');
  if (tbody) tbody.innerHTML = items.map((item, i) => renderBOQRow(item, i)).join('');
  if (tfoot) tfoot.innerHTML = `
    <td colspan="7"><strong>${t('المجموع الكلي', 'Grand Total')}</strong></td>
    <td><strong>${App.formatSAR(totalBeforeVat)} SAR</strong></td>
    <td><strong>${App.formatSAR(totalVat)} SAR</strong></td>
    <td><strong class="text-accent">${App.formatSAR(totalIncl)} SAR</strong></td>
    <td></td>
  `;
}

function generateBOQFromCosts() {
  const t = App.t.bind(App);
  const p = App.currentProject;
  const overrides = window._projectOverrides || {};
  const calc = Calc.calcFull(p, App.costAssumptions, overrides);
  const margins = window._customMargins || { recommended: 25 };
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  const margin = margins.recommended;

  const costItems = [
    { cat: 'المدربون', desc: 'خدمات المدربين', cost: calc.direct.trainers },
    { cat: 'الإدارة', desc: 'التنسيق وإدارة المشروع', cost: calc.direct.coordinators + calc.direct.projectManagement },
    { cat: 'القاعات والضيافة', desc: 'إيجار القاعة/الفندق والضيافة', cost: calc.direct.venue + calc.direct.catering },
    { cat: 'المواد التدريبية', desc: 'الطباعة والقرطاسية والشهادات', cost: calc.direct.printing + calc.direct.stationery + calc.direct.certificates },
    { cat: 'التقنية', desc: 'نظام إدارة التعلم والتقنية', cost: calc.direct.lmsTechnology },
    { cat: 'خدمات التدريب', desc: 'التقييم والاختبارات', cost: calc.direct.assessments },
    { cat: 'السفر', desc: 'السفر والإقامة والمواصلات', cost: calc.direct.travel },
    { cat: 'أخرى', desc: 'المعدات والتصوير والتصاريح والتسويق', cost: calc.direct.equipment + calc.direct.photographer + calc.direct.permits + calc.direct.marketing },
    { cat: 'الإدارة', desc: 'التكاليف الإدارية والطوارئ (غير مباشرة)', cost: calc.indirect.total },
  ].filter(i => i.cost > 0);

  window._boqItems = costItems.map((item, i) => {
    const sellingPrice = item.cost / (1 - margin / 100);
    const totalBeforeVat = sellingPrice;
    const vatAmount = totalBeforeVat * (vat / 100);
    return {
      item_number: i + 1,
      category: item.cat,
      description_ar: item.desc,
      quantity: 1,
      unit: 'مشروع',
      unit_cost: item.cost,
      selling_unit_price: sellingPrice,
      total_before_vat: totalBeforeVat,
      vat_amount: vatAmount,
      total_including_vat: totalBeforeVat + vatAmount,
      notes: ''
    };
  });

  showToast(t('تم توليد BOQ تلقائياً من بناء التكاليف', 'BOQ auto-generated from cost build-up'));
  const content = document.querySelector('.page-content');
  if (content) {
    renderBOQ().then(html => { content.innerHTML = html; attachEventListeners(); });
  }
}

async function saveBOQ() {
  const t = App.t.bind(App);
  const btn = document.querySelector('[onclick="saveBOQ()"]');
  const restore = btn ? setButtonLoading(btn, t('جاري الحفظ...', 'Saving...')) : () => {};
  try {
    const items = window._boqItems || [];
    const saved = await API.post(`/boq/project/${App.currentProject.project_id}/bulk`, items);
    window._boqItems = saved;
    showToast(t('تم حفظ BOQ بنجاح', 'BOQ saved successfully'));
  } catch(e) { showToast(e.message, 'error'); }
  finally { restore(); }
}

// ============ PAYMENT SCHEDULE PAGE ============
async function renderPayments() {
  const t = App.t.bind(App);
  const p = App.currentProject;
  const overrides = window._projectOverrides || {};
  const calc = Calc.calcFull(p, App.costAssumptions, overrides);
  const margins = window._customMargins || { recommended: 25 };
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  const recScenario = Calc.calcScenario(calc.totalCost, margins.recommended, p.num_participants, p.num_training_days, vat);
  const totalContract = recScenario.sellingPriceIncludingVat;

  let milestones = window._milestones;
  if (!milestones) {
    try {
      milestones = await API.get(`/payments/project/${p.project_id}`);
      window._milestones = milestones;
    } catch(e) { milestones = []; }
  }

  const totalPct = milestones.reduce((s, m) => s + (Number(m.percentage) || 0), 0);
  const totalAmount = milestones.reduce((s, m) => s + (Number(m.total_amount) || 0), 0);
  const pctOk = Math.abs(totalPct - 100) < 0.01;

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-calendar-check"></i></div>
        ${t('جدول الدفعات', 'Payment Schedule')}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline btn-sm" onclick="generateDefaultMilestones(${totalContract})">
          <i class="fas fa-magic"></i> ${t('جدول افتراضي', 'Default Schedule')}
        </button>
        <button class="btn btn-outline btn-sm" onclick="addMilestone(${totalContract})">
          <i class="fas fa-plus"></i> ${t('إضافة مرحلة', 'Add Milestone')}
        </button>
        <button class="btn btn-accent btn-sm" onclick="savePayments()">
          <i class="fas fa-save"></i> ${t('حفظ', 'Save')}
        </button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-body" style="padding:14px 20px">
        <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
          <div><span style="font-size:12px;color:var(--text-muted)">${t('قيمة العقد شاملة الضريبة', 'Contract Value Incl. VAT')}</span> <strong style="color:var(--accent)">${App.formatSAR(totalContract)} SAR</strong></div>
          <div><span style="font-size:12px;color:var(--text-muted)">${t('إجمالي النسب', 'Total %')}</span>
            <strong id="paymentTotalPct" class="${pctOk ? 'text-success' : 'text-danger'}">${App.formatPct(totalPct, 1)}</strong>
            ${!pctOk && milestones.length > 0 ? `<span class="badge badge-danger" style="margin-right:6px"><i class="fas fa-exclamation"></i> ${t('يجب أن تساوي 100%', 'Must equal 100%')}</span>` : ''}
          </div>
          <div><span style="font-size:12px;color:var(--text-muted)">${t('إجمالي مبالغ الدفع', 'Total Payment Amounts')}</span> <strong id="paymentTotalAmt">${App.formatSAR(totalAmount)} SAR</strong></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table id="paymentsTable">
          <thead>
            <tr>
              <th>#</th>
              <th>${t('اسم المرحلة', 'Milestone')}</th>
              <th>${t('الوصف', 'Description')}</th>
              <th>${t('النسبة %', '%')}</th>
              <th>${t('المبلغ قبل الضريبة', 'Amount Before VAT')}</th>
              <th>${t('الضريبة', 'VAT')}</th>
              <th>${t('الإجمالي', 'Total')}</th>
              <th>${t('التاريخ المتوقع', 'Expected Date')}</th>
              <th>${t('الحالة', 'Status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="paymentsBody">
            ${milestones.map((m, i) => renderMilestoneRow(m, i, totalContract)).join('')}
          </tbody>
          <tfoot>
            <tr class="table-total">
              <td colspan="3"><strong>${t('الإجمالي', 'Total')}</strong></td>
              <td class="${pctOk ? 'text-success' : 'text-danger'} fw-bold">${App.formatPct(totalPct, 1)}</td>
              <td><strong>${App.formatSAR(milestones.reduce((s,m) => s + (Number(m.amount_before_vat)||0), 0))} SAR</strong></td>
              <td><strong>${App.formatSAR(milestones.reduce((s,m) => s + (Number(m.vat_amount)||0), 0))} SAR</strong></td>
              <td><strong class="text-accent">${App.formatSAR(totalAmount)} SAR</strong></td>
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

function renderMilestoneRow(m, i, totalContract) {
  const t = App.t.bind(App);
  const statusMap = {
    pending: ['badge-warning', t('قيد الانتظار', 'Pending')],
    invoiced: ['badge-info', t('تم الفاتورة', 'Invoiced')],
    received: ['badge-success', t('مستلم', 'Received')],
    overdue: ['badge-danger', t('متأخر', 'Overdue')],
  };
  const [statusCls, statusLabel] = statusMap[m.status] || ['badge-primary', m.status];
  return `
    <tr>
      <td>${i + 1}</td>
      <td><input type="text" value="${m.milestone_name_ar || ''}" onchange="updateMilestone(${i}, 'milestone_name_ar', this.value)" style="min-width:130px"></td>
      <td><input type="text" value="${m.description || ''}" placeholder="${t('وصف المرحلة', 'Milestone description')}" onchange="updateMilestone(${i}, 'description', this.value)" style="min-width:160px"></td>
      <td>
        <div style="display:flex;align-items:center;gap:4px">
          <input type="number" value="${m.percentage || 0}" min="0" max="100" step="0.5"
            onchange="updateMilestone(${i}, 'percentage', this.value)" style="width:60px;direction:ltr">
          <span>%</span>
        </div>
      </td>
      <td><strong>${App.formatSAR(m.amount_before_vat)} SAR</strong></td>
      <td>${App.formatSAR(m.vat_amount)} SAR</td>
      <td><strong class="text-accent">${App.formatSAR(m.total_amount)} SAR</strong></td>
      <td><input type="date" value="${m.expected_date || ''}" onchange="updateMilestone(${i}, 'expected_date', this.value)"></td>
      <td>
        <select onchange="updateMilestone(${i}, 'status', this.value)">
          ${['pending','invoiced','received','overdue'].map(s => `<option value="${s}" ${m.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><button class="btn btn-ghost btn-xs" onclick="removeMilestone(${i})" style="color:var(--danger-light)"><i class="fas fa-trash"></i></button></td>
    </tr>
  `;
}

function updateMilestone(idx, field, value) {
  const m = window._milestones[idx];
  if (!m) return;
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  m[field] = field === 'percentage' ? parseFloat(value) || 0 : value;
  if (field === 'percentage') {
    // Recalculate amounts based on total contract
    const p = App.currentProject;
    const overrides = window._projectOverrides || {};
    const calc = Calc.calcFull(p, App.costAssumptions, overrides);
    const margins = window._customMargins || { recommended: 25 };
    const rec = Calc.calcScenario(calc.totalCost, margins.recommended, p.num_participants, p.num_training_days, vat);
    const totalIncl = rec.sellingPriceIncludingVat;
    m.total_amount = totalIncl * (m.percentage / 100);
    m.amount_before_vat = m.total_amount / (1 + vat / 100);
    m.vat_amount = m.total_amount - m.amount_before_vat;
  }
  refreshPaymentsTable();
}

function addMilestone(totalContract) {
  if (!window._milestones) window._milestones = [];
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  const remaining = 100 - window._milestones.reduce((s, m) => s + (m.percentage || 0), 0);
  const pct = Math.max(0, remaining);
  const total = (totalContract || 0) * (pct / 100);
  window._milestones.push({
    milestone_number: window._milestones.length + 1,
    milestone_name_ar: `المرحلة ${window._milestones.length + 1}`,
    description: '',
    percentage: pct,
    amount_before_vat: total / (1 + vat / 100),
    vat_amount: total * (vat / 100) / (1 + vat / 100),
    total_amount: total,
    expected_date: null,
    status: 'pending',
    notes: ''
  });
  refreshPaymentsTable();
}

function removeMilestone(idx) {
  window._milestones.splice(idx, 1);
  refreshPaymentsTable();
}

function generateDefaultMilestones(totalContract) {
  const t = App.t.bind(App);
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  const milestoneTemplates = [
    { ar: 'دفعة التعاقد', pct: 30 },
    { ar: 'دفعة بدء التنفيذ', pct: 30 },
    { ar: 'دفعة منتصف المشروع', pct: 25 },
    { ar: 'الدفعة الختامية', pct: 15 },
  ];
  window._milestones = milestoneTemplates.map((tmpl, i) => {
    const total = (totalContract || 0) * (tmpl.pct / 100);
    return {
      milestone_number: i + 1,
      milestone_name_ar: tmpl.ar,
      description: '',
      percentage: tmpl.pct,
      amount_before_vat: total / (1 + vat / 100),
      vat_amount: total * (vat / 100) / (1 + vat / 100),
      total_amount: total,
      expected_date: null,
      status: 'pending',
      notes: ''
    };
  });
  refreshPaymentsTable();
  showToast(t('تم توليد الجدول الافتراضي بنجاح', 'Default schedule generated'));
}

function refreshPaymentsTable() {
  const t = App.t.bind(App);
  const items = window._milestones || [];
  const p = App.currentProject;
  const overrides = window._projectOverrides || {};
  const calc = Calc.calcFull(p, App.costAssumptions, overrides);
  const margins = window._customMargins || { recommended: 25 };
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  const rec = Calc.calcScenario(calc.totalCost, margins.recommended, p.num_participants, p.num_training_days, vat);
  const totalContract = rec.sellingPriceIncludingVat;

  const totalPct = items.reduce((s, m) => s + (Number(m.percentage) || 0), 0);
  const totalAmount = items.reduce((s, m) => s + (Number(m.total_amount) || 0), 0);
  const totalBeforeVat = items.reduce((s, m) => s + (Number(m.amount_before_vat) || 0), 0);
  const totalVatAmt = items.reduce((s, m) => s + (Number(m.vat_amount) || 0), 0);
  const pctOk = Math.abs(totalPct - 100) < 0.01;

  const tbody = document.getElementById('paymentsBody');
  const tfoot = document.querySelector('#paymentsTable tfoot tr');

  if (tbody) tbody.innerHTML = items.map((m, i) => renderMilestoneRow(m, i, totalContract)).join('');

  // ✅ FIX: update tfoot totals live
  if (tfoot) {
    tfoot.innerHTML = `
      <td colspan="3"><strong>${t('الإجمالي', 'Total')}</strong></td>
      <td class="${pctOk ? 'text-success' : 'text-danger'} fw-bold">${App.formatPct(totalPct, 1)}</td>
      <td><strong>${App.formatSAR(totalBeforeVat)} SAR</strong></td>
      <td><strong>${App.formatSAR(totalVatAmt)} SAR</strong></td>
      <td><strong class="text-accent">${App.formatSAR(totalAmount)} SAR</strong></td>
      <td colspan="3"></td>
    `;
  }

  // ✅ Also update the summary bar (total %, total amounts)
  const pctEl = document.getElementById('paymentTotalPct');
  const amtEl = document.getElementById('paymentTotalAmt');
  if (pctEl) {
    pctEl.className = pctOk ? 'text-success fw-bold' : 'text-danger fw-bold';
    pctEl.textContent = App.formatPct(totalPct, 1);
  }
  if (amtEl) amtEl.textContent = App.formatSAR(totalAmount) + ' SAR';
}

async function savePayments() {
  const t = App.t.bind(App);
  const btn = document.querySelector('[onclick="savePayments()"]');
  const restore = btn ? setButtonLoading(btn, t('جاري الحفظ...', 'Saving...')) : () => {};
  try {
    const milestones = window._milestones || [];
    const totalPct = milestones.reduce((s, m) => s + (Number(m.percentage) || 0), 0);
    if (milestones.length > 0 && Math.abs(totalPct - 100) > 0.1) {
      showToast(t(`إجمالي النسب يجب أن يساوي 100% (الحالي: ${totalPct.toFixed(1)}%)`, `Total percentages must equal 100% (current: ${totalPct.toFixed(1)}%)`), 'error');
      restore();
      return;
    }
    const saved = await API.post(`/payments/project/${App.currentProject.project_id}/bulk`, milestones);
    window._milestones = saved;
    showToast(t('تم حفظ جدول الدفعات بنجاح', 'Payment schedule saved'));
  } catch(e) { showToast(e.message, 'error'); }
  finally { restore(); }
}

// ============ CASH FLOW PAGE ============
async function renderCashFlow() {
  const t = App.t.bind(App);
  const p = App.currentProject;

  let milestones = window._milestones;
  if (!milestones) {
    try {
      milestones = await API.get(`/payments/project/${p.project_id}`);
      window._milestones = milestones;
    } catch(e) { milestones = []; }
  }

  const overrides = window._projectOverrides || {};
  const calc = Calc.calcFull(p, App.costAssumptions, overrides);
  const margins = window._customMargins || { recommended: 25 };
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  const rec = Calc.calcScenario(calc.totalCost, margins.recommended, p.num_participants, p.num_training_days, vat);

  // Build cash flow data
  const months = [];
  const numDays = Math.max(p.num_training_days || 30, 1);
  const totalCost = calc.totalCost;

  // Distribute costs: 40% upfront, 35% during, 25% end
  const costPhases = [
    { label: t('قبل التنفيذ', 'Pre-Execution'), costPct: 0.40, incomePct: 0 },
    { label: t('أثناء التنفيذ (1)', 'During Execution 1'), costPct: 0.20, incomePct: 0 },
    { label: t('أثناء التنفيذ (2)', 'During Execution 2'), costPct: 0.15, incomePct: 0 },
    { label: t('نهاية المشروع', 'Project End'), costPct: 0.25, incomePct: 0 },
  ];

  // Add payment milestones
  milestones.forEach(m => {
    const pctI = Math.min(Math.floor((milestones.indexOf(m) / milestones.length) * costPhases.length), costPhases.length - 1);
    costPhases[pctI].incomePct += (Number(m.percentage) || 0) / 100;
  });

  // Normalize
  const totalIncomePct = costPhases.reduce((s, p) => s + p.incomePct, 0);
  if (totalIncomePct < 0.99 && milestones.length === 0) {
    costPhases[0].incomePct = 0.30;
    costPhases[1].incomePct = 0.30;
    costPhases[2].incomePct = 0.25;
    costPhases[3].incomePct = 0.15;
  }

  let cumCost = 0;
  let cumIncome = 0;
  const cashFlowData = costPhases.map(phase => {
    const income = rec.sellingPriceIncludingVat * phase.incomePct;
    const cost = totalCost * phase.costPct;
    cumIncome += income;
    cumCost += cost;
    return {
      label: phase.label,
      income,
      cost,
      netCash: income - cost,
      cumIncome,
      cumCost,
      cumNet: cumIncome - cumCost
    };
  });

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-chart-area"></i></div>
        ${t('التدفق النقدي', 'Cash Flow')}
      </div>
    </div>

    <div class="alert alert-info">
      <i class="fas fa-info-circle"></i>
      ${t('يستند التدفق النقدي إلى جدول الدفعات المحدد وتوزيع التكاليف المقدّر', 'Cash flow is based on the configured payment schedule and estimated cost distribution')}
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-chart-line"></i> ${t('مخطط التدفق النقدي', 'Cash Flow Chart')}</div>
      </div>
      <div class="card-body">
        <canvas id="chartCashFlow" height="150"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-table"></i> ${t('جدول التدفق النقدي', 'Cash Flow Table')}</div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>${t('المرحلة', 'Phase')}</th>
              <th>${t('المبالغ المستلمة', 'Client Payments')}</th>
              <th>${t('التكاليف المتوقعة', 'Expected Costs')}</th>
              <th>${t('صافي النقد', 'Net Cash')}</th>
              <th>${t('إجمالي الإيرادات التراكمية', 'Cumulative Revenue')}</th>
              <th>${t('إجمالي التكاليف التراكمية', 'Cumulative Costs')}</th>
              <th>${t('الوضع النقدي التراكمي', 'Cumulative Position')}</th>
            </tr>
          </thead>
          <tbody>
            ${cashFlowData.map(row => `
              <tr>
                <td><strong>${row.label}</strong></td>
                <td class="text-success fw-bold">${App.formatSAR(row.income)} SAR</td>
                <td class="text-danger">${App.formatSAR(row.cost)} SAR</td>
                <td class="${row.netCash >= 0 ? 'text-success' : 'text-danger'} fw-bold">${row.netCash >= 0 ? '+' : ''}${App.formatSAR(row.netCash)} SAR</td>
                <td>${App.formatSAR(row.cumIncome)} SAR</td>
                <td>${App.formatSAR(row.cumCost)} SAR</td>
                <td class="${row.cumNet >= 0 ? 'text-success' : 'text-danger'} fw-bold">${row.cumNet >= 0 ? '+' : ''}${App.formatSAR(row.cumNet)} SAR</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <script>
      setTimeout(function() {
        const ctx = document.getElementById('chartCashFlow');
        if (ctx && typeof Chart !== 'undefined') {
          if (App.charts.cashFlow) App.charts.cashFlow.destroy();
          const data = ${JSON.stringify(cashFlowData)};
          App.charts.cashFlow = new Chart(ctx, {
            type: 'line',
            data: {
              labels: data.map(d => d.label),
              datasets: [
                { label: '${t('الإيرادات التراكمية', 'Cumulative Revenue')}', data: data.map(d => d.cumIncome), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 },
                { label: '${t('التكاليف التراكمية', 'Cumulative Costs')}', data: data.map(d => d.cumCost), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 },
                { label: '${t('الوضع النقدي', 'Cash Position')}', data: data.map(d => d.cumNet), borderColor: '#c8973a', borderWidth: 2, tension: 0.3, borderDash: [5,5] }
              ]
            },
            options: {
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { ticks: { callback: v => v.toLocaleString() + ' SAR' } } }
            }
          });
        }
      }, 100);
    </script>
  `;
}

// ============ EXECUTIVE DASHBOARD PAGE ============
async function renderExecDashboard() {
  const t = App.t.bind(App);
  const p = App.currentProject;
  const overrides = window._projectOverrides || {};
  const calc = Calc.calcFull(p, App.costAssumptions, overrides);
  const margins = window._customMargins || { competitive: 15, recommended: 25, premium: 35 };
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;

  const recScenario = Calc.calcScenario(calc.totalCost, margins.recommended, p.num_participants, p.num_training_days, vat);
  const compScenario = Calc.calcScenario(calc.totalCost, margins.competitive, p.num_participants, p.num_training_days, vat);
  const premScenario = Calc.calcScenario(calc.totalCost, margins.premium, p.num_participants, p.num_training_days, vat);
  const be = calc.breakEven;

  const topCosts = [
    { label: t('المدربون', 'Trainers'), value: calc.direct.trainers },
    { label: t('القاعة', 'Venue'), value: calc.direct.venue },
    { label: t('الضيافة', 'Catering'), value: calc.direct.catering },
    { label: t('التكاليف الإدارية', 'Admin Overhead'), value: calc.indirect.adminOverhead },
    { label: t('إدارة المشروع', 'Project Mgmt'), value: calc.direct.projectManagement },
    { label: t('السفر', 'Travel'), value: calc.direct.travel },
    { label: t('المواد', 'Materials'), value: calc.direct.printing + calc.direct.stationery },
    { label: t('التقنية', 'Technology'), value: calc.direct.lmsTechnology },
    { label: t('الشهادات', 'Certificates'), value: calc.direct.certificates + calc.direct.assessments },
    { label: t('أخرى', 'Other'), value: calc.direct.equipment + calc.direct.marketing + calc.direct.otherDirect },
  ].filter(c => c.value > 0).sort((a,b) => b.value - a.value);

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-chart-pie"></i></div>
        ${t('لوحة الإدارة التنفيذية', 'Executive Dashboard')}
      </div>
    </div>

    <!-- Main KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card success">
        <div class="kpi-label">${t('قيمة المشروع (موصى به)', 'Project Value (Rec.)')}</div>
        <div class="kpi-value large">${App.formatSAR(recScenario.sellingPriceBeforeVat)} <span class="sar">SAR</span></div>
        <div class="kpi-sub">${t('قبل الضريبة', 'Before VAT')}</div>
        <div class="kpi-icon gold"><i class="fas fa-coins"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('إجمالي التكلفة', 'Total Cost')}</div>
        <div class="kpi-value large">${App.formatSAR(calc.totalCost)} <span class="sar">SAR</span></div>
        <div class="kpi-icon orange"><i class="fas fa-receipt"></i></div>
      </div>
      <div class="kpi-card success">
        <div class="kpi-label">${t('الربح الإجمالي (موصى به)', 'Gross Profit (Rec.)')}</div>
        <div class="kpi-value large">${App.formatSAR(recScenario.grossProfit)} <span class="sar">SAR</span></div>
        <div class="kpi-icon green"><i class="fas fa-chart-line"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('هامش الربح (موصى به)', 'Gross Margin (Rec.)')}</div>
        <div class="kpi-value large">${App.formatPct(recScenario.grossMargin)}</div>
        <div class="kpi-icon blue"><i class="fas fa-percentage"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('التكلفة/متدرب', 'Cost/Participant')}</div>
        <div class="kpi-value">${App.formatSAR(calc.costPerParticipant)} <span class="sar">SAR</span></div>
        <div class="kpi-icon blue"><i class="fas fa-user"></i></div>
      </div>
      <div class="kpi-card success">
        <div class="kpi-label">${t('الإيراد/متدرب (موصى به)', 'Revenue/Part. (Rec.)')}</div>
        <div class="kpi-value">${App.formatSAR(recScenario.revenuePerParticipant)} <span class="sar">SAR</span></div>
        <div class="kpi-icon green"><i class="fas fa-user-tie"></i></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t('الإيراد/يوم', 'Revenue/Day')}</div>
        <div class="kpi-value">${App.formatSAR(recScenario.revenuePerTrainingDay)} <span class="sar">SAR</span></div>
        <div class="kpi-icon blue"><i class="fas fa-calendar-day"></i></div>
      </div>
      <div class="kpi-card warning">
        <div class="kpi-label">${t('سعر التعادل', 'Break-Even Price')}</div>
        <div class="kpi-value">${App.formatSAR(be.breakEvenPrice)} <span class="sar">SAR</span></div>
        <div class="kpi-icon orange"><i class="fas fa-balance-scale"></i></div>
      </div>
    </div>

    <!-- Charts Row 1 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card">
        <div class="card-header"><div class="card-title"><i class="fas fa-chart-pie"></i> ${t('توزيع التكاليف', 'Cost Distribution')}</div></div>
        <div class="card-body"><canvas id="chartCostDist" height="200"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title"><i class="fas fa-chart-bar"></i> ${t('مقارنة السيناريوهات', 'Scenario Comparison')}</div></div>
        <div class="card-body"><canvas id="chartScenarios" height="200"></canvas></div>
      </div>
    </div>

    <!-- Charts Row 2 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><div class="card-title"><i class="fas fa-chart-bar"></i> ${t('أكبر عناصر التكلفة', 'Top Cost Drivers')}</div></div>
        <div class="card-body"><canvas id="chartTopCosts" height="200"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title"><i class="fas fa-chart-bar"></i> ${t('الربحية بالسيناريو', 'Profitability by Scenario')}</div></div>
        <div class="card-body"><canvas id="chartProfitability" height="200"></canvas></div>
      </div>
    </div>

    <script>
      setTimeout(function() {
        const tc = ${calc.totalCost.toFixed(0)};
        const topCosts = ${JSON.stringify(topCosts)};

        // Cost Distribution
        const ctx1 = document.getElementById('chartCostDist');
        if (ctx1) {
          if (App.charts.costDist) App.charts.costDist.destroy();
          App.charts.costDist = new Chart(ctx1, {
            type: 'doughnut',
            data: {
              labels: ['${t('مباشرة', 'Direct')}', '${t('غير مباشرة', 'Indirect')}'],
              datasets: [{ data: [${calc.direct.total.toFixed(0)}, ${calc.indirect.total.toFixed(0)}], backgroundColor: ['#1a2e4a','#c8973a'], borderWidth: 0 }]
            },
            options: { plugins: { legend: { position: 'bottom' } }, cutout: '60%' }
          });
        }

        // Scenarios Comparison
        const ctx2 = document.getElementById('chartScenarios');
        if (ctx2) {
          if (App.charts.scenarios) App.charts.scenarios.destroy();
          App.charts.scenarios = new Chart(ctx2, {
            type: 'bar',
            data: {
              labels: ['${t('تنافسي', 'Competitive')}','${t('موصى به', 'Recommended')}','${t('مميز', 'Premium')}'],
              datasets: [
                { label: '${t('التكلفة', 'Cost')}', data: [tc, tc, tc], backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 5 },
                { label: '${t('السعر', 'Price')}', data: [${compScenario.sellingPriceBeforeVat.toFixed(0)}, ${recScenario.sellingPriceBeforeVat.toFixed(0)}, ${premScenario.sellingPriceBeforeVat.toFixed(0)}], backgroundColor: ['rgba(59,130,246,0.8)','rgba(200,151,58,0.9)','rgba(124,58,237,0.8)'], borderRadius: 5 }
              ]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { ticks: { callback: v => v.toLocaleString() } } } }
          });
        }

        // Top Costs
        const ctx3 = document.getElementById('chartTopCosts');
        if (ctx3) {
          if (App.charts.topCosts) App.charts.topCosts.destroy();
          App.charts.topCosts = new Chart(ctx3, {
            type: 'bar',
            data: {
              labels: topCosts.slice(0, 7).map(c => c.label),
              datasets: [{ data: topCosts.slice(0, 7).map(c => c.value.toFixed(0)), backgroundColor: '#1a2e4a', borderRadius: 5 }]
            },
            options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => v.toLocaleString() } } } }
          });
        }

        // Profitability
        const ctx4 = document.getElementById('chartProfitability');
        if (ctx4) {
          if (App.charts.profitability) App.charts.profitability.destroy();
          App.charts.profitability = new Chart(ctx4, {
            type: 'bar',
            data: {
              labels: ['${t('تنافسي', 'Competitive')}','${t('موصى به', 'Recommended')}','${t('مميز', 'Premium')}'],
              datasets: [{ label: '${t('الربح الإجمالي SAR', 'Gross Profit SAR')}', data: [${compScenario.grossProfit.toFixed(0)}, ${recScenario.grossProfit.toFixed(0)}, ${premScenario.grossProfit.toFixed(0)}], backgroundColor: ['rgba(59,130,246,0.8)','rgba(16,185,129,0.8)','rgba(124,58,237,0.8)'], borderRadius: 5 }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => v.toLocaleString() } } } }
          });
        }
      }, 100);
    </script>
  `;
}

// ============ MANAGEMENT RECOMMENDATION PAGE ============
async function renderRecommendation() {
  const t = App.t.bind(App);
  const p = App.currentProject;
  const overrides = window._projectOverrides || {};
  const calc = Calc.calcFull(p, App.costAssumptions, overrides);
  const margins = window._customMargins || { competitive: 15, recommended: 25, premium: 35 };
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
  const recScenario = Calc.calcScenario(calc.totalCost, margins.recommended, p.num_participants, p.num_training_days, vat);
  const be = calc.breakEven;

  // Top 3 cost drivers
  const costDrivers = [
    { label: t('المدربون', 'Trainers'), value: calc.direct.trainers },
    { label: t('القاعة والضيافة', 'Venue & Catering'), value: calc.direct.venue + calc.direct.catering },
    { label: t('الإدارة', 'Management'), value: calc.direct.coordinators + calc.direct.projectManagement },
    { label: t('السفر', 'Travel'), value: calc.direct.travel },
    { label: t('المواد', 'Materials'), value: calc.direct.printing + calc.direct.stationery + calc.direct.certificates },
  ].sort((a,b) => b.value - a.value).slice(0, 3);

  const isMarginWeak = recScenario.grossMargin < be.minMarginPct;

  // Auto-generate recommendation text
  const autoRec = {
    recommended_price: recScenario.sellingPriceBeforeVat,
    recommended_scenario: 'recommended',
    expected_gross_profit: recScenario.grossProfit,
    gross_margin: recScenario.grossMargin,
    major_cost_drivers: costDrivers.map(c => `${c.label}: ${App.formatSAR(c.value)} SAR`).join(', '),
    commercial_risks: t(
      `${p.contract_type === 'tender' ? 'مخاطر المناقصة التنافسية؛ ' : ''}${recScenario.grossMargin < 20 ? 'هامش ربح منخفض نسبياً؛ ' : ''}تقلب أسعار الخامات والخدمات؛ تغيير عدد المشاركين.`,
      `${p.contract_type === 'tender' ? 'Competitive tender risks; ' : ''}${recScenario.grossMargin < 20 ? 'Relatively low profit margin; ' : ''}Cost fluctuations; participant count changes.`
    ),
    pricing_observations: t(
      `السعر الموصى به يحقق هامش ربح ${App.formatPct(recScenario.grossMargin)} وهو ${recScenario.grossMargin >= 20 ? 'مناسب وصحي تجارياً' : 'يستدعي مراجعة'}. التكلفة لكل متدرب ${App.formatSAR(calc.costPerParticipant)} SAR.`,
      `Recommended price achieves ${App.formatPct(recScenario.grossMargin)} margin which is ${recScenario.grossMargin >= 20 ? 'commercially healthy' : 'subject to review'}. Cost per participant: ${App.formatSAR(calc.costPerParticipant)} SAR.`
    ),
    margin_warning: isMarginWeak ? t(`⚠️ تحذير: هامش الربح ${App.formatPct(recScenario.grossMargin)} أقل من الحد الأدنى ${App.formatPct(be.minMarginPct)}`, `⚠️ Warning: ${App.formatPct(recScenario.grossMargin)} margin below ${App.formatPct(be.minMarginPct)} minimum`) : '',
    suggested_decision: t(
      `يُوصى بالسيناريو ب (الموصى به) بسعر ${App.formatSAR(recScenario.sellingPriceBeforeVat)} SAR قبل الضريبة. ${p.contract_type === 'tender' ? 'في حالة الضغط التنافسي يمكن النظر في السيناريو أ مع مراجعة إمكانية تخفيض التكاليف.' : 'يمكن تقديم السيناريو ج للعملاء الباحثين عن جودة مميزة.'}`,
      `Recommend Scenario B at ${App.formatSAR(recScenario.sellingPriceBeforeVat)} SAR before VAT. ${p.contract_type === 'tender' ? 'Under competitive pressure, Scenario A may be considered with cost review.' : 'Scenario C can be offered to quality-focused clients.'}`
    ),
  };

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-star"></i></div>
        ${t('توصية الإدارة', 'Management Recommendation')}
      </div>
      <button class="btn btn-accent" onclick="saveRecommendation()">
        <i class="fas fa-save"></i> ${t('حفظ التوصية', 'Save Recommendation')}
      </button>
    </div>

    ${isMarginWeak ? `<div class="alert alert-warning"><i class="fas fa-exclamation-triangle"></i> <strong>${autoRec.margin_warning}</strong></div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <!-- Key Figures -->
      <div class="card">
        <div class="card-header"><div class="card-title"><i class="fas fa-chart-line"></i> ${t('الأرقام الرئيسية', 'Key Figures')}</div></div>
        <div class="card-body">
          ${[
            [t('السعر الموصى به قبل الضريبة', 'Recommended Price (Before VAT)'), App.formatSAR(autoRec.recommended_price) + ' SAR', 'text-accent'],
            [t('الربح الإجمالي المتوقع', 'Expected Gross Profit'), App.formatSAR(autoRec.expected_gross_profit) + ' SAR', 'text-success'],
            [t('هامش الربح الإجمالي', 'Gross Margin %'), App.formatPct(autoRec.gross_margin), isMarginWeak ? 'text-warning' : 'text-success'],
            [t('السعر شامل الضريبة', 'Price Including VAT'), App.formatSAR(recScenario.sellingPriceIncludingVat) + ' SAR', ''],
            [t('سعر التعادل', 'Break-Even Price'), App.formatSAR(be.breakEvenPrice) + ' SAR', ''],
            [t('هامش الأمان', 'Safety Margin'), App.formatSAR(autoRec.recommended_price - be.breakEvenPrice) + ' SAR', 'text-success'],
          ].map(([l, v, cls]) => `
            <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border-light)">
              <span style="font-size:13px;color:var(--text-secondary)">${l}</span>
              <strong class="${cls}" style="font-size:14px">${v}</strong>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Editable Recommendation Text -->
      <div class="card">
        <div class="card-header"><div class="card-title"><i class="fas fa-edit"></i> ${t('نص التوصية (قابل للتعديل)', 'Recommendation Text (Editable)')}</div></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:12px">
          <div class="form-group">
            <label>${t('أكبر عناصر التكلفة', 'Major Cost Drivers')}</label>
            <textarea id="rec_cost_drivers" rows="2">${autoRec.major_cost_drivers}</textarea>
          </div>
          <div class="form-group">
            <label>${t('المخاطر التجارية الرئيسية', 'Main Commercial Risks')}</label>
            <textarea id="rec_risks" rows="2">${autoRec.commercial_risks}</textarea>
          </div>
          <div class="form-group">
            <label>${t('ملاحظات التسعير', 'Pricing Observations')}</label>
            <textarea id="rec_observations" rows="2">${autoRec.pricing_observations}</textarea>
          </div>
          ${isMarginWeak ? `
          <div class="form-group">
            <label class="text-warning">${t('تحذير الهامش', 'Margin Warning')}</label>
            <textarea id="rec_warning" rows="1">${autoRec.margin_warning}</textarea>
          </div>` : ''}
          <div class="form-group">
            <label>${t('القرار الإداري المقترح', 'Suggested Management Decision')}</label>
            <textarea id="rec_decision" rows="3">${autoRec.suggested_decision}</textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- Recommendation Summary Card -->
    <div class="card mt-16" style="border:2px solid var(--accent)">
      <div class="card-header" style="background:linear-gradient(135deg,#1a2e4a,#2d4a6e)">
        <div class="card-title" style="color:white"><i class="fas fa-star" style="color:var(--accent-light)"></i> ${t('ملخص التوصية التنفيذية', 'Executive Recommendation Summary')}</div>
        <span class="badge" style="background:var(--accent);color:white">${p.project_id}</span>
      </div>
      <div class="card-body" style="background:#fefdf8">
        <div style="font-size:15px;line-height:1.8;color:var(--text-primary)">
          <p><strong>${t('المشروع:', 'Project:')}</strong> ${p.project_name} — ${p.client_name}</p>
          <p><strong>${t('القرار الموصى به:', 'Recommended Decision:')}</strong> ${autoRec.suggested_decision}</p>
          <p><strong>${t('أكبر عناصر التكلفة:', 'Top Cost Drivers:')}</strong> ${autoRec.major_cost_drivers}</p>
          <p><strong>${t('المخاطر:', 'Risks:')}</strong> ${autoRec.commercial_risks}</p>
          ${isMarginWeak ? `<p style="color:var(--warning);font-weight:700">${autoRec.margin_warning}</p>` : ''}
        </div>
      </div>
    </div>

    <input type="hidden" id="rec_recommended_price" value="${autoRec.recommended_price}">
    <input type="hidden" id="rec_gross_profit" value="${autoRec.expected_gross_profit}">
    <input type="hidden" id="rec_gross_margin" value="${autoRec.gross_margin}">
  `;
}

async function saveRecommendation() {
  const t = App.t.bind(App);
  const btn = document.querySelector('[onclick="saveRecommendation()"]');
  const restore = btn ? setButtonLoading(btn, t('جاري الحفظ...', 'Saving...')) : () => {};
  try {
    const data = {
      recommended_price: parseFloat(document.getElementById('rec_recommended_price')?.value) || 0,
      recommended_scenario: 'recommended',
      expected_gross_profit: parseFloat(document.getElementById('rec_gross_profit')?.value) || 0,
      gross_margin: parseFloat(document.getElementById('rec_gross_margin')?.value) || 0,
      major_cost_drivers: document.getElementById('rec_cost_drivers')?.value || '',
      commercial_risks: document.getElementById('rec_risks')?.value || '',
      pricing_observations: document.getElementById('rec_observations')?.value || '',
      margin_warning: document.getElementById('rec_warning')?.value || '',
      suggested_decision: document.getElementById('rec_decision')?.value || '',
      is_custom: 1,
    };
    await API.post(`/projects/${App.currentProject.project_id}/recommendation`, data);
    showToast(t('تم حفظ التوصية بنجاح', 'Recommendation saved'));
  } catch(e) { showToast(e.message, 'error'); }
  finally { restore(); }
}

// ============ REPORTS PAGE ============
function renderReports() {
  const t = App.t.bind(App);
  const p = App.currentProject;

  const reports = [
    { id: 'exec-summary', icon: 'fa-file-invoice', title: t('ملخص التسعير التنفيذي', 'Executive Pricing Summary'), desc: t('ملخص تنفيذي بالأسعار والسيناريوهات والأرباح', 'Executive summary with prices, scenarios, and profits') },
    { id: 'detailed-cost', icon: 'fa-file-invoice-dollar', title: t('كشف التكاليف المفصّل', 'Detailed Cost Sheet'), desc: t('كشف تفصيلي بجميع التكاليف المباشرة وغير المباشرة', 'Detailed breakdown of all direct and indirect costs') },
    { id: 'client-boq', icon: 'fa-list-ol', title: t('BOQ للعميل', 'Client BOQ'), desc: t('جدول الكميات المعد للعميل', 'Bill of quantities prepared for the client') },
    { id: 'scenario-comparison', icon: 'fa-chart-bar', title: t('مقارنة سيناريوهات التسعير', 'Pricing Scenario Comparison'), desc: t('مقارنة مفصلة بين السيناريوهات الثلاثة', 'Detailed comparison of all three pricing scenarios') },
    { id: 'payment-schedule', icon: 'fa-calendar-check', title: t('جدول الدفعات', 'Payment Schedule'), desc: t('جدول المراحل وجدول الدفع', 'Milestone and payment schedule table') },
    { id: 'profitability', icon: 'fa-chart-pie', title: t('تحليل الربحية', 'Profitability Analysis'), desc: t('تحليل الربحية وتعادل التكاليف', 'Profitability and break-even analysis') },
    { id: 'management-rec', icon: 'fa-star', title: t('توصية الإدارة', 'Management Recommendation'), desc: t('التوصية الإدارية الكاملة', 'Complete management recommendation') },
  ];

  return `
    <div class="section-header">
      <div class="section-title">
        <div class="title-icon"><i class="fas fa-file-alt"></i></div>
        ${t('التقارير', 'Reports')}
      </div>
      <button class="btn btn-outline btn-sm" onclick="window.print()">
        <i class="fas fa-print"></i> ${t('طباعة الصفحة الحالية', 'Print Current Page')}
      </button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
      ${reports.map(r => `
        <div class="card" style="cursor:pointer;transition:all 0.2s" onclick="viewReport('${r.id}')" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor=''">
          <div class="card-body" style="padding:20px">
            <div style="display:flex;align-items:flex-start;gap:14px">
              <div style="width:42px;height:42px;background:rgba(200,151,58,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--accent);flex-shrink:0">
                <i class="fas ${r.icon}"></i>
              </div>
              <div>
                <div style="font-weight:700;font-size:14px;color:var(--primary);margin-bottom:5px">${r.title}</div>
                <div style="font-size:12px;color:var(--text-muted)">${r.desc}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px">
              <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();viewReport('${r.id}')">
                <i class="fas fa-eye"></i> ${t('عرض', 'View')}
              </button>
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();window.print()" title="${t('طباعة', 'Print')}">
                <i class="fas fa-print"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <div id="reportContent" style="margin-top:24px"></div>
  `;
}

async function viewReport(reportId) {
  const t = App.t.bind(App);
  const container = document.getElementById('reportContent');
  const p = App.currentProject;
  const overrides = window._projectOverrides || {};
  const calc = Calc.calcFull(p, App.costAssumptions, overrides);
  const margins = window._customMargins || { competitive: 15, recommended: 25, premium: 35 };
  const vat = parseFloat(App.costAssumptions.vat_percent) || 15;

  const compS = Calc.calcScenario(calc.totalCost, margins.competitive, p.num_participants, p.num_training_days, vat);
  const recS = Calc.calcScenario(calc.totalCost, margins.recommended, p.num_participants, p.num_training_days, vat);
  const premS = Calc.calcScenario(calc.totalCost, margins.premium, p.num_participants, p.num_training_days, vat);
  const be = calc.breakEven;

  let html = '';

  if (reportId === 'exec-summary') {
    html = `
      <div class="card" style="border:2px solid var(--accent)">
        <div class="card-header no-print" style="background:var(--primary);color:white">
          <div class="card-title" style="color:white"><i class="fas fa-file-invoice"></i> ${t('ملخص التسعير التنفيذي', 'Executive Pricing Summary')}</div>
          <button class="btn btn-sm" style="background:var(--accent);color:white" onclick="window.print()"><i class="fas fa-print"></i> ${t('طباعة', 'Print')}</button>
        </div>
        <div class="card-body">
          <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--border)">
            <h2 style="font-size:22px;color:var(--primary);margin-bottom:4px">${p.project_name}</h2>
            <div style="color:var(--text-secondary)">${p.client_name} · ${p.project_id}</div>
          </div>
          <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
            ${[
              [t('إجمالي التكلفة', 'Total Cost'), calc.totalCost],
              [t('السعر الموصى به (ق.ض)', 'Recommended Price (BV)'), recS.sellingPriceBeforeVat],
              [t('الربح الإجمالي', 'Gross Profit'), recS.grossProfit],
              [t('هامش الربح', 'Margin %'), null, App.formatPct(recS.grossMargin)],
            ].map(([l, v, custom]) => `
              <div style="text-align:center;padding:14px;background:#f8fafc;border-radius:8px">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px">${l}</div>
                <div style="font-size:20px;font-weight:800;color:var(--primary)">${custom || App.formatSAR(v)}</div>
                ${v !== null && !custom ? '<div style="font-size:10px;color:var(--text-muted)">SAR</div>' : ''}
              </div>
            `).join('')}
          </div>
          <div class="scenarios-grid" style="margin-top:16px">
            ${[
              { label: t('أ - تنافسي', 'A - Competitive'), s: compS, m: margins.competitive, color: '#2563eb' },
              { label: t('ب - موصى به ★', 'B - Recommended ★'), s: recS, m: margins.recommended, color: '#c8973a' },
              { label: t('ج - مميز', 'C - Premium'), s: premS, m: margins.premium, color: '#7c3aed' },
            ].map(item => `
              <div style="border:2px solid ${item.color};border-radius:10px;overflow:hidden">
                <div style="background:${item.color};color:white;padding:10px 14px;text-align:center;font-weight:700">${item.label}</div>
                <div style="padding:12px">
                  ${[
                    [t('هامش', 'Margin'), App.formatPct(item.m)],
                    [t('السعر ق.ض', 'Price BV'), App.formatSAR(item.s.sellingPriceBeforeVat) + ' SAR'],
                    [t('شامل الضريبة', 'Incl. VAT'), App.formatSAR(item.s.sellingPriceIncludingVat) + ' SAR'],
                    [t('الربح', 'Profit'), App.formatSAR(item.s.grossProfit) + ' SAR'],
                  ].map(([l,v]) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid #eee"><span>${l}</span><strong>${v}</strong></div>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  } else if (reportId === 'detailed-cost') {
    const directItems = [
      [t('المدربون', 'Trainers'), calc.direct.trainers],
      [t('المنسقون', 'Coordinators'), calc.direct.coordinators],
      [t('إدارة المشروع', 'Project Management'), calc.direct.projectManagement],
      [t('القاعة/الفندق', 'Venue/Hotel'), calc.direct.venue],
      [t('الضيافة', 'Catering'), calc.direct.catering],
      [t('الطباعة والمواد', 'Printing & Materials'), calc.direct.printing + calc.direct.stationery],
      [t('الشهادات', 'Certificates'), calc.direct.certificates],
      [t('التقييم', 'Assessments'), calc.direct.assessments],
      [t('نظام التعلم والتقنية', 'LMS & Technology'), calc.direct.lmsTechnology],
      [t('السفر والإقامة والمواصلات', 'Travel & Accommodation'), calc.direct.travel],
      [t('المعدات', 'Equipment'), calc.direct.equipment],
      [t('الاستشاريون', 'Consultants'), calc.direct.consultants],
      [t('التسويق', 'Marketing'), calc.direct.marketing],
      [t('التصوير والتصاريح', 'Photography & Permits'), calc.direct.photographer + calc.direct.permits],
      [t('تكاليف مباشرة أخرى', 'Other Direct'), calc.direct.otherDirect],
    ].filter(([,v]) => v > 0);

    html = `
      <div class="card">
        <div class="card-header no-print">
          <div class="card-title"><i class="fas fa-file-invoice-dollar"></i> ${t('كشف التكاليف المفصّل', 'Detailed Cost Sheet')}</div>
          <button class="btn btn-outline btn-sm" onclick="window.print()"><i class="fas fa-print"></i></button>
        </div>
        <div class="card-body">
          <h3 style="margin-bottom:14px;color:var(--primary)">${t('أ. التكاليف المباشرة', 'A. Direct Costs')}</h3>
          <table>
            <thead><tr><th>${t('البند', 'Item')}</th><th>${t('المبلغ', 'Amount')}</th><th>${t('النسبة من المباشرة', '% of Direct')}</th></tr></thead>
            <tbody>
              ${directItems.map(([l,v]) => `<tr><td>${l}</td><td>${App.formatSAR(v)} SAR</td><td>${calc.direct.total > 0 ? (v/calc.direct.total*100).toFixed(1) : 0}%</td></tr>`).join('')}
            </tbody>
            <tfoot><tr class="table-total"><td><strong>${t('إجمالي المباشرة', 'Total Direct')}</strong></td><td><strong>${App.formatSAR(calc.direct.total)} SAR</strong></td><td>100%</td></tr></tfoot>
          </table>
          <h3 style="margin:16px 0 14px;color:var(--primary)">${t('ب. التكاليف غير المباشرة', 'B. Indirect Costs')}</h3>
          <table>
            <thead><tr><th>${t('البند', 'Item')}</th><th>${t('المبلغ', 'Amount')}</th><th>${t('الأساس', 'Basis')}</th></tr></thead>
            <tbody>
              <tr><td>${t('التكاليف الإدارية', 'Admin Overhead')}</td><td>${App.formatSAR(calc.indirect.adminOverhead)} SAR</td><td>${App.costAssumptions.admin_overhead_percent || 12}% ${t('من المباشرة', 'of Direct')}</td></tr>
              <tr><td>${t('الطوارئ', 'Contingency')}</td><td>${App.formatSAR(calc.indirect.contingency)} SAR</td><td>${App.costAssumptions.contingency_percent || 5}% ${t('من المباشرة', 'of Direct')}</td></tr>
            </tbody>
            <tfoot><tr class="table-total"><td><strong>${t('إجمالي غير المباشرة', 'Total Indirect')}</strong></td><td><strong>${App.formatSAR(calc.indirect.total)} SAR</strong></td><td></td></tr></tfoot>
          </table>
          <div style="background:var(--primary);color:white;padding:12px 16px;border-radius:8px;margin-top:16px;display:flex;justify-content:space-between">
            <strong style="font-size:16px">${t('إجمالي تكلفة المشروع', 'Total Project Cost')}</strong>
            <strong style="font-size:18px">${App.formatSAR(calc.totalCost)} SAR</strong>
          </div>
        </div>
      </div>
    `;
  }

  if (html) {
    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth' });
  } else {
    showToast(t('هذا التقرير قيد التطوير', 'This report is coming soon'), 'info');
  }
}

// ============ SAMPLE PROJECT ============
async function loadSampleProject() {
  const t = App.t.bind(App);
  if (!confirm(t('هل تريد تحميل مشروع تجريبي سعودي واقعي؟ سيتم إنشاء مشروع نموذجي مع جميع البيانات.', 'Load a realistic Saudi training sample project? A complete sample project will be created.'))) return;

  try {
    const projectData = {
      client_name: 'أرامكو السعودية',
      project_name: 'برنامج القيادة والإدارة المتقدمة للكوادر الوطنية 2025',
      project_type: 'corporate',
      contract_type: 'direct',
      city: 'الرياض',
      delivery_mode: 'hybrid',
      start_date: '2025-03-01',
      end_date: '2025-06-30',
      duration_days: 120,
      num_programs: 3,
      num_cohorts: 4,
      num_participants: 80,
      num_training_days: 15,
      hours_per_day: 8,
      trainer_type: 'leadership',
      status: 'active',
      notes: `⚠️ هذا مشروع تجريبي تعليمي - يمكن تعديل جميع البيانات والأرقام.
البرنامج يشمل 3 مسارات تدريبية للقيادة والإدارة مع 4 دفعات من فريق أرامكو.
البيانات المالية محسوبة تلقائياً بناءً على معدلات التكلفة الافتراضية.`
    };

    const project = await API.post('/projects', projectData);
    App.projects.unshift(project);
    App.currentProject = project;

    // Set custom margins for sample
    window._customMargins = { competitive: 18, recommended: 28, premium: 38 };

    // Generate and save scenarios
    await recalcAndSaveScenarios();

    // Create sample BOQ
    const calc = Calc.calcFull(project, App.costAssumptions);
    const vat = parseFloat(App.costAssumptions.vat_percent) || 15;
    const margin = 28;
    const boqItems = [
      { category: 'المدربون', description_ar: 'مدربو القيادة والإدارة (3 مدربين × 15 يوم × 4 دفعات)', quantity: 180, unit: 'يوم', unit_cost: App.costAssumptions.trainer_leadership_day_rate || 8000, selling_unit_price: (App.costAssumptions.trainer_leadership_day_rate || 8000) * (1 + margin/100) / (1 - margin/100) },
      { category: 'القاعات والضيافة', description_ar: 'إيجار قاعة التدريب والفندق والضيافة اليومية', quantity: 60, unit: 'يوم', unit_cost: (App.costAssumptions.hotel_venue_cost_per_person_per_day || 500) * 80, selling_unit_price: ((App.costAssumptions.hotel_venue_cost_per_person_per_day || 500) + (App.costAssumptions.coffee_break_cost_per_person_per_day || 120)) * 80 },
      { category: 'المواد التدريبية', description_ar: 'مواد تدريبية وقرطاسية وشهادات (80 متدرب)', quantity: 80, unit: 'شخص', unit_cost: (App.costAssumptions.printing_cost_per_trainee || 150) + (App.costAssumptions.stationery_cost || 50), selling_unit_price: ((App.costAssumptions.printing_cost_per_trainee || 150) + (App.costAssumptions.stationery_cost || 50)) * 1.35 },
      { category: 'التقنية', description_ar: 'منصة إدارة التعلم والتقنية المساعدة', quantity: 1, unit: 'مشروع', unit_cost: (App.costAssumptions.lms_cost || 5000) + (App.costAssumptions.technology_cost || 3000), selling_unit_price: ((App.costAssumptions.lms_cost || 5000) + (App.costAssumptions.technology_cost || 3000)) * 1.4 },
      { category: 'الإدارة', description_ar: 'التنسيق وإدارة المشروع والإدارية', quantity: 1, unit: 'مشروع', unit_cost: (App.costAssumptions.coordinator_day_rate || 800) * 60 + (App.costAssumptions.project_manager_cost || 15000), selling_unit_price: ((App.costAssumptions.coordinator_day_rate || 800) * 60 + (App.costAssumptions.project_manager_cost || 15000)) * 1.3 },
    ];
    await API.post(`/boq/project/${project.project_id}/bulk`, boqItems.map((item, i) => {
      const tBV = item.quantity * item.selling_unit_price;
      const vatA = tBV * vat / 100;
      return { ...item, item_number: i + 1, total_before_vat: tBV, vat_amount: vatA, total_including_vat: tBV + vatA, notes: '' };
    }));

    // Create sample payment schedule
    const recScen = Calc.calcScenario(Calc.calcFull(project, App.costAssumptions).totalCost, margin, project.num_participants, project.num_training_days, vat);
    const totalIncl = recScen.sellingPriceIncludingVat;
    const milestones = [
      { ar: 'دفعة التعاقد وبدء التحضير', pct: 25, date: '2025-01-15' },
      { ar: 'دفعة انطلاق التنفيذ (الدفعة الأولى والثانية)', pct: 35, date: '2025-03-15' },
      { ar: 'دفعة منتصف المشروع (الدفعة الثالثة)', pct: 25, date: '2025-05-01' },
      { ar: 'الدفعة الختامية عند إنجاز المشروع', pct: 15, date: '2025-07-01' },
    ].map((m, i) => {
      const total = totalIncl * m.pct / 100;
      return {
        milestone_number: i + 1,
        milestone_name_ar: m.ar,
        description: '',
        percentage: m.pct,
        amount_before_vat: total / (1 + vat / 100),
        vat_amount: total * (vat / 100) / (1 + vat / 100),
        total_amount: total,
        expected_date: m.date,
        status: 'pending',
        notes: ''
      };
    });
    await API.post(`/payments/project/${project.project_id}/bulk`, milestones);

    showToast(t('تم تحميل المشروع التجريبي بنجاح! جاهز للاستخدام.', 'Sample project loaded! Ready to use.'));
    navigate('project-overview');
  } catch(e) { showToast(e.message, 'error'); }
}

// ============ LOAD SETTINGS WITH FULL DETAILS ============
async function loadFullSettings() {
  try {
    const costs = await API.get('/costs');
    window._fullAssumptions = costs;
    App.costAssumptions = {};
    costs.forEach(c => { App.costAssumptions[c.key] = c.value; });
  } catch(e) {}
}

// ============ PROJECT OVERRIDES LOADER ============
async function loadProjectOverrides() {
  if (!App.currentProject) return;
  try {
    const overrides = await API.get(`/projects/${App.currentProject.project_id}/overrides`);
    window._projectOverrides = overrides;
  } catch(e) {}
}

// Auto-load full assumptions on start  
document.addEventListener('DOMContentLoaded', async function() {
  await loadFullSettings();
});
