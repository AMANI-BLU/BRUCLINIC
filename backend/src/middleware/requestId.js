/**
 * BruClinic — Request ID Middleware
 *
 * Assigns a unique correlation ID to every incoming HTTP request.
 * The ID is:
 *  - Attached to `request.requestId` for use by other middleware and handlers
 *  - Returned in the `X-Request-ID` response header for client-side tracing
 *
 * This enables correlating a single user action across logs, audit records,
 * and security events without storing session state server-side.
 */

import { randomUUID } from 'node:crypto';

/**
 * Attach a unique requestId to the request object and set the response header.
 * Honors an incoming `X-Request-ID` header if the client provides one,
 * after validating it is a safe alphanumeric value (prevents header injection).
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 */
export function attachRequestId(request, response) {
  const incoming = String(request.headers['x-request-id'] || '');
  // Only trust client-supplied IDs that look like a UUID (prevents injection)
  const safe = /^[0-9a-f-]{32,36}$/i.test(incoming) ? incoming : randomUUID();
  request.requestId = safe;
  response.setHeader('X-Request-ID', safe);
}
