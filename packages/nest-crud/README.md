# Nest CRUD

## Query Builder debugging

Set the `debug` query parameter (for example, `?debug=true`) or the `NEST_CRUD_DEBUG=1` environment variable to enable step-by-step logs from the query builder helpers. Logs arrive in the console prefixed with `[NestCrud:<builder>]` so you can trace pagination, joins, relations, and where clause construction before requests reach TypeORM.
