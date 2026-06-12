/**
 * Default `maxPerPage` when unset in `CrudConfigService` / `@Crud`.
 * When the client sends no pagination, list queries use this as `take` (same as the configured cap).
 */
export const DEFAULT_MAX_PER_PAGE = 5000;

export const CRUD_OPTIONS_METADATA = 'NEST_CRUD_CRUD_OPTIONS_METADATA';
export const CRUD_ACTION_METADATA = 'NEST_CRUD_ACTION_METADATA';
