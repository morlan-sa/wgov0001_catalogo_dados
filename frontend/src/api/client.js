const BASE_URL = '/api';

async function request(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${response.status} ao chamar ${path}`);
  }
  return response.json();
}

export function getSchemas() {
  return request('/schemas');
}

export function getCatalogSchemas(filter) {
  const query = filter && filter.length ? `?filter=${filter.join(',')}` : '';
  return request(`/catalog/schemas${query}`);
}

export function getCatalogTables(schema) {
  return request(`/catalog/schemas/${schema}/tables`);
}

export function getCatalogTableDetail(schema, table) {
  return request(`/catalog/schemas/${schema}/tables/${table}`);
}

export function getTableSaude(schema, table) {
  return request(`/catalog/schemas/${schema}/tables/${table}/saude`);
}

export function getDashboardSummary() {
  return request('/dashboard/summary');
}

export function getDashboardSaude() {
  return request('/dashboard/saude');
}

export function searchColumns(term, filter) {
  const params = new URLSearchParams({ q: term });
  if (filter && filter.length) params.set('filter', filter.join(','));
  return request(`/catalog/columns/search?${params.toString()}`);
}

export function getDomains() {
  return request('/domains');
}
