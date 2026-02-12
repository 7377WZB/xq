// ==========================================
// data-core.js - v6.0 (High Performance: No-Sanitize)
// ==========================================

window.csvStockData = {};         
window.csvGroupData = {};         
window.csvBigOrderData = {};      
window.csvGroupBigOrderData = {}; 
window.csvCloseData = {}; 
window.csvGroupCloseData = {}; 
window.csvVolHighData = {};
window.csvGroupVolHighData = {};

window.csvDates = [];             
window.stockNameMap = {};
window.stockInfoMap = {};
window.groupNames = {};
window.currentGroupData = [];

async function loadAllCsvData() {
    const noticeDiv = document.getElementById('notice');
    if (noticeDiv) {
        noticeDiv.style.display = 'block';
        noticeDiv.innerHTML = "系統載入中...";
    }

    try {
        // [Modified] 加入 getStockInfoMap (產業地位) 並行下載
        const [stockJson, groupJson, infoJson] = await Promise.all([
            API.getStockDataJSON(), 
            API.getGroupDataJSON(),
            API.getStockInfoMap() 
        ]);

        // 1. 處理個股資料
        if (stockJson && stockJson.status === 'ok') {
            window.csvDates = stockJson.dates;
            if (stockJson.names) {
                window.stockNameMap = stockJson.names;
            }
            const data = stockJson.data;
            
            // 初始化全域變數 (供 Trend, Backtest 使用)
            window.fullStockData = {}; 

            for (let id in data) {
                // 1. 儲存完整 Raw Data
                window.fullStockData[id] = data[id];

                // 2. 儀表板資料映射 (使用正規化後的 p_rank, v_rank)
                // 注意：這裡將 p_rank 填入 csvStockData，v_rank 填入 csvBigOrderData
                // 這是為了讓既有的 UI (儀表板) 能繼續運作，而不必改動所有 UI 的容器名稱
                if (data[id].p_rank) window.csvStockData[id]     = data[id].p_rank;
                if (data[id].v_rank) window.csvBigOrderData[id]  = data[id].v_rank;
                if (data[id].close)  window.csvCloseData[id]     = data[id].close;
                if (data[id].volhigh) window.csvVolHighData[id]  = data[id].volhigh;
            }
        }

        // 2. 處理族群資料
        if (groupJson && groupJson.status === 'ok') {
            const gData = groupJson.data || {};
            if (groupJson.names) window.groupNames = groupJson.names;
            if (!window.fullStockData) window.fullStockData = {};

            for (let id in gData) {
                const item = gData[id];
                window.fullStockData[id] = item; // 存入完整資料 (含 OHLC)

                // ★ 關鍵修正：將 p_rank 填入 csvGroupData，讓前端能讀到
                if (item.p_rank) window.csvGroupData[id] = item.p_rank;
                if (item.v_rank) window.csvGroupBigOrderData[id] = item.v_rank;
                if (item.close)  window.csvGroupCloseData[id] = item.close;
                if (item.volhigh) window.csvGroupVolHighData[id] = item.volhigh;
            }
        }

        // 3. [New] 處理產業地位
        if (infoJson) {
            window.stockInfoMap = infoJson; 
        }

        // 4. 完成通知
        if (Object.keys(window.csvStockData).length > 0) {
            if (noticeDiv) {
                noticeDiv.innerHTML = "載入完成";
                setTimeout(() => { noticeDiv.style.display = 'none'; }, 1000);
            }
            if (typeof refreshGroupReportView === 'function') {
                refreshGroupReportView();
            }
        }

    } catch (error) {
        console.error("Data Load Error:", error);
        if (noticeDiv) noticeDiv.innerHTML = "資料載入失敗";
    }
}