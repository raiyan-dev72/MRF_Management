export function createId(prefix: string) {
  void prefix;
  return crypto.randomUUID();
}
