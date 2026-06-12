import 'package:nest_crud_request/nest_crud_request.dart';
import 'package:test/test.dart';

/// Drift guard: the Dart operator tokens MUST match the JS `WhereOperatorEnum`
/// in `@ackplus/nest-crud-request` exactly (and the server's `WhereOperatorEnum`).
/// If you add/rename an operator in one client, update the other and this set.
void main() {
  test('operator tokens match the @ackplus/nest-crud-request wire contract', () {
    final tokens = WhereOperator.values.map((o) => o.value).toSet();
    expect(tokens, {
      r'$eq', r'$ne', r'$ieq',
      r'$gt', r'$gte', r'$lt', r'$lte',
      r'$in', r'$notIn',
      r'$like', r'$notLike', r'$iLike', r'$notIlike',
      r'$startsWith', r'$endsWith', r'$iStartsWith', r'$iEndsWith',
      r'$inL', r'$notinL',
      r'$contArr', r'$intersectsArr',
      r'$isNull', r'$isNotNull',
      r'$between', r'$notBetween',
      r'$isTrue', r'$isFalse',
      r'$exists', r'$notExists',
    });
  });

  test('logical, order, and aggregate tokens match', () {
    expect(WhereLogicalOperator.values.map((o) => o.value).toSet(), {r'$and', r'$or'});
    expect(OrderDirection.values.map((o) => o.value).toSet(), {'ASC', 'DESC'});
    expect(AggregateFn.values.map((o) => o.value).toSet(), {'count', 'sum', 'avg', 'min', 'max'});
  });
}
