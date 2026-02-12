// ==========================================
// script.js - CSV Loader & Adapter
// ==========================================

// 1. 介面控制
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const errorMsg = document.getElementById('error-msg');
const reportContainer = document.getElementById('report-container');

// 事件監聽
if (dropZone) {
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500'); });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('border-blue-500'); });
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('border-blue-500'); handleFile(e.dataTransfer.files[0]); });
    dropZone.onclick = () => fileInput.click();
}
if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

// 2. 檔案處理
function handleFile(file) {
    if (!file) return;
    if (errorMsg) errorMsg.classList.add('hidden');
    
    const reader = new FileReader();
    reader.onload = (e) => processCSV(e.target.result);
    // ★ 強制 Big5 讀取 (符合 data_loader.php 的處理邏輯)
    reader.readAsText(file, 'Big5');
}

// 3. 核心處理 (模擬 data_loader.php)
function processCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    
    // A. 定位表頭 (找 TradeDate#)
    let headerIndex = -1;
    let headers = [];
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('TradeDate#')) {
            headerIndex = i;
            headers = lines[i].split(',').map(h => h.trim().replace(/"/g, ''));
            break;
        }
    }

    if (headerIndex === -1) return showError("❌ 格式錯誤：找不到簽章欄位 (TradeDate#)");

    // B. 防偽驗證 (保留之前的邏輯)
    const sigColIndex = headers.findIndex(h => h.startsWith('TradeDate#'));
    const headerString = headers[sigColIndex];
    
    if (lines.length <= headerIndex + 1) return showError("❌ 檔案無資料");
    
    // 取得日期字串 (XQ 格式: 20260212/20260211...)
    let rawDateStr = lines[headerIndex + 1].split(',')[sigColIndex].trim().replace(/"/g, '');
    let firstDate = rawDateStr.includes('/') ? rawDateStr.split('/')[0] : rawDateStr;

    const isSafe = verifyCSV(headerString, firstDate);
    if (!isSafe) return showError("❌ 驗證失敗：防偽簽章不符");

    const userInfo = parseXQSignature(headerString);
    if (userInfo.isExpired) return showError(`❌ 權限已於 ${userInfo.date} 到期`);

    showUserStatus(userInfo);

    // C. 資料轉換 (模擬 PHP 輸出的 JSON 結構)
    // 這是對接 data-core.js 的關鍵
    const stockJson = {
        status: 'ok',
        mode: 'full',
        dates: rawDateStr.split('/'), // 所有歷史日期
        names: {},
        data: {}
    };

    // Mapping (參照 data_loader.php $keys)
    const keyMap = {
        'id': 1,       // 代碼 (Index 1)
        'name': 2,     // 商品 (Index 2)
        'date': sigColIndex, // TradeDate
        'open': headers.findIndex(h => h === 'Open'),
        'high': headers.findIndex(h => h === 'High'),
        'low': headers.findIndex(h => h === 'Low'),
        'close': headers.findIndex(h => h === 'Close'),
        'vol': headers.findIndex(h => h === 'Volume'),
        'p_rank': headers.findIndex(h => h === 'PriceRank'), // 對應 $keys['p_rank']
        'v_rank': headers.findIndex(h => h === 'VolRank'),   // 對應 $keys['v_rank']
        'sma20': headers.findIndex(h => h === 'Sma20'),
        'sma50': headers.findIndex(h => h === 'Sma50'),
        'sma150': headers.findIndex(h => h === 'Sma150'),
        'sma200': headers.findIndex(h => h === 'Sma200'),
        'volhigh': headers.findIndex(h => h === 'VolHigh')
    };

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        if (row.length < 5) continue;

        const id = row[keyMap.id].replace('.TW', '');
        const name = row[keyMap.name];

        if (id && name) {
            stockJson.names[id] = name;
            
            // 建立單一股票資料物件
            const stockObj = {};
            
            // 輔助函式：解析 '/'-separated string to array
            const parseArr = (idx) => {
                if (idx === -1 || !row[idx]) return [];
                return row[idx].split('/').map(v => parseFloat(v) || 0);
            };

            // 填入資料 (完全比照 PHP $keys)
            stockObj.open = parseArr(keyMap.open);
            stockObj.high = parseArr(keyMap.high);
            stockObj.low = parseArr(keyMap.low);
            stockObj.close = parseArr(keyMap.close);
            stockObj.vol = parseArr(keyMap.vol);
            stockObj.p_rank = parseArr(keyMap.p_rank);
            stockObj.v_rank = parseArr(keyMap.v_rank);
            stockObj.sma20 = parseArr(keyMap.sma20);
            stockObj.sma50 = parseArr(keyMap.sma50);
            stockObj.sma150 = parseArr(keyMap.sma150);
            stockObj.sma200 = parseArr(keyMap.sma200);
            // volhigh 是字串陣列 (例如 "600"/"0")
            if (keyMap.volhigh > -1 && row[keyMap.volhigh]) {
                stockObj.volhigh = row[keyMap.volhigh].split('/'); 
            }

            stockJson.data[id] = stockObj;
        }
    }

    // D. 注入 data-core.js
    // 我們手動觸發 data-core 的邏輯，而不是透過 API.getStockDataJSON
    if (window.loadFromLocalCSV) {
        window.loadFromLocalCSV(stockJson);
    } else {
        // 如果 data-core.js 還沒改，我們直接操作全域變數 (Fallback)
        injectDataToCore(stockJson);
    }

    // E. 切換畫面
    if (dropZone) dropZone.style.display = 'none';
    if (reportContainer) reportContainer.classList.remove('hidden');
    
    // 呼叫渲染
    if (typeof renderReportView === 'function') {
        // report-view 可能需要知道有哪些 ID
        // 這裡假設 renderReportView 會自己去讀 window.csvStockData
        renderReportView(); 
    }
}

// 4. 輔助函式：注入資料到 data-core (模擬 loadAllCsvData 的後半段)
function injectDataToCore(stockJson) {
    window.csvDates = stockJson.dates;
    window.stockNameMap = stockJson.names;
    window.fullStockData = {};
    window.csvStockData = {};
    window.csvBigOrderData = {};
    window.csvCloseData = {};
    window.csvVolHighData = {};

    const data = stockJson.data;
    for (let id in data) {
        window.fullStockData[id] = data[id];
        // 取最新一筆 (Index 0) 作為列表顯示用
        if (data[id].p_rank) window.csvStockData[id] = data[id].p_rank[0];
        if (data[id].v_rank) window.csvBigOrderData[id] = data[id].v_rank[0];
        if (data[id].close) window.csvCloseData[id] = data[id].close[0];
        if (data[id].volhigh) window.csvVolHighData[id] = data[id].volhigh[0];
    }
    console.log("Data injected to Core:", Object.keys(window.fullStockData).length);
}

// 5. 錯誤顯示與 UI
function showError(msg) {
    if (errorMsg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    } else {
        alert(msg);
    }
    return false;
}

function showUserStatus(info) {
    const el = document.getElementById('user-status');
    if (!el) return;
    el.innerHTML = `
        <div class="bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow border border-blue-100 flex items-center gap-3">
            <div class="text-right">
                <div class="text-xs text-gray-400">USER ID</div>
                <div class="font-bold text-gray-700">${info.userID}</div>
            </div>
            <div class="h-8 w-px bg-gray-200"></div>
            <div class="text-right">
                <div class="text-xs text-gray-400">STATUS</div>
                <div class="font-bold text-blue-600">${info.statusText}</div>
            </div>
             <div class="h-8 w-px bg-gray-200"></div>
            <div class="text-right">
                <div class="text-xs text-gray-400">EXPIRY</div>
                <div class="font-bold ${info.isExpired ? 'text-red-500' : 'text-green-600'}">
                    ${info.date}
                </div>
            </div>
        </div>
    `;
}

function verifyCSV(headerString, firstDateValue) {
    // 1. 先解析表頭
    const info = parseXQSignature(headerString);
    
    if (!info.valid) {
        console.error("表頭解析失敗:", info.message);
        return false;
    }
    // 2. 取得 CSV 內的資料日期 (需轉為純數字)
    // 假設傳入的是 "20260212" 或 "2026/02/12"
    const cleanDateStr = firstDateValue.replace(/\//g, "").replace(/-/g, "");
    const dataDate = parseInt(cleanDateStr, 10);
    // 3. 執行防偽公式 (必須與 XS 一模一樣)
    // 公式: (日期 * 3 + 888) % 10000
    const calculatedSig = (dataDate * 3 + 888) % 10000;
    // 4. 比對
    if (calculatedSig !== info.signature) {
        console.warn(`防偽警告: 計算值(${calculatedSig}) 與 簽章值(${info.signature}) 不符！`);
        alert("警告：此檔案可能已經過期或是被篡改！(簽章驗證失敗)");
        return false; // 驗證失敗
    }
    console.log("✅ 防偽驗證通過！");
    return true; // 驗證成功
}

function parseXQSignature(fullString) {
        const HEADER = "TradeDate#";
        
        // 基礎檢核
        if (!fullString || !fullString.startsWith(HEADER)) {
            return { valid: false, message: "格式錯誤" };
        }

        const content = fullString.substring(HEADER.length);
        const MAP_DATE = "QwErTyUiOp";   // 0-9
        const MAP_ID   = "abcdefghij";   // 0-9

        function decodeDigit(char) {
            const idx = MAP_DATE.indexOf(char);
            return idx > -1 ? idx.toString() : "?";
        }

        if (content.length < 13) return { valid: false, message: "長度不足" };

        const encSig    = content.substring(0, 4);
        const encStatus = content.substring(4, 5); 
        const encMMDD   = content.substring(5, 9); 
        const encYYYY   = content.substring(content.length - 4); 
        const encID     = content.substring(9, content.length - 4); 

        // --- A. 還原防偽簽章 (這是新增的修改) ---
        let sigStr = "";
        for (let c of encSig) sigStr += decodeDigit(c);
        const signature = parseInt(sigStr, 10); // 轉成數字，例如 1521

        // --- B. 還原日期 (期限) ---
        let yyyy = ""; for (let c of encYYYY) yyyy += decodeDigit(c);
        let mmdd = ""; for (let c of encMMDD) mmdd += decodeDigit(c);
        const fullDate = yyyy + mmdd;
        const isPermanent = (fullDate === "13572468");

        // --- C. 還原狀態 & 過期判斷 ---
        const status = decodeDigit(encStatus);
        let isExpired = false;
        
        if (!isPermanent) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            // JS 月份從 0 開始
            const expDate = new Date(parseInt(yyyy), parseInt(mmdd.substring(0, 2)) - 1, parseInt(mmdd.substring(2)));
            if (expDate < today) {
                isExpired = true;
            }
        }

        // --- D. 還原 ID ---
        let rawIDReversed = "";
        for (let c of encID) {
            const idx = MAP_ID.indexOf(c);
            if (idx > -1) rawIDReversed += idx.toString();
            else rawIDReversed += c;
        }
        const finalID = rawIDReversed.split("").reverse().join("");

        return {
            valid: true,
            signature: signature, // 回傳解碼後的簽章 (例如 1521)
            userID: finalID,
            date: isPermanent ? "無期限" : `${yyyy}/${mmdd.substring(0,2)}/${mmdd.substring(2)}`,
            status: status, 
            statusText: (status === "1") ? "綁定戶" : "VIP",
            isExpired: isExpired,
            rawDate: fullDate
        };
}