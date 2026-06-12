import 'dart:convert';

import 'package:nest_crud_request/nest_crud_request.dart';
import 'package:test/test.dart';

void main() {
  group('where forms', () {
    test('equality shorthand + pagination → exact wire params', () {
      final p = (QueryBuilder()
            ..where('status', 'active')
            ..setTake(20)
            ..setSkip(0))
          .toObject();
      expect(p['where'], '{"status":{"\$eq":"active"}}');
      expect(p['take'], 20);
      expect(p['skip'], 0);
    });

    test('field + operator + value, multiple on one field (implicit AND)', () {
      final p = (QueryBuilder()
            ..whereOp('age', WhereOperator.gte, 18)
            ..whereOp('age', WhereOperator.lt, 65))
          .toObject();
      expect(p['where'], '{"age":{"\$gte":18,"\$lt":65}}');
    });

    test('explicit AND / OR grouping', () {
      final where = (QueryBuilder()
            ..where('status', 'active')
            ..orWhere('role', 'admin')
            ..andWhere('verified', true))
          .toObject(nested: true)['where'];
      expect(where, {
        'status': {'\$eq': 'active'},
        '\$or': [
          {'role': {'\$eq': 'admin'}}
        ],
        '\$and': [
          {'verified': {'\$eq': true}}
        ],
      });
    });

    test('nested group via callback', () {
      final where = (QueryBuilder()
            ..whereGroup((b) {
              b.whereOp('firstName', WhereOperator.iLike, '%jo%');
              b.orWhereOp('lastName', WhereOperator.iLike, '%jo%');
            }))
          .toObject(nested: true)['where'];
      expect(where, {
        'firstName': {'\$iLike': '%jo%'},
        '\$or': [
          {'lastName': {'\$iLike': '%jo%'}}
        ],
      });
    });

    test('value-less + relation-existence operators', () {
      final where = (QueryBuilder()
            ..whereOp('deletedAt', WhereOperator.isNull, true)
            ..whereOp('posts', WhereOperator.exists, true))
          .toObject(nested: true)['where'];
      expect(where, {
        'deletedAt': {'\$isNull': true},
        'posts': {'\$exists': true},
      });
    });
  });

  test('every operator serialises to its token', () {
    for (final op in WhereOperator.values) {
      final where = (QueryBuilder()..whereOp('field', op, 1)).toObject(nested: true)['where'];
      expect(where, {
        'field': {op.value: 1}
      }, reason: op.name);
    }
  });

  group('relations', () {
    test('array names, object config, and joinType', () {
      final rel = (QueryBuilder()
            ..addRelation('profile')
            ..addRelation('posts', select: ['id', 'title'], where: {'status': 'published'}, joinType: 'inner')
            ..addRelation('tags', joinType: 'inner'))
          .toObject(nested: true)['relations'];
      expect(rel, {
        'profile': true,
        'posts': {'select': ['id', 'title'], 'where': {'status': 'published'}, 'joinType': 'inner'},
        'tags': {'joinType': 'inner'},
      });
    });
  });

  test('select, order, pagination, soft-delete serialise', () {
    final p = (QueryBuilder()
          ..addSelect(['id', 'name'])
          ..addOrder('createdAt', OrderDirection.desc)
          ..addOrder('name', OrderDirection.asc)
          ..setTake(10)
          ..setSkip(30)
          ..setWithDeleted(true)
          ..setOnlyDeleted(true))
        .toObject();
    expect(p['select'], '["id","name"]');
    expect(p['order'], '{"createdAt":"DESC","name":"ASC"}');
    expect(p['take'], 10);
    expect(p['skip'], 30);
    expect(p['withDeleted'], true);
    expect(p['onlyDeleted'], true);
  });

  group('aggregates + having', () {
    test('serialises aggregates (incl. distinct) + having', () {
      final out = (QueryBuilder()
            ..addAggregate(fn: AggregateFn.count, field: 'posts.id', as: 'postCount')
            ..addAggregate(fn: AggregateFn.sum, field: 'posts.likes', as: 'likes', distinct: false)
            ..havingOp('postCount', WhereOperator.gt, 5))
          .toObject();
      expect(jsonDecode(out['aggregates'] as String), [
        {'fn': 'count', 'field': 'posts.id', 'as': 'postCount'},
        {'fn': 'sum', 'field': 'posts.likes', 'as': 'likes', 'distinct': false},
      ]);
      expect(out['having'], '{"postCount":{"\$gt":5}}');
    });

    test('per-aggregate where is carried verbatim', () {
      final out = (QueryBuilder()
            ..addAggregate(fn: AggregateFn.count, field: 'posts.id', as: 'published', where: {
              'status': {'\$eq': 'published'}
            }))
          .toObject(nested: true);
      expect(out['aggregates'], [
        {'fn': 'count', 'field': 'posts.id', 'as': 'published', 'where': {'status': {'\$eq': 'published'}}}
      ]);
    });
  });

  group('output + housekeeping', () {
    test('custom keys via set(), empties omitted', () {
      final p = (QueryBuilder()
            ..set('search', 'alice')
            ..set('tenantId', 'acme')
            ..whereGroup((_) {}))
          .toObject();
      expect(p, {'search': 'alice', 'tenantId': 'acme'});
      expect(p.containsKey('where'), isFalse);
    });

    test('toQueryParameters stringifies everything (HTTP shape)', () {
      final p = (QueryBuilder()..where('status', 'active')..setTake(5)).toQueryParameters();
      expect(p['where'], '{"status":{"\$eq":"active"}}');
      expect(p['take'], '5');
      expect(p, isA<Map<String, String>>());
    });

    test('round-trip: toObject(nested) → new QueryBuilder(...) is stable', () {
      final original = (QueryBuilder()
            ..where('status', 'active')
            ..addRelation('posts', select: ['id'])
            ..addAggregate(fn: AggregateFn.count, field: 'posts.id', as: 'postCount')
            ..havingOp('postCount', WhereOperator.gt, 1)
            ..addOrder('postCount', OrderDirection.desc)
            ..setTake(20))
          .toObject(nested: true);
      final restored = QueryBuilder(original).toObject(nested: true);
      expect(restored, original);
    });
  });
}
