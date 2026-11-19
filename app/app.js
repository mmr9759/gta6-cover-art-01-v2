// Vice State Cover Studio — turns photos + a caption into GTA-style poster cover art.
// Everything runs offline: photos are read on this machine and never uploaded.
// Rendering core: renderCover(canvas, W, H) draws any layout + grade at any post size,
// so the live preview and the exported PNG are the exact same drawing.

'use strict';

var POST_SIZES = {
  square:   { label: 'Square',   w: 1080, h: 1080 },
  portrait: { label: 'Portrait', w: 1080, h: 1350 },
  wide:     { label: 'Wide',     w: 1920, h: 1080 },
};

// Nine poster layouts. Panels are fractions of the cover; titleZone places the lettering.
var LAYOUTS = {
  hero:      { name: 'Hero',        panels: [{ x: 0, y: 0, w: 1, h: 1 }], titleZone: 'bottom' },
  'hero-four': { name: 'Hero + Four', panels: [
    { x: 0, y: 0, w: 1, h: 0.60 },
    { x: 0, y: 0.62, w: 0.25, h: 0.38 }, { x: 0.25, y: 0.62, w: 0.25, h: 0.38 },
    { x: 0.50, y: 0.62, w: 0.25, h: 0.38 }, { x: 0.75, y: 0.62, w: 0.25, h: 0.38 }], titleZone: 'hero' },
  'grid-four': { name: 'Grid Four', panels: [
    { x: 0, y: 0, w: 0.495, h: 0.495 }, { x: 0.505, y: 0, w: 0.495, h: 0.495 },
    { x: 0, y: 0.505, w: 0.495, h: 0.495 }, { x: 0.505, y: 0.505, w: 0.495, h: 0.495 }], titleZone: 'center' },
  'full-bleed': { name: 'Full Bleed', panels: [{ x: 0, y: 0, w: 1, h: 1 }], titleZone: 'band' },
  duo:       { name: 'Duo Split',   panels: [
    { x: 0, y: 0, w: 0.495, h: 1 }, { x: 0.505, y: 0, w: 0.495, h: 1 }], titleZone: 'bottom' },
  trio:      { name: 'Trio Strip',  panels: [
    { x: 0, y: 0, w: 0.33, h: 1 }, { x: 0.335, y: 0, w: 0.33, h: 1 },
    { x: 0.67, y: 0, w: 0.33, h: 1 }], titleZone: 'bottom' },
  strips:    { name: 'Strip Four',  panels: [
    { x: 0, y: 0, w: 1, h: 0.24 }, { x: 0, y: 0.253, w: 1, h: 0.24 },
    { x: 0, y: 0.507, w: 1, h: 0.24 }, { x: 0, y: 0.76, w: 1, h: 0.24 }], titleZone: 'top' },
  magazine:  { name: 'Magazine',    panels: [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.63, y: 0, w: 0.37, h: 0.495 }, { x: 0.63, y: 0.505, w: 0.37, h: 0.495 }], titleZone: 'left' },
  nine:      { name: 'Nine Grid',   panels: (function () {
    var out = [], r, c;
    for (r = 0; r < 3; r++) for (c = 0; c < 3; c++)
      out.push({ x: c * 0.34, y: r * 0.34, w: 0.32, h: 0.32 });
    return out;
  })(), titleZone: 'center' },
};

// Six skin-safe grades: warm the scene and the sky, keep skin tones natural.
var GRADES = {
  sunset:  { name: 'Vice Sunset', sky: ['#ff9a3d', '#ff5e7a', '#7b2ff7'], tint: 'rgba(255,110,40,0.16)',  accent: '#ffd166', title: '#ffffff', glow: '#ff5e7a' },
  neon:    { name: 'Neon Nights', sky: ['#2de2ff', '#ff2e88', '#7b2ff7'], tint: 'rgba(255,46,136,0.14)', accent: '#2de2ff', title: '#ffffff', glow: '#ff2e88' },
  golden:  { name: 'Golden Hour', sky: ['#ffd166', '#ff7b2f', '#c94b4b'], tint: 'rgba(255,170,40,0.18)',  accent: '#fff3c4', title: '#ffffff', glow: '#ff9a3d' },
  noir:    { name: 'Palm Noir',   sky: ['#0f2027', '#203a43', '#2c5364'], tint: 'rgba(20,60,80,0.22)',   accent: '#9be8ff', title: '#f2f7ff', glow: '#2de2ff' },
  pastel:  { name: 'Pastel Vice', sky: ['#ffb3d9', '#c9b6ff', '#8fd8ff'], tint: 'rgba(255,150,200,0.12)', accent: '#ff8fc7', title: '#ffffff', glow: '#c9b6ff' },
  mono:    { name: 'Mono Heat',   sky: ['#3d3d3d', '#8a8a8a', '#e8e8e8'], tint: 'rgba(255,120,40,0.10)',  accent: '#ffd166', title: '#ffffff', glow: '#ff9a3d' },
};

var TITLE_COLORS = ['#ffffff', '#ffd166', '#2de2ff', '#ff8fc7', '#ff5e3d', '#0d0714'];
var SURPRISE_TITLES = [
  ['VICE CITY', 'Streets of Gold', 'A LEONIDA STORY'],
  ['NEON COAST', 'Midnight Run', 'DRIVE FAST · LIVE LOUD'],
  ['PALM HEAT', 'Summer in Leonida', 'THE CITY NEVER SLEEPS'],
  ['OCEAN DRIVE', 'Chasing the Sun', 'VICE STATE PRESENTS'],
  ['AFTERGLOW', 'One Last Ride', 'A STORY IN NINE PANELS'],
  ['HOT PURSUIT', 'Wanted Level Five', 'CATCH ME IF YOU CAN'],
];

var SAMPLE_PHOTOS = ['samples/pier.jpg', 'samples/boulevard.jpg'];

var state = {
  layout: 'hero-four', grade: 'sunset', size: 'portrait',
  title: 'VICE CITY', subtitle: 'Streets of Gold', tagline: 'A LEONIDA STORY',
  titleColor: '#ffffff', titleScale: 1, showBadge: true, showFrame: true,
  panels: [], // { photo: index|null, zoom, ox, oy, flip }
};
var photos = [];           // { img, name }
var pickedPhoto = 0;       // library selection
var selectedPanel = 0;
var undoStack = [], future = [];

var canvas = document.getElementById('preview');
var ctx = canvas.getContext('2d');

function layoutDef() { return LAYOUTS[state.layout]; }

function freshPanels() {
  return layoutDef().panels.map(function (_, i) {
    return { photo: photos.length ? (i % photos.length) : null, zoom: 1, ox: 0, oy: 0, flip: false };
  });
}
function ensurePanels() {
  var n = layoutDef().panels.length;
  while (state.panels.length < n) state.panels.push({ photo: photos.length ? 0 : null, zoom: 1, ox: 0, oy: 0, flip: false });
  state.panels.length = n;
}
function snapshot() { return JSON.stringify(state); }
function restore(snap) { state = JSON.parse(snap); syncControls(); drawPreview(); }
function pushHistory() { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); future = []; updateUndoButtons(); }
function undoEdit() {
  if (!undoStack.length) return;
  future.push(snapshot()); restore(undoStack.pop()); updateUndoButtons();
}
function redoEdit() {
  if (!future.length) return;
  undoStack.push(snapshot()); restore(future.pop()); updateUndoButtons();
}
function updateUndoButtons() {
  document.getElementById('btn-undo').disabled = !undoStack.length;
  document.getElementById('btn-redo').disabled = !future.length;
}

// ---------- drawing ----------

function drawPanelPhoto(c, img, rect, panel, grade) {
  var iw = img.naturalWidth, ih = img.naturalHeight;
  var scale = Math.max(rect.w / iw, rect.h / ih) * panel.zoom;
  var dw = iw * scale, dh = ih * scale;
  var dx = rect.x + (rect.w - dw) / 2 + panel.ox * rect.w;
  var dy = rect.y + (rect.h - dh) / 2 + panel.oy * rect.h;
  c.save();
  c.beginPath(); c.rect(rect.x, rect.y, rect.w, rect.h); c.clip();
  if (panel.flip) { c.translate(rect.x + rect.w / 2, 0); c.scale(-1, 1); c.translate(-(rect.x + rect.w / 2), 0); }
  c.drawImage(img, dx, dy, dw, dh);
  // Skin-safe grade: a warm wash + a soft sky gradient, never a hard skin tint.
  c.globalCompositeOperation = 'soft-light';
  c.fillStyle = grade.tint; c.fillRect(rect.x, rect.y, rect.w, rect.h);
  c.globalCompositeOperation = 'source-over';
  var g = c.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(20,4,40,0.28)');
  c.fillStyle = g; c.fillRect(rect.x, rect.y, rect.w, rect.h);
  c.restore();
}

function drawEmptyPanel(c, rect, i, grade) {
  var g = c.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  g.addColorStop(0, grade.sky[0]); g.addColorStop(0.55, grade.sky[1]); g.addColorStop(1, grade.sky[2]);
  c.fillStyle = g; c.fillRect(rect.x, rect.y, rect.w, rect.h);
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.font = '700 ' + Math.round(rect.h * 0.09) + 'px "Segoe UI", system-ui, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function posterFont(px, weight) {
  return weight + ' ' + Math.round(px) + 'px "Arial Black", "Segoe UI Black", Impact, sans-serif';
}

function drawPosterLettering(c, W, H, grade) {
  var zone = layoutDef().titleZone;
  var u = W / 1080; // scale unit
  var titlePx = 148 * u * state.titleScale;
  var subPx = 44 * u, tagPx = 30 * u;
  var tx = W * 0.06, ty;
  if (zone === 'top') ty = H * 0.10;
  else if (zone === 'hero') ty = H * 0.60 - titlePx * 1.5;
  else if (zone === 'band') ty = H * 0.44;
  else if (zone === 'center') ty = H * 0.46;
  else if (zone === 'left') ty = H * 0.72;
  else ty = H - titlePx * 1.9;

  if (zone === 'band') {
    c.save(); c.globalAlpha = 0.92;
    c.fillStyle = '#0d0714'; c.fillRect(0, ty - titlePx * 0.28, W, titlePx * 1.5);
    c.fillStyle = grade.accent; c.fillRect(0, ty - titlePx * 0.28, W, 6 * u);
    c.restore();
  }
  if (state.showBadge) {
    // Sun badge: top-right, unless the top-right panel is narrow — then it
    // would sit on a face, so it goes top-left over the hero panel instead.
    var topRight = layoutDef().panels.find(function (p) {
      return 0.92 >= p.x && 0.92 <= p.x + p.w && 0.075 >= p.y && 0.075 <= p.y + p.h;
    });
    var badgeRight = !topRight || topRight.w >= 0.5;
    var bx = badgeRight ? W - W * 0.16 : W * 0.10, by = H * 0.075, br = 58 * u;
    var sg = c.createRadialGradient(bx, by, br * 0.1, bx, by, br);
    sg.addColorStop(0, '#ffe9a8'); sg.addColorStop(0.5, grade.sky[0]); sg.addColorStop(1, grade.sky[1]);
    c.save(); c.shadowColor = grade.glow; c.shadowBlur = 34 * u;
    c.fillStyle = sg; c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill(); c.restore();
    c.fillStyle = '#0d0714'; c.font = posterFont(br * 0.95, 900);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('VI', bx, by + br * 0.04);
  }
  // Tagline
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.font = '800 ' + tagPx + 'px "Segoe UI", system-ui, sans-serif';
  try { c.letterSpacing = (6 * u) + 'px'; } catch (e) {}
  c.fillStyle = grade.accent;
  c.fillText(state.tagline.toUpperCase(), tx, ty - titlePx * 1.05);
  try { c.letterSpacing = '0px'; } catch (e) {}
  // Big title — the poster formula: huge, stroked, hard drop shadow.
  c.font = posterFont(titlePx, 900);
  c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 0; c.shadowOffsetX = 10 * u; c.shadowOffsetY = 12 * u;
  c.lineJoin = 'round'; c.lineWidth = titlePx * 0.09;
  c.strokeStyle = '#14081f';
  c.strokeText(state.title.toUpperCase(), tx, ty);
  c.shadowColor = grade.glow; c.shadowBlur = 26 * u; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
  c.fillStyle = state.titleColor;
  c.fillText(state.title.toUpperCase(), tx, ty);
  c.shadowColor = 'transparent'; c.shadowBlur = 0;
  // Subtitle on a gradient bar, sized to the subtitle text itself.
  c.font = '800 ' + subPx + 'px "Segoe UI", system-ui, sans-serif';
  var sw = c.measureText(state.subtitle).width + 44 * u;
  var sy = ty + 18 * u;
  var bg = c.createLinearGradient(tx, 0, tx + sw, 0);
  bg.addColorStop(0, grade.sky[0]); bg.addColorStop(1, grade.sky[1]);
  c.fillStyle = bg; c.fillRect(tx, sy, sw, subPx * 1.5);
  c.fillStyle = '#ffffff'; c.font = '800 ' + subPx + 'px "Segoe UI", system-ui, sans-serif';
  c.fillText(state.subtitle, tx + 22 * u, sy + subPx * 1.08);
}

function renderCover(target, W, H) {
  var c = target.getContext('2d');
  target.width = W; target.height = H;
  var grade = GRADES[state.grade];
  var gap = Math.max(3, Math.round(W * 0.006));
  // Backdrop: sunset sky gradient behind every panel.
  var sky = c.createLinearGradient(0, 0, W, H);
  sky.addColorStop(0, grade.sky[2]); sky.addColorStop(0.55, grade.sky[1]); sky.addColorStop(1, grade.sky[0]);
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  ensurePanels();
  layoutDef().panels.forEach(function (p, i) {
    var rect = {
      x: p.x * W + (p.x > 0 ? gap / 2 : 0), y: p.y * H + (p.y > 0 ? gap / 2 : 0),
      w: p.w * W - gap, h: p.h * H - gap,
    };
    var panel = state.panels[i];
    var photo = panel && panel.photo != null ? photos[panel.photo] : null;
    if (photo) drawPanelPhoto(c, photo.img, rect, panel, grade);
    else drawEmptyPanel(c, rect, i, grade);
  });
  // Vignette + grain for the poster feel.
  var vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,2,20,0.42)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  if (state.showFrame) {
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = Math.max(4, W * 0.008);
    c.strokeRect(c.lineWidth / 2, c.lineWidth / 2, W - c.lineWidth, H - c.lineWidth);
  }
  drawPosterLettering(c, W, H, grade);
}

function drawPreview() {
  var size = POST_SIZES[state.size];
  renderCover(canvas, Math.round(size.w * 0.833), Math.round(size.h * 0.833));
  var used = new Set(state.panels.map(function (p) { return p.photo; }));
  document.querySelectorAll('#library img').forEach(function (el, i) {
    el.classList.toggle('used', used.has(i));
    el.classList.toggle('picked', i === pickedPhoto);
  });
  var panel = state.panels[selectedPanel];
  document.getElementById('zoom').value = panel ? panel.zoom : 1;
  document.getElementById('panel-status').textContent =
    'Panel ' + (selectedPanel + 1) + ' selected — drag the photo to move it, or pick a photo from the library';
  positionPanelMenu();
}

function positionPanelMenu() {
  var menu = document.getElementById('panel-menu');
  var p = layoutDef().panels[selectedPanel];
  if (!p) { menu.hidden = true; return; }
  var r = canvas.getBoundingClientRect();
  menu.hidden = false;
  menu.style.left = ((p.x + p.w / 2) * r.width) + 'px';
  menu.style.top = (p.y * r.height + 8) + 'px';
  document.getElementById('panel-menu-label').textContent = 'Panel ' + (selectedPanel + 1);
}

// ---------- export ----------

function downloadPNG(blob, name) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
}
function exportCoverPNG(sizeKey) {
  var size = POST_SIZES[sizeKey];
  var off = document.createElement('canvas');
  renderCover(off, size.w, size.h);
  off.toBlob(function (blob) {
    if (blob) downloadPNG(blob, 'vice-state-' + sizeKey + '-' + size.w + 'x' + size.h + '.png');
  }, 'image/png');
}
function exportAllSizes() {
  Object.keys(POST_SIZES).forEach(function (key, i) {
    setTimeout(function () { exportCoverPNG(key); }, i * 450);
  });
}

// ---------- library ----------

function addPhotoFile(file) {
  var url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function () {
    photos.push({ img: img, name: file.name });
    pickedPhoto = photos.length - 1;
    if (!state.panels.some(function (p) { return p.photo == null; })) {
      state.panels[selectedPanel].photo = pickedPhoto;
    } else {
      var empty = state.panels.findIndex(function (p) { return p.photo == null; });
      if (empty >= 0) state.panels[empty].photo = pickedPhoto;
    }
    buildLibrary(); drawPreview();
  };
  img.src = url;
}
function loadSamplePhotos(done) {
  var remaining = SAMPLE_PHOTOS.length;
  SAMPLE_PHOTOS.forEach(function (src, i) {
    var img = new Image();
    img.onload = function () {
      photos[i] = { img: img, name: src.split('/').pop() };
      if (--remaining === 0) { state.panels = freshPanels(); buildLibrary(); drawPreview(); if (done) done(); }
    };
    img.onerror = function () { if (--remaining === 0 && done) done(); };
    img.src = src;
  });
}
function buildLibrary() {
  var lib = document.getElementById('library');
  lib.innerHTML = '';
  photos.forEach(function (ph, i) {
    var el = document.createElement('img');
    el.src = ph.img.src; el.alt = ph.name; el.title = ph.name;
    el.onclick = function () {
      pickedPhoto = i;
      pushHistory();
      state.panels[selectedPanel].photo = i;
      buildLibrary(); drawPreview();
    };
    lib.appendChild(el);
  });
}

// ---------- UI ----------

function buildLayouts() {
  var wrap = document.getElementById('layouts');
  Object.keys(LAYOUTS).forEach(function (key) {
    var b = document.createElement('button');
    b.className = 'layout-btn' + (key === state.layout ? ' active' : '');
    b.innerHTML = '<span class="thumb"></span>' + LAYOUTS[key].name;
    b.onclick = function () {
      if (state.layout === key) return;
      pushHistory();
      state.layout = key; selectedPanel = 0;
      state.panels = freshPanels();
      document.querySelectorAll('.layout-btn').forEach(function (el) { el.classList.remove('active'); });
      b.classList.add('active');
      drawPreview();
    };
    wrap.appendChild(b);
  });
}
function buildGrades() {
  var wrap = document.getElementById('grades');
  Object.keys(GRADES).forEach(function (key) {
    var g = GRADES[key];
    var b = document.createElement('button');
    b.className = 'grade-btn' + (key === state.grade ? ' active' : '');
    b.innerHTML = '<span class="sw" style="background:linear-gradient(90deg,' + g.sky.join(',') + ')"></span>' + g.name;
    b.onclick = function () {
      if (state.grade === key) return;
      pushHistory(); state.grade = key;
      document.querySelectorAll('.grade-btn').forEach(function (el) { el.classList.remove('active'); });
      b.classList.add('active');
      drawPreview();
    };
    wrap.appendChild(b);
  });
}
function buildTitleColors() {
  var wrap = document.getElementById('title-colors');
  TITLE_COLORS.forEach(function (col) {
    var b = document.createElement('button');
    b.style.background = col;
    if (col === state.titleColor) b.classList.add('active');
    b.title = col;
    b.onclick = function () {
      pushHistory(); state.titleColor = col;
      wrap.querySelectorAll('button').forEach(function (el) { el.classList.remove('active'); });
      b.classList.add('active');
      drawPreview();
    };
    wrap.appendChild(b);
  });
}
function bindCaption(id, key) {
  document.getElementById(id).addEventListener('input', function (e) {
    state[key] = e.target.value;
    drawPreview();
  });
  document.getElementById(id).addEventListener('change', function () { pushHistory(); });
}
function syncControls() {
  document.getElementById('in-title').value = state.title;
  document.getElementById('in-subtitle').value = state.subtitle;
  document.getElementById('in-tagline').value = state.tagline;
  document.getElementById('in-badge').checked = state.showBadge;
  document.getElementById('in-frame').checked = state.showFrame;
  document.getElementById('title-size').value = state.titleScale;
  document.querySelectorAll('.layout-btn').forEach(function (el, i) {
    el.classList.toggle('active', Object.keys(LAYOUTS)[i] === state.layout);
  });
  document.querySelectorAll('.grade-btn').forEach(function (el, i) {
    el.classList.toggle('active', Object.keys(GRADES)[i] === state.grade);
  });
  document.querySelectorAll('#sizes button').forEach(function (el) {
    el.classList.toggle('active', el.dataset.size === state.size);
  });
}

function surpriseMe() {
  pushHistory();
  var keys = Object.keys(LAYOUTS), gkeys = Object.keys(GRADES);
  state.layout = keys[Math.floor(Math.random() * keys.length)];
  state.grade = gkeys[Math.floor(Math.random() * gkeys.length)];
  var t = SURPRISE_TITLES[Math.floor(Math.random() * SURPRISE_TITLES.length)];
  state.title = t[0]; state.subtitle = t[1]; state.tagline = t[2];
  state.titleColor = TITLE_COLORS[Math.floor(Math.random() * TITLE_COLORS.length)];
  state.panels = freshPanels();
  // Shuffle which photo goes where.
  state.panels.forEach(function (p) { p.photo = photos.length ? Math.floor(Math.random() * photos.length) : null; });
  selectedPanel = 0;
  syncControls(); buildLibrary(); drawPreview();
}

// Panel picking + drag-to-pan on the preview canvas.
function canvasPoint(e) {
  var r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
}
function panelAt(pt) {
  var def = layoutDef().panels;
  for (var i = def.length - 1; i >= 0; i--) {
    var p = def[i];
    if (pt.x >= p.x && pt.x <= p.x + p.w && pt.y >= p.y && pt.y <= p.y + p.h) return i;
  }
  return 0;
}
var dragging = null;
canvas.addEventListener('pointerdown', function (e) {
  var pt = canvasPoint(e);
  selectedPanel = panelAt(pt);
  var panel = state.panels[selectedPanel];
  dragging = { start: pt, ox: panel.ox, oy: panel.oy, moved: false };
  canvas.setPointerCapture(e.pointerId);
  drawPreview();
});
canvas.addEventListener('pointermove', function (e) {
  if (!dragging) return;
  var pt = canvasPoint(e);
  var panel = state.panels[selectedPanel];
  var dx = pt.x - dragging.start.x, dy = pt.y - dragging.start.y;
  if (Math.abs(dx) + Math.abs(dy) > 0.004) dragging.moved = true;
  panel.ox = Math.max(-0.6, Math.min(0.6, dragging.ox + dx));
  panel.oy = Math.max(-0.6, Math.min(0.6, dragging.oy + dy));
  drawPreview();
});
canvas.addEventListener('pointerup', function () {
  if (dragging && dragging.moved) pushHistory();
  dragging = null;
});

document.getElementById('panel-menu').addEventListener('click', function (e) {
  var act = e.target.dataset && e.target.dataset.act;
  if (!act) return;
  var panel = state.panels[selectedPanel];
  if (!panel) return;
  pushHistory();
  if (act === 'zoom-in') panel.zoom = Math.min(2.5, panel.zoom + 0.2);
  if (act === 'zoom-out') panel.zoom = Math.max(1, panel.zoom - 0.2);
  if (act === 'flip') panel.flip = !panel.flip;
  if (act === 'clear') { panel.photo = null; panel.zoom = 1; panel.ox = 0; panel.oy = 0; }
  drawPreview();
});
document.getElementById('zoom').addEventListener('input', function (e) {
  var panel = state.panels[selectedPanel];
  if (panel) { panel.zoom = parseFloat(e.target.value); drawPreview(); }
});
document.getElementById('zoom').addEventListener('change', function () { pushHistory(); });
document.getElementById('title-size').addEventListener('input', function (e) {
  state.titleScale = parseFloat(e.target.value); drawPreview();
});
document.getElementById('title-size').addEventListener('change', function () { pushHistory(); });

document.getElementById('file-input').addEventListener('change', function (e) {
  pushHistory();
  Array.prototype.forEach.call(e.target.files, addPhotoFile);
  e.target.value = '';
});
document.addEventListener('dragover', function (e) { e.preventDefault(); });
document.addEventListener('drop', function (e) {
  e.preventDefault();
  if (e.dataTransfer.files.length) {
    pushHistory();
    Array.prototype.forEach.call(e.dataTransfer.files, addPhotoFile);
  }
});
document.getElementById('btn-surprise').onclick = surpriseMe;
document.getElementById('btn-undo').onclick = undoEdit;
document.getElementById('btn-redo').onclick = redoEdit;
document.getElementById('btn-export').onclick = function () { exportCoverPNG(state.size); };
document.getElementById('btn-export-all').onclick = exportAllSizes;
document.getElementById('in-badge').onchange = function (e) { pushHistory(); state.showBadge = e.target.checked; drawPreview(); };
document.getElementById('in-frame').onchange = function (e) { pushHistory(); state.showFrame = e.target.checked; drawPreview(); };
document.querySelectorAll('#sizes button').forEach(function (b) {
  b.onclick = function () {
    pushHistory(); state.size = b.dataset.size;
    document.querySelectorAll('#sizes button').forEach(function (el) { el.classList.remove('active'); });
    b.classList.add('active');
    drawPreview();
  };
});
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undoEdit(); }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redoEdit(); }
});
bindCaption('in-title', 'title');
bindCaption('in-subtitle', 'subtitle');
bindCaption('in-tagline', 'tagline');

// ---------- boot + screenshot modes ----------
// ?shot=cover renders the cover alone, full-window, for screenshots:
//   shot=cover&layout=hero-four&grade=sunset&size=portrait (default)
//   shot=editor renders the editor with the sample photos loaded.
(function boot() {
  var q = new URLSearchParams(location.search);
  if (q.get('layout') && LAYOUTS[q.get('layout')]) state.layout = q.get('layout');
  if (q.get('grade') && GRADES[q.get('grade')]) state.grade = q.get('grade');
  if (q.get('size') && POST_SIZES[q.get('size')]) state.size = q.get('size');
  if (q.get('title')) state.title = q.get('title');
  buildLayouts(); buildGrades(); buildTitleColors(); syncControls(); updateUndoButtons();
  state.panels = freshPanels();
  loadSamplePhotos(function () {
    if (q.get('shot') === 'cover') {
      document.body.classList.add('shot-cover');
      var size = POST_SIZES[state.size];
      renderCover(canvas, size.w, size.h);
      document.title = 'Vice State cover — ' + state.size;
    } else {
      document.body.classList.add('shot-editor');
      drawPreview();
    }
  });
  drawPreview();
})();
