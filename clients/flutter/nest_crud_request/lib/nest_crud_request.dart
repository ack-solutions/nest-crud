/// Framework-agnostic query builder for `@ackplus/nest-crud` REST APIs — the Dart
/// twin of `@ackplus/nest-crud-request`. Build filters, relations, aggregates,
/// ordering and pagination, then drop the result into any HTTP client.
library nest_crud_request;

export 'src/operators.dart';
export 'src/where_builder.dart';
export 'src/relation_builder.dart';
export 'src/query_builder.dart';
