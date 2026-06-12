import 'dart:convert';

/// Builds the `relations` object, mirroring the JS `RelationBuilder`.
class RelationBuilder {
  Map<String, dynamic> _relations = {};

  RelationBuilder([dynamic relations]) {
    if (relations != null) setRelations(relations);
  }

  RelationBuilder setRelations(dynamic relations) {
    if (relations is List) {
      for (final r in relations) {
        add(r as String);
      }
    } else if (relations is String) {
      _relations = Map<String, dynamic>.from(jsonDecode(relations) as Map);
    } else if (relations is Map) {
      _relations = Map<String, dynamic>.from(relations);
    }
    return this;
  }

  RelationBuilder clear() {
    _relations = {};
    return this;
  }

  /// Add (or replace) a relation. With no options it's a plain join (`true`);
  /// otherwise the per-relation `{ select, where, joinType }` config is emitted.
  RelationBuilder add(
    String relation, {
    List<String>? select,
    Map<String, dynamic>? where,
    String? joinType,
  }) {
    if (select == null && where == null && joinType == null) {
      _relations[relation] = true;
    } else {
      final config = <String, dynamic>{};
      if (select != null) config['select'] = select;
      if (where != null) config['where'] = where;
      if (joinType != null) config['joinType'] = joinType;
      _relations[relation] = config;
    }
    return this;
  }

  RelationBuilder remove(String relation) {
    _relations.remove(relation);
    return this;
  }

  bool hasRelations() => _relations.isNotEmpty;
  Map<String, dynamic> toObject() => _relations;
  String toJson() => jsonEncode(_relations);
}
