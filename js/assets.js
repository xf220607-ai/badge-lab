// 素材注册表只登记 assets 文件夹中真实存在的装饰文件；不存在的示意素材不进入 Maker。
export const ASSETS = {
  // 「背景素材」缩略图由这里的数据自动生成。以后新增背景时，只需把图片放进
  // assets/backgrounds/，再追加一条 { id, name, path } 配置；fit 可选 cover / contain。
  backgrounds: [
     { id: 'paper-blue', name: 'windows桌面', path: 'assets/backgrounds/tem1_bg1.jpg' }
  ],
  patterns: [
    { id: 'none', name: 'None', icon: '—' }, { id: 'dots', name: 'Dots', icon: '⠿' }, { id: 'stars', name: 'Stars', icon: '✦' },
    { id: 'grid', name: 'Grid', icon: '#' }, { id: 'checker', name: 'Checkerboard', icon: '▦' }, { id: 'noise', name: 'Pixel Noise', icon: '░' }
  ],
  decorations: [
    { id: 'none', name: '无' },
    { id: 'tem1-light1', name: 'Light 1', label: '光束 1', kind: 'back', path: 'assets/decorations/back/tem1_light1.png' },
    { id: 'tem1-light2', name: 'Light 2', label: '光束 2', kind: 'back', path: 'assets/decorations/back/tem1_light2.png' },
    { id: 'tem1-light3', name: 'Light 3', label: '光束 3', kind: 'back', path: 'assets/decorations/back/tem1_light3.png' },
    { id: 'tem1-light4', name: 'Light 4', label: '光束 4', kind: 'back', path: 'assets/decorations/back/tem1_light4.png' },
    { id: 'tem1-light5', name: 'Light 5', label: '光束 5', kind: 'back', path: 'assets/decorations/back/tem1_light5.png' },
    { id: 'tem1-light6', name: 'Light 6', label: '光束 6', kind: 'back', path: 'assets/decorations/back/tem1_light6.png' },
    { id: 'tem1-light7', name: 'Light 7', label: '光束 7', kind: 'back', path: 'assets/decorations/back/tem1_light7.png' },
    { id: 'tem1-guogai1', name: '锅盖', label: '锅盖', kind: 'back', path: 'assets/decorations/back/tem1_guogai1.png' },
    { id: 'tem1-guogai2', name: '手锅盖', label: '手锅盖', kind: 'back', path: 'assets/decorations/back/tem1_guogai2.png' },
    { id: 'tem1-guogai3', name: '上手', label: '上手', kind: 'back', path: 'assets/decorations/back/tem1_guogai3.png' },
    { id: 'tem1-plate1', name: '底盘', label: '底盘', kind: 'back', path: 'assets/decorations/back/tem1_plate1.png' },
    { id: 'tem1-plate2', name: '手底盘', label: '手底盘', kind: 'back', path: 'assets/decorations/back/tem1_plate2.png' },
    { id: 'tem1-plate3', name: '下手', label: '下手', kind: 'back', path: 'assets/decorations/back/tem1_plate3.png' },
    { id: 'y2k-food-badge-five-stars', name: '五星好评', label: '五星好评', kind: 'front', path: 'assets/decorations/front/y2k-food-badge-five-stars.png' },
  ],
  accents: ['#ff3e93','#6636ff','#00a99d','#ff7a00','#ffdb26','#151515']
};
