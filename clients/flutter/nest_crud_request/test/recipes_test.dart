import 'dart:convert';

import 'package:nest_crud_request/nest_crud_request.dart';
import 'package:test/test.dart';

/// Recipe-style tests that double as copy-paste examples — each asserts the exact
/// query the builder produces, so you can see what a real-world call sends.
void main() {
  group('common recipes', () {
    test('search box — case-insensitive OR across fields', () {
      final qb = QueryBuilder()
        ..whereGroup((g) => g
          ..orWhereOp('firstName', WhereOperator.iLike, '%jo%')
          ..orWhereOp('lastName', WhereOperator.iLike, '%jo%')
          ..orWhereOp('email', WhereOperator.iLike, '%jo%'))
        ..addOrder('firstName', OrderDirection.asc)
        ..setTake(20);

      expect(qb.toObject(nested: true)['where'], {
        r'$or': [
          {'firstName': {r'$iLike': '%jo%'}},
          {'lastName': {r'$iLike': '%jo%'}},
          {'email': {r'$iLike': '%jo%'}},
        ],
      });
      expect(qb.toObject()['order'], '{"firstName":"ASC"}');
      expect(qb.toObject()['take'], 20);
    });

    test('paged list — take/skip + filter + sort', () {
      Map<String, dynamic> page(int i) => (QueryBuilder()
            ..whereOp('isActive', WhereOperator.isTrue, true)
            ..addOrder('createdAt', OrderDirection.desc)
            ..setTake(20)
            ..setSkip(i * 20))
          .toObject();

      expect(page(0)['skip'], 0);
      expect(page(2)['skip'], 40);
      expect(page(0)['where'], '{"isActive":{"\$isTrue":true}}');
    });

    test('top authors — aggregates + per-aggregate where + having + sort', () {
      final qb = QueryBuilder()
        ..addAggregate(fn: AggregateFn.count, field: 'posts.id', as: 'postCount')
        ..addAggregate(fn: AggregateFn.count, field: 'posts.id', as: 'published', where: {'status': 'published'})
        ..addAggregate(fn: AggregateFn.sum, field: 'posts.likes', as: 'totalLikes')
        ..havingOp('postCount', WhereOperator.gte, 1)
        ..addOrder('postCount', OrderDirection.desc)
        ..setTake(10);

      expect(jsonDecode(qb.toObject()['aggregates'] as String), [
        {'fn': 'count', 'field': 'posts.id', 'as': 'postCount'},
        {'fn': 'count', 'field': 'posts.id', 'as': 'published', 'where': {'status': 'published'}},
        {'fn': 'sum', 'field': 'posts.likes', 'as': 'totalLikes'},
      ]);
      expect(qb.toObject()['having'], '{"postCount":{"\$gte":1}}');
    });

    test('combined operators — \$in + \$between + \$ne', () {
      final qb = QueryBuilder()
        ..whereOp('role', WhereOperator.inList, ['admin', 'user'])
        ..whereOp('age', WhereOperator.between, [18, 65])
        ..whereOp('lastName', WhereOperator.ne, 'Test');

      expect(qb.toObject(nested: true)['where'], {
        'role': {r'$in': ['admin', 'user']},
        'age': {r'$between': [18, 65]},
        'lastName': {r'$ne': 'Test'},
      });
    });

    test('relations — nested + scoped where + inner join', () {
      final qb = QueryBuilder()
        ..addRelation('profile')
        ..addRelation('posts.comments')
        ..addRelation('posts', select: ['id', 'title'], where: {'status': 'published'}, joinType: 'inner');

      expect(qb.toObject(nested: true)['relations'], {
        'profile': true,
        'posts.comments': true,
        'posts': {'select': ['id', 'title'], 'where': {'status': 'published'}, 'joinType': 'inner'},
      });
    });
  });

  group('housekeeping', () {
    test('mergeOptions — shallow and deep', () {
      final shallow = (QueryBuilder({'select': ['a']})..mergeOptions({'select': ['b']})).toObject(nested: true);
      expect(shallow['select'], ['b']);

      final deep = (QueryBuilder({'where': {'age': {r'$gt': 18}}})
            ..mergeOptions({'where': {'name': {r'$eq': 'John'}}}, deep: true))
          .toObject(nested: true);
      expect(deep['where'], {'age': {r'$gt': 18}, 'name': {r'$eq': 'John'}});
    });

    test('remove* helpers', () {
      final qb = QueryBuilder()
        ..addSelect(['a', 'b'])
        ..addRelation('x')
        ..addRelation('y')
        ..addOrder('a', OrderDirection.asc)
        ..addAggregate(fn: AggregateFn.count, field: 'x.id', as: 'c')
        ..addAggregate(fn: AggregateFn.sum, field: 'x.n', as: 'd')
        ..removeSelect('b')
        ..removeRelation('y')
        ..removeOrder('a')
        ..removeAggregate('d');

      final out = qb.toObject(nested: true);
      expect(out['select'], ['a']);
      expect(out['relations'], {'x': true});
      expect(out.containsKey('order'), isFalse);
      expect(out['aggregates'], [{'fn': 'count', 'field': 'x.id', 'as': 'c'}]);
    });

    test('toJson equals encoded nested object', () {
      final qb = QueryBuilder()..where('a', 1)..setTake(5);
      expect(qb.toJson(), jsonEncode(qb.toObject(nested: true)));
    });

    test('seed from an existing options map (deserialize)', () {
      final stored = (QueryBuilder()
            ..where('status', 'active')
            ..addRelation('posts', select: ['id'])
            ..setTake(20))
          .toObject(nested: true);
      final restored = QueryBuilder(stored).toObject(nested: true);
      expect(restored, stored);
    });
  });
}
