import { UserRole, AcademicLevel, AccountStatus } from "@prisma/client";

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  level?: AcademicLevel;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
  jti?: string;
  tokenVersion?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type { UserRole, AcademicLevel, AccountStatus };
