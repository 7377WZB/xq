// ==========================================
// trend-modal.js - v7.1 (Single Page Adapter)
// ==========================================
// 依賴: LightweightCharts (CDN 需在 index.html 引入)

window.TrendModal = {
    chart: null,
    series: {}, 
    modalId: 'trend-modal-overlay',
    toolTipId: 'tm-chart-tooltip',
    markerLayerId: 'tm-marker-layer',
    currentId: null,

    // 初始化 Modal 結構 (如果不存在)
    init: function() {
        if (document.getElementById(this.modalId)) return;

        const html = `
        <div id="${this.modalId}" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; backdrop-filter:blur(2px);">
            <div style="position:relative; width:90%; max-width:1000px; height:80vh; margin:5vh auto; background:#1e222d; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.5); display:flex; flex-direction:column; overflow:hidden;">
                <div style="padding:15px; display:flex; justify-content:space-between; align-items:center; background:#2a2e39; color:#eee; border-bottom:1px solid #363c4e;">
                    <div>
                        <span id="tm-title-id" style="font-size:1.5em; font-weight:bold; color:#fbbf24;"></span>
                        <span id="tm-title-name" style="margin-left:10px; color:#aaa;"></span>
                    </div>
                    <button onclick="document.getElementById('${this.modalId}').style.display='none'" style="background:none; border:none; color:#aaa; font-size:24px; cursor:pointer;">&times;</button>
                </div>
                <div id="tm-chart-container" style="position:relative; flex:1; width:100%;">
                    <div id="${this.toolTipId}" style="position:absolute; display:none; padding:8px; box-sizing:border-box; font-size:12px; text-align:left; z-index:1000; top:12px; left:12px; pointer-events:none; border:1px solid; border-radius:2px; font-family:-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; background:rgba(30, 34, 45, 0.9); color:white; border-color:rgba(30, 34, 45, 1);"></div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        
        // 點擊背景關閉
        document.getElementById(this.modalId).onclick = (e) => {
            if (e.target.id === this.modalId) {
                e.target.style.display = 'none';
            }
        };
    },

    // 開啟圖表 (Entry Point)
    open: function(id, name) {
        this.init();
        this.currentId = id;
        
        // 顯示 Modal
        const modal = document.getElementById(this.modalId);
        modal.style.display = 'block';
        
        // 更新標題
        document.getElementById('tm-title-id').textContent = id;
        document.getElementById('tm-title-name').textContent = name;

        // 準備資料
        // ★ 修正：直接從 window 讀取，而非 window.parent
        const rawData = window.fullStockData[id];
        const dates = window.csvDates;

        if (!rawData || !dates) {
            alert("無此個股資料");
            modal.style.display = 'none';
            return;
        }

        this.renderChart(rawData, dates);
    },

    // 繪製 Lightweight Chart
    renderChart: function(data, dates) {
        const container = document.getElementById('tm-chart-container');
        // 清除舊圖表 (如果是 Lightweight Charts 實例)
        if (this.chart) {
            this.chart.remove();
            container.innerHTML = `<div id="${this.toolTipId}" ...></div>`; // 重置 Tooltip 結構
        }

        // 檢查庫是否存在
        if (typeof LightweightCharts === 'undefined') {
            container.innerHTML = '<div style="color:white; padding:20px;">錯誤：找不到 LightweightCharts 函式庫。請在 index.html 加入 CDN。</div>';
            return;
        }

        // 建立圖表
        this.chart = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: { backgroundColor: '#1e222d', textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
            rightPriceScale: { borderColor: '#485c7b' },
            timeScale: { borderColor: '#485c7b', rightOffset: 5 },
        });

        // 處理 K 線資料 (Mapping)
        // 注意：data.close 是 [最新, 昨天, 前天...] (反向)
        // Lightweight Charts 需要 { time, open, high, low, close } 且按時間升冪排列
        const candleData = [];
        const volData = [];
        
        // 資料長度取決於 close 陣列
        const len = data.close.length;
        
        for (let i = len - 1; i >= 0; i--) {
            // 日期轉換: 20260212 -> 2026-02-12
            const dStr = dates[i];
            if (!dStr) continue;
            const fmtDate = `${dStr.substring(0,4)}-${dStr.substring(4,6)}-${dStr.substring(6,8)}`;
            
            candleData.push({
                time: fmtDate,
                open: data.open[i],
                high: data.high[i],
                low: data.low[i],
                close: data.close[i]
            });

            // 顏色邏輯：收盤 >= 開盤 ? 紅 : 綠 (配合台股習慣：紅漲綠跌)
            const isUp = data.close[i] >= data.open[i];
            volData.push({
                time: fmtDate,
                value: data.vol[i],
                color: isUp ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'
            });
        }

        // K 線圖層
        const candleSeries = this.chart.addCandlestickSeries({
            upColor: '#ef4444', 
            downColor: '#22c55e', 
            borderUpColor: '#ef4444', 
            borderDownColor: '#22c55e', 
            wickUpColor: '#ef4444', 
            wickDownColor: '#22c55e',
        });
        candleSeries.setData(candleData);

        // 成交量圖層
        const volumeSeries = this.chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: '', // 疊加在主圖下層
            scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeries.setData(volData);

        // 自動縮放
        this.chart.timeScale().fitContent();

        // 處理視窗大小改變
        new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== container) return;
            const newRect = entries[0].contentRect;
            this.chart.applyOptions({ width: newRect.width, height: newRect.height });
        }).observe(container);
    }
};