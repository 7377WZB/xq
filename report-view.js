/**
 * report-view.js
 * 負責渲染個股列表，並處理 DOM 結構初始化
 */
function renderReportView() {
    console.log("Start rendering Report View...");

    // 1. 初始化 HTML 結構 (如果容器是空的)
    const container = document.getElementById('report-container');
    if (!container) {
        console.error("找不到 report-container");
        return;
    }

    // 只有當內容不存在時才寫入骨架
    if (!document.getElementById('stock-table-body')) {
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-6">
                <div class="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-list-alt text-blue-600 mr-2"></i>個股列表
                    </h2>
                    <div class="text-sm text-gray-500">
                        資料日期：<span id="disp-date" class="font-bold text-blue-600">--</span> 
                        (共 <span id="disp-count">0</span> 檔)
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">趨勢</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">代碼</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品</th>
                                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">成交</th>
                                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">漲幅%</th>
                                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">總量</th>
                                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Price Rank">PR</th>
                                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Volume Rank">VR</th>
                                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Vol High Status">VH</th>
                            </tr>
                        </thead>
                        <tbody id="stock-table-body" class="bg-white divide-y divide-gray-200">
                            </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // 2. 更新日期顯示
    if (window.csvDates && window.csvDates.length > 0) {
        document.getElementById('disp-date').textContent = window.csvDates[0];
    }

    // 3. 準備資料
    // 從 script.js 注入的全域變數中讀取
    const stockIds = Object.keys(window.csvStockData || {}); // 取得所有代碼
    document.getElementById('disp-count').textContent = stockIds.length;

    if (stockIds.length === 0) {
        document.getElementById('stock-table-body').innerHTML = `
            <tr><td colspan="9" class="px-6 py-4 text-center text-gray-400">無資料顯示</td></tr>
        `;
        return;
    }

    // 4. 排序：依照 PR (PriceRank) 由高到低排序
    stockIds.sort((a, b) => {
        const prA = window.csvStockData[a] || 0;
        const prB = window.csvStockData[b] || 0;
        return prB - prA; // 降冪
    });

    // 5. 生成表格 HTML
    const tbody = document.getElementById('stock-table-body');
    let htmlRows = "";

    stockIds.forEach(id => {
        // 讀取各項數值 (使用 data-core 定義的全域變數)
        const name = window.stockNameMap[id] || id;
        const close = window.csvCloseData[id] || 0;
        const vol = (window.fullStockData[id] && window.fullStockData[id].vol) ? window.fullStockData[id].vol[0] : 0;
        const pr = window.csvStockData[id] || 0;
        const vr = window.csvBigOrderData[id] || 0;
        const vh = window.csvVolHighData[id] || "0"; // 字串 "600", "200" 等
        
        // 計算漲幅 (需要前一日收盤價)
        let changeText = "--";
        let changeClass = "text-gray-900";
        if (window.fullStockData[id] && window.fullStockData[id].close && window.fullStockData[id].close.length >= 2) {
            const today = window.fullStockData[id].close[0];
            const yesterday = window.fullStockData[id].close[1];
            if (yesterday > 0) {
                const change = ((today - yesterday) / yesterday) * 100;
                changeText = change.toFixed(2);
                changeClass = change > 0 ? "text-red-600 font-bold" : (change < 0 ? "text-green-600 font-bold" : "text-gray-900");
            }
        }

        // VH 樣式 (創高亮顯)
        let vhBadge = `<span class="text-gray-300">-</span>`;
        if (vh !== "0" && vh !== 0) {
            vhBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">${vh}</span>`;
        }

        // 組合 Row HTML
        htmlRows += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 whitespace-nowrap text-center">
                    <button onclick="handleTrendClick('${id}')" class="text-blue-500 hover:text-blue-700 focus:outline-none transition-transform hover:scale-110" title="查看K線圖">
                        <i class="fas fa-chart-line text-lg"></i>
                    </button>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${id}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${name}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-mono">${close.toFixed(2)}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-mono ${changeClass}">${changeText}%</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 font-mono">${vol.toLocaleString()}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-bold text-gray-700">${Math.floor(pr)}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-bold text-gray-700">${Math.floor(vr)}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm">${vhBadge}</td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlRows;
    console.log(`Rendered ${stockIds.length} rows.`);
}

// 輔助函式：點擊圖示時，呼叫 trend-modal
function handleTrendClick(id) {
    if (typeof openTrendModal === 'function' && window.fullStockData[id]) {
        // 補上 symbol 與 name 屬性，確保 Modal 標題正確
        const item = window.fullStockData[id];
        item.symbol = id;
        item.name = window.stockNameMap[id];
        openTrendModal(item);
    } else {
        console.error("無法開啟趨勢圖: openTrendModal 未定義 或 無資料", id);
    }
}