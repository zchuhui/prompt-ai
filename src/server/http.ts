import { ZodError } from "zod";
import { AppError } from "@/shared/errors";
import { log } from "./logger";

export function requestId(): string {
  return crypto.randomUUID();
}

export function jsonData(
  data: unknown,
  status = 200,
  init?: { headers?: HeadersInit },
): Response {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ data }), { status, headers });
}

export function jsonError(error: AppError, id: string): Response {
  const body: {
    error: {
      code: string;
      message: string;
      fields?: Record<string, string>;
      requestId: string;
    };
  } = {
    error: {
      code: error.code,
      message: error.message,
      requestId: id,
    },
  };
  if (error.fields && Object.keys(error.fields).length > 0) {
    body.error.fields = error.fields;
  }
  return new Response(JSON.stringify(body), {
    status: error.status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-request-id": id,
    },
  });
}

function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "body";
    fields[key] ??= issue.message;
  }
  return fields;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(400, "INVALID_INPUT", "输入不合法");
  }
}

export function toErrorResponse(error: unknown, id: string): Response {
  if (error instanceof AppError) {
    return jsonError(error, id);
  }
  if (error instanceof ZodError) {
    return jsonError(
      new AppError(400, "INVALID_INPUT", "输入不合法", zodFields(error)),
      id,
    );
  }
  log("error", "unhandled request error", { requestId: id });
  return jsonError(new AppError(500, "INTERNAL", "服务器错误"), id);
}
