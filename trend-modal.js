// ==========================================
// trend-modal.js - v7.0 (Final Solution: DOM Overlay Markers)
// ==========================================
// 依賴: window.fullStockData, window.csvDates
// 依賴: LightweightCharts (v4.x)

window.TrendModal = {
    chart: null,
    series: {}, 
    modalId: 'trend-modal-overlay',
    toolTipId: 'tm-chart-tooltip',
    markerLayerId: 'tm-marker-layer', // ★ 新增：標記覆蓋層 ID
    currentDataMap: {}, 
    currentId: null,
    activeMarkers: [], // 儲存目前的標記資料

    init: function() {
        if (document.getElementById(this.modalId)) return;

        // ★ CSS 樣式：確保覆蓋層 (Marker Layer) 能夠穿透點擊
        const html = `
        <style>
            .tm-marker-item {
                position: absolute;
                transform: translateX(-50%);
                font-size: 14px; 
                font-weight: bold;
                pointer-events: none; /* 讓滑鼠可以穿透標記點到圖表 */
                z-index: 20;
                transition: left 0.1s linear; /* 讓移動滑順一點 */
            }
        </style>
        <div id="${this.modalId}" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
            <div style="background:#fff; width:99%; max-width:1500px; height:85vh; border-radius:8px; padding:15px; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.3);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                    <div style="font-size:1.2em; font-weight:bold; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <span id="tm-title-id" onclick="window.TrendModal.copyCode()" title="點擊複製代碼 (.TW)" style="color:#1877F2; margin-right:5px; cursor:pointer; transition:all 0.2s;"></span>
                        <span id="tm-title-name" style="margin-right:15px;"></span>
                        <span style="font-size:0.9em; font-weight:normal; color:#666; display:flex; gap:15px; align-items:center;">
                            <span style="display:flex; align-items:center;"><span style="width:12px; height:12px; background:#C71585; display:inline-block; margin-right:6px;"></span>價排名</span>
                            <span style="display:flex; align-items:center;"><span style="width:12px; height:12px; background:#2962FF; border:2px dotted #2962FF; box-sizing:border-box; display:inline-block; margin-right:6px;"></span>量排名</span>
                        </span>
                    </div>
                    <span onclick="window.TrendModal.close()" style="cursor:pointer; font-size:1.5em; color:#666; padding:0 10px;">&times;</span>
                </div>
                
                <div id="tm-chart-container" style="flex:1; position:relative; width:100%; overflow:hidden;">
                    <div id="${this.markerLayerId}" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; z-index:10;"></div>
                </div>
                
                <div style="text-align:center; font-size:0.8em; color:#999; margin-top:5px;">縮放: 滾輪 / 拖曳 | 預設視角: 近 200 日</div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById(this.modalId).addEventListener('click', (e) => {
            if (e.target.id === this.modalId) this.close();
        });
    },

    open: function(id, name) {
        this.init();
        this.currentId = id; 

        const rawData = window.fullStockData ? window.fullStockData[id] : null;
        if (!rawData || !rawData.close || rawData.close.length === 0) {
            alert(`尚未載入 ${id} 的詳細資料`);
            return;
        }

        const idEl = document.getElementById('tm-title-id');
        idEl.innerText = id;
        idEl.style.color = '#1877F2';
        document.getElementById('tm-title-name').innerText = name || '';
        document.getElementById(this.modalId).style.display = 'flex';

        const processed = this.processData(rawData);
        
        // 延遲渲染以確保 DOM 準備就緒
        setTimeout(() => {
             this.renderChart(processed);
        }, 50);
    },

    copyCode: function() {
        if (!this.currentId) return;
        const rawId = String(this.currentId).replace('.TW', '').trim();
        const textToCopy = `${rawId}.TW`;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy).then(() => this.showCopySuccess());
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try { document.execCommand('copy'); this.showCopySuccess(); } catch (err) {}
            document.body.removeChild(textArea);
        }
    },

    showCopySuccess: function() {
        const el = document.getElementById('tm-title-id');
        const originalColor = '#1877F2';
        el.style.color = '#00c853'; 
        el.style.fontWeight = 'bold';
        setTimeout(() => {
            el.style.color = originalColor;
        }, 800);
    },

    close: function() {
        const modal = document.getElementById(this.modalId);
        if (modal) modal.style.display = 'none';
        
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
            this.series = {};
            this.currentDataMap = {}; 
            
            // 清除標記層
            const layer = document.getElementById(this.markerLayerId);
            if (layer) layer.innerHTML = '';
            this.activeMarkers = [];
        }
    },

    processData: function(source) {
        const dates = window.csvDates || [];
        const limit = 500; 
        const len = Math.min(dates.length, source.close.length, limit);
        
        let kLineData = [];
        let volData = [];
        let pRankData = [];
        let vRankData = [];
        let sma20Data = [];
        let sma50Data = [];
        
        let volHighMarkers = []; // 儲存標記資料
        let dataMap = {};

        // 時間格式化 (嚴格統一)
        const getFormattedTime = (dStr) => {
            if (!dStr) return null;
            if (dStr.indexOf('/') !== -1) return dStr.replace(/\//g, '-');
            if (dStr.length === 8 && !isNaN(dStr)) {
                return `${dStr.substring(0,4)}-${dStr.substring(4,6)}-${dStr.substring(6,8)}`;
            }
            return dStr;
        };

        // ★ 定義符號與顏色 (依據新需求修正)
        const getVolHighConfig = (val) => {
            const v = Number(val);
            if (v >= 600) return { color: '#2962FF', text: '<span style="font-size:20px; line-height:1;">★</span>' }; // ★ 星星
            if (v >= 400) return { color: '#2962FF', text: '<span style="font-size:20px; line-height:1;">■</span>' }; // ■ 方形
            if (v >= 200) return { color: '#2962FF', text: '<span style="font-size:20px; line-height:1;">▲</span>' }; // ▲ 三角
            if (v >= 100) return { color: '#2962FF', text: '0' }; // 0 
            if (v >= 50)  return { color: '#2962FF', text: '5' }; // 5 
            if (v >= 20)  return { color: '#2962FF', text: '2' }; // 2 
            return null;
        };

        const prKey = source.p_rank ? 'p_rank' : (source.pr ? 'pr' : null);
        const vrKey = source.v_rank ? 'v_rank' : (source.vr ? 'vr' : null);
        const vhKey = source.volhigh ? 'volhigh' : (source.VolHigh ? 'VolHigh' : null);

        for (let i = len - 1; i >= 0; i--) {
            let timeStr = getFormattedTime(dates[i]);
            
            const c = parseFloat(source.close[i]);
            if (isNaN(c)) continue; 

            const o = parseFloat(source.open[i]) || c;
            const h = parseFloat(source.high[i]) || c;
            const l = parseFloat(source.low[i]) || c;
            const v = parseFloat(source.vol[i]) || 0;
            
            const prevC = (i + 1 < source.close.length) ? parseFloat(source.close[i+1]) : NaN;
            let pctChange = null;
            if (!isNaN(prevC) && prevC !== 0) {
                pctChange = ((c - prevC) / prevC) * 100;
            }

            const pr = prKey ? parseFloat(source[prKey][i]) : null;
            const vr = vrKey ? parseFloat(source[vrKey][i]) : null;
            const vhRaw = vhKey ? source[vhKey][i] : 0;
            const vh = parseFloat(vhRaw) || 0; 

            const isUp = c >= o;

            kLineData.push({ time: timeStr, open: o, high: h, low: l, close: c });
            
            dataMap[timeStr] = { pctChange: pctChange, volhigh: vh };

            volData.push({
                time: timeStr, value: v,
                color: isUp ? 'rgba(213, 0, 0, 0.5)' : 'rgba(0, 200, 83, 0.5)'
            });

            if (pr !== null && !isNaN(pr)) pRankData.push({ time: timeStr, value: pr });
            if (vr !== null && !isNaN(vr)) vRankData.push({ time: timeStr, value: vr });

            // ★ 收集標記資料 (門檻降至 20)
            if (vh >= 20) {
                const config = getVolHighConfig(vh);
                if (config) {
                    volHighMarkers.push({
                        time: timeStr,
                        text: config.text,
                        color: config.color
                    });
                }
            }

            if (source.sma20) {
                const s20 = parseFloat(source.sma20[i]);
                if (!isNaN(s20)) sma20Data.push({ time: timeStr, value: s20 });
            }
            if (source.sma50) {
                const s50 = parseFloat(source.sma50[i]);
                if (!isNaN(s50)) sma50Data.push({ time: timeStr, value: s50 });
            }
        }

        // 存入全域變數，供 renderChart 使用
        this.activeMarkers = volHighMarkers;

        return { kLineData, volData, pRankData, vRankData, sma20Data, sma50Data, dataMap };
    },

    // ★ 核心功能：更新 DOM 標記位置
    updateOverlayMarkers: function() {
        if (!this.chart || !this.activeMarkers || this.activeMarkers.length === 0) return;

        const layer = document.getElementById(this.markerLayerId);
        if (!layer) return;

        const timeScale = this.chart.timeScale();
        const containerWidth = layer.clientWidth;
        const containerHeight = layer.clientHeight;

        // ★ 修正定位邏輯：直接計算像素位置
        // PR/VR 圖表設定在 top: 0.70 (即高度的 70% 處開始)
        // 我們將標記放在 68% 的位置 (剛好在線的上方，相當於數值 110-120 的視覺位置)
        const yPos = containerHeight * 0.68;

        let htmlBuffer = '';

        this.activeMarkers.forEach(marker => {
            // 取得 X 軸座標
            const x = timeScale.timeToCoordinate(marker.time);

            // 只繪製在畫面內的點，且 x 必須有效
            if (x !== null && x >= -20 && x <= containerWidth + 20) {
                htmlBuffer += `
                    <div class="tm-marker-item" style="left:${x}px; top:${yPos}px; color:${marker.color};">
                        ${marker.text}
                    </div>
                `;
            }
        });

        layer.innerHTML = htmlBuffer;
    },

    renderChart: function({ kLineData, volData, pRankData, vRankData, sma20Data, sma50Data, dataMap }) {
        const container = document.getElementById('tm-chart-container');
        this.currentDataMap = dataMap;

        // 清除舊的 Tooltip 與 Marker Layer
        const oldLayer = document.getElementById(this.markerLayerId);
        if(oldLayer) oldLayer.innerHTML = '';
        
        container.innerHTML = `
            <div id="${this.markerLayerId}" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; z-index:10;"></div>
            <div id="${this.toolTipId}" style="
            position: absolute; display: none; width: 160px; padding: 10px; box-sizing: border-box; font-size: 13px; text-align: left; z-index: 1000; pointer-events: none;
            background: rgba(0, 0, 0, 0.85); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            font-family: 'Microsoft JhengHei', sans-serif; backdrop-filter: blur(2px);
        "></div>`;

        if (typeof LightweightCharts === 'undefined') {
            container.innerHTML += '<div style="color:red; text-align:center;">Library Load Failed</div>';
            return;
        }

        this.chart = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: { background: { type: 'solid', color: '#ffffff' }, textColor: '#333' },
            grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
            localization: { locale: 'zh-TW', dateFormat: 'yyyy/MM/dd' },
            timeScale: {
                borderColor: '#d1d4dc', rightOffset: 5,
                tickMarkFormatter: (time) => {
                    const date = new Date(time); 
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { width: 1, color: '#9B7DFF', style: 0 },
                horzLine: { visible: false, labelVisible: false },
            },
            rightPriceScale: { 
                visible: true, borderColor: '#d1d4dc', 
                scaleMargins: { top: 0.05, bottom: 0.52 } 
            },
            leftPriceScale: { visible: false } 
        });

        // Layer 1: K Line
        this.series.candle = this.chart.addSeries(LightweightCharts.CandlestickSeries, {
            upColor: '#d50000', downColor: '#00c853',
            borderUpColor: '#d50000', borderDownColor: '#00c853',
            wickUpColor: '#d50000', wickDownColor: '#00c853',
            priceScaleId: 'right' 
        });
        this.series.candle.setData(kLineData);

        if (sma20Data && sma20Data.length > 0) {
            this.series.sma20 = this.chart.addSeries(LightweightCharts.LineSeries, {
                color: '#ff9800', lineWidth: 1, priceScaleId: 'right',
                crosshairMarkerVisible: false, lastValueVisible: false, lineStyle: 0
            });
            this.series.sma20.setData(sma20Data);
        }
        if (sma50Data && sma50Data.length > 0) {
            this.series.sma50 = this.chart.addSeries(LightweightCharts.LineSeries, {
                color: '#2e7d32', lineWidth: 1, priceScaleId: 'right',
                crosshairMarkerVisible: false, lastValueVisible: false, lineStyle: 0
            });
            this.series.sma50.setData(sma50Data);
        }

        // Layer 2: Volume
        this.series.volume = this.chart.addSeries(LightweightCharts.HistogramSeries, {
            color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: 'vol_scale', 
        });
        this.series.volume.setData(volData);
        this.chart.priceScale('vol_scale').applyOptions({ scaleMargins: { top: 0.52, bottom: 0.30 }, visible: false });

        // Layer 3: Block 2 (PR/VR) - 標準設定
        const prOptions = {
            priceScaleId: 'pr_scale', 
            priceFormat: { type: 'price', precision: 0, minMove: 1 },
            autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } })
        };

        this.series.pRank = this.chart.addSeries(LightweightCharts.LineSeries, {
            color: '#C71585', lineWidth: 2, ...prOptions
        });
        this.series.pRank.setData(pRankData);

        this.series.vRank = this.chart.addSeries(LightweightCharts.LineSeries, {
            color: '#2962FF', lineWidth: 2, lineStyle: 2, ...prOptions
        });
        this.series.vRank.setData(vRankData);

        this.chart.priceScale('pr_scale').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 }, position: 'left', visible: false, autoScale: false, minimumWidth: 40 });

        // ★ 綁定事件：當圖表捲動或縮放時，更新 HTML 標記位置
        this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
            this.updateOverlayMarkers();
        });
        
        // ★ 初始化：繪製第一次標記
        // 延遲一點點確保 chart 已經 layout 完成
        setTimeout(() => {
            this.updateOverlayMarkers();
        }, 100);

        this.setupTooltip(container);

        const totalBars = kLineData.length;
        const zoomDays = 200;
        if (totalBars > zoomDays) {
            this.chart.timeScale().setVisibleLogicalRange({
                from: totalBars - zoomDays, to: totalBars + 5
            });
        } else {
            this.chart.timeScale().fitContent();
        }
    },

    setupTooltip: function(container) {
        const toolTip = document.getElementById(this.toolTipId);
        const tooltipWidth = 160;
        const tooltipHeight = 160; 
        const gap = 15; 

        this.chart.subscribeCrosshairMove(param => {
            if (
                param.point === undefined || !param.time ||
                param.point.x < 0 || param.point.x > container.clientWidth ||
                param.point.y < 0 || param.point.y > container.clientHeight
            ) {
                toolTip.style.display = 'none';
                return;
            }

            let left = param.point.x - tooltipWidth - gap;
            let top = param.point.y + gap;

            if (left < 0) left = param.point.x + gap;
            if (top + tooltipHeight > container.clientHeight) top = param.point.y - tooltipHeight - gap;

            toolTip.style.left = left + 'px';
            toolTip.style.top = top + 'px';

            const candleData = param.seriesData.get(this.series.candle);
            const volData = param.seriesData.get(this.series.volume);
            const pRankVal = param.seriesData.get(this.series.pRank); 
            const vRankVal = param.seriesData.get(this.series.vRank);
            const customData = this.currentDataMap[param.time];

            const dateStr = param.time; 
            const displayDate = dateStr.replace(/-/g, '/');

            let price = candleData ? candleData.close : '-';
            let vol = volData ? Math.round(volData.value).toLocaleString() : '-';
            let pr = (pRankVal && pRankVal.value !== undefined) ? pRankVal.value.toFixed(0) : '-';
            let vr = (vRankVal && vRankVal.value !== undefined) ? vRankVal.value.toFixed(0) : '-';
            
            let pctHtml = '<span style="color:#bbb;">-</span>';
            let priceColor = '#fff';

            if (candleData) {
                if (candleData.open) {
                    priceColor = candleData.close >= candleData.open ? '#ff5252' : '#69f0ae';
                }
                if (customData && customData.pctChange !== undefined && customData.pctChange !== null) {
                    const pct = customData.pctChange;
                    const sign = pct > 0 ? '+' : '';
                    const pctColor = pct > 0 ? '#ff5252' : (pct < 0 ? '#69f0ae' : '#fff');
                    pctHtml = `<span style="font-weight:bold; color:${pctColor}">${sign}${pct.toFixed(1)}%</span>`;
                }
            }

            // VolHigh Display
            let vhHtml = '';
            if (customData && customData.volhigh > 0) {
                vhHtml = `
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; margin-top:4px; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.2);">
                    <span style="color:#FFD700; font-weight:bold;">★ 量創高</span>
                    <span style="font-weight:bold; color:#FFD700;">${customData.volhigh}</span>
                </div>`;
            }

            toolTip.innerHTML = `
                <div style="font-weight:bold; font-size:1.1em; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.3); padding-bottom:4px;">${displayDate}</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#bbb;">收盤價</span>
                    <span style="font-weight:bold; color:${priceColor}">${price}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#bbb;">漲幅</span>
                    ${pctHtml}
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#bbb;">成交量</span>
                    <span>${vol}</span>
                </div>
                
                ${vhHtml}

                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#ff80ab;">價 PR</span>
                    <span style="font-weight:bold;">${pr}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#1e90ff;">量 PR</span>
                    <span style="font-weight:bold;">${vr}</span>
                </div>
            `;
            
            toolTip.style.display = 'block';
        });
    }
};