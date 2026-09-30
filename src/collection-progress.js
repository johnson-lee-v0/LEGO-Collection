/** Browser-owned progress. Legacy server records are read once and never changed. */
export const PROGRESS_KEY = 'lego-collection-progress-v1';
export const LEGACY_IMPORT_KEY = 'lego-collection-legacy-import-v1';

function normalizeBuild(record) {
  if (!record || typeof record.blueprintId !== 'string' || !record.blueprintId ||
      !Number.isSafeInteger(record.totalCount) || record.totalCount < 1 ||
      !Number.isSafeInteger(record.placedCount) || record.placedCount < 0) return null;
  const placedCount = Math.min(record.placedCount, record.totalCount);
  return {
    blueprintId:record.blueprintId,
    title:typeof record.title === 'string' ? record.title : '',
    description:typeof record.description === 'string' ? record.description : '',
    placedCount, totalCount:record.totalCount, completed:placedCount === record.totalCount,
    updatedAt:typeof record.updatedAt === 'string' ? record.updatedAt : '',
  };
}

export function createProgressStore(storage) {
  // Resolve storage lazily: browsers can deny even access to window.localStorage.
  const getStorage = typeof storage === 'function' ? storage : () => storage;
  function read(strict = false) {
    try {
      const raw = getStorage().getItem(PROGRESS_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.builds)) return [];
      return data.builds.map(normalizeBuild).filter(Boolean);
    } catch (error) { if (strict) throw error; return []; }
  }
  function write(builds) {
    getStorage().setItem(PROGRESS_KEY, JSON.stringify({version:1, builds}));
    return builds;
  }
  function save(record) {
    const saved = normalizeBuild({...record, updatedAt:new Date().toISOString()});
    if (!saved) throw new Error('This build progress could not be saved.');
    const builds = read(true).filter(item => item.blueprintId !== saved.blueprintId);
    write([...builds, saved]);
    return saved;
  }
  function importBuilds(records) {
    // A local reset or undo is intentional; imported progress must never replace it.
    const builds = read(true), known = new Set(builds.map(item => item.blueprintId));
    for (const record of records) {
      const imported = normalizeBuild(record);
      if (imported && !known.has(imported.blueprintId)) {
        builds.push(imported); known.add(imported.blueprintId);
      }
    }
    return write(builds);
  }
  async function importLegacy(fetcher = globalThis.fetch) {
    try {
      const token = getStorage().getItem('keepsake-owner');
      if (!token || getStorage().getItem(LEGACY_IMPORT_KEY)) return read();
      const response = await fetcher('/api/me', {
        headers:{'X-Owner-Token':token}, signal:AbortSignal.timeout(4000),
      });
      if (!response.ok) return read();
      const data = await response.json();
      if (!Array.isArray(data.sets)) return read();
      const builds = importBuilds(data.sets);
      getStorage().setItem(LEGACY_IMPORT_KEY, 'complete');
      return builds;
    } catch { return read(); }
  }
  return {read, save, importBuilds, importLegacy};
}
