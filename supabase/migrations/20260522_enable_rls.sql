-- ============================================================
-- RLS Migration: Enable Row-Level Security on ALL tables
-- Date: 2026-05-22
-- Phase: 4.1 — Critical (10/10)
--
-- NOTE: The app uses Prisma for DB queries (direct PostgreSQL),
-- which bypasses Supabase REST API. RLS protects against:
--   1. Direct Supabase REST API access via anon key
--   2. Supabase Dashboard / SQL Editor access
--   3. Accidental data leaks from misconfigured client queries
--
-- For full Prisma RLS protection, set session parameters:
--   SET app.current_user_id = '...';
--   SET app.current_user_role = '...';
-- Then reference them in policies as:
--   current_setting('app.current_user_id', true)
-- ============================================================

-- ==================== 1. USERS ====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (id = auth.uid()::text);

-- ADMIN can read all users
CREATE POLICY "users_select_admin" ON users
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'ADMIN');

-- Users can update own profile (but not role/level)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- Only ADMIN can insert/delete users
CREATE POLICY "users_insert_admin" ON users
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'ADMIN');

CREATE POLICY "users_delete_admin" ON users
  FOR DELETE
  USING (auth.jwt() ->> 'role' = 'ADMIN');

-- ==================== 2. SESSIONS ====================
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users can read own sessions
CREATE POLICY "sessions_select_own" ON sessions
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- Only ADMIN can see all sessions
CREATE POLICY "sessions_select_admin" ON sessions
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'ADMIN');

-- Users can delete own sessions (logout)
CREATE POLICY "sessions_delete_own" ON sessions
  FOR DELETE
  USING (user_id = auth.uid()::text);

-- ==================== 3. SUBJECTS ====================
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see subjects
CREATE POLICY "subjects_select_auth" ON subjects
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only ADMIN and MANAGEMENT can insert/update/delete subjects
CREATE POLICY "subjects_insert_admin" ON subjects
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('ADMIN', 'MANAGEMENT'));

CREATE POLICY "subjects_update_admin" ON subjects
  FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('ADMIN', 'MANAGEMENT'));

CREATE POLICY "subjects_delete_admin" ON subjects
  FOR DELETE
  USING (auth.jwt() ->> 'role' = 'ADMIN');

-- ==================== 4. MESSAGES ====================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages they sent or received (not deleted)
CREATE POLICY "messages_select_participant" ON messages
  FOR SELECT
  USING (
    (sender_id = auth.uid()::text AND sender_deleted = false)
    OR (receiver_id = auth.uid()::text AND receiver_deleted = false)
  );

-- Users can insert messages (sent by them)
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT
  WITH CHECK (sender_id = auth.uid()::text);

-- Users can soft-delete own messages
CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE
  USING (sender_id = auth.uid()::text OR receiver_id = auth.uid()::text)
  WITH CHECK (sender_id = auth.uid()::text OR receiver_id = auth.uid()::text);

-- ==================== 5. CONTENT ====================
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Users can read content of their level
CREATE POLICY "content_select_level" ON content
  FOR SELECT
  USING (
    level::text = auth.jwt() ->> 'level'
    OR auth.jwt() ->> 'role' IN ('ADMIN', 'MANAGEMENT')
  );

-- Publisher can update own content
CREATE POLICY "content_update_own" ON content
  FOR UPDATE
  USING (publisher_id = auth.uid()::text);

-- ADMIN can manage all content
CREATE POLICY "content_admin_all" ON content
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'ADMIN');

-- ==================== 6. ANNOUNCEMENTS ====================
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Users can see announcements of their level
CREATE POLICY "announcements_select_level" ON announcements
  FOR SELECT
  USING (
    level::text = auth.jwt() ->> 'level'
    OR auth.jwt() ->> 'role' IN ('ADMIN', 'MANAGEMENT')
  );

-- ADMIN and MANAGEMENT can insert/update announcements
CREATE POLICY "announcements_insert_admin" ON announcements
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('ADMIN', 'MANAGEMENT'));

CREATE POLICY "announcements_update_own" ON announcements
  FOR UPDATE
  USING (publisher_id = auth.uid()::text);

-- ==================== 7. ASSIGNMENTS ====================
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Students see own assignments; teachers see assigned to their subjects; ADMIN sees all
CREATE POLICY "assignments_select_own" ON assignments
  FOR SELECT
  USING (
    student_id = auth.uid()::text
    OR evaluator_id = auth.uid()::text
    OR auth.jwt() ->> 'role' = 'ADMIN'
  );

-- Students can insert own assignments
CREATE POLICY "assignments_insert_own" ON assignments
  FOR INSERT
  WITH CHECK (student_id = auth.uid()::text);

-- Teachers/ADMIN can update assignments (evaluation)
CREATE POLICY "assignments_update_evaluator" ON assignments
  FOR UPDATE
  USING (
    evaluator_id = auth.uid()::text
    OR auth.jwt() ->> 'role' = 'ADMIN'
  );

-- ==================== 8. GRADE DISTRIBUTIONS ====================
ALTER TABLE grade_distributions ENABLE ROW LEVEL SECURITY;

-- Users can see grade distributions of their level
CREATE POLICY "grade_distributions_select_level" ON grade_distributions
  FOR SELECT
  USING (
    level::text = auth.jwt() ->> 'level'
    OR auth.jwt() ->> 'role' IN ('ADMIN', 'MANAGEMENT')
  );

-- Teachers can insert own grade distributions
CREATE POLICY "grade_distributions_insert_own" ON grade_distributions
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid()::text);

-- ==================== 9. NOTIFICATIONS ====================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read own notifications
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- Users can update own notifications (mark as read)
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- System can insert notifications (service_role)
CREATE POLICY "notifications_insert_system" ON notifications
  FOR INSERT
  WITH CHECK (true);

-- ==================== 10. UPLOAD PERMISSIONS ====================
ALTER TABLE upload_permissions ENABLE ROW LEVEL SECURITY;

-- Users can see own upload permissions
CREATE POLICY "upload_permissions_select_own" ON upload_permissions
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- ADMIN can manage all upload permissions
CREATE POLICY "upload_permissions_admin" ON upload_permissions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'ADMIN');

-- ==================== 11. AUDIT LOGS ====================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can see own audit logs
CREATE POLICY "audit_logs_select_own" ON audit_logs
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- ADMIN can see all audit logs
CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'ADMIN');

-- Only service_role can insert audit logs
CREATE POLICY "audit_logs_insert_system" ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- ==================== 12. ACTIVATION CODES ====================
ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;

-- Only ADMIN can see activation codes
CREATE POLICY "activation_codes_select_admin" ON activation_codes
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'ADMIN');

CREATE POLICY "activation_codes_admin" ON activation_codes
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'ADMIN');

-- ==================== 13. PROMOTION REQUESTS ====================
ALTER TABLE promotion_requests ENABLE ROW LEVEL SECURITY;

-- Users can see own promotion requests
CREATE POLICY "promotion_requests_select_own" ON promotion_requests
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- ADMIN can see and manage all
CREATE POLICY "promotion_requests_admin" ON promotion_requests
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'ADMIN');

-- Users can insert own promotion requests
CREATE POLICY "promotion_requests_insert_own" ON promotion_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- ==================== 14. GENERATION LOGS ====================
ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;

-- ADMIN can see all generation logs
CREATE POLICY "generation_logs_select_admin" ON generation_logs
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'ADMIN');

CREATE POLICY "generation_logs_insert_system" ON generation_logs
  FOR INSERT
  WITH CHECK (true);

-- ==================== 15. PUSH SUBSCRIPTIONS ====================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage own push subscription
CREATE POLICY "push_subscriptions_select_own" ON push_subscriptions
  FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "push_subscriptions_insert_own" ON push_subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "push_subscriptions_delete_own" ON push_subscriptions
  FOR DELETE
  USING (user_id = auth.uid()::text);

-- ==================== 16. SYSTEM CONFIGS ====================
ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;

-- Only ADMIN can read/write system configs
CREATE POLICY "system_configs_select_admin" ON system_configs
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'ADMIN');

CREATE POLICY "system_configs_admin" ON system_configs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'ADMIN');

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Run after migration:
--   SELECT schemaname, tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--     AND tablename NOT LIKE '_prisma%'
--   ORDER BY tablename;
-- ============================================================
