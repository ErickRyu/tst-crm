-- Add is_default column to sms_templates
ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS is_default integer NOT NULL DEFAULT 0;

-- Mark existing seed templates as default
UPDATE sms_templates SET is_default = 1 WHERE key IN (
  'new_lead',
  'missed_call',
  'noshow',
  'consultation_done',
  'appointment_confirm',
  'appointment_reminder',
  'directions',
  'parking',
  'hours',
  'auto_new_lead',
  'pre_first_call',
  'auto_absent',
  'auto_appointment'
);

-- Re-activate soft-deleted default templates (missed_call, appointment_confirm)
UPDATE sms_templates SET is_active = 1 WHERE key IN ('missed_call', 'appointment_confirm') AND is_default = 1;
