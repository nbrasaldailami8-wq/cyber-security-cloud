-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGEMENT', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "AcademicLevel" AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4');

-- CreateEnum
CREATE TYPE "Semester" AS ENUM ('TERM_1', 'TERM_2');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'LOCKED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('PDF', 'DOCX', 'XLSX', 'PNG', 'JPG', 'YOUTUBE_LINK');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_MESSAGE', 'ASSIGNMENT_EVALUATED', 'NEW_ASSIGNMENT', 'NEW_ANNOUNCEMENT', 'NEW_CONTENT', 'GRADES_DISTRIBUTED', 'ACCOUNT_MODIFIED', 'LEVEL_PROMOTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'UPLOAD', 'DOWNLOAD', 'EVALUATE', 'PUBLISH', 'FAILED_LOGIN', 'SUSPICIOUS_ACTIVITY', 'LEVEL_PROMOTION', 'PROMOTED', 'SEMESTER_SWITCH');

-- CreateEnum
CREATE TYPE "SeverityLevel" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "level" "AcademicLevel",
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "activationCodeHash" TEXT,
    "activationExpires" TIMESTAMP(3),
    "isActivated" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "webAuthnEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webAuthnCredential" TEXT,
    "webAuthnDeviceId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "managementLevel" "AcademicLevel",
    "previousLevel" "AcademicLevel",
    "lastLoginIp" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "level" "AcademicLevel" NOT NULL,
    "semester" "Semester" NOT NULL DEFAULT 'TERM_1',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "replyToId" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "senderDeleted" BOOLEAN NOT NULL DEFAULT false,
    "receiverDeleted" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ContentType" NOT NULL,
    "fileUrl" TEXT,
    "youtubeUrl" TEXT,
    "fileSize" INTEGER,
    "subjectId" TEXT,
    "level" "AcademicLevel" NOT NULL,
    "semester" "Semester" NOT NULL DEFAULT 'TERM_1',
    "publisherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" "AcademicLevel" NOT NULL,
    "publisherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "grade" DOUBLE PRECISION,
    "feedback" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "evaluatorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "semester" "Semester" NOT NULL DEFAULT 'TERM_1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_distributions" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "studentsCount" INTEGER NOT NULL,
    "distributionData" JSONB,
    "level" "AcademicLevel" NOT NULL,
    "semester" "Semester" NOT NULL DEFAULT 'TERM_1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "grade_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "upload_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "severity" "SeverityLevel" NOT NULL DEFAULT 'INFO',
    "description" TEXT NOT NULL,
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "level" "AcademicLevel",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activation_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "level" "AcademicLevel" NOT NULL,
    "role" "UserRole" NOT NULL,
    "subjectId" TEXT,
    "usedAt" TIMESTAMP(3),
    "usedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activation_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromLevel" "AcademicLevel" NOT NULL,
    "toLevel" "AcademicLevel" NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_logs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" "UserRole" NOT NULL,
    "level" "AcademicLevel" NOT NULL,
    "code" TEXT NOT NULL,
    "subjectName" TEXT,
    "subjectCode" TEXT,
    "semester" "Semester",
    "generatedById" TEXT NOT NULL,
    "generatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "authKey" TEXT NOT NULL,
    "p256dhKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_level_idx" ON "users"("level");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "sessions_refreshTokenHash_idx" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE INDEX "subjects_level_idx" ON "subjects"("level");

-- CreateIndex
CREATE INDEX "subjects_deletedAt_idx" ON "subjects"("deletedAt");

-- CreateIndex
CREATE INDEX "subjects_teacherId_idx" ON "subjects"("teacherId");

-- CreateIndex
CREATE INDEX "subjects_semester_idx" ON "subjects"("semester");

-- CreateIndex
CREATE INDEX "messages_senderId_senderDeleted_createdAt_idx" ON "messages"("senderId", "senderDeleted", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "messages_receiverId_receiverDeleted_createdAt_idx" ON "messages"("receiverId", "receiverDeleted", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "messages_senderId_receiverId_createdAt_idx" ON "messages"("senderId", "receiverId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "messages_receiverId_senderId_createdAt_idx" ON "messages"("receiverId", "senderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "messages_deletedAt_idx" ON "messages"("deletedAt");

-- CreateIndex
CREATE INDEX "messages_isBlocked_idx" ON "messages"("isBlocked");

-- CreateIndex
CREATE UNIQUE INDEX "messages_senderId_idempotencyKey_key" ON "messages"("senderId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "content_level_idx" ON "content"("level");

-- CreateIndex
CREATE INDEX "content_level_subjectId_idx" ON "content"("level", "subjectId");

-- CreateIndex
CREATE INDEX "content_publisherId_idx" ON "content"("publisherId");

-- CreateIndex
CREATE INDEX "content_deletedAt_idx" ON "content"("deletedAt");

-- CreateIndex
CREATE INDEX "content_createdAt_idx" ON "content"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "announcements_level_idx" ON "announcements"("level");

-- CreateIndex
CREATE INDEX "announcements_publisherId_idx" ON "announcements"("publisherId");

-- CreateIndex
CREATE INDEX "announcements_deletedAt_idx" ON "announcements"("deletedAt");

-- CreateIndex
CREATE INDEX "assignments_studentId_subjectId_idx" ON "assignments"("studentId", "subjectId");

-- CreateIndex
CREATE INDEX "assignments_studentId_status_idx" ON "assignments"("studentId", "status");

-- CreateIndex
CREATE INDEX "assignments_subjectId_idx" ON "assignments"("subjectId");

-- CreateIndex
CREATE INDEX "assignments_subjectId_status_idx" ON "assignments"("subjectId", "status");

-- CreateIndex
CREATE INDEX "assignments_deletedAt_idx" ON "assignments"("deletedAt");

-- CreateIndex
CREATE INDEX "assignments_status_idx" ON "assignments"("status");

-- CreateIndex
CREATE INDEX "assignments_evaluatorId_idx" ON "assignments"("evaluatorId");

-- CreateIndex
CREATE INDEX "grade_distributions_teacherId_subjectId_idx" ON "grade_distributions"("teacherId", "subjectId");

-- CreateIndex
CREATE INDEX "grade_distributions_level_idx" ON "grade_distributions"("level");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_type_createdAt_idx" ON "notifications"("userId", "type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "upload_permissions_userId_idx" ON "upload_permissions"("userId");

-- CreateIndex
CREATE INDEX "upload_permissions_revokedAt_idx" ON "upload_permissions"("revokedAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "activation_codes_codeHash_key" ON "activation_codes"("codeHash");

-- CreateIndex
CREATE INDEX "activation_codes_level_idx" ON "activation_codes"("level");

-- CreateIndex
CREATE INDEX "activation_codes_role_idx" ON "activation_codes"("role");

-- CreateIndex
CREATE INDEX "activation_codes_usedAt_idx" ON "activation_codes"("usedAt");

-- CreateIndex
CREATE INDEX "activation_codes_expiresAt_idx" ON "activation_codes"("expiresAt");

-- CreateIndex
CREATE INDEX "promotion_requests_userId_idx" ON "promotion_requests"("userId");

-- CreateIndex
CREATE INDEX "promotion_requests_status_idx" ON "promotion_requests"("status");

-- CreateIndex
CREATE INDEX "promotion_requests_toLevel_idx" ON "promotion_requests"("toLevel");

-- CreateIndex
CREATE INDEX "generation_logs_level_idx" ON "generation_logs"("level");

-- CreateIndex
CREATE INDEX "generation_logs_role_idx" ON "generation_logs"("role");

-- CreateIndex
CREATE INDEX "generation_logs_deletedAt_idx" ON "generation_logs"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_userId_key" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_distributions" ADD CONSTRAINT "grade_distributions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_distributions" ADD CONSTRAINT "grade_distributions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_permissions" ADD CONSTRAINT "upload_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_requests" ADD CONSTRAINT "promotion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
