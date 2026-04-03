import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  console.error("[API Error]", error);

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

export function unauthorized() {
  return new ApiError("Unauthorized", 401, "UNAUTHORIZED");
}

export function forbidden() {
  return new ApiError("Forbidden", 403, "FORBIDDEN");
}

export function notFound(resource: string) {
  return new ApiError(`${resource} not found`, 404, "NOT_FOUND");
}
