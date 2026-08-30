import { LAYOUTS } from './layouts.js';

// 首页的卡片数据只描述“浏览库”；真正进入 Maker 时由 layouts.js 决定版式参数。
const LIBRARY_ITEMS = [
  {
    ...LAYOUTS.template01,
    name: '请品尝',
    preview: '✦ ◒',
    tags: ['圆形吧唧', 'y2k']
  }
];

const grid = document.querySelector('#template-grid');
const dialog = document.querySelector('#template-dialog');
const modalContent = document.querySelector('#template-modal-content');
let activeTemplateId = null;
const renderTags = tags => (Array.isArray(tags) ? tags : [tags])
  .map(tag => `<small>${tag}</small>`)
  .join('');

grid.classList.toggle('template01-grid', LIBRARY_ITEMS.length === 1 && LIBRARY_ITEMS[0].id === 'template01');
grid.innerHTML = LIBRARY_ITEMS.map((template, index) => `
  <article class="library-card-wrap ${template.id === 'template01' ? 'template01-card-wrap' : ''}">
    <button class="library-card ${template.id === 'template01' ? 'template01-card' : ''}" type="button" data-template-id="${template.id}" aria-label="查看 ${template.name} 模板详情">
      <span class="library-preview preview-${(index % 6) + 1} ${template.id === 'template01' ? 'preview-template01' : ''}" aria-hidden="true">${template.id === 'template01' ? '<img class="template01-cover-image" src="assets/backgrounds/cover_template01.png" alt="">' : ''}<span>${template.preview}</span></span>
      <span class="library-card-info"><strong>${template.name}</strong><span class="library-card-tags">${renderTags(template.tags)}</span></span>
    </button>
  </article>`).join('');

function openDetails(id) {
  const template = LIBRARY_ITEMS.find(item => item.id === id);
  if (!template) return;
  const index = LIBRARY_ITEMS.findIndex(item => item.id === id);
  activeTemplateId = template.id;
  dialog.dataset.templateId = activeTemplateId;
  modalContent.innerHTML = `<div class="modal-preview preview-${(index % 6) + 1} ${template.id === 'template01' ? 'preview-template01' : ''}" aria-hidden="true">${template.id === 'template01' ? '<img class="template01-cover-image" src="assets/backgrounds/cover_template01.png" alt="">' : ''}<span>${template.preview}</span></div><div class="modal-copy"><h2 id="modal-template-name">${template.name}</h2><p id="modal-template-description">${template.description}</p><button class="button primary modal-use-template" type="button">使用此模板</button></div>`;
  modalContent.querySelector('.modal-use-template').addEventListener('click', () => {
    if (!activeTemplateId) return;
    location.assign(`maker.html?template=${encodeURIComponent(activeTemplateId)}`);
  });
  dialog.showModal();
}

grid.querySelectorAll('.library-card').forEach(card => card.addEventListener('click', () => openDetails(card.dataset.templateId)));
dialog.querySelector('.modal-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && dialog.open) {
    event.preventDefault();
    dialog.close();
  }
});
dialog.addEventListener('close', () => {
  activeTemplateId = null;
  delete dialog.dataset.templateId;
});
