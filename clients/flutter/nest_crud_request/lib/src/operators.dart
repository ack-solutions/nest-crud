/// Comparison / pattern / existence operators — values mirror the JS
/// `WhereOperatorEnum` in `@ackplus/nest-crud-request` exactly, so the produced
/// query strings are identical on the wire.
enum WhereOperator {
  eq(r'$eq'),
  ne(r'$ne'),
  ieq(r'$ieq'),
  gt(r'$gt'),
  gte(r'$gte'),
  lt(r'$lt'),
  lte(r'$lte'),
  inList(r'$in'),
  notIn(r'$notIn'),
  like(r'$like'),
  notLike(r'$notLike'),
  iLike(r'$iLike'),
  notIlike(r'$notIlike'),
  startsWith(r'$startsWith'),
  endsWith(r'$endsWith'),
  iStartsWith(r'$iStartsWith'),
  iEndsWith(r'$iEndsWith'),
  inL(r'$inL'),
  notinL(r'$notinL'),
  contArr(r'$contArr'),
  intersectsArr(r'$intersectsArr'),
  isNull(r'$isNull'),
  isNotNull(r'$isNotNull'),
  between(r'$between'),
  notBetween(r'$notBetween'),
  isTrue(r'$isTrue'),
  isFalse(r'$isFalse'),
  exists(r'$exists'),
  notExists(r'$notExists');

  /// The wire token (e.g. `$gte`).
  final String value;
  const WhereOperator(this.value);
}

/// Logical grouping operators.
enum WhereLogicalOperator {
  and(r'$and'),
  or(r'$or');

  final String value;
  const WhereLogicalOperator(this.value);
}

/// Sort direction.
enum OrderDirection {
  asc('ASC'),
  desc('DESC');

  final String value;
  const OrderDirection(this.value);
}

/// Aggregate function for `addAggregate`.
enum AggregateFn {
  count('count'),
  sum('sum'),
  avg('avg'),
  min('min'),
  max('max');

  final String value;
  const AggregateFn(this.value);
}
