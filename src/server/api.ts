import "server-only";

import type { AdminContext } from "@/features/auth/server/service";
import {
  requireAdmin,
  requireAdminMutation,
} from "@/features/auth/server/guards";
import { jsonData, requestId, toErrorResponse } from "@/server/http";

export async function adminRead(
  request: Request,
  action: (admin: AdminContext, id: string) => Promise<unknown>,
): Promise<Response> {
  const id = requestId();
  try {
    const admin = await requireAdmin(request);
    const result = await action(admin, id);
    return result instanceof Response ? result : jsonData(result);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}

export async function adminWrite(
  request: Request,
  action: (admin: AdminContext, id: string) => Promise<unknown>,
): Promise<Response> {
  const id = requestId();
  try {
    const admin = await requireAdminMutation(request);
    const result = await action(admin, id);
    return result instanceof Response ? result : jsonData(result);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}

export async function publicRead(action: () => Promise<unknown>): Promise<Response> {
  const id = requestId();
  try {
    return jsonData(await action());
  } catch (error) {
    return toErrorResponse(error, id);
  }
}

export async function publicWrite(
  action: (id: string) => Promise<unknown>,
  status = 200,
): Promise<Response> {
  const id = requestId();
  try {
    const result = await action(id);
    if (result instanceof Response) {
      return result;
    }
    return jsonData(result, status);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
