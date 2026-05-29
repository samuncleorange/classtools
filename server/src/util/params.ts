/** 把路径参数解析为正整数；非法返回 null */
export function intParam(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
