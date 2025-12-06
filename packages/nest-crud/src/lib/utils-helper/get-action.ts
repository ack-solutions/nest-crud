import { CrudActionsEnum } from '../interface/crud';
import { R } from '../crud/reflection.helper';

/**
 * Gets the CRUD action name from a handler function
 *
 * This is a convenient helper function that extracts the CRUD action
 * metadata directly from the handler function. Works even when code
 * is minified or methods are renamed.
 *
 * @param handler - The route handler function
 * @returns The CRUD action name (e.g., 'findMany', 'create'), or undefined if not a CRUD route
 *
 * @example
 * ```typescript
 * import { getAction } from '@ackplus/nest-crud';
 *
 * // In an interceptor
 * intercept(context: ExecutionContext, next: CallHandler) {
 *   const handler = context.getHandler();
 *   const action = getAction(handler);
 *   console.log(action); // 'findMany', 'create', etc.
 *   return next.handle();
 * }
 * ```
 */
export function getAction(handler: any): CrudActionsEnum | undefined {
    return R.getActionFromHandler(handler);
}
