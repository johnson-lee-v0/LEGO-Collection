import { appUrl, appMarkup } from './app-path.js';
import { createIcons, ArrowRight, ArrowUpRight, Blocks, Download, LayoutGrid, Move, PackageOpen, X } from 'lucide';
import { COLLECTION_CATALOG } from './collection-catalog.js';
import './style.css';

const root = document.querySelector('#app');
const icons = { ArrowRight, ArrowUpRight, Blocks, Download, LayoutGrid, Move, PackageOpen, X };
let model, scene, routeSerial = 0;
const fmt = n => Number(n).toLocaleString();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const iconify = () => createIcons({ icons, attrs: { 'stroke-width': 1.65 } });
function navigate(path) { history.pushState({}, '', appUrl(path)); renderRoute(); }
window.addEventListener('popstate', renderRoute);
function shell(content) {
  return appMarkup(`<div class="app-shell collection-shell"><header class="topbar"><a href="/" class="wordmark" data-nav="/" aria-label="Brick Collection home">${ico('blocks')}<span class="wordmark-text">Brick Collection</span></a><div class="brand-line">Explore. Rotate. Discover.</div><nav class="topbar-right" aria-label="Main navigation"><a class="text-button collection-nav-link" href="/" data-nav="/" aria-label="Collection">${ico('layout-grid')}<span>Collection</span></a><a class="text-button portfolio-link" href="https://johnson-lee-v0.github.io/#hobbies">Johnson Lee ${ico('arrow-up-right')}</a></nav></header>${content}<footer class="footer"><span>An independent collection by Johnson Lee.<br><a href="/about.html">Privacy, credits &amp; licenses</a></span><span>LEGO® is a trademark of the LEGO Group of companies, which does not sponsor, authorize or endorse this site. Vehicle marks belong to their respective owners.</span></footer></div><div id="modal-root"></div>`);
}
function bindNavigation() {
  document.querySelectorAll('[data-nav]').forEach(el => { el.onclick = e => { e.preventDefault(); navigate(el.dataset.nav); }; });
}
async function renderRoute() {
  const serial = ++routeSerial;
  scene?.dispose(); scene = null; model = null;
  window.scrollTo(0,0);
  const design = new URLSearchParams(location.search).get('design');
  if (!design) { document.title = 'Brick Collection · Johnson Lee'; renderGallery(); return; }
  try {
    if (!COLLECTION_CATALOG.some(entry => entry.alias === design || entry.id === design)) throw new Error('This set is not in the public collection.');
    root.innerHTML = shell(`<main class="empty-state"><span class="spinner"></span><h1>Opening the model…</h1><p>Preparing the community CAD reconstruction.</p></main>`);
    bindNavigation(); iconify();
    const [{getModel}, {mountOfficialRoom}] = await Promise.all([import('./model-registry.js'), import('./official-room.js')]);
    if (serial !== routeSerial) return;
    model = getModel(design);
    document.title = `${model.shortTitle} · Brick Collection`;
    scene = mountOfficialRoom({root,model,shell,esc,ico,iconify,bindNavigation,modal,onDownload:downloadImage});
  } catch (error) {
    if (serial !== routeSerial) return;
    root.innerHTML = shell(`<main class="empty-state"><div class="empty-icon">${ico('package-open')}</div><h1>The model could not open.</h1><p>${esc(error.message)}</p><button class="button primary" data-nav="/">Back to the collection ${ico('arrow-right')}</button></main>`);
    bindNavigation(); iconify();
  }
}
function renderGallery() {
  root.innerHTML=shell(`<main class="gallery-main"><div class="gallery-heading"><div class="eyebrow">MODELS OF LEGO® SETS</div><h1>A collection.<br>Piece by piece.</h1><p>Explore attributed community models. Rotate each car and discover its parts.</p></div><div class="gallery-grid gallery-official-grid">${COLLECTION_CATALOG.map((entry,i)=>`<article class="gallery-card"><button class="gallery-art" data-nav="/?design=${entry.alias}" aria-label="Open ${esc(entry.title)}"><img src="${entry.thumbnail}" alt="${esc(entry.title)} community CAD model" width="1100" height="680" ${i>1?'loading="lazy"':''} decoding="async" /><span class="gallery-type">LEGO® SET ${entry.setNumber}</span><span class="gallery-open">${ico('arrow-up-right')}</span></button><div class="gallery-card-info"><div class="eyebrow">${esc(entry.galleryEyebrow)}</div><h2>${esc(entry.shortTitle)}</h2><p>${esc(entry.galleryDescription)}</p><div class="gallery-card-meta"><span>${fmt(entry.modeledPieceCount)} modeled pieces</span><span>Interactive 3D model</span></div><button class="button primary" data-nav="/?design=${entry.alias}">Explore this model ${ico('arrow-right')}</button></div></article>`).join('')}</div><section class="gallery-note"><div>${ico('blocks')}<h2>Look closer.</h2></div><p>This is a model viewer, not a build guide. For physical assembly, open the original LEGO® instructions linked with each set.</p></section></main>`);
  bindNavigation(); iconify();
}
function modal(body, className = '') {
  const host = document.querySelector('#modal-root'); host.innerHTML = appMarkup(`<dialog class="modal ${className}"><button class="modal-close icon-button" aria-label="Close dialog">${ico('x')}</button>${body}</dialog>`);
  const dialog = host.querySelector('dialog'); dialog.querySelector('.modal-close').onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  dialog.showModal(); iconify(); return dialog;
}
function downloadImage() {
  if (!scene) return;
  try {
    const captured = scene.capture();
    modal(`<div class="eyebrow">SAVE THE VIEW</div><h2>A closer look to keep.</h2><img class="export-preview" src="${captured}" alt="Preview of the community model" /><p class="modal-description">Model by ${esc(model.author)}. When sharing the image, include the <a href="/official/${model.setNumber}/MODEL-CREDITS.md">model credit and license</a>.</p><a class="button primary" href="${captured}" download="${model.alias}-collection.png">Download PNG ${ico('download')}</a>`);
  } catch { modal('<h2>The image could not be saved.</h2><p>Please wait for the model to finish loading and try again.</p>'); }
}
root.innerHTML = `<div class="boot">${ico('blocks')}<p>Opening Brick Collection…</p></div>`;
renderRoute();
