// ==========================================
// report-view.js - v9.0 (Controls & Full Cells)
// ==========================================

// 狀態管理 (記住使用者的選擇)
const g_viewState = {
    dataType: 'p_rank', // p_rank(價PR), v_rank(量PR), volhigh(量創高)
    filterLevel: 0,     // 0:全部, 80:強勢(>80), 90:超強(>90)
    days: 20,           // 顯示天數: 20, 50, 100
    sort: 'desc'        // desc(新->舊), asc(舊->新)
};

function renderReportView() {
    console.log("Rendering Report View v9.0...");
    const container = document.getElementById('report-container');
    if (!container) return;

    // 1. 準備資料
    const allDates = window.csvDates || [];
    // 根據設定的天數截取日期
    let displayDates = allDates.slice(0, g_viewState.days);
    // 處理排序 (新舊反轉)
    if (g_viewState.sort === 'asc') {
        displayDates = [...displayDates].reverse();
    }

    // 2. 篩選與排序 Stock ID
    let stockIds = Object.keys(window.csvStockData || {});
    
    // 預設依據 PR 排序
    stockIds.sort((a, b) => {
        const valA = getLatestValue(a, 'p_rank');
        const valB = getLatestValue(b, 'p_rank');
        return valB - valA;
    });

    // 執行過濾 (Filter)
    if (g_viewState.filterLevel > 0) {
        stockIds = stockIds.filter(id => {
            const pr = getLatestValue(id, 'p_rank');
            const vr = getLatestValue(id, 'v_rank');
            // 只要其中一個滿足條件就留下來
            return pr >= g_viewState.filterLevel || vr >= g_viewState.filterLevel;
        });
    }

    // 效能保護: 最多顯示 100 筆 (避免 SVG 繪圖過多卡頓)
    // 您可以自行調整此數值
    const RENDER_LIMIT = 100;
    const finalIds = stockIds.slice(0, RENDER_LIMIT);

    // 3. 建立 HTML 結構 (含控制面板)
    // 只有當根容器不存在時才重建，避免閃爍。但如果需要更新 Header (日期變動)，則需更新 thead
    // 這裡為了簡單，每次都重繪整個容器內容
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg flex flex-col h-screen max-h-[90vh] border border-gray-200">
            
            <div class="p-3 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center justify-between">
                
                <div class="flex items-center gap-3">
                    <div class="font-bold text-gray-700 text-lg flex items-center">
                        <i class="fas fa-sliders-h text-blue-600 mr-2"></i>籌碼矩陣
                    </div>
                    <span class="text-xs font-mono text-gray-500 bg-gray-200 px-2 py-1 rounded">
                        共 ${finalIds.length} 檔
                    </span>
                </div>

                <div class="flex flex-wrap gap-2 items-center">
                    
                    <div class="flex bg-white border border-gray-300 rounded overflow-hidden shadow-sm">
                        ${renderBtn('dataType', 'p_rank', '價 PR')}
                        ${renderBtn('dataType', 'v_rank', '量 PR')}
                        ${renderBtn('dataType', 'volhigh', '量創高')}
                    </div>

                    <div class="flex bg-white border border-gray-300 rounded overflow-hidden shadow-sm ml-2">
                        ${renderBtn('filterLevel', 0, '全部')}
                        ${renderBtn('filterLevel', 80, '> 80')}
                        ${renderBtn('filterLevel', 90, '> 90')}
                    </div>

                    <div class="flex bg-white border border-gray-300 rounded overflow-hidden shadow-sm ml-2">
                        ${renderBtn('days', 20, '20日')}
                        ${renderBtn('days', 50, '50日')}
                        ${renderBtn('days', 100, '百日')}
                    </div>

                    <button onclick="updateViewState('sort', '${g_viewState.sort === 'desc' ? 'asc' : 'desc'}')" 
                            class="ml-2 px-3 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-600">
                        <i class="fas fa-sort${g_viewState.sort === 'asc' ? '-numeric-down' : '-numeric-up-alt'} mr-1"></i>
                        ${g_viewState.sort === 'desc' ? '新→舊' : '舊→新'}
                    </button>
                </div>
            </div>

            <div class="overflow-auto flex-1 bg-white">
                <table class="min-w-full border-separate" style="border-spacing: 0;">
                    <thead class="bg-gray-50 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th class="sticky left-0 bg-gray-50 px-2 py-2 text-center text-xs font-bold text-gray-500 uppercase border-b border-r border-gray-200 w-10 z-30">K線</th>
                            <th class="sticky left-10 bg-gray-50 px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase border-b border-r border-gray-200 w-28 z-30">商品</th>
                            <th class="px-2 py-2 text-center text-xs font-bold text-gray-500 uppercase border-b border-gray-200 w-24">走勢</th>
                            <th class="px-2 py-2 text-right text-xs font-bold text-gray-500 uppercase border-b border-r border-gray-200 w-16">漲幅</th>
                            
                            ${displayDates.map(date => {
                                const dStr = date.length === 8 ? `${date.substring(4,6)}/${date.substring(6,8)}` : date;
                                return `<th class="px-0 py-2 text-center text-xs font-medium text-gray-500 border-b border-gray-100 min-w-[36px] w-[36px] select-none">${dStr}</th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-100">
                        ${renderRows(finalIds, displayDates)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// 輔助：生成按鈕 HTML
function renderBtn(key, value, label) {
    const isActive = g_viewState[key] === value;
    const activeClass = "bg-blue-600 text-white font-bold";
    const normalClass = "bg-white text-gray-600 hover:bg-gray-50";
    // 轉義字串參數
    const valStr = typeof value === 'string' ? `'${value}'` : value;
    return `
        <button onclick="updateViewState('${key}', ${valStr})" 
                class="px-3 py-1 text-xs border-r border-gray-200 last:border-r-0 transition-colors ${isActive ? activeClass : normalClass}">
            ${label}
        </button>
    `;
}

// 輔助：更新狀態並重繪
window.updateViewState = function(key, value) {
    g_viewState[key] = value;
    renderReportView(); // 重繪
};

// 輔助：生成表格列
function renderRows(ids, dates) {
    if (ids.length === 0) return `<tr><td colspan="100" class="p-8 text-center text-gray-400">無符合條件資料</td></tr>`;

    // 為了對應日期，我們需要知道原始日期的 Index
    // 若 g_viewState.sort === 'asc'，dates 是 [舊...新]，但 window.csvDates 是 [新...舊]
    // 這邊用 Map 建立 日期字串 -> 原始Index 的對照，比較準確
    const allDatesMap = {};
    (window.csvDates || []).forEach((d, i) => allDatesMap[d] = i);

    return ids.map(id => {
        const name = window.stockNameMap[id] || id;
        const fullData = window.fullStockData[id] || {};
        const closeArr = fullData.close || [];
        
        // 漲幅
        let changeText = "-";
        let changeClass = "text-gray-300";
        if (closeArr.length >= 2 && closeArr[1] > 0) {
            const val = ((closeArr[0] - closeArr[1]) / closeArr[1]) * 100;
            changeText = (val > 0 ? "+" : "") + val.toFixed(1) + "%";
            changeClass = val > 0 ? "text-red-600 font-bold" : (val < 0 ? "text-green-600 font-bold" : "text-gray-900");
        }

        // Sparkline
        const sparkData = closeArr.slice(0, 20).reverse();
        const color = changeClass.includes('red') ? 'red' : (changeClass.includes('green') ? 'green' : 'gray');
        const svg = generateSparkline(sparkData, color);

        // 矩陣儲存格生成 (重點修改：Full Cell)
        const cells = dates.map(dateStr => {
            const dataIdx = allDatesMap[dateStr];
            const val = getMatrixValue(id, dataIdx, g_viewState.dataType);
            
            // 樣式判斷
            const style = getCellStyle(val, g_viewState.dataType);
            
            // ★ 重點：移除 padding (p-0)，用 div 撐滿 (h-8 w-full)
            return `
                <td class="p-0 border-b border-gray-100 border-r border-dashed border-gray-100 h-8">
                    <div class="w-full h-full flex items-center justify-center text-xs ${style.textClass}" 
                         style="${style.bgStyle}">
                        ${style.label}
                    </div>
                </td>
            `;
        }).join('');

        return `
            <tr class="hover:bg-blue-50 transition-colors group">
                <td class="sticky left-0 bg-white group-hover:bg-blue-50 p-0 text-center border-b border-r border-gray-200 z-10 w-10">
                    <button onclick="openKLineChart('${id}')" class="w-full h-full flex items-center justify-center text-blue-400 hover:text-blue-600">
                        <i class="fas fa-chart-line"></i>
                    </button>
                </td>
                <td class="sticky left-10 bg-white group-hover:bg-blue-50 px-2 py-1 text-left border-b border-r border-gray-200 z-10 w-28">
                    <div class="font-bold text-gray-800 text-xs leading-tight">${id}</div>
                    <div class="text-xs text-gray-500 truncate leading-tight">${name}</div>
                </td>
                <td class="p-1 text-center border-b border-gray-100">${svg}</td>
                <td class="px-2 py-1 text-right border-b border-r border-gray-200 text-xs font-mono ${changeClass}">${changeText}</td>
                ${cells}
            </tr>
        `;
    }).join('');
}

// 邏輯：取得矩陣數值
function getMatrixValue(id, idx, type) {
    const data = window.fullStockData[id];
    if (!data) return 0;
    
    if (type === 'p_rank') return (data.p_rank && data.p_rank[idx]) || 0;
    if (type === 'v_rank') return (data.v_rank && data.v_rank[idx]) || 0;
    if (type === 'volhigh') return (data.volhigh && data.volhigh[idx]) || "0";
    return 0;
}

// 邏輯：取得單一數值 (用於排序)
function getLatestValue(id, type) {
    return getMatrixValue(id, 0, type);
}

// 樣式：決定格子的顏色與文字 (整合 Heatmap)
function getCellStyle(val, type) {
    // A. 價PR / 量PR (使用熱力圖邏輯)
    if (type === 'p_rank' || type === 'v_rank') {
        const num = Math.floor(val);
        if (!num && num !== 0) return { label: '-', textClass: 'text-gray-300', bgStyle: '' };
        
        // 使用您提供的熱力圖配色函式
        const styleStr = getHeatmapStyle(num);
        return { 
            label: num, 
            textClass: '', // 文字顏色已包含在 styleStr 中
            bgStyle: styleStr 
        };
    }
    
    // B. 量創高 (保持原本邏輯，標示 H)
    if (type === 'volhigh') {
        if (val == "0" || !val) return { label: '', textClass: '', bgStyle: '' };
        return { label: 'H', textClass: 'text-white font-bold', bgStyle: 'background-color: #f59e0b;' }; // 橘色
    }

    return { label: val, textClass: '', bgStyle: '' };
}

// ★ 新增：熱力圖配色核心 (您的原始代碼)
function getHeatmapStyle(val) {
    if (val === null || val === undefined || isNaN(val)) return "";
    
    const v = parseFloat(val);

    // 97分以上：強調顯示 (亮粉紅底、白字、特大粗體)
    if (v >= 97) {
        return "background-color: #C71585; color: #fff; font-size: 1.1em; font-weight: 900;"; 
        // 註: font-size 我稍微調小至 1.1em 以免撐破表格，您可自行改回 1.3em
    }

    let r, g, b, textColor;
    const BASE = 230; // 基礎亮度 (數值越小顏色越深)

    if (v >= 50) {
        // 分數 >= 50：紅色漸層 (越高越紅)
        const ratio = (v - 50) / 50; 
        r = 255; 
        g = Math.round(BASE - ((BASE - 60) * ratio)); 
        b = Math.round(BASE - ((BASE - 60) * ratio));
        // 數值很高時字體轉白，否則深黑
        textColor = (v >= 85) ? '#fff' : '#333';
    } else {
        // 分數 < 50：綠色漸層 (越低越綠)
        const ratio = (50 - v) / 50; 
        r = Math.round(BASE - ((BASE - 40) * ratio)); 
        g = Math.round(BASE - ((BASE - 160) * ratio)); 
        b = Math.round(BASE - ((BASE - 40) * ratio));
        textColor = (v <= 15) ? '#fff' : '#333';
    }
    return `background-color: rgb(${r},${g},${b}); color: ${textColor};`;
}

// 輔助：Sparkline
function generateSparkline(data, color) {
    if (!data || data.length < 2) return '';
    const w = 80, h = 20;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => `${(i/(data.length-1))*w},${h - ((v-min)/range)*h}`).join(' ');
    const stroke = color === 'red' ? '#dc2626' : (color === 'green' ? '#16a34a' : '#9ca3af');
    return `<svg width="${w}" height="${h}" class="mx-auto"><polyline fill="none" stroke="${stroke}" stroke-width="1.5" points="${points}" /></svg>`;
}

// 互動：開圖
window.openKLineChart = function(id) {
    const name = window.stockNameMap[id] || id;
    if (window.TrendModal) window.TrendModal.open(id, name);
}