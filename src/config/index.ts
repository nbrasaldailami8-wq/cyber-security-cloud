export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "سحابة الأمن السيبراني",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  university: process.env.NEXT_PUBLIC_UNIVERSITY || "جامعة ذمار - كلية الحاسبات",
  maxFileSize: 20 * 1024 * 1024,
  allowedFileTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg",
    "image/jpg",
  ],
  blockedFileExtensions: [".exe", ".bat", ".js", ".apk", ".zip"],
  activationCodeExpiry: 24 * 60 * 60 * 1000,
  passwordResetExpiry: 15 * 60 * 1000,
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000,
  itemsPerPage: 20,
};

export const RBAC = {
  adminPages: [
    "/admin",
    "/admin/generation",
    "/admin/upgrade",
    "/admin/audit-log",
    "/admin/activated-accounts",
    "/admin/server-usage",
    "/admin/security-radar",
    "/admin/semester",
    "/admin/promotions",
  ],
  managementPages: [
    "/management",
    "/management/generation",
    "/management/upgrade",
    "/management/activated-accounts",
    "/management/server-usage",
  ],
  teacherPages: [
    "/teacher",
    "/teacher/grades",
    "/teacher/assignments",
    "/teacher/audit-log",
  ],
  studentPages: [
    "/student",
  ],
};
