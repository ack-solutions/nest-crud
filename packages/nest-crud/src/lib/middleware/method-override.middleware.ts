/**
 * Minimal structural shape of the Express request fields this middleware touches.
 * Declared locally so the package doesn't take a hard dependency on `express`
 * types; a real Express `Request` is structurally assignable to it.
 */
interface OverridableRequest {
    method: string;
    headers: Record<string, string | string[] | undefined>;
    body?: any;
    query?: any;
    [key: string]: any;
}

type NextFunction = (err?: any) => void;

/**
 * Options for {@link crudMethodOverride}.
 */
export interface CrudMethodOverrideOptions {
    /**
     * Header names checked for the override verb (case-insensitive).
     * Default: `['x-http-method-override', 'x-method-override']`.
     */
    headers?: string[];
    /**
     * Body keys checked for the override verb. The matched key is **stripped from
     * the body** before the body becomes the query, so it never leaks into the
     * parsed filter. Default: `['_method']`.
     */
    bodyKeys?: string[];
    /**
     * Verbs permitted as an override target. Restricted to the safe read verb by
     * default so the override can never turn a request into a write. Default: `['GET']`.
     */
    allowedMethods?: string[];
}

const DEFAULT_HEADERS = ['x-http-method-override', 'x-method-override'];
const DEFAULT_BODY_KEYS = ['_method'];
const DEFAULT_ALLOWED = ['GET'];

/**
 * HTTP method-override middleware for large read queries.
 *
 * A read whose filter is too long for the URL (browsers/proxies/CDNs cap the
 * request line around 8&nbsp;KB) can instead be sent as a **POST** carrying the
 * query in the **body**, plus an override marker that says "treat me as a GET":
 *
 * - a header — `X-HTTP-Method-Override: GET`, or
 * - a body field — `{ "_method": "GET", ...query }`.
 *
 * When the marker is present and resolves to an allowed (safe) verb, this
 * middleware:
 *   1. strips the `_method` key from the body (so it can't leak into the filter),
 *   2. merges the body over `req.query` — so the controller and
 *      `RequestQueryParser` see **exactly** what a direct GET would have produced,
 *   3. rewrites `req.method`, so routing dispatches to the existing `@Get()` handler.
 *
 * Requests without the marker — including genuine `POST` creates and `PUT`
 * updates — are passed through untouched. Only safe verbs (`GET` by default) are
 * accepted as a target, so the override can never be used to reach a write route.
 *
 * Apply it once, before the router (Nest registers its body parser ahead of
 * `app.use()` middleware, so `req.body` is already populated):
 *
 * ```ts
 * // main.ts
 * import { crudMethodOverride } from '@ackplus/nest-crud';
 * const app = await NestFactory.create(AppModule);
 * app.use(crudMethodOverride());
 * ```
 *
 * The body sent by the client must be the same key/value shape the query string
 * uses — i.e. the client's `QueryBuilder.toObject()` (where/relations/order/…
 * are JSON strings). That is what makes the parsed result identical to a GET.
 */
export function crudMethodOverride(options: CrudMethodOverrideOptions = {}) {
    const headers = (options.headers ?? DEFAULT_HEADERS).map((h) => h.toLowerCase());
    const bodyKeys = options.bodyKeys ?? DEFAULT_BODY_KEYS;
    const allowed = new Set((options.allowedMethods ?? DEFAULT_ALLOWED).map((m) => m.toUpperCase()));

    return function crudMethodOverrideMiddleware(req: OverridableRequest, _res: unknown, next: NextFunction): void {
        // Only POST can carry an override; anything else is left untouched, so real
        // POST creates / PUT updates / DELETEs are never affected.
        if (req.method !== 'POST') return next();

        const body: Record<string, any> | undefined =
            req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : undefined;

        // Resolve the override verb — a header wins over a body field.
        let override: string | undefined;
        for (const name of headers) {
            const value = req.headers[name];
            if (typeof value === 'string' && value.trim()) {
                override = value.trim();
                break;
            }
        }
        if (!override && body) {
            for (const key of bodyKeys) {
                if (body[key] != null) {
                    override = String(body[key]);
                    break;
                }
            }
        }
        if (!override) return next();

        const target = override.toUpperCase();
        if (!allowed.has(target)) return next(); // refuse anything but the safe verbs

        // Strip every candidate override key from the body so it never leaks into the
        // query the handler parses (covers the body-marker form).
        if (body) {
            for (const key of bodyKeys) delete body[key];
        }

        // The POST body IS the query: merge it over anything already in the URL so the
        // handler + RequestQueryParser see exactly what a direct GET would have produced.
        if (body) {
            setQuery(req, { ...readQuery(req), ...body });
        }

        // Re-label the request so the router dispatches it to the GET handler.
        req.method = target;
        return next();
    };
}

function readQuery(req: OverridableRequest): Record<string, any> {
    const current = (req as any).query;
    return current && typeof current === 'object' ? current : {};
}

/**
 * Express 4 exposes a writable `req.query`; Express 5 makes it a lazy read-only
 * getter, so assignment is a no-op/throws — fall back to redefining the property.
 */
function setQuery(req: OverridableRequest, value: Record<string, any>): void {
    try {
        (req as any).query = value;
        if ((req as any).query === value) return;
    } catch {
        /* read-only getter (Express 5) — redefined below */
    }
    Object.defineProperty(req, 'query', {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
    });
}
