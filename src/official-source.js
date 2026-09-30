/** Resolve a step or inventory row to its original instruction booklet. */
export function officialBooklet(model, item = {}) {
  return model.source.booklets?.find(book => book.id === item.bookletId) || model.source.booklets?.[0] || model.source;
}

export function officialPdfPage(model, item) {
  return `${officialBooklet(model, item).sourceUrl}#page=${item.page}`;
}

export function officialSection(model, step) {
  return step.sectionLabel || model.sectionLabels?.[step.section] || step.section || 'Build';
}

/** Preserve source numbering when an alternate build restarts at step one. */
export function officialStepTitle(step) {
  return step.officialLabel ? step.officialLabel.replace(/ (\d+)$/, ' step $1') : `Step ${step.number}`;
}
