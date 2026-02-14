// ==========================================
// trend-modal.js - v13.0 (Header Legend: MA & PR Only)
// ==========================================
// 依賴: window.fullStockData, window.csvDates
// 依賴: LightweightCharts (v4.x)

window.TrendModal = {
    chart: null,
    series: {}, 
    modalId: 'trend-modal-overlay',
    toolTipId: 'tm-chart-tooltip',
    markerLayerId: 'tm-marker-layer', 
    currentDataMap: {}, 
    currentId: null,
    activeMarkers: [], 

    init: function() {
        if (document.getElementById(this.modalId)) return;

        const html = `
        <style>
            .tm-marker-item {
                position: absolute;
                transform: translateX(-50%);
                font-size: 14px; 
                font-weight: bold;
                pointer-events: none;
                z-index: 20;
                transition: left 0.1s linear;
                text-shadow: 
                    -1px -1px 0 #fff,  
                     1px -1px 0 #fff,
                    -1px  1px 0 #fff,
                     1px  1px 0 #fff;
            }
            #${this.modalId} {
                display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center;
                backdrop-filter: blur(2px);
            }
            .tm-content {
                background: #fff; width: 98%; max-width: 1600px; height: 90vh; 
                border-radius: 8px; padding: 15px; display: flex; flex-direction: column;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            }
        </style>
        <div id="${this.modalId}">
            <div class="tm-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:8px;">
                    <div style="font-size:1.4em; font-weight:bold; display:flex; align-items:center; gap:10px;">
                        <span id="tm-title-id" onclick="window.TrendModal.copyCode()" title="點擊複製代碼" style="color:#1877F2; cursor:pointer;"></span>
                        <span id="tm-title-name" style="color:#333;"></span>
                        
                        <div style="margin-left:20px; font-size:0.7em; font-weight:bold; display:flex; gap:12px; align-items:center;">
                            <span style="color:#ddd; font-weight:normal;">|</span>
                            <span style="color:#000000;">均線：</span>
                            <span style="color:#ff9800;">20</span>
                            <span style="color:#2e7d32;">50</span>
                            <span style="color:#9c27b0;">150</span>
                            <span style="color:#2962FF;">200</span>
                            <span style="color:#ddd; font-weight:normal;">|</span>
                            <span style="color:#000000;">副圖：</span>
                            <span style="color:#FF0000;">價 PR</span>
                            <span style="color:#2962FF;">量 PR</span>
                            <span style="color:#000000;">量創高</span>
                        </div>
                    </div>
                    <span onclick="window.TrendModal.close()" style="cursor:pointer; font-size:2em; color:#999; line-height:0.5;">&times;</span>
                </div>
                
                <div id="tm-chart-container" style="flex:1; position:relative; width:100%; overflow:hidden;">
                    <div id="${this.markerLayerId}" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; z-index:10;"></div>
                </div>
                
                <div style="text-align:center; font-size:0.8em; color:#bbb; margin-top:5px;">
                    滾輪縮放 | 拖曳移動 | 預設視角: 近 200 日
                </div>
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
        
        setTimeout(() => {
             this.renderChart(processed);
        }, 50);
    },

    copyCode: function() {
        if (typeof window.copyStockCode === 'function') {
            window.copyStockCode(this.currentId);
            const el = document.getElementById('tm-title-id');
            const originColor = el.style.color;
            el.style.color = '#00c853';
            setTimeout(() => el.style.color = originColor, 500);
        }
    },

    close: function() {
        const modal = document.getElementById(this.modalId);
        if (modal) modal.style.display = 'none';
        
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
            this.series = {};
            this.currentDataMap = {}; 
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
        let sma20Data = [], sma50Data = [], sma150Data = [], sma200Data = [];
        
        let volHighMarkers = []; 
        let dataMap = {};

        const getFormattedTime = (dStr) => {
            if (!dStr) return null;
            if (dStr.indexOf('/') !== -1) return dStr.replace(/\//g, '-');
            if (dStr.length === 8 && !isNaN(dStr)) {
                return `${dStr.substring(0,4)}-${dStr.substring(4,6)}-${dStr.substring(6,8)}`;
            }
            return dStr;
        };

        const getVolHighConfig = (val) => {
            const v = Number(val);
            if (v >= 600) return { color: '#000000', text: '<span style="font-size:20px; line-height:1;">★</span>' };
            if (v >= 400) return { color: '#000000', text: '<span style="font-size:20px; line-height:1;">■</span>' };
            if (v >= 200) return { color: '#000000', text: '<span style="font-size:20px; line-height:1;">▲</span>' };
            if (v >= 100) return { color: '#000000', text: '0' }; 
            if (v >= 50)  return { color: '#000000', text: '5' }; 
            if (v >= 20)  return { color: '#000000', text: '2' }; 
            return null;
        };

        const prKey = source.p_rank ? 'p_rank' : 'pr';
        const vrKey = source.v_rank ? 'v_rank' : 'vr';
        const vhKey = source.volhigh ? 'volhigh' : 'VolHigh';

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
            if (!isNaN(prevC) && prevC !== 0) pctChange = ((c - prevC) / prevC) * 100;

            const pr = source[prKey] ? parseFloat(source[prKey][i]) : null;
            const vr = source[vrKey] ? parseFloat(source[vrKey][i]) : null;
            const vhRaw = source[vhKey] ? source[vhKey][i] : 0;
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

            if (vh >= 20) {
                const config = getVolHighConfig(vh);
                if (config) {
                    volHighMarkers.push({ time: timeStr, text: config.text, color: config.color });
                }
            }

            const pushMA = (arr, target) => {
                if (source[arr]) {
                    const val = parseFloat(source[arr][i]);
                    if (!isNaN(val)) target.push({ time: timeStr, value: val });
                }
            };
            pushMA('sma20', sma20Data);
            pushMA('sma50', sma50Data);
            pushMA('sma150', sma150Data);
            pushMA('sma200', sma200Data);
        }

        this.activeMarkers = volHighMarkers;
        return { kLineData, volData, pRankData, vRankData, sma20Data, sma50Data, sma150Data, sma200Data, dataMap };
    },

    updateOverlayMarkers: function() {
        if (!this.chart || !this.activeMarkers || this.activeMarkers.length === 0) return;
        const layer = document.getElementById(this.markerLayerId);
        if (!layer) return;

        const timeScale = this.chart.timeScale();
        const containerWidth = layer.clientWidth;
        const containerHeight = layer.clientHeight;

        // ★ 位置: 0.70 (置中於間隙)
        const yPos = containerHeight * 0.70; 

        let htmlBuffer = '';
        this.activeMarkers.forEach(marker => {
            const x = timeScale.timeToCoordinate(marker.time);
            if (x !== null && x >= -20 && x <= containerWidth + 20) {
                htmlBuffer += `<div class="tm-marker-item" style="left:${x}px; top:${yPos}px; color:${marker.color};">${marker.text}</div>`;
            }
        });
        layer.innerHTML = htmlBuffer;
    },

    renderChart: function({ kLineData, volData, pRankData, vRankData, sma20Data, sma50Data, sma150Data, sma200Data, dataMap }) {
        const container = document.getElementById('tm-chart-container');
        this.currentDataMap = dataMap;

        const oldLayer = document.getElementById(this.markerLayerId);
        if(oldLayer) oldLayer.innerHTML = '';
        const oldTooltip = document.getElementById(this.toolTipId);
        if(oldTooltip) oldTooltip.remove();

        container.insertAdjacentHTML('beforeend', `
            <div id="${this.toolTipId}" style="
            position: absolute; display: none; width: 160px; padding: 10px; box-sizing: border-box; font-size: 13px; text-align: left; z-index: 1000; pointer-events: none;
            background: rgba(0, 0, 0, 0.85); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            backdrop-filter: blur(2px); font-family: 'Segoe UI', sans-serif;"></div>
        `);

        this.chart = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: { background: { type: 'solid', color: '#ffffff' }, textColor: '#333' },
            grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
            localization: { locale: 'zh-TW', dateFormat: 'yyyy/MM/dd' },
            timeScale: { borderColor: '#d1d4dc', rightOffset: 5, timeVisible: true },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
            rightPriceScale: { 
                visible: true, borderColor: '#d1d4dc',
                // ★ K線佈局: 0% - 55%
                scaleMargins: { top: 0.05, bottom: 0.45 } 
            }, 
        });

        this.series.candle = this.chart.addCandlestickSeries({
            upColor: '#d50000', downColor: '#00c853',
            borderUpColor: '#d50000', borderDownColor: '#00c853',
            wickUpColor: '#d50000', wickDownColor: '#00c853',
        });
        this.series.candle.setData(kLineData);

        const addMA = (data, color, width) => {
            if (data && data.length) {
                const s = this.chart.addLineSeries({ color: color, lineWidth: width, crosshairMarkerVisible: false, lineStyle: 0 });
                s.setData(data);
                return s;
            }
        };
        // ★ 顏色定義 (與 Header 一致)
        this.series.sma20 = addMA(sma20Data, '#ff9800', 1);
        this.series.sma50 = addMA(sma50Data, '#2e7d32', 1);
        this.series.sma150 = addMA(sma150Data, '#9c27b0', 1);
        this.series.sma200 = addMA(sma200Data, '#2962FF', 2);

        this.series.volume = this.chart.addHistogramSeries({
            color: '#26a69a', priceFormat: { type: 'volume' },
            priceScaleId: 'vol_scale', 
        });
        this.series.volume.setData(volData);
        
        // ★ 成交量佈局: 58% - 62% (bottom 0.38)
        this.chart.priceScale('vol_scale').applyOptions({
            scaleMargins: { top: 0.58, bottom: 0.28 },
            visible: false 
        });

        const prOptions = {
            priceScaleId: 'pr_scale', 
            priceFormat: { type: 'price', precision: 0, minMove: 1 },
            autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } })
        };

        this.series.pRank = this.chart.addLineSeries({ color: '#FF0000', lineWidth: 2, ...prOptions });
        this.series.pRank.setData(pRankData);

        this.series.vRank = this.chart.addLineSeries({ color: '#2962FF', lineWidth: 2, lineStyle: 2, ...prOptions });
        this.series.vRank.setData(vRankData);

        // ★ PR佈局: 80% - 100%
        this.chart.priceScale('pr_scale').applyOptions({
            scaleMargins: { top: 0.77, bottom: 0 },
            visible: true, 
            borderVisible: false 
        });

        this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => this.updateOverlayMarkers());
        
        setTimeout(() => this.updateOverlayMarkers(), 100);
        this.setupTooltip(container);

        const totalBars = kLineData.length;
        const zoomDays = 200;
        if (totalBars > zoomDays) {
            this.chart.timeScale().setVisibleLogicalRange({ from: totalBars - zoomDays, to: totalBars + 5 });
        } else {
            this.chart.timeScale().fitContent();
        }
    },

    setupTooltip: function(container) {
        const toolTip = document.getElementById(this.toolTipId);
        const tooltipWidth = 160;
        const tooltipHeight = 180; 
        const gap = 15; 

        this.chart.subscribeCrosshairMove(param => {
            if (!param.point || !param.time || param.point.x < 0 || param.point.x > container.clientWidth || param.point.y < 0 || param.point.y > container.clientHeight) {
                toolTip.style.display = 'none';
                return;
            }

            let left = param.point.x + gap;
            let top = param.point.y + gap;
            if (left + tooltipWidth > container.clientWidth) left = param.point.x - tooltipWidth - gap;
            if (top + tooltipHeight > container.clientHeight) top = param.point.y - tooltipHeight - gap;

            toolTip.style.left = left + 'px';
            toolTip.style.top = top + 'px';

            const getVal = (s) => {
                const d = param.seriesData.get(s);
                return (d && d.value !== undefined) ? d.value : (d && d.close !== undefined ? d.close : null);
            };

            const price = getVal(this.series.candle);
            const vol = getVal(this.series.volume);
            const pr = getVal(this.series.pRank);
            const vr = getVal(this.series.vRank);
            const customData = this.currentDataMap[param.time];

            const dateStr = param.time; 
            const displayDate = dateStr.replace(/-/g, '/');
            
            let pctHtml = '<span style="color:#bbb;">-</span>';
            let priceColor = '#fff';

            if (price) {
                if (customData && customData.pctChange !== undefined && customData.pctChange !== null) {
                    const pct = customData.pctChange;
                    const sign = pct > 0 ? '+' : '';
                    const pctColor = pct > 0 ? '#ff5252' : (pct < 0 ? '#69f0ae' : '#fff');
                    pctHtml = `<span style="font-weight:bold; color:${pctColor}">${sign}${pct.toFixed(1)}%</span>`;
                }
            }

            let vhHtml = '';
            if (customData && customData.volhigh > 0) {
                vhHtml = `<div style="display:flex; justify-content:space-between; margin:4px 0; border-top:1px dashed #555; padding-top:4px;">
                    <span style="color:#ff9800; font-weight:bold;">★ 量創高</span><span style="font-weight:bold; color:#ff9800;">${customData.volhigh}</span></div>`;
            }

            toolTip.innerHTML = `
                <div style="font-weight:bold; margin-bottom:5px; border-bottom:1px solid #555; padding-bottom:5px;">${displayDate}</div>
                <div style="display:flex; justify-content:space-between;"><span style="color:#bbb;">收盤價</span><span style="font-weight:bold; color:${priceColor}">${price || '-'}</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:#bbb;">漲幅</span>${pctHtml}</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span style="color:#bbb;">成交量</span><span>${vol ? Math.round(vol).toLocaleString() : '-'}</span></div>
                ${vhHtml}
                <div style="display:flex; justify-content:space-between; margin-top:5px; padding-top:5px; border-top:1px solid #555;">
                    <span style="color:#FF0000; font-weight:bold;">價 PR</span><span style="font-weight:bold;">${pr !== null ? pr.toFixed(0) : '-'}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#2962FF; font-weight:bold;">量 PR</span><span style="font-weight:bold;">${vr !== null ? vr.toFixed(0) : '-'}</span>
                </div>
            `;
            toolTip.style.display = 'block';
        });
    }
};