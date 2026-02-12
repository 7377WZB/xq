// ==========================================
// trend-modal.js - v8.0 (SMA + Markers + SubChart)
// ==========================================
// 依賴: LightweightCharts v3.8.0

window.TrendModal = {
    modalId: 'trend-modal-overlay',
    mainChart: null,
    subChart: null, // 副圖 (PR/VR)
    
    init: function() {
        if (document.getElementById(this.modalId)) return;

        // 建立 Modal 結構：分為 Main Chart 與 Sub Chart 兩個容器
        const html = `
        <div id="${this.modalId}" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; backdrop-filter:blur(4px);">
            <div style="position:relative; width:95%; max-width:1100px; height:85vh; margin:5vh auto; background:#1e222d; border-radius:8px; display:flex; flex-direction:column; overflow:hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                
                <div style="padding:12px 20px; background:#2a2e39; border-bottom:1px solid #363c4e; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span id="tm-title-id" style="font-size:1.4em; font-weight:bold; color:#fbbf24;"></span>
                        <span id="tm-title-name" style="margin-left:10px; color:#ddd; font-size:1.1em;"></span>
                    </div>
                    <button onclick="document.getElementById('${this.modalId}').style.display='none'" 
                            style="background:none; border:none; color:#9ca3af; font-size:28px; cursor:pointer; line-height:1;">&times;</button>
                </div>

                <div style="flex:1; display:flex; flex-direction:column; position:relative;">
                    
                    <div id="tm-main-chart" style="flex:7; width:100%; position:relative; border-bottom:1px solid #363c4e;"></div>
                    
                    <div id="tm-sub-chart" style="flex:3; width:100%; position:relative;"></div>

                    <div id="tm-tooltip" style="position:absolute; top:10px; left:10px; z-index:20; background:rgba(30,34,45,0.9); border:1px solid #444; padding:8px; border-radius:4px; color:#fff; font-size:12px; pointer-events:none; display:none;"></div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        
        document.getElementById(this.modalId).onclick = (e) => {
            if (e.target.id === this.modalId) e.target.style.display = 'none';
        };
    },

    open: function(id, name) {
        this.init();
        document.getElementById(this.modalId).style.display = 'block';
        document.getElementById('tm-title-id').textContent = id;
        document.getElementById('tm-title-name').textContent = name;

        const rawData = window.fullStockData[id];
        const dates = window.csvDates;
        if (!rawData || !dates) return alert("無資料");

        this.renderCharts(rawData, dates);
    },

    renderCharts: function(data, dates) {
        if (typeof LightweightCharts === 'undefined') return alert("缺少 LightweightCharts 函式庫");

        const mainContainer = document.getElementById('tm-main-chart');
        const subContainer = document.getElementById('tm-sub-chart');
        
        // 1. 清理舊圖表
        if (this.mainChart) { this.mainChart.remove(); this.mainChart = null; }
        if (this.subChart) { this.subChart.remove(); this.subChart = null; }
        mainContainer.innerHTML = ''; 
        subContainer.innerHTML = '';

        // 2. 準備資料 (反轉時間軸：新->舊 轉為 舊->新)
        const len = data.close.length;
        const kData = [];
        const ma20 = [], ma50 = [], ma150 = [], ma200 = [];
        const prData = [], vrData = [];
        const markers = []; // VolHigh Markers

        for (let i = len - 1; i >= 0; i--) {
            const dStr = dates[i];
            if (!dStr) continue;
            // 格式化日期 20260212 -> 2026-02-12
            const time = `${dStr.substring(0,4)}-${dStr.substring(4,6)}-${dStr.substring(6,8)}`;
            
            // K線
            kData.push({ time, open: data.open[i], high: data.high[i], low: data.low[i], close: data.close[i] });

            // 均線 (如果該日有值)
            if (data.sma20 && data.sma20[i]) ma20.push({ time, value: data.sma20[i] });
            if (data.sma50 && data.sma50[i]) ma50.push({ time, value: data.sma50[i] });
            if (data.sma150 && data.sma150[i]) ma150.push({ time, value: data.sma150[i] });
            if (data.sma200 && data.sma200[i]) ma200.push({ time, value: data.sma200[i] });

            // 副圖 (PR/VR)
            const prVal = (data.p_rank && data.p_rank[i]) ? data.p_rank[i] : 0;
            const vrVal = (data.v_rank && data.v_rank[i]) ? data.v_rank[i] : 0;
            prData.push({ time, value: prVal });
            vrData.push({ time, value: vrVal });

            // Markers (VolHigh)
            // 假設 volhigh[i] 為 "600" 或 "200" 非 "0" 表示有訊號
            if (data.volhigh && data.volhigh[i] && data.volhigh[i] !== "0") {
                markers.push({
                    time,
                    position: 'aboveBar',
                    color: '#fbbf24', // 黃色
                    shape: 'arrowDown',
                    text: 'H'
                });
            }
        }

        // 3. 建立 Main Chart
        this.mainChart = LightweightCharts.createChart(mainContainer, {
            width: mainContainer.clientWidth,
            height: mainContainer.clientHeight,
            layout: { backgroundColor: '#1e222d', textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
            rightPriceScale: { borderColor: '#485c7b' },
            timeScale: { borderColor: '#485c7b', timeVisible: true },
        });

        // K線 Series
        const candleSeries = this.mainChart.addCandlestickSeries({
            upColor: '#ef4444', downColor: '#22c55e', 
            borderUpColor: '#ef4444', borderDownColor: '#22c55e', 
            wickUpColor: '#ef4444', wickDownColor: '#22c55e'
        });
        candleSeries.setData(kData);
        candleSeries.setMarkers(markers); // 設定創高標記

        // 均線 Series
        const line20 = this.mainChart.addLineSeries({ color: '#fbbf24', lineWidth: 1, title: 'MA20' }); // 黃
        const line50 = this.mainChart.addLineSeries({ color: '#60a5fa', lineWidth: 1, title: 'MA50' }); // 藍
        const line150 = this.mainChart.addLineSeries({ color: '#a78bfa', lineWidth: 1, title: 'MA150' }); // 紫
        const line200 = this.mainChart.addLineSeries({ color: '#34d399', lineWidth: 2, title: 'MA200' }); // 綠
        
        line20.setData(ma20);
        line50.setData(ma50);
        line150.setData(ma150);
        line200.setData(ma200);

        // 4. 建立 Sub Chart (PR/VR)
        this.subChart = LightweightCharts.createChart(subContainer, {
            width: subContainer.clientWidth,
            height: subContainer.clientHeight,
            layout: { backgroundColor: '#1e222d', textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
            rightPriceScale: { 
                scaleMargins: { top: 0.1, bottom: 0.1 },
                borderColor: '#485c7b' 
            },
            timeScale: { visible: false }, // 隱藏時間軸 (共用上方的)
        });

        const prSeries = this.subChart.addLineSeries({ color: '#ef4444', lineWidth: 2, title: '價PR' });
        const vrSeries = this.subChart.addLineSeries({ color: '#3b82f6', lineWidth: 2, title: '量PR' });
        
        prSeries.setData(prData);
        vrSeries.setData(vrData);

        // 5. 同步兩個圖表 (Sync)
        // 當主圖捲動時，副圖跟著動
        this.mainChart.timeScale().subscribeVisibleTimeRangeChange(range => {
            this.subChart.timeScale().setVisibleRange(range);
        });
        // 副圖捲動時，主圖跟著動
        this.subChart.timeScale().subscribeVisibleTimeRangeChange(range => {
            this.mainChart.timeScale().setVisibleRange(range);
        });

        // 初始縮放
        this.mainChart.timeScale().fitContent();

        // RWD
        new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === mainContainer) this.mainChart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
                if (entry.target === subContainer) this.subChart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        }).observe(mainContainer.parentElement);
    }
};