export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, details?: unknown) {
    super(404, `${resource} غير موجود`, "NOT_FOUND", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "غير مصرح") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "غير مسموح بالوصول") {
    super(403, message, "FORBIDDEN");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, "VALIDATION_ERROR", details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "محاولات كثيرة. حاول لاحقاً.") {
    super(429, message, "RATE_LIMIT");
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, message, "CONFLICT", details);
  }
}
