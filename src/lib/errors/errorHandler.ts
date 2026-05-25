import { NextResponse } from "next/server";
import { AppError } from "./AppError";
import { logger } from "@/lib/logger";

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function formatError(error: AppError): ErrorResponse {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}

export function handleAppError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(error.message, { code: error.code, details: error.details });
    } else {
      logger.warn(error.message, { code: error.code, statusCode: error.statusCode });
    }
    return NextResponse.json(formatError(error), {
      status: error.statusCode,
    });
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error("Unhandled error", { error: message });
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "حدث خطأ في السيرفر",
      },
    } satisfies ErrorResponse,
    { status: 500 },
  );
}

export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  fn: T,
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleAppError(error);
    }
  }) as T;
}
