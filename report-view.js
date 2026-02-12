/**
 * report-view.js - v3.1 (Fixed: Pagination)
 * 修正：加入分頁機制，防止一次渲染過多 DOM 導致瀏覽器崩潰
 */

// 全域分頁變數
let g_currentPage = 1;
let g_pageSize = 50; // 每頁只顯示 50 筆，保證流暢
let g_sortedStockIds = []; // 儲存排序後的 ID 列表

function renderReportView() {
    console.log("Rendering Paged Matrix View...");

    const container = document.getElementById('report-container');
    if (!container) return;

    const allDates = window.csvDates || [];
    const displayDates = allDates.slice(0, 15); // 顯示最近 15 天

    // 1. 初始化 HTML 結構 (含分頁控制區)
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg flex flex-col h-screen max-h-[90vh]">
            <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                <div class="flex items-center gap-3">
                    <h2 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-th text-blue-600 mr-2"></i>籌碼矩陣
                    </h2>
                    <span class="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                        資料日期: ${allDates[0] || '--'}
                    </span>
                </div>
                <div class="flex items-center gap-4">
                    <div class="text-sm text-gray-500">
                        共 <span id="disp-total-count" class="font-bold text-blue-600">0</span> 檔
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="changePage(-1)" class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm">上一頁</button>
                        <span id="page-info" class="text-sm font-mono">1 / 1</span>
                        <button onclick="changePage(1)" class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm">下一頁</button>
                    </div>
                </div>
            </div>

            <div class="overflow-auto flex-1">
                <table class="min-w-full divide-y divide-gray-200 border-separate" style="border-spacing: 0;">
                    <thead class="bg-gray-50 sticky top-0 z-20">
                        <tr>
                            <th class="sticky left-0 bg-gray-50 px-2 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 shadow-sm w-16 z-30">
                                趨勢
                            </th>
                            <th class="sticky left-16 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 shadow-sm w-40 z-30">
                                股號 / 股名
                            </th>
                            <th class="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-32">
                                近50日走勢
                            </th>
                            <th class="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 w-20">
                                漲幅
                            </th>
                            ${displayDates.map(date => {
                                const fmtDate = date.length === 8 ? `${date.substring(4,6)}/${date.substring(6,8)}` : date;
                                return `<th class="px-2 py-3 text-center text-xs font-medium text-gray-500 border-b border-gray-100 min-w-[50px]">${fmtDate}</th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody id="stock-table-body" class="bg-white divide-y divide-gray-200">
                        </tbody>
                </table>
            </div>
        </div>
    `;

    // 2. 準備與排序資料
    const stockIds = Object.keys(window.csvStockData || {});
    
    // 排序：依照 PR 由高到低
    stockIds.sort((a, b) => {
        const prA = getPrValue(a, 0);
        const prB = getPrValue(b, 0);
        return prB - prA;
    });

    g_sortedStockIds = stockIds;
    g_currentPage = 1;

    document.getElementById('disp-total-count').textContent = stockIds.length;

    // 3. 渲染第一頁
    renderPageData();
}

/**
 * 渲染單頁資料 (核心優化)
 */
function renderPageData() {
    const tbody = document.getElementById('stock-table-body');
    const displayDates = (window.csvDates || []).slice(0, 15);
    
    // 計算分頁範圍
    const startIdx = (g_currentPage - 1) * g_pageSize;
    const endIdx = startIdx + g_pageSize;
    const pageIds = g_sortedStockIds.slice(startIdx, endIdx);

    // 更新分頁資訊
    const totalPages = Math.ceil(g_sortedStockIds.length / g_pageSize);
    document.getElementById('page-info').textContent = `${g_currentPage} / ${totalPages}`;

    let html = "";

    pageIds.forEach(id => {
        const name = window.stockNameMap[id] || id;
        const fullData = window.fullStockData[id] || {};
        const closeArr = fullData.close || [];
        
        // 漲幅
        let changeText = "--";
        let changeClass = "text-gray-400";
        if (closeArr.length >= 2 && closeArr[1] > 0) {
            const chg = ((closeArr[0] - closeArr[1]) / closeArr[1]) * 100;
            changeText = chg.toFixed(1) + "%";
            changeClass = chg > 0 ? "text-red-600 font-bold" : (chg < 0 ? "text-green-600 font-bold" : "text-gray-900");
        }

        // Sparkline
        const sparkData = closeArr.slice(0, 50).reverse(); 
        const sparkSvg = generateSparkline(sparkData, changeClass.includes('red') ? 'red' : (changeClass.includes('green') ? 'green' : 'gray'));

        // 日期 PR 欄位
        const dateCells = displayDates.map((_, idx) => {
            const pr = getPrValue(id, idx);
            let prClass = "text-gray-400";
            let bgClass = "";
            
            // 顏色邏輯
            if (pr >= 95) { prClass = "text-white font-bold"; bgClass = "bg-purple-500 rounded shadow-sm"; }
            else if (pr >= 90) { prClass = "text-white font-bold"; bgClass = "bg-red-500 rounded shadow-sm"; }
            else if (pr >= 80) { prClass = "text-red-600 font-bold bg-red-50 rounded"; }
            
            return `
                <td class="px-1 py-3 text-center text-sm border-b border-gray-50">
                    <div class="${bgClass} w-8 h-6 flex items-center justify-center mx-auto ${prClass} text-xs">
                        ${pr > 0 ? Math.floor(pr) : '-'}
                    </div>
                </td>
            `;
        }).join('');

        html += `
            <tr class="hover:bg-blue-50 transition-colors group">
                <td class="sticky left-0 bg-white group-hover:bg-blue-50 px-2 py-3 text-center border-r border-gray-200 z-10">
                    <button onclick="handleTrendClick('${id}')" class="w-8 h-8 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center">
                        <i class="fas fa-chart-line text-sm"></i>
                    </button>
                </td>
                
                <td class="sticky left-16 bg-white group-hover:bg-blue-50 px-4 py-3 text-left border-r border-gray-200 z-10">
                    <div class="font-bold text-gray-800 text-sm">${id}</div>
                    <div class="text-xs text-gray-500 truncate max-w-[100px]">${name}</div>
                </td>

                <td class="px-2 py-3 text-center">
                    ${sparkSvg}
                </td>

                <td class="px-4 py-3 text-right border-r border-gray-200 text-sm font-mono ${changeClass}">
                    ${changeText}
                </td>

                ${dateCells}
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// 分頁切換
function changePage(delta) {
    const totalPages = Math.ceil(g_sortedStockIds.length / g_pageSize);
    const newPage = g_currentPage + delta;
    
    if (newPage >= 1 && newPage <= totalPages) {
        g_currentPage = newPage;
        renderPageData();
        // 滾動回頂部
        document.querySelector('.overflow-auto').scrollTop = 0;
    }
}

// 輔助函式
function getPrValue(id, dateIndex) {
    const data = window.fullStockData[id];
    if (data && data.p_rank && data.p_rank[dateIndex] !== undefined) {
        return data.p_rank[dateIndex];
    }
    return 0;
}

function generateSparkline(data, colorType) {
    if (!data || data.length < 2) return `<span class="text-xs text-gray-300">-</span>`;
    
    const width = 80;
    const height = 24;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    const strokeColor = colorType === 'red' ? '#ef4444' : (colorType === 'green' ? '#10b981' : '#9ca3af');

    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="overflow-visible mx-auto">
            <polyline fill="none" stroke="${strokeColor}" stroke-width="1.5" points="${points}" vector-effect="non-scaling-stroke" />
        </svg>
    `;
}

function handleTrendClick(id) {
    if (typeof window.openTrendModal === 'function' && window.fullStockData[id]) {
        const item = window.fullStockData[id];
        item.symbol = id;
        item.name = window.stockNameMap[id];
        window.openTrendModal(item);
    } else {
        console.error("openTrendModal not ready");
    }
}