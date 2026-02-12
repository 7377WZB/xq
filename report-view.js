/**
 * report-view.js
 * 還原 NAS 版本邏輯：矩陣式列表 + Sparkline + 客戶端過濾 (VR > 95)
 */

function renderReportView() {
    console.log("Rendering Report View (Matrix Mode)...");

    const container = document.getElementById('report-container');
    if (!container) return;

    // 1. 準備資料
    const allDates = window.csvDates || [];
    // 依照截圖，顯示最近的 N 天 (例如 12~15 天)
    const displayDates = allDates.slice(0, 15);
    
    // 2. 篩選資料 (關鍵：防止當機)
    // 邏輯：只取 VR > 95 或 PR > 95 的強勢股，模擬您原本的 "預設限制"
    const stockIds = Object.keys(window.csvStockData || {});
    
    // 先排序 (依照 PR 由高到低)
    stockIds.sort((a, b) => {
        const prA = getPrValue(a, 0);
        const prB = getPrValue(b, 0);
        return prB - prA;
    });

    // ★ 過濾核心：只顯示前 50 檔，或是 VR > 90 的股票
    // 這樣就不用分頁，也不會當機
    const filteredIds = stockIds.filter(id => {
        const vr = window.csvBigOrderData[id] || 0; // 量排名
        const pr = window.csvStockData[id] || 0;    // 價排名
        // 條件：VR > 95 或 PR > 95 (您可以依需求調整此處數字)
        return vr >= 80 || pr >= 80; 
    }).slice(0, 60); // 雙重保險：最多只顯示 60 筆，確保效能

    document.getElementById('disp-count').textContent = filteredIds.length;

    // 3. 建構 HTML (Sticky Header Matrix)
    // 如果表格結構還沒建立，才建立 (保留 Sticky 特性)
    if (!document.getElementById('matrix-table-root')) {
        container.innerHTML = `
            <div id="matrix-table-root" class="bg-white rounded-xl shadow-lg flex flex-col h-screen max-h-[90vh]">
                <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div class="flex items-center gap-3">
                        <h2 class="text-xl font-bold text-gray-800">
                            <i class="fas fa-th text-blue-600 mr-2"></i>強勢股矩陣 (VR/PR > 80)
                        </h2>
                        <span class="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                            資料日期: ${allDates[0] || '--'}
                        </span>
                    </div>
                    <div class="text-sm text-gray-500">
                        共 <span class="font-bold text-blue-600">${filteredIds.length}</span> 檔
                    </div>
                </div>

                <div class="overflow-auto flex-1">
                    <table class="min-w-full divide-y divide-gray-200 border-separate" style="border-spacing: 0;">
                        <thead class="bg-gray-50 sticky top-0 z-20">
                            <tr>
                                <th class="sticky left-0 bg-gray-50 px-2 py-3 text-center text-xs font-bold text-gray-500 uppercase border-b border-r border-gray-200 shadow-sm w-12 z-30">
                                    K線
                                </th>
                                <th class="sticky left-12 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase border-b border-r border-gray-200 shadow-sm w-32 z-30">
                                    商品
                                </th>
                                <th class="px-2 py-3 text-center text-xs font-bold text-gray-500 uppercase border-b border-gray-200 w-32">
                                    近20日走勢
                                </th>
                                <th class="px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase border-b border-r border-gray-200 w-20">
                                    漲幅%
                                </th>
                                ${displayDates.map(date => {
                                    // 格式 20260212 -> 02/12
                                    const dStr = date.length === 8 ? `${date.substring(4,6)}/${date.substring(6,8)}` : date;
                                    return `<th class="px-2 py-3 text-center text-xs font-medium text-gray-500 border-b border-gray-100 min-w-[48px]">${dStr}</th>`;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody id="stock-table-body" class="bg-white divide-y divide-gray-200">
                            </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // 4. 渲染資料列
    const tbody = document.getElementById('stock-table-body');
    let html = "";

    filteredIds.forEach(id => {
        const name = window.stockNameMap[id] || id;
        const fullData = window.fullStockData[id] || {};
        const closeArr = fullData.close || [];
        
        // 漲幅計算
        let changeText = "--";
        let changeClass = "text-gray-400";
        if (closeArr.length >= 2 && closeArr[1] > 0) {
            const val = ((closeArr[0] - closeArr[1]) / closeArr[1]) * 100;
            changeText = (val > 0 ? "+" : "") + val.toFixed(2) + "%";
            changeClass = val > 0 ? "text-red-600 font-bold" : (val < 0 ? "text-green-600 font-bold" : "text-gray-900");
        }

        // Sparkline (取近 20 日，反轉)
        const sparkLimit = 20;
        const sparkData = closeArr.slice(0, sparkLimit).reverse();
        const color = changeClass.includes('red') ? 'red' : (changeClass.includes('green') ? 'green' : 'gray');
        const svg = generateSimpleSparkline(sparkData, color);

        // Matrix 日期欄位 (PR 值)
        const dateCells = displayDates.map((_, idx) => {
            const pr = getPrValue(id, idx);
            // 依照截圖邏輯：數值高亮
            let cellClass = "text-gray-300";
            let bgStyle = "";
            
            if (pr >= 95) { 
                cellClass = "text-white font-bold text-xs"; 
                bgStyle = "background-color: #8b5cf6;"; // 紫色
            } else if (pr >= 90) { 
                cellClass = "text-white font-bold text-xs"; 
                bgStyle = "background-color: #ef4444;"; // 紅色
            } else if (pr >= 80) { 
                cellClass = "text-red-600 font-bold text-xs"; 
                bgStyle = "background-color: #fef2f2;"; // 淺紅
            } else if (pr > 0) {
                cellClass = "text-gray-600 text-xs";
            }

            return `
                <td class="px-1 py-2 text-center border-b border-gray-50">
                    <div style="${bgStyle}" class="w-8 h-6 flex items-center justify-center mx-auto rounded ${cellClass}">
                        ${pr > 0 ? Math.floor(pr) : '-'}
                    </div>
                </td>
            `;
        }).join('');

        html += `
            <tr class="hover:bg-blue-50 transition-colors group">
                <td class="sticky left-0 bg-white group-hover:bg-blue-50 px-2 py-2 text-center border-r border-gray-200 z-10">
                    <button onclick="handleKLineClick('${id}')" class="text-blue-500 hover:text-blue-700">
                        <i class="fas fa-chart-line text-lg"></i>
                    </button>
                </td>
                
                <td class="sticky left-12 bg-white group-hover:bg-blue-50 px-4 py-2 text-left border-r border-gray-200 z-10">
                    <div class="font-bold text-gray-800 text-sm leading-tight">${id}</div>
                    <div class="text-xs text-gray-500 leading-tight">${name}</div>
                </td>

                <td class="px-2 py-2 text-center">
                    ${svg}
                </td>

                <td class="px-2 py-2 text-right border-r border-gray-200 text-sm font-mono ${changeClass}">
                    ${changeText}
                </td>

                ${dateCells}
            </tr>
        `;
    });

    if (filteredIds.length === 0) {
        html = `<tr><td colspan="20" class="p-8 text-center text-gray-500">沒有符合條件 (VR/PR >= 80) 的個股</td></tr>`;
    }

    tbody.innerHTML = html;
}

// 輔助：取得 PR
function getPrValue(id, dateIndex) {
    const data = window.fullStockData[id];
    if (data && data.p_rank && data.p_rank[dateIndex] !== undefined) {
        return data.p_rank[dateIndex];
    }
    return 0;
}

// 輔助：簡單 SVG (高效能)
function generateSimpleSparkline(data, color) {
    if (!data || data.length < 2) return '';
    const w = 100, h = 25;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${x},${y}`;
    }).join(' ');

    const stroke = color === 'red' ? '#dc2626' : (color === 'green' ? '#16a34a' : '#9ca3af');
    return `<svg width="${w}" height="${h}" class="overflow-visible"><polyline fill="none" stroke="${stroke}" stroke-width="1.5" points="${points}" /></svg>`;
}

// 互動：呼叫 TrendModal
function handleKLineClick(id) {
    // 優先使用 window.TrendModal (您上傳的 trend-modal.js 似乎將其掛在 window.TrendModal)
    if (window.TrendModal && typeof window.TrendModal.open === 'function') {
        const name = window.stockNameMap[id] || id;
        window.TrendModal.open(id, name);
    } 
    // 相容舊版呼叫
    else if (typeof openTrendModal === 'function') {
        const item = window.fullStockData[id] || {};
        item.symbol = id;
        openTrendModal(item);
    } else {
        alert("TrendModal 未載入");
    }
}