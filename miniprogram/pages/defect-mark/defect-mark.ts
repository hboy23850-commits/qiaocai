// @ts-ignore
import Toast from 'tdesign-miniprogram/toast/index';

Page({
  data: {
    imagePath: '',
    defects: [] as {x: number, y: number, width: number, height: number}[],
    currentRect: null as any
  },
  
  canvas: null as any,
  ctx: null as any,
  canvasWidth: 0,
  canvasHeight: 0,
  stockId: '',
  stockWidthMm: 0,
  stockHeightMm: 0,

  imageNativeWidth: 0,
  imageNativeHeight: 0,
  imageRenderWidth: 0,
  imageRenderHeight: 0,
  imageOffsetX: 0,
  imageOffsetY: 0,

  onLoad(options: any) {
    this.stockId = options.stockId || 'default';
    this.stockWidthMm = parseInt(options.w || '1000', 10);
    this.stockHeightMm = parseInt(options.h || '1000', 10);
    
    // In a real app, load existing defects if any.
    setTimeout(() => {
      this.initCanvas();
    }, 500);
  },

  initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#defectCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0]) return;
      this.canvas = res[0].node;
      this.ctx = this.canvas.getContext('2d');
      this.canvasWidth = res[0].width;
      this.canvasHeight = res[0].height;
      this.canvas.width = this.canvasWidth;
      this.canvas.height = this.canvasHeight;
      this.resetBounds();
      this.draw();
    });
  },

  resetBounds() {
    this.imageRenderWidth = this.canvasWidth;
    this.imageRenderHeight = this.canvasHeight;
    this.imageOffsetX = 0;
    this.imageOffsetY = 0;
  },

  calcImageBounds() {
    if (!this.imageNativeWidth || !this.imageNativeHeight || !this.canvasWidth || !this.canvasHeight) {
      this.resetBounds();
      return;
    }
    const scaleX = this.canvasWidth / this.imageNativeWidth;
    const scaleY = this.canvasHeight / this.imageNativeHeight;
    const scale = Math.min(scaleX, scaleY);
    this.imageRenderWidth = this.imageNativeWidth * scale;
    this.imageRenderHeight = this.imageNativeHeight * scale;
    this.imageOffsetX = (this.canvasWidth - this.imageRenderWidth) / 2;
    this.imageOffsetY = (this.canvasHeight - this.imageRenderHeight) / 2;
  },

  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const path = res.tempFiles[0].tempFilePath;
        this.setData({ imagePath: path });
        wx.getImageInfo({
          src: path,
          success: (info) => {
            this.imageNativeWidth = info.width;
            this.imageNativeHeight = info.height;
            this.calcImageBounds();
            this.draw();
          }
        });
      }
    });
  },

  touchStart(e: any) {
    const touch = e.touches[0];
    this.setData({
      currentRect: { startX: touch.x, startY: touch.y, endX: touch.x, endY: touch.y }
    });
  },

  touchMove(e: any) {
    if (!this.data.currentRect) return;
    const touch = e.touches[0];
    this.setData({
      'currentRect.endX': touch.x,
      'currentRect.endY': touch.y
    }, () => {
      this.draw();
    });
  },

  touchEnd() {
    if (this.data.currentRect) {
      const rect = this.data.currentRect;
      let x = Math.min(rect.startX, rect.endX);
      let y = Math.min(rect.startY, rect.endY);
      let w = Math.abs(rect.startX - rect.endX);
      let h = Math.abs(rect.startY - rect.endY);
      
      // Clamp to image boundaries
      const clampX = Math.max(this.imageOffsetX, Math.min(x, this.imageOffsetX + this.imageRenderWidth));
      const clampY = Math.max(this.imageOffsetY, Math.min(y, this.imageOffsetY + this.imageRenderHeight));
      const clampMaxX = Math.max(this.imageOffsetX, Math.min(x + w, this.imageOffsetX + this.imageRenderWidth));
      const clampMaxY = Math.max(this.imageOffsetY, Math.min(y + h, this.imageOffsetY + this.imageRenderHeight));

      x = clampX;
      y = clampY;
      w = clampMaxX - clampX;
      h = clampMaxY - clampY;
      
      if (w > 5 && h > 5) {
        const mapX = (x - this.imageOffsetX) / this.imageRenderWidth;
        const mapY = (y - this.imageOffsetY) / this.imageRenderHeight;
        const mapW = w / this.imageRenderWidth;
        const mapH = h / this.imageRenderHeight;
        
        this.data.defects.push({
          x: Math.round(mapX * this.stockWidthMm * 10),
          y: Math.round(mapY * this.stockHeightMm * 10),
          width: Math.round(mapW * this.stockWidthMm * 10),
          height: Math.round(mapH * this.stockHeightMm * 10)
        });
      }
      this.setData({ currentRect: null, defects: this.data.defects }, () => {
        this.draw();
      });
    }
  },

  draw() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    this.ctx.strokeStyle = 'red';
    this.ctx.lineWidth = 2;
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';

    // Draw saved defects
    this.data.defects.forEach(d => {
      const rx = (d.x / (this.stockWidthMm * 10)) * this.imageRenderWidth + this.imageOffsetX;
      const ry = (d.y / (this.stockHeightMm * 10)) * this.imageRenderHeight + this.imageOffsetY;
      const rw = (d.width / (this.stockWidthMm * 10)) * this.imageRenderWidth;
      const rh = (d.height / (this.stockHeightMm * 10)) * this.imageRenderHeight;
      this.ctx.strokeRect(rx, ry, rw, rh);
      this.ctx.fillRect(rx, ry, rw, rh);
    });

    // Draw current rect
    if (this.data.currentRect) {
      const r = this.data.currentRect;
      const x = Math.min(r.startX, r.endX);
      const y = Math.min(r.startY, r.endY);
      const w = Math.abs(r.startX - r.endX);
      const h = Math.abs(r.startY - r.endY);
      this.ctx.strokeRect(x, y, w, h);
      this.ctx.fillRect(x, y, w, h);
    }
  },

  clearDefects() {
    this.setData({ defects: [] }, () => {
      this.draw();
    });
  },

  confirmDefects() {
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel && eventChannel.emit) {
      eventChannel.emit('acceptDefects', { stockId: this.stockId, defects: this.data.defects });
    }
    Toast({ context: this, selector: '#t-toast', message: '已保存', theme: 'success' });
    setTimeout(() => {
      wx.navigateBack();
    }, 500);
  }
});
