// ==========================================
// script.js - v2.0 (Full Code)
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
    // 強制 Big5 讀取 (符合 XQ 格式)
    reader.readAsText(file, 'Big5');
}

// 3. 核心處理
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

    // B. 防偽驗證
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
    const stockJson = {
        status: 'ok',
        mode: 'full',
        dates: rawDateStr.split('/'), // 所有歷史日期
        names: {},
        data: {}
    };

    // 動態欄位對應 (Mapping)
    const col = (name) => headers.findIndex(h => h === name || h === name.replace(/"/g, ''));
    
    // 根據 data_loader.php 的 $keys 設定
    const keyMap = {
        'id': col('代碼'),
        'name': col('商品'),
        'date': sigColIndex,
        'open': col('Open'),
        'high': col('High'),
        'low': col('Low'),
        'close': col('Close'),
        'vol': col('Volume'),
        'p_rank': col('PriceRank'),
        'v_rank': col('VolRank'),
        'sma20': col('Sma20'),
        'sma50': col('Sma50'),
        'sma150': col('Sma150'),
        'sma200': col('Sma200'),
        'volhigh': col('VolHigh')
    };

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        if (row.length < 5) continue;

        // 確保欄位存在才讀取
        const idIdx = keyMap.id;
        const nameIdx = keyMap.name;
        
        if (idIdx === -1 || nameIdx === -1) continue;

        const id = row[idIdx].replace('.TW', '');
        const name = row[nameIdx];

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
            
            if (keyMap.volhigh > -1 && row[keyMap.volhigh]) {
                stockObj.volhigh = row[keyMap.volhigh].split('/'); 
            }

            stockJson.data[id] = stockObj;
        }
    }

    // D. 注入 data-core.js
    injectDataToCore(stockJson);

    // E. 切換畫面與呼叫渲染
    if (dropZone) dropZone.style.display = 'none';
    if (reportContainer) reportContainer.classList.remove('hidden');
    
    // ★ 關鍵：呼叫 report-view.js 的主函式
    if (typeof renderReportView === 'function') {
        console.log("Calling renderReportView...");
        renderReportView(); 
    } else {
        console.error("renderReportView is not defined. Please check report-view.js");
        alert("錯誤：找不到列表渲染函式 (renderReportView)。請確認 report-view.js 是否已正確封裝。");
    }
}

// 4. 輔助函式：注入資料到 data-core
function injectDataToCore(stockJson) {
    if (!window.csvDates) window.csvDates = [];
    if (!window.stockNameMap) window.stockNameMap = {};
    if (!window.fullStockData) window.fullStockData = {};
    if (!window.csvStockData) window.csvStockData = {};
    if (!window.csvBigOrderData) window.csvBigOrderData = {};
    if (!window.csvCloseData) window.csvCloseData = {};
    if (!window.csvVolHighData) window.csvVolHighData = {};

    window.csvDates = stockJson.dates;
    window.stockNameMap = stockJson.names;

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

// 6. 防偽函式 (verifyCSV, parseXQSignature)
function parseXQSignature(fullString) {
    const HEADER = "TradeDate#";
    if (!fullString || !fullString.startsWith(HEADER)) {
        return { valid: false, message: "格式錯誤" };
    }
    const content = fullString.substring(HEADER.length);
    const MAP_DATE = "QwErTyUiOp";
    const MAP_ID   = "abcdefghij";

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

    let sigStr = "";
    for (let c of encSig) sigStr += decodeDigit(c);
    const signature = parseInt(sigStr, 10);

    let yyyy = ""; for (let c of encYYYY) yyyy += decodeDigit(c);
    let mmdd = ""; for (let c of encMMDD) mmdd += decodeDigit(c);
    const fullDate = yyyy + mmdd;
    const isPermanent = (fullDate === "13572468");

    const status = decodeDigit(encStatus);
    let isExpired = false;
    
    if (!isPermanent) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expDate = new Date(parseInt(yyyy), parseInt(mmdd.substring(0, 2)) - 1, parseInt(mmdd.substring(2)));
        if (expDate < today) {
            isExpired = true;
        }
    }

    let rawIDReversed = "";
    for (let c of encID) {
        const idx = MAP_ID.indexOf(c);
        if (idx > -1) rawIDReversed += idx.toString();
        else rawIDReversed += c;
    }
    const finalID = rawIDReversed.split("").reverse().join("");

    return {
        valid: true,
        signature: signature,
        userID: finalID,
        date: isPermanent ? "無期限" : `${yyyy}/${mmdd.substring(0,2)}/${mmdd.substring(2)}`,
        status: status, 
        statusText: (status === "1") ? "綁定戶" : "VIP",
        isExpired: isExpired,
        rawDate: fullDate
    };
}

function verifyCSV(headerString, firstDateValue) {
    const info = parseXQSignature(headerString);
    if (!info.valid) return false;

    const cleanDateStr = firstDateValue.replace(/\//g, "").replace(/-/g, "");
    const dataDate = parseInt(cleanDateStr, 10);
    const calculatedSig = (dataDate * 3 + 888) % 10000;

    return calculatedSig === info.signature;
}