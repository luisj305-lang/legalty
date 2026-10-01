import { adaptLegacy, loadLegacyHandler } from '../../../lib/api/adapt-legacy';

export const runtime = 'nodejs';

const load = loadLegacyHandler('webhook');
const invoke = (request: Request) => load.then(handler => adaptLegacy(handler, request));

export const GET = invoke;
export const POST = invoke;
export const PUT = invoke;
export const PATCH = invoke;
export const DELETE = invoke;
export const OPTIONS = invoke;
