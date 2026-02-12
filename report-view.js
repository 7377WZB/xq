/**
 * report-view.js - v3.0 (Matrix View)
 * 功能：
 * 1. 顯示 Sparkline (近50日走勢)
 * 2. 動態生成日期欄位 (顯示歷史 PR)
 * 3. 修復 Modal 呼叫問題
 */

function renderReportView() {
    console.log("Rendering Matrix Report View...");

    // 1. 檢查與初始化容器
    const container = document.getElementById('report-container');
    if (!container) return;

    // 取得所有日期 (從 data-core 全域變數)
    // 預設限制顯示最近 10~15 天，以免表格過寬 (可自行調整 slice)
    const allDates = window.csvDates || [];
    const displayDates = allDates.slice(0, 15); // 只顯示最近 15 天

    // 2. 建立 HTML 結構 (Matrix 佈局)
    // 注意：我們使用 sticky header 讓日期列固定
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
                <div class="text-sm text-gray-500">
                    共 <span id="disp-count" class="font-bold text-blue-600">0</span> 檔
                </div>
            </div>

            <div class="overflow-auto flex-1">
                <table class="min-w-full divide-y divide-gray-200 border-separate" style="border-spacing: 0;">
                    <thead class="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th class="sticky left-0 bg-gray-50 px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 shadow-sm w-16">
                                趨勢
                            </th>
                            <th class="sticky left-16 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 shadow-sm w-40">
                                股號 / 股名
                            </th>
                            <th class="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-32">
                                近50日走勢
                            </th>
                            <th class="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 w-20">
                                漲幅
                            </th>
                            
                            ${displayDates.map(date => {
                                // 格式化日期：20260209 -> 02/09
                                const fmtDate = date.length === 8 ? `${date.substring(4,6)}/${date.substring(6,8)}` : date;
                                return `<th class="px-2 py-3 text-center text-xs font-medium text-gray-500 border-b border-gray-100 min-w-[60px]">${fmtDate}</th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody id="stock-table-body" class="bg-white divide-y divide-gray-200">
                        </tbody>
                </table>
            </div>
        </div>
    `;

    // 3. 準備資料
    const stockIds = Object.keys(window.csvStockData || {});
    document.getElementById('disp-count').textContent = stockIds.length;

    // 排序：依照最新一天 (Index 0) 的 PR 由高到低
    stockIds.sort((a, b) => {
        const prA = getPrValue(a, 0);
        const prB = getPrValue(b, 0);
        return prB - prA;
    });

    // 4. 生成內容
    const tbody = document.getElementById('stock-table-body');
    let html = "";

    stockIds.forEach(id => {
        const name = window.stockNameMap[id] || id;
        const fullData = window.fullStockData[id] || {};
        
        // --- 漲幅計算 ---
        const closeArr = fullData.close || [];
        let changeText = "--";
        let changeClass = "text-gray-400";
        if (closeArr.length >= 2 && closeArr[1] > 0) {
            const chg = ((closeArr[0] - closeArr[1]) / closeArr[1]) * 100;
            changeText = chg.toFixed(1) + "%";
            changeClass = chg > 0 ? "text-red-600 font-bold" : (chg < 0 ? "text-green-600 font-bold" : "text-gray-900");
        }

        // --- Sparkline (SVG) ---
        // 取最近 50 天收盤價，並反轉 (舊->新) 以利繪圖
        const sparkData = closeArr.slice(0, 50).reverse(); 
        const sparkSvg = generateSparkline(sparkData, changeClass.includes('red') ? 'red' : (changeClass.includes('green') ? 'green' : 'gray'));

        // --- 歷史 PR 欄位 ---
        const dateCells = displayDates.map((_, idx) => {
            const pr = getPrValue(id, idx);
            // PR 顏色邏輯：>=90 紅底白字, >=80 紅字
            let prClass = "text-gray-400";
            let bgClass = "";
            if (pr >= 95) { prClass = "text-white font-bold"; bgClass = "bg-purple-500 rounded"; }
            else if (pr >= 90) { prClass = "text-white font-bold"; bgClass = "bg-red-500 rounded"; }
            else if (pr >= 80) { prClass = "text-red-600 font-bold"; bgClass = "bg-red-50"; }
            
            return `
                <td class="px-2 py-3 whitespace-nowrap text-center text-sm border-b border-gray-50">
                    <div class="${bgClass} py-1 px-1 min-w-[36px] mx-auto ${prClass}">
                        ${pr > 0 ? Math.floor(pr) : '-'}
                    </div>
                </td>
            `;
        }).join('');

        html += `
            <tr class="hover:bg-blue-50 transition-colors group">
                <td class="sticky left-0 bg-white group-hover:bg-blue-50 px-4 py-3 text-center border-r border-gray-200">
                    <button onclick="handleTrendClick('${id}')" class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm">
                        <i class="fas fa-chart-line"></i>
                    </button>
                </td>
                
                <td class="sticky left-16 bg-white group-hover:bg-blue-50 px-4 py-3 text-left border-r border-gray-200">
                    <div class="font-bold text-gray-800">${id}</div>
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

// 輔助：讀取 PR 值 (容錯)
function getPrValue(id, dateIndex) {
    // window.fullStockData[id].p_rank 是一個陣列 [今日, 昨日, 前日...]
    const data = window.fullStockData[id];
    if (data && data.p_rank && data.p_rank[dateIndex] !== undefined) {
        return data.p_rank[dateIndex];
    }
    return 0;
}

// 輔助：產生 Sparkline SVG
function generateSparkline(data, colorType) {
    if (!data || data.length < 2) return `<span class="text-xs text-gray-300">No Data</span>`;
    
    const width = 100;
    const height = 30;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    // 生成路徑點
    const points = data.map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height; // Y軸反轉 (0在上方)
        return `${x},${y}`;
    }).join(' ');

    const strokeColor = colorType === 'red' ? '#ef4444' : (colorType === 'green' ? '#10b981' : '#9ca3af');

    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="overflow-visible">
            <polyline fill="none" stroke="${strokeColor}" stroke-width="1.5" points="${points}" vector-effect="non-scaling-stroke" />
            <circle cx="${width}" cy="${height - ((data[data.length-1] - min) / range) * height}" r="2" fill="${strokeColor}" />
        </svg>
    `;
}

// 互動：處理點擊 (呼叫 trend-modal)
// 確保 openTrendModal 是全域可用的
function handleTrendClick(id) {
    console.log("Clicked trend for:", id);
    
    // 檢查資料
    if (!window.fullStockData || !window.fullStockData[id]) {
        alert("錯誤：找不到該股資料");
        return;
    }

    // 檢查 Modal 函式
    if (typeof window.openTrendModal === 'function') {
        // 補充必要的顯示欄位 (因為 trend-modal 可能依賴這些)
        const item = window.fullStockData[id];
        item.symbol = id;
        item.name = window.stockNameMap[id];
        
        window.openTrendModal(item);
    } else if (typeof openTrendModal === 'function') {
        // 嘗試直接呼叫
        const item = window.fullStockData[id];
        item.symbol = id;
        item.name = window.stockNameMap[id];
        openTrendModal(item);
    } else {
        console.error("openTrendModal is NOT defined.");
        alert("錯誤：趨勢圖模組未正確載入 (openTrendModal)");
    }
}