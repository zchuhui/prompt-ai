import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { AppError } from "@/shared/errors";
import { getProcessEnv, type Env } from "./env-core";

export type StoredObject = {
  key: string;
  lastModified: Date;
};

export interface ObjectStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<StoredObject[]>;
  ready(): Promise<void>;
}

type MemoryObject = {
  body: Uint8Array;
  contentType: string;
  lastModified: Date;
};

export class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, MemoryObject>();

  async put(
    key: string,
    body: Uint8Array,
    contentType: string,
    lastModified = new Date(),
  ): Promise<void> {
    this.objects.set(key, { body, contentType, lastModified });
  }

  async get(key: string): Promise<Uint8Array> {
    const found = this.objects.get(key);
    if (!found) {
      throw new AppError(404, "NOT_FOUND", "对象不存在");
    }
    return found.body;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async list(prefix: string): Promise<StoredObject[]> {
    return [...this.objects.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, lastModified: value.lastModified }));
  }

  async ready(): Promise<void> {}
}

export function createS3Storage(env: Env): ObjectStorage {
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  const bucket = env.S3_BUCKET;

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },
    async get(key) {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        if (!result.Body) {
          throw new AppError(404, "NOT_FOUND", "对象不存在");
        }
        return result.Body.transformToByteArray();
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        if (missingObject(error)) {
          throw new AppError(404, "NOT_FOUND", "对象不存在");
        }
        throw new AppError(500, "INTERNAL", "对象存储读取失败");
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async list(prefix) {
      const objects: StoredObject[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: token,
          }),
        );
        for (const item of page.Contents ?? []) {
          if (item.Key) {
            objects.push({
              key: item.Key,
              lastModified: item.LastModified ?? new Date(0),
            });
          }
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return objects;
    },
    async ready() {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    },
  };
}

const globalStorage = globalThis as typeof globalThis & {
  promptGalleryMemory?: MemoryStorage;
  promptGalleryS3?: ObjectStorage;
  promptGalleryOverride?: ObjectStorage;
};

function missingObject(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  const metadata =
    "$metadata" in error
      ? (error.$metadata as { httpStatusCode?: number })
      : undefined;
  return name === "NoSuchKey" || name === "NotFound" || metadata?.httpStatusCode === 404;
}

export function getStorage(): ObjectStorage {
  if (globalStorage.promptGalleryOverride) {
    return globalStorage.promptGalleryOverride;
  }
  const env = getProcessEnv();
  if (env.STORAGE_DRIVER === "memory") {
    globalStorage.promptGalleryMemory ??= new MemoryStorage();
    return globalStorage.promptGalleryMemory;
  }
  globalStorage.promptGalleryS3 ??= createS3Storage(env);
  return globalStorage.promptGalleryS3;
}

export function setStorageForTests(storage: ObjectStorage | undefined): void {
  globalStorage.promptGalleryOverride = storage;
}
