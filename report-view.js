// ==========================================
// report-view.js - v8.0 (Single Page Adapter)
// ==========================================

function renderReportView() {
    console.log("Rendering Report View (Matrix Mode)...");

    // 1. 環境檢查
    const container = document.getElementById('report-container');
    if (!container) return;

    // 2. 參數設定
    const DISPLAY_LIMIT = 50; // ★ 關鍵：限制顯示數量，防止瀏覽器繪圖崩潰
    const allDates = window.csvDates || [];
    const displayDates = allDates.slice(0, 50); // 顯示最近 15 天

    // 3. 資料準備與排序
    const stockIds = Object.keys(window.csvStockData || {});
    
    // 排序：依照最新一天 (Index 0) 的 PR (PriceRank) 由高到低
    stockIds.sort((a, b) => {
        const prA = getPrValue(a, 0);
        const prB = getPrValue(b, 0);
        return prB - prA;
    });

    // 過濾：只取前 50 檔 (模擬原本的過濾邏輯)
    const filteredIds = stockIds.slice(0, DISPLAY_LIMIT);

    // 4. 初始化 HTML 結構 (Sticky Table)
    // 只有當結構不存在時才寫入，避免重複刷新閃爍
    if (!document.getElementById('matrix-table-root')) {
        container.innerHTML = `
            <div id="matrix-table-root" class="bg-white rounded-xl shadow-lg flex flex-col h-screen max-h-[90vh]">
                <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div class="flex items-center gap-3">
                        <h2 class="text-xl font-bold text-gray-800">
                            <i class="fas fa-th text-blue-600 mr-2"></i>強勢股矩陣 (Top ${DISPLAY_LIMIT})
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
                                    // 格式化日期 20260212 -> 02/12
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

    // 5. 渲染資料列
    const tbody = document.getElementById('stock-table-body');
    let html = "";

    filteredIds.forEach(id => {
        const name = window.stockNameMap[id] || id;
        const fullData = window.fullStockData[id] || {};
        const closeArr = fullData.close || [];
        
        // --- 漲幅計算 ---
        let changeText = "--";
        let changeClass = "text-gray-400";
        if (closeArr.length >= 2 && closeArr[1] > 0) {
            const val = ((closeArr[0] - closeArr[1]) / closeArr[1]) * 100;
            changeText = (val > 0 ? "+" : "") + val.toFixed(2) + "%";
            changeClass = val > 0 ? "text-red-600 font-bold" : (val < 0 ? "text-green-600 font-bold" : "text-gray-900");
        }

        // --- Sparkline (SVG) ---
        // 取最近 20 天收盤價，並反轉 (舊->新) 以利繪圖
        const sparkLimit = 20;
        const sparkData = closeArr.slice(0, sparkLimit).reverse();
        // 根據漲跌決定線條顏色
        const color = changeClass.includes('red') ? 'red' : (changeClass.includes('green') ? 'green' : 'gray');
        const svg = generateSparkline(sparkData, color);

        // --- Matrix 日期欄位 (PR 值) ---
        const dateCells = displayDates.map((_, idx) => {
            const pr = getPrValue(id, idx);
            // 依照截圖邏輯：PR 高亮顯示
            let cellClass = "text-gray-300";
            let bgStyle = "";
            
            if (pr >= 95) { 
                cellClass = "text-white font-bold text-xs"; 
                bgStyle = "background-color: #8b5cf6;"; // 紫色 (Top tier)
            } else if (pr >= 90) { 
                cellClass = "text-white font-bold text-xs"; 
                bgStyle = "background-color: #ef4444;"; // 紅色 (High)
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
                    <button onclick="openKLineChart('${id}')" class="text-blue-500 hover:text-blue-700 transition-transform hover:scale-110">
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
        html = `<tr><td colspan="20" class="p-8 text-center text-gray-500">無符合條件資料</td></tr>`;
    }

    tbody.innerHTML = html;
}

// === 輔助函式 ===

// 1. 取得 PR 值 (安全存取)
function getPrValue(id, dateIndex) {
    const data = window.fullStockData[id];
    if (data && data.p_rank && data.p_rank[dateIndex] !== undefined) {
        return data.p_rank[dateIndex];
    }
    return 0;
}

// 2. 產生 Sparkline SVG (極簡版，不耗效能)
function generateSparkline(data, color) {
    if (!data || data.length < 2) return '';
    const w = 100, h = 25;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${x},${y}`;
    }).join(' ');

    const stroke = color === 'red' ? '#dc2626' : (color === 'green' ? '#16a34a' : '#9ca3af');
    // 使用 vector-effect 確保線條清晰
    return `<svg width="${w}" height="${h}" class="overflow-visible"><polyline fill="none" stroke="${stroke}" stroke-width="1.5" points="${points}" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
}

// 3. 開啟 K 線圖 (橋接函式)
function openKLineChart(id) {
    const name = window.stockNameMap[id] || id;
    if (window.TrendModal && window.TrendModal.open) {
        window.TrendModal.open(id, name);
    } else {
        alert("TrendModal 尚未載入");
    }
}