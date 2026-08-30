// 版式注册表：画面固定构图全部集中在这里。新增版式只需添加同结构的配置对象。
export const DEFAULT_LAYOUT_ID = 'retro-desktop';

export const LAYOUTS = {
  'template01': {
    id: 'template01', name: 'Template 01', description: '银色餐罩、光束与悬浮人物的圆形吧唧。', implemented: true,
    canvas: { width: 1080, height: 1080 },
    badge: {
      cutDiameterMM: 58,
      safeDiameterMM: 48,
      x: 540,
      y: 540,
      cutDiameter: 994,
      safeDiameter: 823
    },
    availableSlots: { back: 3, front: 1 },
    defaults: {
      backgroundColor: '#fff4ad', pattern: 'none', patternColor: '#000000',
      back: ['tem1-light1', 'tem1-guogai1', 'tem1-plate1'], front: ['none'],
      accentPrimary: '#ff3e93', accentSecondary: '#6636ff'
    },
    // assetIds 是同一固定位置可以选择的素材列表；以后可直接向对应数组追加素材 ID。
    decorationSlots: {
      back: [
      { assetIds: ['tem1-light1', 'tem1-light2', 'tem1-light3', 'tem1-light4', 'tem1-light5', 'tem1-light6', 'tem1-light7'], x: 540, y: 550, width: 920, height: 920, rotation: 0, scale: 1.8, zIndex: 1 },
      {
        assetIds: ['tem1-guogai1', 'tem1-guogai2', 'tem1-guogai3'],
        transforms: {
          'tem1-guogai1': { x: 500, y: 435, width: 680, height: 500, rotation: 4, scale: 1 },
          'tem1-guogai2': { x: 480, y: 360, width: 680, height: 500, rotation: 4, scale: 1 },
          'tem1-guogai3': { x: 480, y: 360, width: 680, height: 500, rotation: 4, scale: 0.7 }
        },
        zIndex: 2
      },
      {
        assetIds: ['tem1-plate1', 'tem1-plate2', 'tem1-plate3'],
        transforms: {
          'tem1-plate1': { x: 535, y: 800, width: 650, height: 200, rotation: 0, scale: 1 },
          'tem1-plate2': { x: 515, y: 780, width: 650, height: 200, rotation: 0, scale: 1.5 },
          'tem1-plate3': { x: 590, y: 800, width: 650, height: 200, rotation: 0, scale: 1.3 }
        },
        zIndex: 3
      }
      ],
      front: [
        { assetIds: ['y2k-food-badge-five-stars'], x: 540, y: 480, width: 440, height: 260, rotation: 0, scale: 2.5, zIndex: 5 }
      ]
    },
    // 所有坐标均使用 1080 x 1080 导出画布坐标；x/y 是图层中心点。
    layers: [
      {
        id: 'character', type: 'character', x: 552, y: 565, width: 245, height: 390, rotation: 0, scale: 1,
        // 人物保持抠图后的透明轮廓，不应用任何遮罩或裁切。
        zIndex: 4
      }
    ]
  },
  'retro-desktop': {
    id: 'retro-desktop', name: 'Retro Desktop', description: '像素窗口、光标与桌面涂鸦。', implemented: true, canvas: { width: 1080, height: 1080 },
    availableSlots: { back: 3, front: 3 },
    defaults: { backgroundColor: '#fff8df', pattern: 'dots', patternColor: '#6a54a5', back: ['none','none','none'], front: ['none','none','none'], accentPrimary: '#ff3e93', accentSecondary: '#6636ff' },
    character: { x: 540, y: 636, scale: 0.78 },
    // 三个后景及前景槽位的固定位置；用户只能替换素材，不可拖动。
    backPositions: [{ x: 145, y: 245, size: 155, rotate: -8 }, { x: 795, y: 250, size: 170, rotate: 5 }, { x: 850, y: 725, size: 130, rotate: 12 }],
    frontPositions: [{ x: 190, y: 800, size: 135, rotate: -15 }, { x: 805, y: 760, size: 165, rotate: 10 }, { x: 760, y: 165, size: 120, rotate: 8 }],
    text: { x: 64, y: 1000, content: 'YOUR FAVE / YOUR RULES' }
  },
  // 未实现的模板保留在注册表中供首页展示；补齐 defaults 和位置后即可启用。
  'dreamy-pop': { id:'dreamy-pop', name:'Dreamy Pop', description:'柔软闪光的偶像卡氛围。', implemented:false, canvas:{width:1080,height:1080} },
  'graphic-collage': { id:'graphic-collage', name:'Graphic Collage', description:'大胆拼贴与高对比字形。', implemented:false, canvas:{width:1080,height:1080} }
};

export function getLayout(templateId) {
  const requested = LAYOUTS[templateId];
  return requested?.implemented && requested.defaults ? requested : LAYOUTS[DEFAULT_LAYOUT_ID];
}
