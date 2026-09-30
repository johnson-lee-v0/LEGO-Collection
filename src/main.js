import { appUrl, appMarkup } from './app-path.js';
import { createIcons, ArrowRight, ArrowUpRight, Blocks, Bookmark, Check, Download, LayoutGrid, Move, PackageOpen, Plus, RotateCcw, X, Eye, Layers3, Pause, FastForward } from 'lucide';
import { COLLECTION_CATALOG } from './collection-catalog.js';
import { createProgressStore } from './collection-progress.js';
import './style.css';

const root = document.querySelector('#app');
const icons = { ArrowRight, ArrowUpRight, Blocks, Bookmark, Check, Download, LayoutGrid, Move, PackageOpen, Plus, RotateCcw, X, Eye, Layers3, Pause, FastForward };
const progress = createProgressStore(() => localStorage);
let sets = progress.read(), model, placed = 0, scene, routeSerial = 0;
const fmt = n => Number(n).toLocaleString();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const iconify = () => createIcons({ icons, attrs: { 'stroke-width': 1.65 } });
function toast(message) {
  let el = document.querySelector('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = message; el.className = 'toast show';
  clearTimeout(el._timer); el._timer = setTimeout(() => el.classList.remove('show'), 4200);
}
function saveSet() {
  try {
    const saved = progress.save({blueprintId:model.id, title:model.title, description:model.defaultDescription || '', placedCount:placed, totalCount:model.progressTotal});
    sets = progress.read();
    return saved;
  } catch {
    const status = document.querySelector('#save-status');
    if (status) status.textContent = 'Progress could not be saved';
    throw new Error('Your browser could not save progress. Check that site storage is allowed.');
  }
}
function navigate(path) { history.pushState({}, '', appUrl(path)); renderRoute(); }
window.addEventListener('popstate', renderRoute);
function shell(content) {
  return appMarkup(`<div class="app-shell collection-shell"><header class="topbar"><a href="/" class="wordmark" data-nav="/" aria-label="LEGO Collection home">${ico('blocks')}<span class="wordmark-text">LEGO Collection</span></a><div class="brand-line">Explore. Build. Collect.</div><nav class="topbar-right" aria-label="Main navigation"><a class="text-button collection-nav-link" href="/" data-nav="/" aria-label="Collection">${ico('layout-grid')}<span>Collection</span></a><a class="text-button portfolio-link" href="https://johnson-lee-v0.github.io/#hobbies">Johnson Lee ${ico('arrow-up-right')}</a></nav></header>${content}<footer class="footer"><span>An independent LEGO collection by Johnson Lee.</span><span>LEGO is a trademark of the LEGO Group, which does not endorse this site.</span></footer></div><div id="modal-root"></div>`);
}
function bindNavigation() {
  document.querySelectorAll('[data-nav]').forEach(el => { el.onclick = e => { e.preventDefault(); navigate(el.dataset.nav); }; });
}
async function renderRoute() {
  const serial = ++routeSerial;
  scene?.dispose(); scene = null; model = null;
  window.scrollTo(0,0);
  const design = new URLSearchParams(location.search).get('design');
  if (!design) { document.title = 'LEGO Collection'; renderGallery(); return; }
  try {
    if (!COLLECTION_CATALOG.some(entry => entry.alias === design || entry.id === design)) throw new Error('This set is not in the public collection.');
    root.innerHTML = shell(`<main class="empty-state"><span class="spinner"></span><h1>Opening your build…</h1><p>Preparing the pieces and instructions.</p></main>`);
    bindNavigation(); iconify();
    const [{getModel, getModelChapters}, {mountOfficialRoom}] = await Promise.all([import('./model-registry.js'), import('./official-room.js')]);
    if (serial !== routeSerial) return;
    model = getModel(design); sets = progress.read();
    const activeSet = sets.find(s => s.blueprintId === model.id) || null;
    placed = Math.min(model.progressTotal, activeSet?.placedCount || 0);
    document.title = `${model.shortTitle || model.title} · LEGO Collection`;
    scene = mountOfficialRoom({root,model,chapters:getModelChapters(model.id),placed,activeSet,shell,esc,ico,iconify,bindNavigation,modal,onReset:rebuildSet,onDownload:downloadImage,onProgress:n=>{
      placed=n;try {saveSet();if(n===model.progressTotal)toast('Build complete. Progress saved in this browser.');} catch(error){toast(error.message);}
    }});
  } catch (error) {
    if (serial !== routeSerial) return;
    root.innerHTML = shell(`<main class="empty-state"><div class="empty-icon">${ico('package-open')}</div><h1>The build could not open.</h1><p>${esc(error.message)}</p><button class="button primary" data-nav="/">Back to the collection ${ico('arrow-right')}</button></main>`);
    bindNavigation(); iconify();
  }
}
function renderGallery() {
  root.innerHTML=shell(`<main class="gallery-main"><div class="gallery-heading"><div class="eyebrow">JOHNSON’S LEGO COLLECTION</div><h1>A collection.<br>Piece by piece.</h1><p>Explore the details. See how each set comes together.</p></div><div class="gallery-grid gallery-official-grid">${COLLECTION_CATALOG.map((entry,i)=>{
    const saved=sets.find(s=>s.blueprintId===entry.id);
    return `<article class="gallery-card"><button class="gallery-art" data-nav="/?design=${entry.alias}" aria-label="Open ${esc(entry.title)}"><img src="${entry.thumbnail}" alt="${esc(entry.title)} completed model" width="1100" height="680" ${i>1?'loading="lazy"':''} decoding="async" /><span class="gallery-type">LEGO SET ${entry.setNumber}</span><span class="gallery-open">${ico('arrow-up-right')}</span></button><div class="gallery-card-info"><div class="eyebrow">${esc(entry.galleryEyebrow)}</div><h2>${esc(entry.shortTitle)}</h2><p>${esc(entry.galleryDescription)}</p><div class="gallery-card-meta"><span>${fmt(entry.pieceCount)} pieces</span><span>${fmt(entry.progressTotal)} build steps</span></div>${saved?.placedCount?`<div class="gallery-progress">${ico(saved.completed?'check':'bookmark')}<span>${saved.completed?'Build complete':`${fmt(saved.placedCount)} of ${fmt(entry.progressTotal)} steps built`}</span></div>`:''}<button class="button primary" data-nav="/?design=${entry.alias}">${saved?.completed?'View completed build':saved?.placedCount?'Continue building':'Explore this set'} ${ico('arrow-right')}</button></div></article>`;
  }).join('')}</div><section class="gallery-note"><div>${ico('blocks')}<h2>Look closer. Build it yourself.</h2></div><p>Open a set to rotate the model, place each step and explore its parts. Progress is saved in this browser.</p></section></main>`);
  bindNavigation(); iconify();
}
function modal(body, className = '') {
  const host = document.querySelector('#modal-root'); host.innerHTML = appMarkup(`<dialog class="modal ${className}"><button class="modal-close icon-button" aria-label="Close dialog">${ico('x')}</button>${body}</dialog>`);
  const dialog = host.querySelector('dialog'); dialog.querySelector('.modal-close').onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  dialog.showModal(); iconify(); return dialog;
}
function rebuildSet() {
  const dialog = modal(`<div class="eyebrow">START FROM THE BEGINNING</div><h2>Build this set again?</h2><p class="modal-description">This resets this set’s progress in this browser. Your other builds keep their progress.</p><button class="button primary" id="confirm-rebuild">Start again ${ico('rotate-ccw')}</button><p class="form-error" id="rebuild-error" role="alert"></p>`);
  dialog.querySelector('#confirm-rebuild').onclick = e => {
    const previous = placed; e.currentTarget.disabled = true;
    try { placed = 0; saveSet(); dialog.close(); scene?.setProgress(0); }
    catch (error) { placed = previous; dialog.querySelector('#rebuild-error').textContent = error.message; e.currentTarget.disabled = false; }
  };
}
function downloadImage() {
  if (!scene) return;
  try {
    const image = scene.capture();
    modal(`<div class="eyebrow">SAVE YOUR BUILD</div><h2>Your build, ready to save.</h2><img class="export-preview" src="${image}" alt="Exported image of your completed brick set" /><a class="button primary" href="${image}" download="${model.alias}-collection.png">Download PNG ${ico('download')}</a>`);
  } catch { toast('The image could not be saved. Please try again.'); }
}
root.innerHTML = `<div class="boot">${ico('blocks')}<p>Opening LEGO Collection…</p></div>`;
renderRoute();
