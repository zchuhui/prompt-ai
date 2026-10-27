import { describe, expect, it } from "vitest";
import { describeProcessingError, formatBytes, validateFile } from "./upload-store";

describe("upload validation", () => {
  it("accepts supported images within the size limit", () => {
    expect(validateFile({ type: "image/png", size: 1024 })).toBeNull();
    expect(validateFile({ type: "image/webp", size: 20 * 1024 * 1024 })).toBeNull();
  });

  it("rejects unsupported, empty and oversized files", () => {
    expect(validateFile({ type: "image/gif", size: 10 })).toBe("只支持 JPEG、PNG、WebP");
    expect(validateFile({ type: "image/jpeg", size: 0 })).toBe("文件为空");
    expect(validateFile({ type: "image/jpeg", size: 20 * 1024 * 1024 + 1 })).toBe("文件超过 20 MiB");
  });

  it("describes processing failures and sizes", () => {
    expect(describeProcessingError("IMAGE_LIMIT")).toBe("图片像素超出限制");
    expect(describeProcessingError("SOMETHING_ELSE")).toBe("图片处理失败");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
