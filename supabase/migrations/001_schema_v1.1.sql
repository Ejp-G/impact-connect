-- ═══════════════════════════════════════════════════════════════════
-- IMPACT CONNECT — SCHÉMA CORRIGÉ v1.1
-- Correction : is_minor remplacé par colonne normale + trigger
-- ═══════════════════════════════════════════════════════════════════

-- ─── Nettoyage (au cas où des tables partielles ont été créées) ───
DROP TABLE IF EXISTS notifications           CASCADE;
DROP TABLE IF EXISTS audit_log              CASCADE;
DROP TABLE IF EXISTS communication_logs     CASCADE;
DROP TABLE IF EXISTS communication_templates CASCADE;
DROP TABLE IF EXISTS fi_attendance          CASCADE;
DROP TABLE IF EXISTS tasks                  CASCADE;
DROP TABLE IF EXISTS contacts               CASCADE;
DROP TABLE IF EXISTS commune_fi_mapping     CASCADE;
DROP TABLE IF EXISTS familles_impact        CASCADE;
DROP TABLE IF EXISTS communes               CASCADE;
DROP TABLE IF EXISTS profiles               CASCADE;
DROP TABLE IF EXISTS settings               CASCADE;

DROP FUNCTION IF EXISTS update_updated_at()       CASCADE;
DROP FUNCTION IF EXISTS handle_new_user()         CASCADE;
DROP FUNCTION IF EXISTS calculate_score(UUID)     CASCADE;
DROP FUNCTION IF EXISTS auto_assign_agent(UUID,TEXT) CASCADE;
DROP FUNCTION IF EXISTS auto_assign_fi(UUID,UUID) CASCADE;
DROP FUNCTION IF EXISTS create_follow_up_tasks(UUID) CASCADE;
DROP FUNCTION IF EXISTS trigger_new_contact()     CASCADE;
DROP FUNCTION IF EXISTS trigger_stage_change()    CASCADE;
DROP FUNCTION IF EXISTS update_alerts_and_scores() CASCADE;
DROP FUNCTION IF EXISTS update_is_minor()         CASCADE;
DROP FUNCTION IF EXISTS my_role()                 CASCADE;
DROP FUNCTION IF EXISTS my_fi()                   CASCADE;

-- ─── 1. SETTINGS ───
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO settings (key, value) VALUES
  ('branding',      '{"name1":"IMPACT","name2":"CONNECT","icon":"cross","color":"#0B3D91"}'),
  ('relances',      '{"j3":true,"j7":true,"j14":true,"j21":true,"j30":true,"j60":true,"j90":true}'),
  ('notifications', '{"nouveau_visiteur":true,"rappel_mardi":true,"rapport_hebdo":true}'),
  ('attribution',   '{"method":"round_robin","gender_rule":true}'),
  ('mineurs',       '{"archivage_j30":true,"suppression_j90":true}');

-- ─── 2. PROFILES ───
CREATE TABLE profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'equipe_integration'
               CHECK (role IN ('admin','responsable_integration','equipe_integration',
                               'responsable_suivi','equipe_suivi','pilote_fi',
                               'superviseur','responsable_jeunesse')),
  sex        TEXT CHECK (sex IN ('M','F')),
  phone      TEXT,
  fi_id      UUID,
  sector     TEXT,
  active     BOOLEAN DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- ─── 3. COMMUNES ───
CREATE TABLE communes (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name   TEXT NOT NULL UNIQUE,
  sector TEXT,
  active BOOLEAN DEFAULT true
);
INSERT INTO communes (name, sector) VALUES
  ('Pointe-a-Pitre', 'Centre'),
  ('Abymes',         'Centre'),
  ('Baie-Mahault',   'Nord-Est'),
  ('Le Gosier',      'Sud'),
  ('Sainte-Anne',    'Sud'),
  ('Saint-Francois', 'Sud-Est'),
  ('Capesterre',     'Basse-Terre'),
  ('Basse-Terre',    'Basse-Terre'),
  ('Lamentin',       'Nord-Est'),
  ('Morne-a-l-Eau',  'Nord');

-- ─── 4. FAMILLES D'IMPACT ───
CREATE TABLE familles_impact (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  commune_id   UUID REFERENCES communes(id),
  commune_name TEXT NOT NULL,
  pilot_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  copilot_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  address      TEXT,
  quartiers    TEXT[],
  day          TEXT,
  time         TEXT,
  capacity     INTEGER DEFAULT 15,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active','en_developpement','inactive')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE commune_fi_mapping (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id UUID REFERENCES communes(id) NOT NULL,
  fi_id      UUID REFERENCES familles_impact(id) NOT NULL,
  quartier   TEXT,
  priority   INTEGER DEFAULT 1,
  UNIQUE(commune_id, fi_id)
);

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_fi
  FOREIGN KEY (fi_id) REFERENCES familles_impact(id) ON DELETE SET NULL;

-- ─── 5. CONTACTS ───
-- NOTE : is_minor est une colonne normale mise à jour par trigger
CREATE TABLE contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  sex              TEXT CHECK (sex IN ('M','F')),
  date_of_birth    DATE,
  is_minor         BOOLEAN DEFAULT false,   -- mis à jour automatiquement par trigger
  phone            TEXT,
  whatsapp         TEXT,
  email            TEXT,
  commune          TEXT,
  commune_id       UUID REFERENCES communes(id) ON DELETE SET NULL,
  quartier         TEXT,
  first_visit_date DATE DEFAULT CURRENT_DATE,
  first_visit      BOOLEAN DEFAULT true,
  salvation_call   BOOLEAN DEFAULT false,
  how_found        TEXT,
  situation        TEXT,
  wants_contact    BOOLEAN DEFAULT true,
  wants_fi         BOOLEAN DEFAULT true,
  interests        TEXT[],
  prayer_request   TEXT,
  stop_relances    BOOLEAN DEFAULT false,
  stage            TEXT DEFAULT 'visiteur' CHECK (stage IN (
                     'visiteur','contacte','invite_fi','fi1','fi2',
                     'integre','parcours','bapteme','service','leader_pot','leader'
                   )),
  stage_updated_at  TIMESTAMPTZ DEFAULT NOW(),
  integration_score INTEGER DEFAULT 0 CHECK (integration_score BETWEEN 0 AND 100),
  alert_level       TEXT CHECK (alert_level IN ('green','orange','red')),
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','archived','deleted')),
  fi_id             UUID REFERENCES familles_impact(id) ON DELETE SET NULL,
  assigned_to       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assignment_date   TIMESTAMPTZ,
  -- Mineurs
  parent_last_name  TEXT,
  parent_first_name TEXT,
  parent_phone      TEXT,
  parent_email      TEXT,
  parent_relation   TEXT,
  parental_status   TEXT DEFAULT 'not_required'
                      CHECK (parental_status IN ('not_required','pending','authorized','refused','expired')),
  parental_auth_date TIMESTAMPTZ,
  parental_token     UUID DEFAULT gen_random_uuid(),
  -- Dates
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  last_contact_at   TIMESTAMPTZ,
  first_fi_date     DATE,
  second_fi_date    DATE,
  baptism_date      DATE,
  archived_at       TIMESTAMPTZ
);

-- ─── 6. TÂCHES ───
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('appel','relance','invite_fi','disciple','bapteme','service','autre','parental_relance')),
  title       TEXT NOT NULL,
  note        TEXT,
  priority    TEXT DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low')),
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','done','cancelled','postponed')),
  due_date    DATE NOT NULL,
  done_at     TIMESTAMPTZ,
  done_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  auto_created BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 7. PRÉSENCES FI ───
CREATE TABLE fi_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fi_id       UUID REFERENCES familles_impact(id) ON DELETE CASCADE NOT NULL,
  contact_id  UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  date        DATE NOT NULL,
  present     BOOLEAN DEFAULT true,
  notes       TEXT,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fi_id, contact_id, date)
);

-- ─── 8. COMMUNICATIONS ───
CREATE TABLE communication_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  channel    TEXT NOT NULL CHECK (channel IN ('whatsapp','sms','email')),
  subject    TEXT,
  content    TEXT NOT NULL,
  variables  TEXT[],
  trigger    TEXT,
  active     BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO communication_templates (name, channel, content, variables, trigger) VALUES
  ('Bienvenue',      'whatsapp', 'Bonjour {prenom}, nous sommes ravis de vous avoir parmi nous ! Nous vous contacterons bientot.', ARRAY['{prenom}'],        'bienvenue'),
  ('Invitation FI',  'whatsapp', 'Bonjour {prenom}, vous etes invite(e) a notre FI le {jour} a {heure}. Venez tel(le) que vous etes !', ARRAY['{prenom}','{jour}','{heure}'], 'invite_fi'),
  ('Relance J+7',    'whatsapp', 'Bonjour {prenom}, nous pensons a vous ! N hesitez pas a nous contacter.', ARRAY['{prenom}'],        'relance_j7'),
  ('Rappel culte',   'whatsapp', 'Bonjour {prenom}, notre culte est dimanche a 9h30. Vous etes le bienvenu !', ARRAY['{prenom}'],   'rappel_culte');

CREATE TABLE communication_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID REFERENCES contacts(id) ON DELETE SET NULL,
  template_id UUID REFERENCES communication_templates(id) ON DELETE SET NULL,
  channel     TEXT NOT NULL,
  direction   TEXT DEFAULT 'outbound',
  subject     TEXT,
  content     TEXT NOT NULL,
  sent_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  status      TEXT DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed'))
);

-- ─── 9. AUDIT ───
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    UUID,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  details      JSONB DEFAULT '{}',
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. NOTIFICATIONS ───
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT,
  link       TEXT,
  read       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEX ───
CREATE INDEX idx_contacts_stage    ON contacts(stage);
CREATE INDEX idx_contacts_fi       ON contacts(fi_id);
CREATE INDEX idx_contacts_assigned ON contacts(assigned_to);
CREATE INDEX idx_contacts_status   ON contacts(status);
CREATE INDEX idx_contacts_alert    ON contacts(alert_level);
CREATE INDEX idx_contacts_minor    ON contacts(is_minor);
CREATE INDEX idx_contacts_created  ON contacts(created_at DESC);
CREATE INDEX idx_tasks_due         ON tasks(status, due_date);
CREATE INDEX idx_tasks_assigned    ON tasks(assigned_to, status);
CREATE INDEX idx_notifs_user       ON notifications(user_id, read);

-- ═══════════════════════════════════════════════════════════════════
-- FONCTIONS
-- ═══════════════════════════════════════════════════════════════════

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON contacts          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fi_updated       BEFORE UPDATE ON familles_impact   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Calcul automatique de is_minor (corrigé — plus de colonne générée)
CREATE OR REPLACE FUNCTION update_is_minor()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    NEW.is_minor := NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years');
  ELSE
    NEW.is_minor := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_is_minor
  BEFORE INSERT OR UPDATE OF date_of_birth ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_is_minor();

-- Création du profil à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role, sex)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'equipe_integration'),
    NEW.raw_user_meta_data->>'sex'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Score d'intégration
CREATE OR REPLACE FUNCTION calculate_score(p_id UUID) RETURNS INTEGER AS $$
DECLARE
  v_c contacts%ROWTYPE;
  v_s INTEGER := 0;
  v_p INTEGER;
  v_t INTEGER;
BEGIN
  SELECT * INTO v_c FROM contacts WHERE id = p_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_s := CASE v_c.stage
    WHEN 'visiteur'   THEN 5  WHEN 'contacte'   THEN 10 WHEN 'invite_fi' THEN 15
    WHEN 'fi1'        THEN 25 WHEN 'fi2'         THEN 35 WHEN 'integre'   THEN 50
    WHEN 'parcours'   THEN 65 WHEN 'bapteme'     THEN 75 WHEN 'service'   THEN 85
    WHEN 'leader_pot' THEN 92 WHEN 'leader'      THEN 100 ELSE 0
  END;
  SELECT COUNT(*) INTO v_p FROM fi_attendance WHERE contact_id = p_id AND present = true;
  v_s := v_s + LEAST(v_p * 4, 20);
  SELECT COUNT(*) INTO v_t FROM tasks WHERE contact_id = p_id AND status = 'done';
  v_s := v_s + LEAST(v_t * 3, 15);
  IF v_c.alert_level = 'red'    THEN v_s := v_s - 15; END IF;
  IF v_c.alert_level = 'orange' THEN v_s := v_s - 5;  END IF;
  RETURN GREATEST(0, LEAST(100, v_s));
END;
$$ LANGUAGE plpgsql;

-- Attribution automatique agent (règle H→H / F→F)
CREATE OR REPLACE FUNCTION auto_assign_agent(p_contact UUID, p_sex TEXT) RETURNS UUID AS $$
DECLARE v_agent UUID;
BEGIN
  SELECT p.id INTO v_agent
  FROM profiles p
  LEFT JOIN (
    SELECT assigned_to, COUNT(*) c FROM contacts WHERE status = 'active' GROUP BY assigned_to
  ) L ON L.assigned_to = p.id
  WHERE p.role IN ('equipe_suivi','responsable_suivi')
    AND p.sex = p_sex
    AND p.active = true
  ORDER BY COALESCE(L.c, 0) ASC
  LIMIT 1;

  IF v_agent IS NOT NULL THEN
    UPDATE contacts SET assigned_to = v_agent, assignment_date = NOW() WHERE id = p_contact;
    INSERT INTO audit_log (action, entity_type, entity_id, details)
    VALUES ('Attribution agent auto', 'contact', p_contact,
            jsonb_build_object('agent', v_agent, 'genre', p_sex));
  END IF;
  RETURN v_agent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attribution automatique FI
CREATE OR REPLACE FUNCTION auto_assign_fi(p_contact UUID, p_commune UUID) RETURNS UUID AS $$
DECLARE v_fi UUID;
BEGIN
  SELECT cfm.fi_id INTO v_fi
  FROM commune_fi_mapping cfm
  JOIN familles_impact fi ON fi.id = cfm.fi_id
  WHERE cfm.commune_id = p_commune
    AND fi.status = 'active'
    AND (SELECT COUNT(*) FROM contacts WHERE fi_id = fi.id AND status = 'active') < fi.capacity
  ORDER BY cfm.priority
  LIMIT 1;

  IF v_fi IS NOT NULL THEN
    UPDATE contacts SET fi_id = v_fi WHERE id = p_contact;
    INSERT INTO notifications (user_id, type, title, message)
    SELECT fi.pilot_id, 'new_member', 'Nouvelle personne dans votre secteur',
           'Une personne vient d etre affectee a votre FI.'
    FROM familles_impact fi
    WHERE fi.id = v_fi AND fi.pilot_id IS NOT NULL;
  END IF;
  RETURN v_fi;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Création des tâches de relance automatiques
CREATE OR REPLACE FUNCTION create_follow_up_tasks(p_contact UUID) RETURNS VOID AS $$
DECLARE
  v_c   contacts%ROWTYPE;
  v_cfg JSONB;
BEGIN
  SELECT * INTO v_c FROM contacts WHERE id = p_contact;
  SELECT value INTO v_cfg FROM settings WHERE key = 'relances';

  INSERT INTO tasks (contact_id, assigned_to, type, title, priority, due_date, auto_created)
  VALUES (p_contact, v_c.assigned_to, 'appel', 'Premier contact J+3', 'high', v_c.created_at::DATE + 3, true);

  IF COALESCE((v_cfg->>'j7')::BOOLEAN, true) THEN
    INSERT INTO tasks (contact_id, assigned_to, type, title, priority, due_date, auto_created)
    VALUES (p_contact, v_c.assigned_to, 'relance', 'Relance J+7', 'normal', v_c.created_at::DATE + 7, true);
  END IF;
  IF COALESCE((v_cfg->>'j14')::BOOLEAN, true) THEN
    INSERT INTO tasks (contact_id, assigned_to, type, title, priority, due_date, auto_created)
    VALUES (p_contact, v_c.assigned_to, 'relance', 'Relance J+14', 'normal', v_c.created_at::DATE + 14, true);
  END IF;
  IF COALESCE((v_cfg->>'j21')::BOOLEAN, true) THEN
    INSERT INTO tasks (contact_id, assigned_to, type, title, priority, due_date, auto_created)
    VALUES (p_contact, v_c.assigned_to, 'relance', 'Relance J+21', 'high', v_c.created_at::DATE + 21, true);
  END IF;
  IF COALESCE((v_cfg->>'j30')::BOOLEAN, true) THEN
    INSERT INTO tasks (contact_id, assigned_to, type, title, priority, due_date, auto_created)
    VALUES (p_contact, v_c.assigned_to, 'relance', 'Relance J+30 - Urgent', 'urgent', v_c.created_at::DATE + 30, true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger après création d'un contact
CREATE OR REPLACE FUNCTION trigger_new_contact() RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_follow_up_tasks(NEW.id);
  UPDATE contacts SET integration_score = calculate_score(NEW.id) WHERE id = NEW.id;
  IF NEW.is_minor = true AND NEW.parental_status = 'not_required' THEN
    UPDATE contacts SET parental_status = 'pending' WHERE id = NEW.id;
  END IF;
  INSERT INTO audit_log (action, entity_type, entity_id, details)
  VALUES ('Creation visiteur', 'contact', NEW.id,
          jsonb_build_object('name', NEW.first_name || ' ' || NEW.last_name, 'commune', NEW.commune));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_contact_created
  AFTER INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION trigger_new_contact();

-- Trigger changement de stage
CREATE OR REPLACE FUNCTION trigger_stage_change() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage <> OLD.stage THEN
    NEW.stage_updated_at := NOW();
    NEW.integration_score := calculate_score(NEW.id);
    INSERT INTO audit_log (action, entity_type, entity_id, details)
    VALUES ('Changement stage', 'contact', NEW.id,
            jsonb_build_object('from', OLD.stage, 'to', NEW.stage));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_stage_change
  BEFORE UPDATE OF stage ON contacts
  FOR EACH ROW EXECUTE FUNCTION trigger_stage_change();

-- Mise à jour quotidienne des alertes
CREATE OR REPLACE FUNCTION update_alerts_and_scores() RETURNS VOID AS $$
BEGIN
  UPDATE contacts SET alert_level = 'red'
  WHERE status = 'active' AND stop_relances = false
    AND ((last_contact_at IS NULL AND created_at < NOW() - INTERVAL '3 days')
      OR last_contact_at < NOW() - INTERVAL '30 days')
    AND stage IN ('visiteur','contacte','invite_fi');

  UPDATE contacts SET alert_level = 'orange'
  WHERE status = 'active' AND stop_relances = false
    AND last_contact_at BETWEEN NOW() - INTERVAL '29 days' AND NOW() - INTERVAL '14 days'
    AND alert_level != 'red';

  UPDATE contacts SET alert_level = 'green'
  WHERE status = 'active'
    AND (last_contact_at > NOW() - INTERVAL '14 days'
      OR stage IN ('integre','parcours','bapteme','service','leader_pot','leader'))
    AND alert_level NOT IN ('red','orange');

  UPDATE contacts SET integration_score = calculate_score(id) WHERE status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════
-- RLS — Sécurité par rôle
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE familles_impact       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fi_attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION my_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION my_fi() RETURNS UUID AS $$
  SELECT fi_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- PROFILES
CREATE POLICY "voir_profils" ON profiles FOR SELECT
  USING (id = auth.uid() OR my_role() IN ('admin','superviseur','responsable_integration','responsable_suivi'));
CREATE POLICY "admin_profiles" ON profiles FOR ALL USING (my_role() = 'admin');
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- CONTACTS
CREATE POLICY "admin_contacts" ON contacts FOR ALL
  USING (my_role() IN ('admin','responsable_integration','responsable_suivi'));
CREATE POLICY "integration_insert" ON contacts FOR INSERT
  WITH CHECK (my_role() IN ('equipe_integration','responsable_integration','admin'));
CREATE POLICY "suivi_read" ON contacts FOR SELECT
  USING (assigned_to = auth.uid() OR my_role() IN ('admin','responsable_integration','responsable_suivi','superviseur'));
CREATE POLICY "suivi_update" ON contacts FOR UPDATE
  USING (assigned_to = auth.uid() OR my_role() IN ('admin','responsable_integration','responsable_suivi'));
CREATE POLICY "pilote_read" ON contacts FOR SELECT
  USING (fi_id = my_fi() OR my_role() IN ('admin','superviseur','responsable_integration'));

-- TASKS
CREATE POLICY "own_tasks" ON tasks FOR SELECT
  USING (assigned_to = auth.uid() OR my_role() IN ('admin','responsable_suivi','responsable_integration'));
CREATE POLICY "admin_tasks" ON tasks FOR ALL
  USING (my_role() IN ('admin','responsable_suivi','responsable_integration'));
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE USING (assigned_to = auth.uid());

-- FI
CREATE POLICY "read_fi" ON familles_impact FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_fi" ON familles_impact FOR ALL USING (my_role() = 'admin');
CREATE POLICY "pilote_update_fi" ON familles_impact FOR UPDATE
  USING (pilot_id = auth.uid() OR copilot_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY "own_notifs" ON notifications FOR ALL USING (user_id = auth.uid());

-- SETTINGS
CREATE POLICY "read_settings" ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_settings" ON settings FOR ALL USING (my_role() = 'admin');

-- AUDIT
CREATE POLICY "read_audit" ON audit_log FOR SELECT
  USING (my_role() IN ('admin','responsable_integration','responsable_suivi'));
CREATE POLICY "insert_audit" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- COMMUNICATIONS
CREATE POLICY "read_templates" ON communication_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_templates" ON communication_templates FOR ALL USING (my_role() = 'admin');
CREATE POLICY "own_logs" ON communication_logs FOR SELECT
  USING (sent_by = auth.uid() OR my_role() IN ('admin','responsable_integration','responsable_suivi'));
CREATE POLICY "insert_logs" ON communication_logs FOR INSERT TO authenticated WITH CHECK (true);

-- FI ATTENDANCE
CREATE POLICY "read_attendance" ON fi_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_attendance" ON fi_attendance FOR INSERT TO authenticated WITH CHECK (true);

-- ─── REALTIME ───
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
