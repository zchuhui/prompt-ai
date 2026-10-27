import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "./constants";

export function parsePage(value: string | undefined): number {
  if (value === undefined || value === "") {
    return 1;
  }
  if (!/^[1-9]\d*$/.test(value)) {
    return 1;
  }
  return Number(value);
}

export function parsePageSize(value: string | undefined): number {
  if (value === undefined || value === "") {
    return PAGE_SIZE_DEFAULT;
  }
  if (!/^[1-9]\d*$/.test(value)) {
    return PAGE_SIZE_DEFAULT;
  }
  return Math.min(Number(value), PAGE_SIZE_MAX);
}

export function pageOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
