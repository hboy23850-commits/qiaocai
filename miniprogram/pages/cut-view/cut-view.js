"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const index_1 = __importDefault(require("tdesign-miniprogram/toast/index"));
Page({
    data: {
        currentStep: 0,
        maxStep: 0,
        steps: [],
        stockW: 0,
        stockH: 0,
        currentStockIndex: 0,
        totalStocks: 0,
        usedStocks: [],
        layoutMode: 'GUILLOTINE_RECT',
        recommendedTool: '钢直尺 + 重型美工刀',
        currentStepDesc: '',
    },
    onLoad() {
        const app = getApp();
        if (app.globalData.selectedCandidate) {
            const candidate = app.globalData.selectedCandidate;
            const usedStocks = candidate.usedStocks || [];
            const totalStocks = usedStocks.length;
            const mode = candidate.layoutMode || 'GUILLOTINE_RECT';
            this.setData({
                totalStocks,
                usedStocks,
                layoutMode: mode,
            });
            this.loadStockSteps(0, usedStocks, candidate);
        }
        setTimeout(() => this.drawStep(), 500);
    },
    loadStockSteps(idx, usedStocks, candidate) {
        const app = getApp();
        const cand = candidate || app.globalData.selectedCandidate;
        const stocks = usedStocks || (cand?.usedStocks || []);
        const stock = stocks[idx];
        if (!stock)
            return;
        if (cand?.layoutMode === 'PROFILE') {
            const cutPaths = (cand.cutPaths || []).filter((cp) => !cp.stockId || cp.stockId === stock.stockId);
            const tool = cutPaths[0]?.toolRecommendation || '钢直尺 + 重型美工刀（适合直线多边形）';
            this.setData({
                currentStockIndex: idx,
                steps: cutPaths,
                maxStep: cutPaths.length,
                currentStep: 0,
                stockW: stock.width,
                stockH: stock.height,
                recommendedTool: tool,
                currentStepDesc: cutPaths[0]?.description || '点击“下一刀”查看第一步裁切',
            }, () => this.drawStep());
            return;
        }
        // 传统矩形切树
        const nodes = [];
        const traverse = (node) => {
            if (!node)
                return;
            if (node.type === 'PART' || node.type === 'OFFCUT' || node.type === 'KERF') {
                nodes.push(node);
            }
            if (node.children && Array.isArray(node.children)) {
                if (node.children[0])
                    traverse(node.children[0]);
                if (node.children[1])
                    traverse(node.children[1]);
            }
        };
        traverse(stock.cutTree);
        this.setData({
            currentStockIndex: idx,
            steps: nodes,
            maxStep: nodes.length,
            currentStep: 0,
            stockW: stock.width,
            stockH: stock.height,
            recommendedTool: '钢直尺 + 重型美工刀',
            currentStepDesc: '直线分切步骤，请按高亮线逐步下刀',
        }, () => this.drawStep());
    },
    switchStock(e) {
        const idx = Number(e.currentTarget.dataset.idx);
        this.loadStockSteps(idx);
    },
    onShareAppMessage() {
        return { title: '巧裁——查看手工排料与裁切指导！', path: '/pages/index/index' };
    },
    prevStep() {
        if (this.data.currentStep > 0) {
            const newStep = this.data.currentStep - 1;
            const desc = newStep > 0 && this.data.steps[newStep - 1]
                ? this.data.steps[newStep - 1].description
                : '已回退到初始状态';
            this.setData({ currentStep: newStep, currentStepDesc: desc }, () => this.drawStep());
        }
    },
    nextStep() {
        if (this.data.currentStep < this.data.maxStep) {
            const newStep = this.data.currentStep + 1;
            const desc = this.data.steps[newStep - 1]?.description || '';
            this.setData({ currentStep: newStep, currentStepDesc: desc }, () => this.drawStep());
        }
    },
    autoPlay() {
        if (this.data.currentStep >= this.data.maxStep) {
            this.setData({ currentStep: 0 });
        }
        const timer = setInterval(() => {
            if (this.data.currentStep < this.data.maxStep) {
                this.nextStep();
            }
            else {
                clearInterval(timer);
            }
        }, 900);
    },
    saveImage() {
        const query = wx.createSelectorQuery().in
            ? wx.createSelectorQuery().in(this)
            : wx.createSelectorQuery();
        query
            .select('#cutCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
            if (!res || !res[0] || !res[0].node) {
                (0, index_1.default)({
                    context: this,
                    selector: '#t-toast',
                    message: '未找到画布',
                    theme: 'error',
                });
                return;
            }
            const canvas = res[0].node;
            wx.canvasToTempFilePath({
                canvas,
                fileType: 'png',
                quality: 1,
                success: (tempRes) => {
                    if (tempRes.tempFilePath) {
                        wx.saveImageToPhotosAlbum({
                            filePath: tempRes.tempFilePath,
                            success: () => {
                                (0, index_1.default)({
                                    context: this,
                                    selector: '#t-toast',
                                    message: '1:1 图纸已保存至相册',
                                    theme: 'success',
                                });
                            },
                            fail: () => {
                                wx.previewImage({ urls: [tempRes.tempFilePath] });
                            },
                        });
                    }
                },
                fail: () => {
                    (0, index_1.default)({
                        context: this,
                        selector: '#t-toast',
                        message: '导出图片失败',
                        theme: 'error',
                    });
                },
            });
        });
    },
    drawStep() {
        if (!this.data.stockW || !this.data.stockH)
            return;
        const query = wx.createSelectorQuery();
        query
            .select('#cutCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
            if (!res[0])
                return;
            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');
            const width = res[0].width;
            const height = res[0].height;
            const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || (wx.getSystemInfoSync ? wx.getSystemInfoSync().pixelRatio : 2) || 2;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
            const scaleX = (width - 40) / this.data.stockW;
            const scaleY = (height - 60) / this.data.stockH;
            const scale = Math.min(scaleX, scaleY);
            const offsetX = (width - this.data.stockW * scale) / 2;
            const offsetY = (height - 40 - this.data.stockH * scale) / 2;
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#FAFAFA';
            ctx.fillRect(0, 0, width, height);
            ctx.save();
            ctx.translate(offsetX, offsetY);
            ctx.scale(scale, scale);
            // 1. 板材底色
            ctx.fillStyle = '#EBECE6';
            ctx.fillRect(0, 0, this.data.stockW, this.data.stockH);
            // 板材外边框
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 4 / scale;
            ctx.strokeRect(0, 0, this.data.stockW, this.data.stockH);
            const app = getApp();
            const cand = app.globalData?.selectedCandidate;
            if (cand && cand.layoutMode === 'PROFILE') {
                // PROFILE 异形排料渲染
                const placements = cand.profilePlacements || [];
                const curStockId = this.data.usedStocks[this.data.currentStockIndex]?.stockId;
                const stockPlacements = placements.filter((p) => !curStockId || p.stockId === curStockId);
                // 绘制所有放置零件的真实轮廓底色
                for (let i = 0; i < stockPlacements.length; i++) {
                    const p = stockPlacements[i];
                    const pts = p.transformedPoints;
                    if (!pts || pts.length < 3)
                        continue;
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (let j = 1; j < pts.length; j++) {
                        ctx.lineTo(pts[j].x, pts[j].y);
                    }
                    ctx.closePath();
                    ctx.fillStyle = 'rgba(24, 92, 55, 0.25)'; // 主色半透明
                    ctx.fill();
                    ctx.strokeStyle = '#185C37';
                    ctx.lineWidth = 3 / scale;
                    ctx.stroke();
                    // 标注零件名称与编号
                    ctx.fillStyle = '#185C37';
                    ctx.font = `${Math.round(14 / scale)}px sans-serif`;
                    ctx.fillText(p.name || `P${i + 1}`, p.bbox.x + 8 / scale, p.bbox.y + 18 / scale);
                }
                // 绘制分步刀路 (高亮当前步骤)
                for (let i = 0; i < this.data.currentStep; i++) {
                    const step = this.data.steps[i];
                    if (!step || !step.points || step.points.length < 2)
                        continue;
                    const isCurrent = i === this.data.currentStep - 1;
                    ctx.beginPath();
                    ctx.moveTo(step.points[0].x, step.points[0].y);
                    for (let j = 1; j < step.points.length; j++) {
                        ctx.lineTo(step.points[j].x, step.points[j].y);
                    }
                    if (step.pathType !== 'STRAIGHT') {
                        ctx.closePath();
                    }
                    ctx.strokeStyle = isCurrent ? '#F06A2A' : '#185C37'; // 当前刀为强调色
                    ctx.lineWidth = (isCurrent ? 6 : 3) / scale;
                    ctx.stroke();
                }
            }
            else {
                // GUILLOTINE 矩形切树渲染
                for (let i = 0; i < this.data.currentStep; i++) {
                    const step = this.data.steps[i];
                    if (!step || !step.rect)
                        continue;
                    ctx.beginPath();
                    if (step.type === 'PART') {
                        ctx.fillStyle = '#185C37';
                    }
                    else if (step.type === 'KERF') {
                        ctx.fillStyle = '#F06A2A';
                    }
                    else {
                        ctx.fillStyle = '#CCCCCC';
                    }
                    ctx.fillRect(step.rect.x, step.rect.y, step.rect.width, step.rect.height);
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 3 / scale;
                    ctx.strokeRect(step.rect.x, step.rect.y, step.rect.width, step.rect.height);
                }
            }
            ctx.restore();
            // 2. 绘制 100mm 打印实测校准线 (在底部水平居中)
            const rulerMm = 100;
            const rulerScaled = rulerMm * 10 * scale; // 100mm = 1000 (0.1mm)
            const rulerX = (width - rulerScaled) / 2;
            const rulerY = height - 16;
            ctx.beginPath();
            ctx.moveTo(rulerX, rulerY);
            ctx.lineTo(rulerX + rulerScaled, rulerY);
            // 两端刻度
            ctx.moveTo(rulerX, rulerY - 6);
            ctx.lineTo(rulerX, rulerY + 6);
            ctx.moveTo(rulerX + rulerScaled, rulerY - 6);
            ctx.lineTo(rulerX + rulerScaled, rulerY + 6);
            ctx.strokeStyle = '#185C37';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#185C37';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('100mm 打印实测校准线', width / 2, rulerY - 8);
        });
    },
    navToFinish() {
        wx.navigateTo({ url: '/pages/finish/finish' });
    },
});
