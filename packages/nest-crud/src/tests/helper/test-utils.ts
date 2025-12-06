import { expect } from '@jest/globals';

/**
 * Test utilities for handling database-specific SQL differences
 */

/**
 * Normalize SQL for database-agnostic testing
 * Handles differences between PostgreSQL, SQLite, MySQL, etc.
 */
function normalizeSql(sql: string): string {
    return sql
        // Normalize PostgreSQL type casting to generic format
        .replace(/::/g, ' AS ')
        .replace(/\btext\b/gi, 'TEXT')

        // Normalize parameter placeholders
        .replace(/\$\d+/g, '?')  // PostgreSQL $1, $2 -> ?
        .replace(/:\w+/g, '?')   // Named parameters -> ?

        // Normalize column quoting (PostgreSQL uses "", SQLite can use [] or "")
        .replace(/\[([^\]]+)\]/g, '"$1"')  // [column] -> "column"

        // Normalize spaces around parentheses
        .replace(/\s*\(\s*/g, ' ( ')
        .replace(/\s*\)\s*/g, ' ) ')

        // Normalize spaces around operators
        .replace(/\s+AND\s+/gi, ' AND ')
        .replace(/\s+OR\s+/gi, ' OR ')
        .replace(/\s+IN\s+/gi, ' IN ')
        .replace(/\s+NOT\s+IN\s+/gi, ' NOT IN ')
        .replace(/\s+LIKE\s+/gi, ' LIKE ')
        .replace(/\s+NOT\s+LIKE\s+/gi, ' NOT LIKE ')
        .replace(/\s+BETWEEN\s+/gi, ' BETWEEN ')
        .replace(/\s+NOT\s+BETWEEN\s+/gi, ' NOT BETWEEN ')
        .replace(/\s+IS\s+NULL\s+/gi, ' IS NULL ')
        .replace(/\s+IS\s+NOT\s+NULL\s+/gi, ' IS NOT NULL ')
        .replace(/\s+NOT\s+ILIKE\s+/gi, ' NOT ILIKE ')
        .replace(/\s+ILIKE\s+/gi, ' ILIKE ')

        // Normalize database-specific text casting
        .replace(/CAST\s*\(\s*([^)]+)\s+AS\s+\w+\s*\)/gi, '$1') // Remove CAST for comparison
        .replace(/::text/gi, '')  // Remove PostgreSQL text casting

        .replace(/ORDER\s+BY\s+/gi, 'ORDER BY ')
        .replace(/ORDER\s+BY\s+/gi, 'ORDER BY ')

        // Remove extra spaces and normalize
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Helper function to check if actual SQL contains expected SQL pattern
 * accounting for database-specific differences
 */
export function expectSqlToContain(actualSql: string, expectedSql: string): boolean {
    const normalizedActual = normalizeSql(actualSql);
    const normalizedExpected = normalizeSql(expectedSql);

    return normalizedActual.includes(normalizedExpected);
}

/**
 * Helper function for Jest assertions with better error messages
 */
export function expectSqlToMatch(actualSql: string, expectedSql: string): void {
    const normalizedActual = normalizeSql(actualSql);
    const normalizedExpected = normalizeSql(expectedSql);

    expect(normalizedActual).toContain(normalizedExpected);
}
