import { callCloudFunction } from '../../utils/cloud-adapter';
// @ts-ignore
import Toast, { hideToast } from 'tdesign-miniprogram/toast/index';

const PRESET_TEMPLATES = [
  { name: 'A4 卡纸', mat: '卡纸', thick: 0.3, color: '白色', w: 297, h: 210, price: 1 },
  { name: 'A3 卡纸', mat: '卡纸', thick: 0.3, color: '白色', w: 420, h: 297, price: 2 },
  { name: '瓦楞纸箱板', mat: '瓦楞纸', thick: 3, color: '牛皮色', w: 600, h: 400, price: 5 },
  { name: '高密泡沫板', mat: '泡沫板', thick: 5, color: '白色', w: 500, h: 500, price: 8 },
  { name: '标准椴木整板', mat: '木板', thick: 3, color: '原木色', w: 2440, h: 1220, price: 45 },
  { name: '透明亚克力', mat: '亚克力', thick: 2, color: '透明', w: 1000, h: 1000, price: 30 },
];

Page({
  data: {
    material: '木板',
    thickness: 3,
    color: '原木色',
    width: 2440,
    height: 1220,
    price: 45,
    qty: 1,
    safetyMarginMm: 2,

    // 常用材料模板
    presets: PRESET_TEMPLATES,
    materialOptions: ['卡纸', '瓦楞纸', '泡沫板', '木板', '亚克力', '自定义'],

    // 禁排/破损区
    hasDefect: false,
    defectX: 0,
    defectY: 0,
    defectW: 100,
    defectH: 100,
  },

  applyPreset(e: any) {
    const idx = Number(e.currentTarget.dataset.idx);
    const p = PRESET_TEMPLATES[idx];
    if (p) {
      this.setData({
        material: p.mat,
        thickness: p.thick,
        color: p.color,
        width: p.w,
        height: p.h,
        price: p.price,
      });
      Toast({ context: this, selector: '#t-toast', message: `已应用: ${p.name}`, theme: 'success' });
    }
  },

  selectMaterial(e: any) {
    const mat = e.currentTarget.dataset.mat;
    this.setData({ material: mat });
  },

  updateMat(e: any) { this.setData({ material: e.detail.value }) },
  updateThick(e: any) { this.setData({ thickness: parseFloat(e.detail.value) || 0 }) },
  updateColor(e: any) { this.setData({ color: e.detail.value }) },
  updateW(e: any) { this.setData({ width: parseFloat(e.detail.value) || 0 }) },
  updateH(e: any) { this.setData({ height: parseFloat(e.detail.value) || 0 }) },
  updatePrice(e: any) { this.setData({ price: parseFloat(e.detail.value) || 0 }) },
  updateQty(e: any) { this.setData({ qty: parseInt(e.detail.value) || 1 }) },
  updateSafetyMargin(e: any) { this.setData({ safetyMarginMm: parseFloat(e.detail.value) || 0 }) },

  toggleDefect(e: any) { this.setData({ hasDefect: e.detail.value }) },
  updateDefectX(e: any) { this.setData({ defectX: parseFloat(e.detail.value) || 0 }) },
  updateDefectY(e: any) { this.setData({ defectY: parseFloat(e.detail.value) || 0 }) },
  updateDefectW(e: any) { this.setData({ defectW: parseFloat(e.detail.value) || 0 }) },
  updateDefectH(e: any) { this.setData({ defectH: parseFloat(e.detail.value) || 0 }) },

  async submit() {
    if (this.data.width <= 0 || this.data.height <= 0) {
      return Toast({ context: this, selector: '#t-toast', message: '请输入正确的板材长宽尺寸' });
    }
    
    Toast({ context: this, selector: '#t-toast', message: '材料入库中...', theme: 'loading' });
    
    const defects = [];
    if (this.data.hasDefect && this.data.defectW > 0 && this.data.defectH > 0) {
      defects.push({
        x: Math.round(this.data.defectX * 10),
        y: Math.round(this.data.defectY * 10),
        width: Math.round(this.data.defectW * 10),
        height: Math.round(this.data.defectH * 10),
      });
    }

    const stocks = [];
    for (let i = 0; i < this.data.qty; i++) {
      stocks.push({
        code: 'STD-' + Date.now().toString().slice(-6) + i,
        group: { 
          material: this.data.material, 
          thicknessMm: this.data.thickness, 
          color: this.data.color, 
          pricePerSqm: this.data.price 
        },
        width: Math.round(this.data.width * 10),  // internal is 0.1mm
        height: Math.round(this.data.height * 10),
        isOffcut: false,
        status: 'AVAILABLE',
        defects: defects.length > 0 ? defects : undefined,
      });
    }

    const res: any = await callCloudFunction('saveStocks', { stocks });
    hideToast({ context: this, selector: '#t-toast' });
    
    if (res.result && res.result.code === 200) {
      Toast({ context: this, selector: '#t-toast', message: '材料入库成功', theme: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } else {
      Toast({ context: this, selector: '#t-toast', message: '入库失败，请重试', theme: 'error' });
    }
  }
});
