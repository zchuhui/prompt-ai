import { createHash } from "node:crypto";
import { AppError } from "@/shared/errors";

export async function readLimitedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) {
    throw new AppError(400, "INVALID_INPUT", "缺少文件");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new AppError(413, "PAYLOAD_TOO_LARGE", "文件超过 20 MiB");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
