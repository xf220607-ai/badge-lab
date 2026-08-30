import { ASSETS, assetUrl } from './assets.js';
import { getLayout } from './layouts.js';
import { removeBackground as removeImageBackground } from '@imgly/background-removal';

// 所有实时选择集中在 state。预览与 PNG 导出都读取同一份 state，避免两者不一致。
const templateId = new URLSearchParams(location.search).get('template') || 'retro-desktop';
const layout = getLayout(templateId);
const isTemplate01 = layout.id === 'template01';
const characterLayer = layout.layers?.find(layer => layer.type === 'character');
// Prefer the current badge schema while keeping older implemented templates safe.
const badge = layout.badge || (layout.badgeArea ? {
  x: layout.badgeArea.x,
  y: layout.badgeArea.y,
  cutDiameter: layout.badgeArea.diameter,
  safeDiameter: layout.safeArea?.diameter ?? layout.bleed?.size ?? layout.badgeArea.diameter
} : null);
function makeState() {
  const { backgroundColor, ...defaults } = layout.defaults;
  return {
    ...defaults,
    back: [...layout.defaults.back],
    front: [...layout.defaults.front],
    // 背景始终只有一种生效模式：纯色、内置素材或本地上传。
    background: { mode: 'color', color: backgroundColor, assetId: null, uploadedSrc: null, uploadedName: null },
    backgroundAssetsOpen: false,
    charSize: 'medium',
    charAlign: 'center',
    characterImage: null,
    activeTab: 'character',
    activeSlot: { back: 0, front: 0 },
    characterTransform: characterLayer ? { x: characterLayer.x, y: characterLayer.y, width: characterLayer.width, height: characterLayer.height, rotation: characterLayer.rotation, scale: characterLayer.scale } : null
  };
}
let state = makeState();
let pendingImage = null;
let cutoutImage = null;
const canvasEl = document.querySelector('#design-canvas');
const controls = document.querySelector('#controls');
const imageInput = document.querySelector('#image-input');
const backgroundImageInput = document.querySelector('#background-image-input');
const dialog = document.querySelector('#cutout-dialog');
const cutoutPreview = document.querySelector('#cutout-preview');
const removeBackground = document.querySelector('#remove-background');
const cutoutToolButtons = [...document.querySelectorAll('[data-cutout-tool]')];
const brushSizeInput = document.querySelector('#brush-size');
const brushSizeOutput = document.querySelector('#brush-size-output');
const resetCutoutEdits = document.querySelector('#reset-cutout-edits');
const cutoutToolStatus = document.querySelector('#cutout-tool-status');
const previewSize = 420;
const originalPreview = document.createElement('canvas');
const cutoutBase = document.createElement('canvas');
originalPreview.width = cutoutBase.width = previewSize;
originalPreview.height = cutoutBase.height = previewSize;
let activeCutoutTool = 'keep';
let brushSize = Number(brushSizeInput.value);
let isCutoutProcessing = false;
let isPaintingCutout = false;
let lastPaintPoint = null;
let hasCutoutEdits = false;
const patterns = { none:'none', dots:'radial-gradient(var(--pattern-color) 1.4px,transparent 1.8px)', grid:'linear-gradient(var(--pattern-color) 1px,transparent 1px),linear-gradient(90deg,var(--pattern-color) 1px,transparent 1px)', checker:'conic-gradient(var(--pattern-color) 25%,transparent 0 50%,var(--pattern-color) 0 75%,transparent 0)', noise:'radial-gradient(var(--pattern-color) 1px,transparent 1.4px)' };
// 逻辑画布中的底纹单元尺寸。预览转为百分比，导出使用同一数值，避免密度随显示尺寸变化。
const patternCells = { dots: 38, noise: 38, stars: 76, grid: 56, checker: 54 };
// 模型与 WASM 随项目发布，避免首次抠图依赖 IMG.LY 的外部 CDN。
const cutoutConfig = {
  publicPath: new URL('background-removal/', window.location.href).toString(),
  model: 'isnet_quint8',
  device: 'cpu'
};

function selectedAsset(id) { return ASSETS.decorations.find(a => a.id === id) || ASSETS.decorations[0]; }
function slotAllowsAsset(slot, id) { return Boolean(slot?.assetIds?.includes(id)); }
// 同一槽位内的每个素材可覆盖位置和尺寸；未声明时仍可使用槽位的共享值。
function slotTransform(slot, id) { return { ...slot, ...(slot?.transforms?.[id] || {}) }; }
function slotChoices(slot) {
  const allowedIds = new Set(['none', ...(slot?.assetIds || [])]);
  return ASSETS.decorations.filter(asset => allowedIds.has(asset.id));
}
function backgroundAssetSrc(asset) { return assetUrl(asset?.path || asset?.src || ''); }
function activeBackground() {
  const background = state.background;
  if (background.mode === 'preset') {
    const asset = ASSETS.backgrounds.find(item => item.id === background.assetId);
    const path = backgroundAssetSrc(asset);
    if (path) return { color: background.color, image: { path, fit: asset.fit || 'cover' } };
  }
  if (background.mode === 'uploaded' && background.uploadedSrc) {
    return { color: background.color, image: { path: background.uploadedSrc, fit: 'cover' } };
  }
  return { color: background.color, image: null };
}
function colorBackground(color = state.background.color) {
  return { mode: 'color', color, assetId: null, uploadedSrc: null, uploadedName: null };
}
function presetBackground(assetId) {
  return { mode: 'preset', color: state.background.color, assetId, uploadedSrc: null, uploadedName: null };
}
function uploadedBackground(src, name) {
  return { mode: 'uploaded', color: state.background.color, assetId: null, uploadedSrc: src, uploadedName: name };
}
function patternStyle(id) {
  if (id === 'stars') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><text y="20" font-size="17" fill="${state.patternColor}">✦</text></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  return patterns[id] || 'none';
}
function canvasPercent(value, axis = 'x') { return value / layout.canvas[axis === 'y' ? 'height' : 'width'] * 100; }
function templateLayer(id) { return layout.layers.find(layer => layer.id === id); }
function renderDecoNodes(kind, layer) {
  return state[kind].map((id, i) => {
    const asset = selectedAsset(id);
    if (id === 'none') return '';
    if (isTemplate01) {
      const slot = layout.decorationSlots[kind]?.[i];
      if (!slotAllowsAsset(slot, id) || !asset.path) return '';
      const transform = slotTransform(slot, id);
      const characterZ = templateLayer('character').zIndex, zIndex = kind === 'back' ? Math.min(slot.zIndex, characterZ - 1) : Math.max(slot.zIndex, characterZ + 1);
      return `<img class="template-decoration" src="${assetUrl(asset.path)}" alt="" aria-hidden="true" style="--x:${canvasPercent(transform.x)}%;--y:${canvasPercent(transform.y, 'y')}%;--w:${canvasPercent(transform.width)}%;--h:${canvasPercent(transform.height, 'y')}%;--rotation:${transform.rotation}deg;--scale:${transform.scale};--z:${zIndex}">`;
    }
    const p = layout[`${kind}Positions`]?.[i];
    if (!p || !asset.icon) return '';
    return `<div class="canvas-deco ${asset.id === 'window' ? 'deco-window' : ''}" style="--x:${p.x / 10}%;--y:${p.y / 10}%;--size:${p.size / 10}%;--rotate:${p.rotate}deg;--layer:${layer};--deco-color:${asset.color}" aria-hidden="true">${asset.icon}</div>`;
  }).join('');
}
function applyCanvasAppearance() {
  const background = activeBackground();
  const backgroundImage = background.image;
  // 自定义属性最终在 css/template01.css 中作为 background-image 使用；相对路径会被
  // 浏览器按 CSS 文件目录解析成 /css/assets/...，因此先转成基于当前页面的绝对 URL。
  const resolvedBackgroundPath = backgroundImage?.path ? new URL(backgroundImage.path, document.baseURI).href : '';
  const backgroundImageValue = resolvedBackgroundPath ? `url(${JSON.stringify(resolvedBackgroundPath)})` : 'none';
  const backgroundSize = backgroundImage?.fit || 'cover';
  canvasEl.style.backgroundColor = background.color;
  canvasEl.style.backgroundImage = backgroundImageValue;
  canvasEl.style.backgroundPosition = 'center';
  canvasEl.style.backgroundRepeat = 'no-repeat';
  canvasEl.style.backgroundSize = backgroundSize;
  canvasEl.style.setProperty('--accent-primary', state.accentPrimary);
  canvasEl.style.setProperty('--accent-secondary', state.accentSecondary);
  canvasEl.style.setProperty('--pattern-color', state.patternColor);
  canvasEl.style.setProperty('--pattern-image', patternStyle(state.pattern));
  const cell = patternCells[state.pattern], cellPercent = cell ? canvasPercent(cell) : 0;
  const patternSize = state.pattern === 'grid' ? `${cellPercent}% ${cellPercent}%,${cellPercent}% ${cellPercent}%` : cell ? `${cellPercent}% ${cellPercent}%` : 'auto';
  canvasEl.style.setProperty('--pattern-size', patternSize);
  return { color: background.color, image: backgroundImage, imageValue: backgroundImageValue, size: backgroundSize };
}
function renderTemplate01Preview() {
  const character = templateLayer('character');
  const transform = state.characterTransform;
  const characterContent = state.characterImage ? `<img src="${state.characterImage}" alt="上传的人物">` : `<span>人物<br><small>上传图片</small></span>`;
  const showTransformBox = state.characterImage && state.activeTab === 'character';
  const transformBox = showTransformBox ? `<div class="character-transform-box" style="--x:${canvasPercent(transform.x)}%;--y:${canvasPercent(transform.y, 'y')}%;--w:${canvasPercent(transform.width * transform.scale)}%;--h:${canvasPercent(transform.height * transform.scale, 'y')}%;--rotation:${transform.rotation}deg" aria-label="人物位置和大小调整框"><button type="button" draggable="false" class="character-resize-handle handle-nw" data-resize-handle="nw" aria-label="从左上角缩放人物"></button><button type="button" draggable="false" class="character-resize-handle handle-ne" data-resize-handle="ne" aria-label="从右上角缩放人物"></button><button type="button" draggable="false" class="character-resize-handle handle-sw" data-resize-handle="sw" aria-label="从左下角缩放人物"></button><button type="button" draggable="false" class="character-resize-handle handle-se" data-resize-handle="se" aria-label="从右下角缩放人物"></button><span class="character-size-badge" aria-hidden="true">${Math.round(transform.width * transform.scale)} × ${Math.round(transform.height * transform.scale)}</span></div>` : '';
  canvasEl.className = 'design-canvas template01-canvas';
  const background = applyCanvasAppearance();
  canvasEl.style.background = 'transparent';
  canvasEl.style.setProperty('--template-background-color', background.color);
  canvasEl.style.setProperty('--template-background-image', background.imageValue);
  canvasEl.style.setProperty('--template-background-size', background.size);
  canvasEl.style.setProperty('--template-circle-x', `${canvasPercent(badge.x)}%`);
  canvasEl.style.setProperty('--template-circle-y', `${canvasPercent(badge.y, 'y')}%`);
  canvasEl.style.setProperty('--template-circle-size', `${canvasPercent(badge.cutDiameter)}%`);
  canvasEl.style.setProperty('--template-circle-radius', `${canvasPercent(badge.cutDiameter / 2)}%`);
  canvasEl.innerHTML = `<div class="template01-artwork"><div class="template01-disc" aria-hidden="true"></div>${renderDecoNodes('back', 2)}<div class="template01-character ${state.characterImage ? 'has-image' : ''}" style="--x:${canvasPercent(transform.x)}%;--y:${canvasPercent(transform.y, 'y')}%;--w:${canvasPercent(transform.width)}%;--h:${canvasPercent(transform.height, 'y')}%;--rotation:${transform.rotation}deg;--scale:${transform.scale};--z:${character.zIndex}">${characterContent}</div>${renderDecoNodes('front', 5)}</div><div class="template01-cut-guide" style="--guide-x:${canvasPercent(badge.x)}%;--guide-y:${canvasPercent(badge.y, 'y')}%;--guide-size:${canvasPercent(badge.cutDiameter)}%" aria-label="切割线"></div><div class="template01-safe-guide editor-only" style="--guide-x:${canvasPercent(badge.x)}%;--guide-y:${canvasPercent(badge.y, 'y')}%;--guide-size:${canvasPercent(badge.safeDiameter)}%" aria-label="安全区参考线"></div>${transformBox}`;
  bindCharacterTransform();
  document.querySelectorAll('.tabs button').forEach(btn => btn.setAttribute('aria-selected', btn.dataset.tab === state.activeTab));
}

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function characterCanvasPoint(event) {
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (layout.canvas.width / rect.width),
    y: (event.clientY - rect.top) * (layout.canvas.height / rect.height)
  };
}
function syncCharacterTransformDOM() {
  const transform = state.characterTransform;
  const character = canvasEl.querySelector('.template01-character');
  const box = canvasEl.querySelector('.character-transform-box');
  if (character) {
    character.style.setProperty('--x', `${canvasPercent(transform.x)}%`);
    character.style.setProperty('--y', `${canvasPercent(transform.y, 'y')}%`);
    character.style.setProperty('--w', `${canvasPercent(transform.width)}%`);
    character.style.setProperty('--h', `${canvasPercent(transform.height, 'y')}%`);
    character.style.setProperty('--scale', transform.scale);
  }
  if (box) {
    box.style.setProperty('--x', `${canvasPercent(transform.x)}%`);
    box.style.setProperty('--y', `${canvasPercent(transform.y, 'y')}%`);
    box.style.setProperty('--w', `${canvasPercent(transform.width * transform.scale)}%`);
    box.style.setProperty('--h', `${canvasPercent(transform.height * transform.scale, 'y')}%`);
    const badge = box.querySelector('.character-size-badge');
    if (badge) badge.textContent = `${Math.round(transform.width * transform.scale)} × ${Math.round(transform.height * transform.scale)}`;
  }
}
function bindCharacterTransform() {
  const box = canvasEl.querySelector('.character-transform-box');
  if (!box) return;
  let drag = null;
  box.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    const transform = state.characterTransform;
    if (transform.scale !== 1) {
      transform.width *= transform.scale;
      transform.height *= transform.scale;
      transform.scale = 1;
      syncCharacterTransformDOM();
    }
    const startPoint = characterCanvasPoint(event);
    const handleElement = event.target.closest('[data-resize-handle]');
    const handle = handleElement?.dataset.resizeHandle;
    const start = { ...transform };
    if (handle) {
      const signX = handle.endsWith('e') ? 1 : -1;
      const signY = handle.startsWith('s') ? 1 : -1;
      drag = {
        mode: 'resize', start, signX, signY,
        oppositeX: start.x - signX * start.width / 2,
        oppositeY: start.y - signY * start.height / 2
      };
    } else drag = { mode: 'move', start, startPoint };
    box.classList.add('is-dragging');
    window.addEventListener('pointermove', updateDragging, { passive: false });
    window.addEventListener('pointerup', stopDragging, { once: true });
    window.addEventListener('pointercancel', stopDragging, { once: true });
  });
  function updateDragging(event) {
    if (!drag) return;
    event.preventDefault();
    const point = characterCanvasPoint(event);
    const transform = state.characterTransform;
    if (drag.mode === 'move') {
      const halfWidth = drag.start.width / 2;
      const halfHeight = drag.start.height / 2;
      transform.x = clamp(drag.start.x + point.x - drag.startPoint.x, halfWidth, layout.canvas.width - halfWidth);
      transform.y = clamp(drag.start.y + point.y - drag.startPoint.y, halfHeight, layout.canvas.height - halfHeight);
    } else {
      const startVectorX = drag.signX * drag.start.width;
      const startVectorY = drag.signY * drag.start.height;
      const currentVectorX = point.x - drag.oppositeX;
      const currentVectorY = point.y - drag.oppositeY;
      const projectedScale = (currentVectorX * startVectorX + currentVectorY * startVectorY) / (startVectorX ** 2 + startVectorY ** 2);
      const minScale = Math.max(72 / drag.start.width, 72 / drag.start.height);
      const availableWidth = drag.signX > 0 ? layout.canvas.width - drag.oppositeX : drag.oppositeX;
      const availableHeight = drag.signY > 0 ? layout.canvas.height - drag.oppositeY : drag.oppositeY;
      const maxScale = Math.min(availableWidth / drag.start.width, availableHeight / drag.start.height);
      const scale = clamp(projectedScale, minScale, Math.max(minScale, maxScale));
      transform.width = drag.start.width * scale;
      transform.height = drag.start.height * scale;
      transform.x = drag.oppositeX + drag.signX * transform.width / 2;
      transform.y = drag.oppositeY + drag.signY * transform.height / 2;
    }
    syncCharacterTransformDOM();
  }
  function stopDragging() {
    if (!drag) return;
    drag = null;
    box.classList.remove('is-dragging');
    window.removeEventListener('pointermove', updateDragging);
    window.removeEventListener('pointerup', stopDragging);
    window.removeEventListener('pointercancel', stopDragging);
  }
}
function renderPreview() {
  if (isTemplate01) { renderTemplate01Preview(); return; }
  canvasEl.className = 'design-canvas';
  const size = { small: '52%', medium: '67%', large: '82%' }[state.charSize];
  const align = { left: '41%', center: '50%', right: '59%' }[state.charAlign];
  applyCanvasAppearance();
  const character = state.characterImage ? `<img class="canvas-character" src="${state.characterImage}" alt="上传的人物" style="--char-x:${align};--char-y:59%;--char-size:${size}">` : `<div class="character-placeholder" style="--char-x:${align};--char-y:59%">上传人物<br><small>PNG / JPG / WebP</small></div>`;
  // 层顺序：背景 → 底纹（伪元素）→ 后景槽位 → 人物 → 前景槽位 → 强调元素。
  canvasEl.innerHTML = `${renderDecoNodes('back', 2)}${character}${renderDecoNodes('front', 4)}<div class="canvas-accent"></div><div class="canvas-title">${layout.text.content}</div>`;
  document.querySelectorAll('.tabs button').forEach(btn => btn.setAttribute('aria-selected', btn.dataset.tab === state.activeTab));
}
function assetChoices(items, selected) { return `<div class="choice-grid">${items.map(item => `<button class="asset-choice ${item.id === selected ? 'selected' : ''}" data-choice="${item.id}" type="button">${item.path ? `<img class="asset-preview" src="${assetUrl(item.path)}" alt="${item.label || item.name}"><small>${item.name}</small>` : item.icon ? `<span class="asset-icon" style="--asset-color:${item.color || 'var(--ink)'}">${item.icon}</span><small>${item.name}</small>` : `<span class="asset-none-icon" aria-hidden="true">⊘</span><small>${item.name}</small>`}</button>`).join('')}</div>`; }
// 每条 backgrounds 配置都复用同一个缩略图按钮；增加素材时无需修改 Maker 核心逻辑。
function backgroundAssetButton(item) {
  const selected = state.background.mode === 'preset' && state.background.assetId === item.id;
  return `<button class="background-option background-asset-choice ${selected ? 'selected' : ''}" data-background-asset="${item.id}" type="button"><img class="background-option-preview" src="${backgroundAssetSrc(item)}" alt=""><span>${item.name}</span></button>`;
}
function renderBackgroundControls() {
  const background = state.background;
  const selectedPreset = ASSETS.backgrounds.find(item => item.id === background.assetId);
  const presetPreview = selectedPreset ? `<img class="background-option-preview" src="${backgroundAssetSrc(selectedPreset)}" alt="">` : '<span class="background-upload-preview" aria-hidden="true">▦</span>';
  const uploadPreview = background.mode === 'uploaded' ? `<img class="background-option-preview" src="${background.uploadedSrc}" alt="">` : '<span class="background-upload-preview" aria-hidden="true">▧</span>';
  const assetLibrary = ASSETS.backgrounds.length
    ? `<div class="background-asset-grid">${ASSETS.backgrounds.map(backgroundAssetButton).join('')}</div>`
    : '<p class="background-assets-empty">暂无内置背景素材。将图片登记到 assets.js 后会自动显示在这里。</p>';
  controls.innerHTML = `<h2 class="control-heading">背景</h2><p class="control-copy">自定义颜色、内置背景素材或本地上传图片。</p><div class="background-option-grid"><label id="custom-background-control" class="background-option background-color-option ${background.mode === 'color' ? 'selected' : ''}" aria-label="选择自定义颜色，当前颜色 ${background.color}"><span id="background-color-preview" class="background-color-preview" style="--background-color:${background.color}"></span><span>自定义颜色</span><input id="custom-bg" class="background-color-input" type="color" value="${background.color}"></label><button id="background-assets-button" class="background-option ${background.mode === 'preset' ? 'selected' : ''}" type="button" aria-expanded="${state.backgroundAssetsOpen}">${presetPreview}<span>背景素材</span></button><button id="background-upload-button" class="background-option ${background.mode === 'uploaded' ? 'selected' : ''}" type="button">${uploadPreview}<span>${background.mode === 'uploaded' ? '更换图片' : '选择图片'}</span></button></div>${state.backgroundAssetsOpen ? `<section class="background-assets-panel" aria-label="选择背景素材"><h3>选择背景</h3>${assetLibrary}</section>` : ''}`;

  const colorControl = controls.querySelector('#custom-background-control');
  const colorInput = controls.querySelector('#custom-bg');
  colorInput.addEventListener('click', () => {
    state.background = colorBackground();
    renderPreview();
    controls.querySelectorAll('.background-option').forEach(option => option.classList.toggle('selected', option === colorControl));
  });
  colorInput.addEventListener('input', event => {
    state.background = colorBackground(event.target.value);
    renderPreview();
    controls.querySelector('#background-color-preview').style.setProperty('--background-color', event.target.value);
    colorControl.setAttribute('aria-label', `选择自定义颜色，当前颜色 ${event.target.value}`);
  });
  controls.querySelector('#background-assets-button').addEventListener('click', () => {
    state.backgroundAssetsOpen = !state.backgroundAssetsOpen;
    renderControls();
  });
  controls.querySelector('#background-upload-button').addEventListener('click', () => backgroundImageInput.click());
  controls.querySelectorAll('[data-background-asset]').forEach(button => button.addEventListener('click', () => {
    const asset = ASSETS.backgrounds.find(item => item.id === button.dataset.backgroundAsset);
    if (!asset || !backgroundAssetSrc(asset)) return;
    state.background = presetBackground(asset.id);
    update();
  }));
}
function renderControls() {
  const t = state.activeTab;
  if (isTemplate01 && t === 'character') {
    controls.innerHTML = `<h2 class="control-heading">人物位置与大小</h2><p class="control-copy">${state.characterImage ? '直接拖动画布中的人物来移动位置，拖动蓝色边框的四个角可等比例缩放。' : '上传人物图片后，可直接在画布中移动和缩放。'}红色安全区点线仅供编辑参考，不会出现在成品中。</p><button id="upload-button" class="button primary" type="button">${state.characterImage ? '更换人物图片' : '选择图片并一键抠图'}</button>${state.characterImage ? '<button id="delete-image" class="button quiet delete-button" type="button">删除人物</button>' : ''}`;
    controls.querySelector('#upload-button')?.addEventListener('click', () => imageInput.click());
    controls.querySelector('#delete-image')?.addEventListener('click', () => { state.characterImage = null; update(); });
    return;
  }
  if (t === 'character') controls.innerHTML = `<h2 class="control-heading">上传你的人物</h2><p class="control-copy">图片仅在本地浏览器内处理，不会被发送到服务器。</p><button id="upload-button" class="button primary" type="button">${state.characterImage ? '更换人物图片' : '选择图片并一键抠图'}</button>${state.characterImage ? '<button id="delete-image" class="button quiet delete-button" type="button">删除人物</button>' : ''}<div class="field-row"><label>人物大小</label><div class="segment" data-setting="charSize">${['small','medium','large'].map(v => `<button class="${state.charSize === v ? 'selected' : ''}" data-value="${v}">${({small:'小',medium:'中',large:'大'})[v]}</button>`).join('')}</div></div><div class="field-row"><label>水平位置</label><div class="segment" data-setting="charAlign">${['left','center','right'].map(v => `<button class="${state.charAlign === v ? 'selected' : ''}" data-value="${v}">${({left:'左',center:'中',right:'右'})[v]}</button>`).join('')}</div></div>`;
  if (t === 'background') {
    renderBackgroundControls();
    return;
  }
  if (t === 'pattern') controls.innerHTML = `<h2 class="control-heading">背景底纹</h2><p class="control-copy"></p>${assetChoices(ASSETS.patterns, state.pattern)}<label class="pattern-color">底纹颜色 <input class="native-color" id="pattern-color" type="color" value="${state.patternColor}"></label>`;
  if (isTemplate01 && (t === 'back' || t === 'front')) {
    const title = t === 'back' ? '后景装饰素材' : '前景装饰素材', slots = layout.decorationSlots[t];
    if (!slots.length) controls.innerHTML = `<h2 class="control-heading">${title}</h2><p class="control-copy"></p>`;
    else {
     const slot = slots[state.activeSlot[t]], choices = slotChoices(slot);
      controls.innerHTML = `<h2 class="control-heading">${title}</h2><p class="control-copy"></p><div class="slot-selector" aria-label="选择装饰槽位">${slots.map((_, i) => `<button class="${state.activeSlot[t] === i ? 'selected' : ''}" data-slot="${i}" type="button">${i + 1}</button>`).join('')}</div>${assetChoices(choices, state[t][state.activeSlot[t]])}`;
    }
  }
  if (!isTemplate01 && (t === 'back' || t === 'front')) { const title = t === 'back' ? '后景装饰素材' : '前景装饰素材', available = ASSETS.decorations.filter(asset => asset.id === 'none' || asset.kind === t); controls.innerHTML = `<h2 class="control-heading">${title}</h2><p class="control-copy">先选槽位，再点选素材。只显示 assets 文件夹中属于该层级的真实素材。</p><div class="slot-selector" aria-label="选择装饰槽位">${[0,1,2].map(i => `<button class="${state.activeSlot[t] === i ? 'selected' : ''}" data-slot="${i}" type="button">${i + 1}</button>`).join('')}</div>${assetChoices(available, state[t][state.activeSlot[t]])}`; }
  controls.querySelectorAll('[data-choice]').forEach(btn => btn.onclick = () => { const id = btn.dataset.choice; if (t === 'pattern') state.pattern = id; else state[t][state.activeSlot[t]] = id; update(); });
  controls.querySelectorAll('[data-slot]').forEach(btn => btn.onclick = () => { state.activeSlot[t] = Number(btn.dataset.slot); renderControls(); });
  controls.querySelectorAll('[data-setting] button').forEach(btn => btn.onclick = () => { state[btn.closest('[data-setting]').dataset.setting] = btn.dataset.value; update(); });
  controls.querySelector('#upload-button')?.addEventListener('click', () => imageInput.click()); controls.querySelector('#delete-image')?.addEventListener('click', () => { state.characterImage = null; update(); });
  controls.querySelector('#pattern-color')?.addEventListener('input', e => { state.patternColor = e.target.value; renderPreview(); });
}
function update() { renderPreview(); renderControls(); }
document.querySelectorAll('.tabs button').forEach(btn => btn.addEventListener('click', () => { state.activeTab = btn.dataset.tab; update(); }));
document.querySelector('#reset-button').onclick = () => { state = makeState(); update(); };
document.querySelector('#random-button').onclick = () => { const pick = a => a[Math.floor(Math.random() * a.length)].id; if (ASSETS.backgrounds.length) state.background = presetBackground(ASSETS.backgrounds[Math.floor(Math.random() * ASSETS.backgrounds.length)].id); else state.background = colorBackground(); state.pattern = pick(ASSETS.patterns); if (isTemplate01) { state.back = layout.decorationSlots.back.map(slot => Math.random() < .5 ? 'none' : slot.assetIds[Math.floor(Math.random() * slot.assetIds.length)]); state.front = []; } else ['back','front'].forEach(k => state[k] = state[k].map(() => pick(ASSETS.decorations))); update(); };
backgroundImageInput.addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    state.background = uploadedBackground(reader.result, file.name);
    state.backgroundAssetsOpen = false;
    backgroundImageInput.value = '';
    update();
  });
  reader.readAsDataURL(file);
});
imageInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  const confirmButton = document.querySelector('#confirm-cutout');

  try {
    pendingImage = await createImageBitmap(file);
    cutoutImage = null;

    drawCutoutPreview();
    dialog.showModal();

    setCutoutProcessing(true);
    confirmButton.disabled = true;
    confirmButton.textContent = '正在加载抠图模型…';

    const resultBlob = await removeImageBackground(file, {
      ...cutoutConfig,
      progress: (key, current, total) => {
        if (!total) return;

        const percent = Math.round((current / total) * 100);
        confirmButton.textContent = `正在智能抠图 ${percent}%`;
      }
    });

    cutoutImage = await createImageBitmap(resultBlob);
    drawCutoutPreview();
  } catch (error) {
    console.error('智能抠图失败：', error);
    cutoutToolStatus.textContent = '智能抠图失败，已保留原图。请确认浏览器允许加载本地模型后重试。';
    alert('智能抠图失败，已保留原图。请检查网络或刷新页面后重试。');
  } finally {
    setCutoutProcessing(false);
    confirmButton.disabled = false;
    confirmButton.textContent = '确认使用图片';
  }
});

function drawImageCentered(canvas, image) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, previewSize, previewSize);
  const ratio = Math.min(previewSize / image.width, previewSize / image.height);
  const width = image.width * ratio;
  const height = image.height * ratio;
  ctx.drawImage(image, (previewSize - width) / 2, (previewSize - height) / 2, width, height);
}

function setCutoutProcessing(processing) {
  isCutoutProcessing = processing;
  cutoutToolButtons.forEach(button => { button.disabled = processing; });
  brushSizeInput.disabled = processing;
  resetCutoutEdits.disabled = processing || !hasCutoutEdits;
  cutoutToolStatus.textContent = processing
    ? '正在生成智能抠图结果，完成后即可手动精修。'
    : activeCutoutTool === 'keep'
      ? '保留画笔：在误删区域拖动，补回原图内容。'
      : '橡皮擦：在多余区域拖动，将其擦成透明。';
}

function drawCutoutPreview() {
  if (!pendingImage) return;
  drawImageCentered(originalPreview, pendingImage);
  drawImageCentered(cutoutBase, removeBackground.checked && cutoutImage ? cutoutImage : pendingImage);
  const ctx = cutoutPreview.getContext('2d');
  ctx.clearRect(0, 0, previewSize, previewSize);
  ctx.drawImage(cutoutBase, 0, 0);
  hasCutoutEdits = false;
  resetCutoutEdits.disabled = true;
}

function previewPoint(event) {
  const rect = cutoutPreview.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (cutoutPreview.width / rect.width),
    y: (event.clientY - rect.top) * (cutoutPreview.height / rect.height)
  };
}

function paintCutout(from, to) {
  const ctx = cutoutPreview.getContext('2d');
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = brushSize;
  ctx.globalCompositeOperation = activeCutoutTool === 'erase' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = activeCutoutTool === 'erase'
    ? '#000'
    : ctx.createPattern(originalPreview, 'no-repeat');
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  if (from.x === to.x && from.y === to.y) {
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  hasCutoutEdits = true;
  resetCutoutEdits.disabled = false;
}

cutoutToolButtons.forEach(button => button.addEventListener('click', () => {
  activeCutoutTool = button.dataset.cutoutTool;
  cutoutToolButtons.forEach(item => {
    const active = item === button;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  setCutoutProcessing(false);
}));
brushSizeInput.addEventListener('input', event => {
  brushSize = Number(event.target.value);
  brushSizeOutput.value = brushSize;
  brushSizeOutput.textContent = brushSize;
});
resetCutoutEdits.addEventListener('click', drawCutoutPreview);
cutoutPreview.addEventListener('pointerdown', event => {
  if (isCutoutProcessing || !pendingImage) return;
  event.preventDefault();
  isPaintingCutout = true;
  lastPaintPoint = previewPoint(event);
  cutoutPreview.setPointerCapture(event.pointerId);
  paintCutout(lastPaintPoint, lastPaintPoint);
});
cutoutPreview.addEventListener('pointermove', event => {
  if (!isPaintingCutout) return;
  event.preventDefault();
  const point = previewPoint(event);
  paintCutout(lastPaintPoint, point);
  lastPaintPoint = point;
});
const stopCutoutPainting = event => {
  if (!isPaintingCutout) return;
  isPaintingCutout = false;
  lastPaintPoint = null;
  if (cutoutPreview.hasPointerCapture(event.pointerId)) cutoutPreview.releasePointerCapture(event.pointerId);
};
cutoutPreview.addEventListener('pointerup', stopCutoutPainting);
cutoutPreview.addEventListener('pointercancel', stopCutoutPainting);
removeBackground.onchange = drawCutoutPreview;
document.querySelector('#confirm-cutout').onclick = e => {
  e.preventDefault();
  state.characterImage = cutoutPreview.toDataURL('image/png');
  dialog.close();
  imageInput.value = '';
  update();
};
// Canvas 导出独立绘制图层，只导出中央设计，不带网页 UI 或编辑器出血参考线。
function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`无法加载导出素材：${src}`)); image.src = assetUrl(src); }); }
function drawConfiguredImage(ctx, layer, image) {
  const boxWidth = layer.width * layer.scale, boxHeight = layer.height * layer.scale;
  const ratio = Math.min(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
  const width = image.naturalWidth * ratio, height = image.naturalHeight * ratio;
  ctx.save(); ctx.translate(layer.x, layer.y); ctx.rotate(layer.rotation * Math.PI / 180); ctx.drawImage(image, -width / 2, -height / 2, width, height); ctx.restore();
}
async function fillCanvasBackground(ctx, S) {
  const background = activeBackground();
  ctx.fillStyle = background.color;
  ctx.fillRect(0, 0, S, S);
  if (!background.image?.path) return;
  const image = await loadImage(background.image.path);
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const fit = background.image.fit === 'contain' ? 'contain' : 'cover';
  const ratio = fit === 'contain' ? Math.min(S / imageWidth, S / imageHeight) : Math.max(S / imageWidth, S / imageHeight);
  const width = imageWidth * ratio;
  const height = imageHeight * ratio;
  ctx.drawImage(image, (S - width) / 2, (S - height) / 2, width, height);
}
async function drawTemplateDecorations(ctx, kind) {
  for (let i = 0; i < state[kind].length; i += 1) {
    const id = state[kind][i], slot = layout.decorationSlots[kind]?.[i], asset = selectedAsset(id);
    if (id === 'none' || !slotAllowsAsset(slot, id) || !asset.path) continue;
    drawConfiguredImage(ctx, slotTransform(slot, id), await loadImage(assetUrl(asset.path)));
  }
}
async function exportTemplate01(ctx) {
  const S = layout.canvas.width;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath(); ctx.arc(badge.x, badge.y, badge.cutDiameter / 2, 0, Math.PI * 2); ctx.clip();
  try {
    await fillCanvasBackground(ctx, S);
    drawPattern(ctx, S);
    await drawTemplateDecorations(ctx, 'back');
    if (state.characterImage) {
      const transform = state.characterTransform, image = await loadImage(state.characterImage);
      const width = transform.width * transform.scale, height = transform.height * transform.scale;
      ctx.save(); ctx.translate(transform.x, transform.y); ctx.rotate(transform.rotation * Math.PI / 180);
      const ratio = Math.min(width / image.width, height / image.height); const drawWidth = image.width * ratio, drawHeight = image.height * ratio;
      ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight); ctx.restore();
    }
    await drawTemplateDecorations(ctx, 'front');
  } finally {
    ctx.restore();
  }
  downloadCanvas('badge-lab-template-01.png');
}
function downloadCanvas(name) { const a = document.createElement('a'); a.download = name; a.href = document.querySelector('#export-canvas').toDataURL('image/png'); a.click(); }
async function exportPNG() {
  const canvas = document.querySelector('#export-canvas');
  const ctx = canvas.getContext('2d');
  const S = 1080;
  if (isTemplate01) {
    await exportTemplate01(ctx);
    return;
  }
  ctx.clearRect(0, 0, S, S);
  await fillCanvasBackground(ctx, S);
  drawPattern(ctx, S);
  drawDecos(ctx, 'back');
  if (state.characterImage) {
    const image = await loadImage(state.characterImage);
    const size = { small: 560, medium: 720, large: 880 }[state.charSize];
    const x = { left: 440, center: 540, right: 640 }[state.charAlign];
    ctx.drawImage(image, x - size / 2, 636 - size * .58, size, size);
  }
  drawDecos(ctx, 'front');
  ctx.fillStyle = state.accentSecondary;
  ctx.beginPath(); ctx.arc(940, 900, 82, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1730'; ctx.lineWidth = 8; ctx.stroke();
  ctx.fillStyle = state.accentPrimary; ctx.fillRect(64, 932, 520, 55); ctx.strokeRect(64, 932, 520, 55);
  ctx.fillStyle = '#fff'; ctx.font = '900 25px Arial'; ctx.fillText(layout.text.content, 82, 968);
  downloadCanvas('badge-lab-retro-desktop.png');
}
function drawPattern(ctx,S){const cell=patternCells[state.pattern];if(!cell)return;ctx.save();ctx.globalAlpha=.48;ctx.fillStyle=state.patternColor;ctx.strokeStyle=state.patternColor;if(state.pattern==='dots'||state.pattern==='noise'){const size=state.pattern==='noise'?3:4.5;for(let y=cell*.42;y<S;y+=cell)for(let x=cell*.42;x<S;x+=cell)ctx.fillRect(x,y,size,size);}if(state.pattern==='grid'){for(let i=0;i<S;i+=cell){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,S);ctx.moveTo(0,i);ctx.lineTo(S,i);ctx.stroke();}}if(state.pattern==='checker'){for(let y=0;y<S;y+=cell)for(let x=0;x<S;x+=cell)if((Math.round(x/cell)+Math.round(y/cell))%2===0)ctx.fillRect(x,y,cell,cell);}if(state.pattern==='stars'){ctx.font=`${cell*17/48}px Arial`;for(let y=cell*20/48;y<S;y+=cell)for(let x=0;x<S;x+=cell)ctx.fillText('✦',x,y);}ctx.restore();}
function drawDecos(ctx,kind){state[kind].forEach((id,i)=>{if(id==='none')return;const a=selectedAsset(id),p=layout[`${kind}Positions`]?.[i];if(!p||!a.icon)return;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotate*Math.PI/180);ctx.fillStyle=a.color;ctx.strokeStyle='#1a1730';ctx.lineWidth=6;if(id==='window'){ctx.fillRect(-p.size/2,-p.size*.38,p.size,p.size*.76);ctx.strokeRect(-p.size/2,-p.size*.38,p.size,p.size*.76);ctx.fillStyle=state.accentPrimary;ctx.fillRect(-p.size/2+8,-p.size*.38+8,p.size-16,25);ctx.fillStyle='#1a1730';ctx.font=`${p.size*.5}px Arial`;ctx.fillText('▣',-p.size*.2,p.size*.18);}else{ctx.font=`${p.size*.85}px Arial`;ctx.strokeText(a.icon,-p.size*.38,p.size*.28);ctx.fillText(a.icon,-p.size*.38,p.size*.28);}ctx.restore();});}
document.querySelector('#export-button').onclick=() => exportPNG().catch(error => { console.error('导出失败：', error); alert('导出失败，请重试。'); });
update();
