/**
 * Azure Functions adapter (optional production shape).
 *
 * Does not call app.listen — the platform invokes the HTTP handler.
 * Requires `@azure/functions` and an Express→Azure bridge at deploy time.
 *
 * This module is documentation + typed scaffold; wire `createSovereignApp()`
 * into your Function App host when Azure packaging is ready.
 *
 * Example (azure-functions-express / similar):
 *
 *   import { app as azureApp } from '@azure/functions';
 *   import { createSovereignApp } from '@sovereign/host';
 *   const { app: expressApp } = createSovereignApp();
 *   azureApp.http('sovereignApi', {
 *     methods: ['GET', 'POST', 'OPTIONS'],
 *     authLevel: 'function',
 *     route: '{*segments}',
 *     handler: async (request, context) => { ... forward to expressApp ... },
 *   });
 *
 * Note: In pure consumption plans, in-memory PLLedger/registry reset on cold
 * start — back with Redis/Cosmos before multi-instance production.
 */

export { createSovereignApp } from './app.js';
