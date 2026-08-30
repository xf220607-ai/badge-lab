# 吧唧的产房 / Badge Lab

一个无需账号、无需后端的固定版式吧唧稿图生成器原型。用户只能替换模板预设槽位，因此内容可自由变化，但画面构图保持稳定。

## 本地运行

本项目使用浏览器模块和本地图片处理依赖，需要通过 Vite 启动，不能直接双击 `index.html`。

- macOS：双击项目根目录的 `start.command`，终端会启动服务并自动打开网站。
- 命令行：在项目目录运行 `npm start`。
- 如果依赖尚未安装，先运行一次 `npm install`。

开发地址通常是 `http://127.0.0.1:5173/`。请保持启动服务的终端窗口打开；关闭窗口后网站地址会暂时无法访问。

## 项目结构

- `index.html`：首页与模板选择。
- `maker.html`：制作工作台。
- `js/layouts.js`：所有固定版式的位置、默认选项与尺寸。
- `js/assets.js`：背景、底纹、装饰与色彩的素材注册表。
- `js/app.js`：状态、实时预览、上传预处理及 Canvas PNG 导出。
- `css/styles.css`：响应式样式。

## 添加装饰素材

1. 将 PNG 放入 `assets/decorations/back/` 或 `assets/decorations/front/`。
2. 在 `js/assets.js` 的 `decorations` 增加一条记录，例如 `{ id: 'heart', name: 'Heart', icon: '♥', color: '#ff729f', path: 'assets/decorations/front/heart.png' }`。
3. 刷新页面；素材选择区由注册表自动生成。

当前第一版使用文字/符号占位图形来测试完整流程。若升级为真实 PNG，可让渲染器优先读取记录中的 `path`，而控制 UI 和模板配置不需要改动。

## 添加背景图片

背景面板提供三种互斥模式：“自定义颜色”、“背景素材”和“选择图片”。选择颜色会取消当前图片；选择内置素材会替换本地上传图片；重新上传本地图片也会替换当前内置素材。

用户可以通过“选择图片”临时上传本地图片。项目内置背景则由“背景素材”入口中的可复用缩略图按钮自动生成：

1. 将 PNG、JPG 或 WebP 放入 `assets/backgrounds/`。
2. 在 `js/assets.js` 的 `backgrounds` 数组追加一条记录，例如 `{ id: 'paper-blue', name: '蓝色纸张', path: 'assets/backgrounds/paper-blue.png' }`。
3. 刷新页面。新背景会自动出现在“背景素材”列表中，并同时支持实时预览和 PNG 导出。

图片默认以 `cover` 方式铺满背景；如果需要完整显示图片，可在记录中增加 `fit: 'contain'`。

## 添加新模板

在 `js/layouts.js` 新增一个布局对象，提供模板 ID、名称、画布尺寸、默认素材、人物默认参数及三组前/后景槽位的 `{ x, y, size, rotate }`。首页卡片会自动出现。Maker 逻辑从配置读取槽位，而不是按模板写独立逻辑。

`template01` 的 `decorationSlots.back` 将光效、锅盖和底盘绑定到三个后景槽位。每个槽位通过 `assetIds` 声明该固定位置可选择的真实 PNG；例如光效槽位可在 Light 1–7 和“无”之间切换，选项超过一行时仍属于同一槽位。以后只需先在 `js/assets.js` 注册素材，再将素材 ID 追加到对应槽位的 `assetIds`。人物层保留抠图后的透明轮廓，不使用遮罩或裁切，并始终位于全部后景素材之上、全部前景素材之下。`bleed` 只在编辑器 DOM 中渲染，Canvas 导出不会绘制它。

Template 01 的圆形区域是整个成品的硬裁切边界。背景、底纹、后景素材、人物和前景素材超出圆周的全部像素都会被删除；圆外区域在预览和 PNG 导出中始终保持透明。

预览和导出共用 1080 × 1080 逻辑坐标、圆形尺寸及底纹单元尺寸。PNG 素材使用等比 `contain` 绘制，不会因槽位宽高而被压扁或拉长。

## 修改颜色与导出

强调色通过 `state.accentPrimary` / `state.accentSecondary` 和 CSS variables 更新；底纹颜色单独保存。点击“输出成品”会在浏览器 Canvas 中按背景、底纹、后景、人物、前景、强调元素的顺序重新绘制，再下载 1080 × 1080 PNG，网页控件不会被导出。
