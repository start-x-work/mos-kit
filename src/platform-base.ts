/**
 * All external platform integrations are read-only by default.
 * Write methods (create/update/post/publish/schedule/delete) are intentionally
 * omitted so automated submission and posting stay structurally excluded.
 */
export interface ReadOnlyPlatform<TEntity, TMetrics> {
  list(): Promise<TEntity[]>;
  get(id: string): Promise<TEntity>;
  getMetrics(id: string): Promise<TMetrics>;
}
