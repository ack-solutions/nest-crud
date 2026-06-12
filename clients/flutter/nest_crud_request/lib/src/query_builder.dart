import 'dart:convert';

import 'operators.dart';
import 'relation_builder.dart';
import 'where_builder.dart';

/// Fluent builder for `@ackplus/nest-crud` list-query parameters — the Dart twin
/// of the JS `QueryBuilder` in `@ackplus/nest-crud-request`. It produces the exact
/// same query strings, so it talks to your existing API with no server changes.
///
/// ```dart
/// final params = (QueryBuilder()
///       ..where('status', 'active')
///       ..whereOp('age', WhereOperator.gte, 18)
///       ..addRelation('posts', select: ['id', 'title'])
///       ..addAggregate(fn: AggregateFn.count, field: 'posts.id', as: 'postCount')
///       ..having('postCount', WhereOperator.gt, 5)
///       ..addOrder('createdAt', OrderDirection.desc)
///       ..setTake(20))
///     .toQueryParameters();
///
/// final res = await dio.get('/users', queryParameters: params);
/// ```
class QueryBuilder {
  Map<String, dynamic> _options = {};
  WhereBuilder _where = WhereBuilder();
  WhereBuilder _having = WhereBuilder();
  RelationBuilder _relations = RelationBuilder();

  QueryBuilder([Map<String, dynamic>? options]) {
    if (options != null) setOptions(options);
  }

  QueryBuilder setOptions(Map<String, dynamic> options) {
    _options = Map<String, dynamic>.from(options);
    _where = WhereBuilder(options['where']);
    _having = WhereBuilder(options['having']);
    _relations = RelationBuilder(options['relations']);
    return this;
  }

  QueryBuilder mergeOptions(Map<String, dynamic> options, {bool deep = false}) {
    return setOptions(deep ? _deepMerge(_options, options) : {..._options, ...options});
  }

  // ---- select ----
  QueryBuilder addSelect(dynamic fields) {
    final current = _options['select'] is List ? List<String>.from(_options['select'] as List) : <String>[];
    if (fields is List) {
      current.addAll(fields.cast<String>());
    } else {
      current.add(fields as String);
    }
    _options['select'] = current;
    return this;
  }

  QueryBuilder removeSelect(dynamic fields) {
    if (_options['select'] is List) {
      final remove = fields is List ? fields.cast<String>() : [fields as String];
      _options['select'] = (_options['select'] as List).where((f) => !remove.contains(f)).toList();
    }
    return this;
  }

  // ---- relations ----
  QueryBuilder addRelation(String relation,
      {List<String>? select, Map<String, dynamic>? where, String? joinType}) {
    _relations.add(relation, select: select, where: where, joinType: joinType);
    return this;
  }

  QueryBuilder removeRelation(String relation) {
    _relations.remove(relation);
    return this;
  }

  // ---- where (delegate to WhereBuilder) ----
  QueryBuilder where(String field, dynamic value) { _where.where(field, value); return this; }
  QueryBuilder whereOp(String field, WhereOperator op, dynamic value) { _where.whereOp(field, op, value); return this; }
  QueryBuilder whereRaw(Map<String, dynamic> condition) { _where.whereRaw(condition); return this; }
  QueryBuilder whereGroup(void Function(WhereBuilder) build) { _where.whereGroup(build); return this; }
  QueryBuilder andWhere(String field, dynamic value) { _where.andWhere(field, value); return this; }
  QueryBuilder andWhereOp(String field, WhereOperator op, dynamic value) { _where.andWhereOp(field, op, value); return this; }
  QueryBuilder andWhereGroup(void Function(WhereBuilder) build) { _where.andWhereGroup(build); return this; }
  QueryBuilder orWhere(String field, dynamic value) { _where.orWhere(field, value); return this; }
  QueryBuilder orWhereOp(String field, WhereOperator op, dynamic value) { _where.orWhereOp(field, op, value); return this; }
  QueryBuilder orWhereGroup(void Function(WhereBuilder) build) { _where.orWhereGroup(build); return this; }

  // ---- order ----
  QueryBuilder addOrder(String field, OrderDirection direction) {
    final order = _options['order'] is Map ? Map<String, dynamic>.from(_options['order'] as Map) : <String, dynamic>{};
    order[field] = direction.value;
    _options['order'] = order;
    return this;
  }

  QueryBuilder removeOrder(String field) {
    if (_options['order'] is Map) (_options['order'] as Map).remove(field);
    return this;
  }

  // ---- aggregates ----
  QueryBuilder addAggregate({
    required AggregateFn fn,
    required String field,
    required String as,
    bool? distinct,
    Map<String, dynamic>? where,
  }) {
    final list = _options['aggregates'] is List ? List<dynamic>.from(_options['aggregates'] as List) : <dynamic>[];
    final spec = <String, dynamic>{'fn': fn.value, 'field': field, 'as': as};
    if (distinct != null) spec['distinct'] = distinct;
    if (where != null) spec['where'] = where;
    list.add(spec);
    _options['aggregates'] = list;
    return this;
  }

  QueryBuilder removeAggregate(String as) {
    if (_options['aggregates'] is List) {
      _options['aggregates'] = (_options['aggregates'] as List).where((a) => a is Map && a['as'] != as).toList();
    }
    return this;
  }

  // ---- having (delegate) ----
  QueryBuilder having(String field, dynamic value) { _having.where(field, value); return this; }
  QueryBuilder havingOp(String field, WhereOperator op, dynamic value) { _having.whereOp(field, op, value); return this; }
  QueryBuilder andHaving(String field, dynamic value) { _having.andWhere(field, value); return this; }
  QueryBuilder orHaving(String field, dynamic value) { _having.orWhere(field, value); return this; }

  // ---- pagination / flags / custom ----
  QueryBuilder setSkip(int skip) { _options['skip'] = skip; return this; }
  QueryBuilder setTake(int take) { _options['take'] = take; return this; }
  QueryBuilder setWithDeleted(bool withDeleted) { _options['withDeleted'] = withDeleted; return this; }
  QueryBuilder setOnlyDeleted(bool onlyDeleted) { _options['onlyDeleted'] = onlyDeleted; return this; }
  QueryBuilder set(String key, dynamic value) { _options[key] = value; return this; }

  // ---- output ----

  /// Build the params. By default complex fields (`where`, `relations`, `order`,
  /// `select`, `aggregates`, `having`) are JSON-stringified — the HTTP shape the
  /// server parses. Pass [nested] = true to keep them as native maps/lists.
  Map<String, dynamic> toObject({bool nested = false}) {
    final out = Map<String, dynamic>.from(_options);

    void put(String key, bool present, dynamic native) {
      if (present) {
        out[key] = nested ? native : jsonEncode(native);
      } else {
        out.remove(key);
      }
    }

    put('where', _where.hasConditions(), _where.toObject());
    put('relations', _relations.hasRelations(), _relations.toObject());
    put('having', _having.hasConditions(), _having.toObject());

    final order = _options['order'];
    put('order', order is Map && order.isNotEmpty, order);
    final select = _options['select'];
    put('select', select is List && select.isNotEmpty, select);
    final aggregates = _options['aggregates'];
    put('aggregates', aggregates is List && aggregates.isNotEmpty, aggregates);

    return out;
  }

  /// Params ready for an HTTP client (`dio` / `http`) — every value as a String.
  Map<String, String> toQueryParameters() {
    return toObject().map((key, value) => MapEntry(key, value is String ? value : '$value'));
  }

  /// The whole query as a single JSON string (native/nested form).
  String toJson() => jsonEncode(toObject(nested: true));

  static Map<String, dynamic> _deepMerge(Map<String, dynamic> target, Map<String, dynamic> source) {
    final result = Map<String, dynamic>.from(target);
    source.forEach((key, value) {
      if (value is Map && result[key] is Map) {
        result[key] = _deepMerge(Map<String, dynamic>.from(result[key] as Map), Map<String, dynamic>.from(value));
      } else {
        result[key] = value;
      }
    });
    return result;
  }
}
