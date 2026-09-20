"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../utils/core/index");
// @ts-ignore
const index_2 = __importDefault(require("tdesign-miniprogram/toast/index"));
const TEMPLATE_LIST = [
    { kind: 'RECT', name: '矩形', icon: '⬛' },
    { kind: 'ROUNDED_RECT', name: '圆角矩形', icon: '▢' },
    { kind: 'CIRCLE', name: '圆形', icon: '⚪' },
    { kind: 'ELLIPSE', name: '椭圆', icon: '⬭' },
    { kind: 'TRIANGLE', name: '三角形', icon: '▲' },
    { kind: 'REGULAR_POLYGON', name: '正多边形', icon: '⬡' },
    { kind: 'L_SHAPE', name: 'L形', icon: '⌐' },
    { kind: 'ARCH', name: '拱门形', icon: '⌒' },
    { kind: 'STAR', name: '星形', icon: '★' },
];
Page({
    data: {
        currentTab: 'template',
        templateList: TEMPLATE_LIST,
        selectedKind: 'TRIANGLE',
        shapeKindName: '三角形',
        tplParams: {
            width: 100,
            height: 100,
            radius: 20,
            diameter: 100,
            rx: 50,
            ry: 35,
            base: 100,
            sides: 6,
            w1: 100,
            h1: 100,
            w2: 40,
            h2: 40,
            archHeight: 40,
            points: 5,
            outerRadius: 60,
            innerRadius: 25,
        },
        geoWidthMm: 100,
        geoHeightMm: 100,
        geoAreaMm2: 5000,
        vertexCount: 3,
        selfIntersecting: false,
        // 自由绘制状态
        drawPoints: [],
        isClosed: false,
        enableSnap: true,
        drawHistory: [],
        drawHistoryIndex: -1,
        dragIndex: -1,
        // 拍照识别状态
        photoThreshold: 128,
        dpTolerance: 3,
        photoKnownWidthMm: 100,
        photoPath: '',
        geometrySource: 'TEMPLATE',
        // SVG 状态
        svgCode: '',
        // 零件基本设定
        partName: '异形零件 1',
        partQuantity: 1,
        rotationPolicy: 'RIGHT_ANGLE',
    },
    canvas: null,
    ctx: null,
    canvasWidth: 340,
    canvasHeight: 280,
    viewScale: 1,
    viewOffsetX: 0,
    viewOffsetY: 0,
    onLoad() {
        this.updateFromTemplate();
    },
    onReady() {
        this.initCanvas();
    },
    initCanvas() {
        const query = wx.createSelectorQuery().in(this);
        query
            .select('#workbenchCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
            if (res && res[0] && res[0].node) {
                this.canvas = res[0].node;
                this.ctx = this.canvas.getContext('2d');
                const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || (wx.getSystemInfoSync ? wx.getSystemInfoSync().pixelRatio : 1) || 1;
                this.canvasWidth = res[0].width;
                this.canvasHeight = res[0].height;
                this.canvas.width = res[0].width * dpr;
                this.canvas.height = res[0].height * dpr;
                this.ctx.scale(dpr, dpr);
                this.renderCanvas();
            }
        });
    },
    onTabChange(e) {
        const tab = e.detail.value;
        this.setData({ currentTab: tab }, () => {
            if (tab === 'template') {
                this.setData({ geometrySource: 'TEMPLATE' });
                this.updateFromTemplate();
            }
            else if (tab === 'draw') {
                this.setData({ geometrySource: 'DRAW' });
                if (this.data.drawPoints.length === 0) {
                    // 初始化默认三角形绘制点
                    const pts = [
                        { x: 100, y: 100 },
                        { x: 500, y: 100 },
                        { x: 300, y: 400 },
                    ];
                    this.setData({ drawPoints: pts, isClosed: true });
                    this.pushDrawHistory(pts);
                }
                this.syncGeometryInfo(this.data.drawPoints, 'POLYGON', '自由多边形');
            }
            else if (tab === 'photo') {
                this.setData({ geometrySource: 'PHOTO' });
            }
            else if (tab === 'svg') {
                this.setData({ geometrySource: 'SVG' });
            }
            this.renderCanvas();
        });
    },
    selectTemplateKind(e) {
        const kind = e.currentTarget.dataset.kind;
        const item = TEMPLATE_LIST.find((t) => t.kind === kind);
        this.setData({
            selectedKind: kind,
            shapeKindName: item ? item.name : kind,
        }, () => {
            this.updateFromTemplate();
        });
    },
    updateTplParam(e) {
        const key = e.currentTarget.dataset.key;
        const val = parseFloat(e.detail.value) || 0;
        const params = { ...this.data.tplParams, [key]: val };
        this.setData({ tplParams: params }, () => {
            this.updateFromTemplate();
        });
    },
    updateFromTemplate() {
        // 模板参数转为 0.1mm 整数
        const scaledParams = {};
        for (const [k, v] of Object.entries(this.data.tplParams)) {
            scaledParams[k] = Math.round(Number(v) * 10);
        }
        try {
            const geo = (0, index_1.generateTemplatePolygon)(this.data.selectedKind, scaledParams);
            this.currentGeo = geo;
            this.syncGeometryInfo(geo.points, geo.kind, this.data.shapeKindName);
            this.renderCanvas();
        }
        catch (e) {
            console.warn('generateTemplatePolygon error:', e);
        }
    },
    currentGeo: null,
    syncGeometryInfo(points, kind, kindName) {
        if (!points || points.length === 0)
            return;
        const bbox = (0, index_1.calculatePolygonBBox)(points);
        const area = (0, index_1.calculatePolygonArea)(points);
        const isSelfInt = (0, index_1.isPolygonSelfIntersecting)(points);
        this.setData({
            geoWidthMm: Math.round(bbox.width / 10),
            geoHeightMm: Math.round(bbox.height / 10),
            geoAreaMm2: Math.round(area / 100),
            vertexCount: points.length,
            selfIntersecting: isSelfInt,
            shapeKindName: kindName,
        });
    },
    // === 自由绘制操作 ===
    pushDrawHistory(pts) {
        const history = this.data.drawHistory.slice(0, this.data.drawHistoryIndex + 1);
        history.push([...pts]);
        this.setData({
            drawHistory: history,
            drawHistoryIndex: history.length - 1,
        });
    },
    drawUndo() {
        if (this.data.drawHistoryIndex > 0) {
            const newIdx = this.data.drawHistoryIndex - 1;
            const pts = [...this.data.drawHistory[newIdx]];
            this.setData({
                drawPoints: pts,
                drawHistoryIndex: newIdx,
            });
            this.syncGeometryInfo(pts, 'POLYGON', '自由多边形');
            this.renderCanvas();
        }
    },
    drawRedo() {
        if (this.data.drawHistoryIndex < this.data.drawHistory.length - 1) {
            const newIdx = this.data.drawHistoryIndex + 1;
            const pts = [...this.data.drawHistory[newIdx]];
            this.setData({
                drawPoints: pts,
                drawHistoryIndex: newIdx,
            });
            this.syncGeometryInfo(pts, 'POLYGON', '自由多边形');
            this.renderCanvas();
        }
    },
    toggleClosePolygon() {
        this.setData({ isClosed: !this.data.isClosed }, () => this.renderCanvas());
    },
    clearDraw() {
        this.setData({
            drawPoints: [],
            isClosed: false,
        }, () => {
            this.pushDrawHistory([]);
            this.renderCanvas();
        });
    },
    toggleSnap(e) {
        this.setData({ enableSnap: e.detail.value });
    },
    // Canvas 触控事件
    onTouchStart(e) {
        if (this.data.currentTab !== 'draw')
            return;
        const touch = e.touches[0];
        const { x, y } = touch;
        // 使用当前画布变换把触控像素还原为真实几何坐标。
        const scale = this.viewScale || 1;
        const pt = {
            x: Math.round((x - this.viewOffsetX) / scale),
            y: Math.round((y - this.viewOffsetY) / scale),
        };
        // 检查是否点中现有顶点进行拖拽
        const pts = this.data.drawPoints;
        let hitIdx = -1;
        for (let i = 0; i < pts.length; i++) {
            if (Math.hypot(pts[i].x - pt.x, pts[i].y - pt.y) < 14 / scale) {
                hitIdx = i;
                break;
            }
        }
        if (hitIdx >= 0) {
            this.setData({ dragIndex: hitIdx });
        }
        else if (!this.data.isClosed && pts.length < 64) {
            // 增加顶点
            let finalPt = pt;
            if (this.data.enableSnap && pts.length > 0) {
                const last = pts[pts.length - 1];
                const snapped = (0, index_1.snapAngle)(pt.x - last.x, pt.y - last.y);
                finalPt = { x: last.x + snapped.dx, y: last.y + snapped.dy };
            }
            const newPts = [...pts, finalPt];
            this.setData({ drawPoints: newPts });
            this.pushDrawHistory(newPts);
            this.syncGeometryInfo(newPts, 'POLYGON', '自由绘制');
            this.renderCanvas();
        }
    },
    onTouchMove(e) {
        if (this.data.currentTab !== 'draw' || this.data.dragIndex < 0)
            return;
        const touch = e.touches[0];
        const scale = this.viewScale || 1;
        const newPt = {
            x: Math.round((touch.x - this.viewOffsetX) / scale),
            y: Math.round((touch.y - this.viewOffsetY) / scale),
        };
        const pts = [...this.data.drawPoints];
        pts[this.data.dragIndex] = newPt;
        this.setData({ drawPoints: pts });
        this.syncGeometryInfo(pts, 'POLYGON', '自由绘制');
        this.renderCanvas();
    },
    onTouchEnd() {
        if (this.data.dragIndex >= 0) {
            this.pushDrawHistory(this.data.drawPoints);
            this.setData({ dragIndex: -1 });
        }
    },
    // === 拍照与 SVG ===
    choosePhoto() {
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: async (res) => {
                const tempPath = res.tempFiles[0].tempFilePath;
                this.setData({ photoPath: tempPath });
                await this.extractPhotoContour(tempPath);
            },
            fail: (err) => {
                if (!String(err.errMsg || '').includes('cancel')) {
                    (0, index_2.default)({ context: this, selector: '#t-toast', message: '无法读取图片，请重试', theme: 'error' });
                }
            },
        });
    },
    async extractPhotoContour(tempPath) {
        if (!this.canvas || !this.ctx) {
            (0, index_2.default)({ context: this, selector: '#t-toast', message: '画布尚未准备好，请稍后重试', theme: 'warning' });
            return;
        }
        (0, index_2.default)({ context: this, selector: '#t-toast', message: '正在从真实图片提取轮廓…', theme: 'loading' });
        try {
            const imageInfo = await new Promise((resolve, reject) => {
                wx.getImageInfo({ src: tempPath, success: resolve, fail: reject });
            });
            const maxW = Math.max(80, Math.floor(this.canvasWidth));
            const maxH = Math.max(80, Math.floor(this.canvasHeight));
            const ratio = Math.min(maxW / imageInfo.width, maxH / imageInfo.height);
            const drawW = Math.max(1, Math.floor(imageInfo.width * ratio));
            const drawH = Math.max(1, Math.floor(imageInfo.height * ratio));
            const image = this.canvas.createImage();
            await new Promise((resolve, reject) => {
                image.onload = () => resolve();
                image.onerror = reject;
                image.src = tempPath;
            });
            this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
            this.ctx.drawImage(image, 0, 0, drawW, drawH);
            const imageData = this.ctx.getImageData(0, 0, drawW, drawH);
            const gray = new Uint8Array(drawW * drawH);
            let borderSum = 0;
            let borderCount = 0;
            for (let y = 0; y < drawH; y++) {
                for (let x = 0; x < drawW; x++) {
                    const p = y * drawW + x;
                    const i = p * 4;
                    const value = Math.round(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2]);
                    gray[p] = value;
                    if (x === 0 || y === 0 || x === drawW - 1 || y === drawH - 1) {
                        borderSum += value;
                        borderCount++;
                    }
                }
            }
            const backgroundIsLight = borderSum / Math.max(1, borderCount) >= 128;
            const threshold = Number(this.data.photoThreshold);
            const grid = new Uint8Array(drawW * drawH);
            let foregroundCount = 0;
            for (let i = 0; i < gray.length; i++) {
                const foreground = backgroundIsLight ? gray[i] < threshold : gray[i] > threshold;
                grid[i] = foreground ? 1 : 0;
                if (foreground)
                    foregroundCount++;
            }
            if (foregroundCount < 12 || foregroundCount > grid.length * 0.92) {
                throw new Error('主体与背景对比不足，请换纯色背景或调整阈值');
            }
            const raw = (0, index_1.extractContourFromBinaryImage)(grid, drawW, drawH, { scaleMmPerPixel: 1, maxVertices: 64 });
            if (!raw.points || raw.points.length < 3 || raw.width <= 0) {
                throw new Error('没有找到可闭合的主体轮廓');
            }
            const widthMm = Math.max(1, Number(this.data.photoKnownWidthMm) || 100);
            const physicalScale = (widthMm * 10) / raw.width;
            const scaled = raw.points.map((p) => ({
                x: Math.round(p.x * physicalScale),
                y: Math.round(p.y * physicalScale),
            }));
            const simplified = (0, index_1.douglasPeucker)(scaled, Math.max(1, Number(this.data.dpTolerance)) * 10, 64);
            if (simplified.length < 3)
                throw new Error('轮廓顶点过少，请降低精简容差');
            this.setData({
                drawPoints: simplified,
                currentTab: 'draw',
                geometrySource: 'PHOTO',
                isClosed: true,
            });
            this.pushDrawHistory(simplified);
            this.syncGeometryInfo(simplified, 'POLYGON', '图片辅助轮廓');
            this.renderCanvas();
            (0, index_2.default)({ context: this, selector: '#t-toast', message: '已提取真实轮廓，请拖动节点校正', theme: 'success' });
        }
        catch (err) {
            console.warn('extractPhotoContour error:', err);
            (0, index_2.default)({ context: this, selector: '#t-toast', message: err.message || '轮廓提取失败，请改用手动描边', theme: 'error' });
        }
    },
    onPhotoWidthChange(e) {
        const value = Math.max(1, Math.min(2000, Number(e.detail.value) || 100));
        this.setData({ photoKnownWidthMm: value });
    },
    onThresholdChange(e) {
        this.setData({ photoThreshold: e.detail.value });
    },
    onToleranceChange(e) {
        this.setData({ dpTolerance: e.detail.value });
    },
    onSvgInput(e) {
        this.setData({ svgCode: e.detail.value });
    },
    parseSvg() {
        const svg = this.data.svgCode.trim();
        if (!svg) {
            (0, index_2.default)({ context: this, selector: '#t-toast', message: '请输入 SVG 代码', theme: 'warning' });
            return;
        }
        try {
            const geo = (0, index_1.parseSVGToShapeGeometry)(svg, { targetWidthMm: 100, targetHeightMm: 100 });
            this.setData({
                drawPoints: geo.points,
                currentTab: 'draw',
                geometrySource: 'SVG',
                isClosed: true,
            });
            this.syncGeometryInfo(geo.points, 'POLYGON', 'SVG 解析');
            this.renderCanvas();
            (0, index_2.default)({ context: this, selector: '#t-toast', message: 'SVG 解析完成！', theme: 'success' });
        }
        catch (err) {
            (0, index_2.default)({ context: this, selector: '#t-toast', message: 'SVG 解析失败: ' + err.message, theme: 'error' });
        }
    },
    // 工艺设置
    onNameChange(e) {
        this.setData({ partName: e.detail.value });
    },
    onQuantityChange(e) {
        this.setData({ partQuantity: Number(e.detail.value) });
    },
    setRotPolicy(e) {
        const policy = e.currentTarget.dataset.policy;
        this.setData({ rotationPolicy: policy });
    },
    // 渲染画板
    renderCanvas() {
        if (!this.ctx)
            return;
        const ctx = this.ctx;
        const w = this.canvasWidth;
        const h = this.canvasHeight;
        ctx.clearRect(0, 0, w, h);
        // 1. 绘制网格背景
        ctx.strokeStyle = '#F0F2ED';
        ctx.lineWidth = 1;
        const gridStep = 20;
        for (let x = 0; x < w; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        // 2. 获取当前要绘制的点集
        let points = [];
        if (this.data.currentTab === 'template' && this.currentGeo) {
            points = this.currentGeo.points;
        }
        else {
            points = this.data.drawPoints;
        }
        if (points.length < 2)
            return;
        // 3. 计算缩放并居中绘制
        const bbox = (0, index_1.calculatePolygonBBox)(points);
        const padding = 30;
        const availW = w - padding * 2;
        const availH = h - padding * 2;
        const scale = Math.min(availW / (bbox.width || 1), availH / (bbox.height || 1), 0.5);
        const offsetX = (w - bbox.width * scale) / 2 - bbox.x * scale;
        const offsetY = (h - bbox.height * scale) / 2 - bbox.y * scale;
        this.viewScale = scale;
        this.viewOffsetX = offsetX;
        this.viewOffsetY = offsetY;
        ctx.beginPath();
        const p0x = points[0].x * scale + offsetX;
        const p0y = points[0].y * scale + offsetY;
        ctx.moveTo(p0x, p0y);
        for (let i = 1; i < points.length; i++) {
            const px = points[i].x * scale + offsetX;
            const py = points[i].y * scale + offsetY;
            ctx.lineTo(px, py);
        }
        if (this.data.isClosed || this.data.currentTab === 'template') {
            ctx.closePath();
            ctx.fillStyle = 'rgba(24, 92, 55, 0.18)'; // 主色半透明填充
            ctx.fill();
        }
        ctx.strokeStyle = this.data.selfIntersecting ? '#F06A2A' : '#185C37';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // 4. 绘制顶点与可交互把手
        for (let i = 0; i < points.length; i++) {
            const px = points[i].x * scale + offsetX;
            const py = points[i].y * scale + offsetY;
            ctx.beginPath();
            ctx.arc(px, py, i === 0 ? 5.5 : 4, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? '#F06A2A' : '#185C37'; // 起点高亮为强调色
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    },
    // 确认并存入零件清单
    confirmShape() {
        let points = [];
        let kind = this.data.selectedKind;
        if (this.data.currentTab === 'template') {
            if (!this.currentGeo) {
                (0, index_2.default)({ context: this, selector: '#t-toast', message: '请选择或配置模板', theme: 'warning' });
                return;
            }
            points = this.currentGeo.points;
            kind = this.currentGeo.kind;
        }
        else if (this.data.currentTab === 'photo') {
            if (!this.data.photoPath || this.data.geometrySource !== 'PHOTO' || this.data.drawPoints.length < 3) {
                (0, index_2.default)({ context: this, selector: '#t-toast', message: '请先选择实物图片并成功提取轮廓', theme: 'warning' });
                return;
            }
            points = this.data.drawPoints;
            kind = 'POLYGON';
        }
        else if (this.data.currentTab === 'svg') {
            if (!this.data.svgCode.trim() || this.data.geometrySource !== 'SVG' || this.data.drawPoints.length < 3) {
                (0, index_2.default)({ context: this, selector: '#t-toast', message: '请先输入并解析 SVG 完成后再保存', theme: 'warning' });
                return;
            }
            points = this.data.drawPoints;
            kind = 'POLYGON';
        }
        else {
            points = this.data.drawPoints;
            kind = 'POLYGON';
            if (points.length < 3) {
                (0, index_2.default)({ context: this, selector: '#t-toast', message: '多边形至少需要 3 个顶点', theme: 'warning' });
                return;
            }
        }
        const bbox = (0, index_1.calculatePolygonBBox)(points);
        const area = (0, index_1.calculatePolygonArea)(points);
        if ((0, index_1.isPolygonSelfIntersecting)(points)) {
            (0, index_2.default)({ context: this, selector: '#t-toast', message: '多边形轮廓存在自相交，请调整节点避免交叉', theme: 'warning' });
            return;
        }
        if (area <= 0) {
            (0, index_2.default)({ context: this, selector: '#t-toast', message: '多边形面积无效，请重新绘制或调整节点', theme: 'warning' });
            return;
        }
        const geometry = {
            kind,
            source: this.data.geometrySource,
            points,
            width: bbox.width,
            height: bbox.height,
            area,
            closed: true,
            templateParams: this.data.currentTab === 'template' ? this.data.tplParams : undefined,
            sourceImagePath: this.data.geometrySource === 'PHOTO' ? this.data.photoPath : undefined,
            scaleReferenceMm: this.data.geometrySource === 'PHOTO' ? this.data.photoKnownWidthMm : undefined,
        };
        const newPartGroup = {
            id: `p_geo_${Date.now()}`,
            name: this.data.partName.trim() || '异形零件',
            targetWidth: bbox.width,
            targetHeight: bbox.height,
            quantity: this.data.partQuantity,
            allowRotation: this.data.rotationPolicy !== 'LOCKED',
            rotationPolicy: this.data.rotationPolicy,
            geometry,
            shape: kind,
        };
        const app = getApp();
        if (!app.globalData)
            app.globalData = {};
        if (!app.globalData.customPartGroups)
            app.globalData.customPartGroups = [];
        app.globalData.customPartGroups.push(newPartGroup);
        (0, index_2.default)({ context: this, selector: '#t-toast', message: '异形零件已保存！', theme: 'success' });
        setTimeout(() => {
            wx.navigateBack();
        }, 600);
    },
});
