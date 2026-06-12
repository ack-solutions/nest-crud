import 'dart:convert';

import 'operators.dart';

/// Builds a `where` (or `having`) condition object, mirroring the JS
/// `WhereBuilder` in `@ackplus/nest-crud-request` (same merge semantics, so the
/// JSON is byte-identical on the wire).
///
/// Four condition forms, each available as `where` / `andWhere` / `orWhere`:
/// ```dart
/// b.where('status', 'active');                 // equality
/// b.whereOp('age', WhereOperator.gte, 18);     // field + operator + value
/// b.whereRaw({'role': {r'$in': ['admin']}});   // raw object
/// b.whereGroup((g) => g..orWhere('a', 1)..orWhere('b', 2)); // nested group
/// ```
class WhereBuilder {
  Map<String, dynamic> _where = {};

  WhereBuilder([dynamic where]) {
    if (where is String) {
      _where = Map<String, dynamic>.from(jsonDecode(where) as Map);
    } else if (where is Map) {
      _where = Map<String, dynamic>.from(where);
    }
  }

  bool _isOperator(dynamic value) => value is String && value.startsWith(r'$');

  WhereBuilder clear() {
    _where = {};
    return this;
  }

  // ---- where ----
  WhereBuilder where(String field, dynamic value) => _value(null, field, value);
  WhereBuilder whereOp(String field, WhereOperator op, dynamic value) =>
      _operator(null, field, op, value);
  WhereBuilder whereRaw(Map<String, dynamic> condition) {
    _update(condition, null);
    return this;
  }
  WhereBuilder whereGroup(void Function(WhereBuilder) build) =>
      _group(null, build);

  // ---- andWhere ----
  WhereBuilder andWhere(String field, dynamic value) =>
      _value(WhereLogicalOperator.and, field, value);
  WhereBuilder andWhereOp(String field, WhereOperator op, dynamic value) =>
      _operator(WhereLogicalOperator.and, field, op, value);
  WhereBuilder andWhereRaw(Map<String, dynamic> condition) {
    _update(condition, WhereLogicalOperator.and);
    return this;
  }
  WhereBuilder andWhereGroup(void Function(WhereBuilder) build) =>
      _group(WhereLogicalOperator.and, build);

  // ---- orWhere ----
  WhereBuilder orWhere(String field, dynamic value) =>
      _value(WhereLogicalOperator.or, field, value);
  WhereBuilder orWhereOp(String field, WhereOperator op, dynamic value) =>
      _operator(WhereLogicalOperator.or, field, op, value);
  WhereBuilder orWhereRaw(Map<String, dynamic> condition) {
    _update(condition, WhereLogicalOperator.or);
    return this;
  }
  WhereBuilder orWhereGroup(void Function(WhereBuilder) build) =>
      _group(WhereLogicalOperator.or, build);

  bool hasConditions() => _where.isNotEmpty;
  Map<String, dynamic> toObject() => _where;
  String toJson() => jsonEncode(_where);

  // ---- internals (mirror the JS parseCondition) ----

  WhereBuilder _group(WhereLogicalOperator? type, void Function(WhereBuilder) build) {
    final builder = WhereBuilder();
    build(builder);
    _update(builder.toObject(), type);
    return this;
  }

  WhereBuilder _operator(
      WhereLogicalOperator? type, String field, WhereOperator op, dynamic value) {
    _update({
      field: {op.value: value}
    }, type);
    return this;
  }

  WhereBuilder _value(WhereLogicalOperator? type, String field, dynamic value) {
    if (value is Map) {
      final firstKey = value.keys.isEmpty ? '' : value.keys.first.toString();
      if (firstKey.startsWith(r'$')) {
        _update({field: value}, type);
      } else {
        _update({
          field: {r'$eq': value}
        }, type);
      }
    } else if (_isOperator(value)) {
      _update({
        field: {value: true}
      }, type);
    } else {
      _update({
        field: {r'$eq': value}
      }, type);
    }
    return this;
  }

  void _update(Map<String, dynamic> condition, WhereLogicalOperator? type) {
    if (type == null) {
      _merge(_where, condition);
    } else {
      final key = type.value;
      final existing = (_where[key] as List?) ?? [];
      _where[key] = [...existing, condition];
    }
  }

  void _merge(Map<String, dynamic> target, Map<String, dynamic> source) {
    source.forEach((key, sourceValue) {
      if (key == r'$and' || key == r'$or') {
        final srcList = sourceValue is List ? sourceValue : [sourceValue];
        final existing = target[key] as List?;
        target[key] = existing != null ? [...existing, ...srcList] : srcList;
      } else if (target[key] is Map && sourceValue is Map) {
        target[key] = {...target[key] as Map, ...sourceValue};
      } else {
        target[key] = sourceValue;
      }
    });
  }
}
