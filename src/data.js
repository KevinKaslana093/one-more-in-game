export const GAME_VERSION = 1;

export const PASSENGERS = [
  { id: 'courier', name: '骑手小哥', short: '骑', weight: 68, w: 44, h: 72, color: '#f8b51b', skin: '#ffd2a8', perk: '方正好塞', icon: '▣' },
  { id: 'bride', name: '甜心新娘', short: '娘', weight: 54, w: 78, h: 84, color: '#fff8ed', skin: '#ffd1b1', perk: '婚纱蓬松', icon: '♥' },
  { id: 'corgi', name: '柯基阿福', short: '福', weight: 22, w: 54, h: 42, color: '#e9892e', skin: '#ffe3bf', perk: '灵活补位', icon: '•' },
  { id: 'uncle', name: '健身大叔', short: '壮', weight: 108, w: 64, h: 86, color: '#d94a35', skin: '#e8a16e', perk: '稳定重心', icon: '●' },
  { id: 'office', name: '职场小李', short: '李', weight: 63, w: 42, h: 72, color: '#f1f0e9', skin: '#ffd1a8', perk: '不占地方', icon: '◇' },
  { id: 'granny', name: '广场舞阿姨', short: '姨', weight: 57, w: 48, h: 68, color: '#9b7bd5', skin: '#e9b98c', perk: '自带节奏', icon: '♪' },
  { id: 'boxes', name: '快递山', short: '箱', weight: 46, w: 64, h: 58, color: '#bb7738', skin: '#f0bf73', perk: '可以堆叠', icon: '▦' },
  { id: 'student', name: '赶课学生', short: '学', weight: 49, w: 43, h: 67, color: '#3d92c9', skin: '#f6c89a', perk: '身轻如燕', icon: '★' }
];

export const FLOOR_CONFIG = [
  { target: 3, capacity: 235, time: 45, label: '新手热身' },
  { target: 3, capacity: 215, time: 42, label: '早高峰' },
  { target: 4, capacity: 285, time: 40, label: '婚礼迟到' },
  { target: 4, capacity: 260, time: 38, label: '快递风暴' },
  { target: 5, capacity: 335, time: 36, label: '健身团建' },
  { target: 5, capacity: 310, time: 34, label: '终极早高峰' }
];

export const PROPS = [
  { id: 'lube', icon: '◇', title: '润滑剂', copy: '所有乘客体积 -8%', color: '#43bcb1' },
  { id: 'rope', icon: '∿', title: '弹力绳', copy: '边缘容错 +8 像素', color: '#ef7d3d' },
  { id: 'cart', icon: '□', title: '小推车', copy: '载重上限 +40kg', color: '#728de1' }
];

export const UPGRADES = [
  { id: 'capacity', icon: '⚙', title: '加固钢索', copy: '之后每层载重 +30kg' },
  { id: 'compact', icon: '⤢', title: '收纳大师', copy: '之后乘客体积 -7%' },
  { id: 'coins', icon: '★', title: '幸运硬币', copy: '本局得分 +25%' }
];
