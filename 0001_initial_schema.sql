-- ==========================================
-- Training Proposal & Pricing Engine
-- Initial Database Schema
-- ==========================================

-- Global Cost Assumptions (Settings)
CREATE TABLE IF NOT EXISTS cost_assumptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  unit TEXT DEFAULT 'SAR',
  description_ar TEXT,
  description_en TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'corporate',
  contract_type TEXT NOT NULL DEFAULT 'direct',
  city TEXT,
  start_date DATE,
  end_date DATE,
  duration_days INTEGER DEFAULT 0,
  num_programs INTEGER DEFAULT 1,
  num_cohorts INTEGER DEFAULT 1,
  num_participants INTEGER DEFAULT 0,
  num_training_days INTEGER DEFAULT 0,
  hours_per_day REAL DEFAULT 8,
  delivery_mode TEXT DEFAULT 'in_person',
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Project Cost Overrides (project-specific settings overriding global)
CREATE TABLE IF NOT EXISTS project_cost_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value REAL NOT NULL,
  UNIQUE(project_id, key),
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

-- Project Direct Cost Items
CREATE TABLE IF NOT EXISTS project_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL,
  item_key TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  quantity REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  notes TEXT,
  is_manual INTEGER DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

-- Pricing Scenarios
CREATE TABLE IF NOT EXISTS pricing_scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  scenario_type TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  target_margin REAL NOT NULL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  selling_price_before_vat REAL DEFAULT 0,
  vat_amount REAL DEFAULT 0,
  selling_price_including_vat REAL DEFAULT 0,
  gross_profit REAL DEFAULT 0,
  gross_margin REAL DEFAULT 0,
  profit_per_participant REAL DEFAULT 0,
  revenue_per_participant REAL DEFAULT 0,
  revenue_per_training_day REAL DEFAULT 0,
  is_recommended INTEGER DEFAULT 0,
  is_locked INTEGER DEFAULT 0,
  UNIQUE(project_id, scenario_type),
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

-- BOQ - Bill of Quantities
CREATE TABLE IF NOT EXISTS boq_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  item_number INTEGER NOT NULL,
  category TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  description_en TEXT,
  quantity REAL DEFAULT 0,
  unit TEXT DEFAULT 'وحدة',
  unit_cost REAL DEFAULT 0,
  selling_unit_price REAL DEFAULT 0,
  total_before_vat REAL DEFAULT 0,
  vat_amount REAL DEFAULT 0,
  total_including_vat REAL DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

-- Payment Schedule
CREATE TABLE IF NOT EXISTS payment_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  milestone_number INTEGER NOT NULL,
  milestone_name_ar TEXT NOT NULL,
  milestone_name_en TEXT,
  description TEXT,
  percentage REAL NOT NULL DEFAULT 0,
  amount_before_vat REAL DEFAULT 0,
  vat_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  expected_date DATE,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

-- Management Recommendations
CREATE TABLE IF NOT EXISTS management_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT UNIQUE NOT NULL,
  recommended_price REAL DEFAULT 0,
  recommended_scenario TEXT,
  expected_gross_profit REAL DEFAULT 0,
  gross_margin REAL DEFAULT 0,
  major_cost_drivers TEXT,
  commercial_risks TEXT,
  pricing_observations TEXT,
  margin_warning TEXT,
  suggested_decision TEXT,
  is_custom INTEGER DEFAULT 0,
  custom_content TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

-- App Settings
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Default Global Cost Assumptions
-- ==========================================
INSERT OR IGNORE INTO cost_assumptions (key, label_ar, label_en, value, category, unit) VALUES
-- Trainer Rates
('trainer_general_day_rate', 'معدل المدرب العام اليومي', 'General Trainer Day Rate', 3000, 'trainers', 'SAR/يوم'),
('trainer_specialized_day_rate', 'معدل المدرب المتخصص اليومي', 'Specialized Trainer Day Rate', 5000, 'trainers', 'SAR/يوم'),
('trainer_leadership_day_rate', 'معدل مدرب القيادة اليومي', 'Leadership Trainer Day Rate', 8000, 'trainers', 'SAR/يوم'),
-- Staff Rates
('coordinator_day_rate', 'معدل المنسق اليومي', 'Coordinator Day Rate', 800, 'staff', 'SAR/يوم'),
('project_manager_cost', 'تكلفة مدير المشروع', 'Project Manager Cost', 15000, 'staff', 'SAR/مشروع'),
-- Training Materials
('printing_cost_per_trainee', 'تكلفة الطباعة للمتدرب', 'Printing Cost per Trainee', 150, 'materials', 'SAR/متدرب'),
('stationery_cost', 'القرطاسية', 'Stationery Cost', 50, 'materials', 'SAR/متدرب'),
('certificates_cost', 'تكلفة الشهادات', 'Certificates Cost', 75, 'materials', 'SAR/متدرب'),
-- Venue & Catering
('coffee_break_cost_per_person_per_day', 'تكلفة استراحة القهوة للشخص/اليوم', 'Coffee Break Cost per Person/Day', 120, 'venue', 'SAR/شخص/يوم'),
('hotel_venue_cost_per_person_per_day', 'تكلفة الفندق/القاعة للشخص/اليوم', 'Hotel/Venue Cost per Person/Day', 500, 'venue', 'SAR/شخص/يوم'),
-- Travel
('accommodation_per_night', 'تكلفة الإقامة الليلية', 'Accommodation per Night', 600, 'travel', 'SAR/ليلة'),
('flights_cost', 'تكلفة الطيران', 'Flights Cost', 1200, 'travel', 'SAR/رحلة'),
('ground_transportation', 'المواصلات البرية', 'Ground Transportation', 300, 'travel', 'SAR/يوم'),
-- Technology
('lms_cost', 'تكلفة نظام إدارة التعلم', 'LMS Cost', 5000, 'technology', 'SAR/مشروع'),
('technology_cost', 'التكلفة التقنية', 'Technology Cost', 3000, 'technology', 'SAR/مشروع'),
-- Other
('photographer_cost', 'تكلفة المصور', 'Photographer Cost', 2000, 'other', 'SAR/يوم'),
('permits_cost', 'تكلفة التصاريح', 'Permits Cost', 1000, 'other', 'SAR/مشروع'),
('assessment_cost', 'تكلفة التقييم', 'Assessment Cost', 200, 'other', 'SAR/متدرب'),
('marketing_cost', 'تكلفة التسويق', 'Marketing Cost', 5000, 'other', 'SAR/مشروع'),
('equipment_cost', 'تكلفة المعدات', 'Equipment Cost', 3000, 'other', 'SAR/مشروع'),
('external_consultants_cost', 'تكلفة الاستشاريين الخارجيين', 'External Consultants Cost', 0, 'other', 'SAR/مشروع'),
('other_direct_costs', 'تكاليف مباشرة أخرى', 'Other Direct Costs', 0, 'other', 'SAR/مشروع'),
-- Overheads
('admin_overhead_percent', 'نسبة التكاليف الإدارية', 'Administrative Overhead %', 12, 'overhead', '%'),
('contingency_percent', 'نسبة الطوارئ', 'Contingency %', 5, 'overhead', '%'),
('vat_percent', 'نسبة ضريبة القيمة المضافة', 'VAT %', 15, 'overhead', '%'),
-- Minimum Margin
('minimum_margin_percent', 'الحد الأدنى لهامش الربح', 'Minimum Acceptable Margin %', 15, 'overhead', '%');

-- Default App Settings
INSERT OR IGNORE INTO app_settings (key, value) VALUES
('language', 'ar'),
('currency', 'SAR'),
('company_name', 'المعهد السعودي للتدريب'),
('company_name_en', 'Saudi Training Institute');
