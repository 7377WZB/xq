// ==========================================
// script.js - v4.0 (Non-destructive Loading)
// ==========================================

const DB_NAME = 'StockAppDB';
const STORE_NAME = 'csvData';
const DB_VERSION = 1;

// 1. 介面控制
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const errorMsg = document.getElementById('error-msg');
const reportContainer = document.getElementById('report-container');

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // A. 自動建立 Loading 遮罩 (如果還沒有的話)
    if (dropZone && !document.getElementById('loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'absolute inset-0 bg-white/95 flex flex-col items-center justify-center z-10 hidden rounded-xl';
        overlay.innerHTML = `
            <div class="text-blue-500 font-bold text-xl animate-pulse">
                <i class="fas fa-spinner fa-spin mr-2"></i>讀取與解析中...
            </div>
        `;
        // 確保 dropZone 是 relative 定位，讓遮罩能蓋在裡面
        if (!dropZone.classList.contains('relative')) dropZone.classList.add('relative');
        dropZone.appendChild(overlay);
    }

    try {
        const savedData = await loadFromDB();
        if (savedData) {
            console.log("Loading saved data...");
            injectDataToCore(savedData);
            if (dropZone) dropZone.style.display = 'none';
            if (reportContainer) reportContainer.classList.remove('hidden');
            if (savedData.userInfo) showUserStatus(savedData.userInfo, true);
            if (typeof renderReportView === 'function') renderReportView();
        }
    } catch (e) {
        console.log("No saved data:", e);
    }
});

// 事件監聽 (單一入口，不與 HTML 衝突)
if (dropZone && fileInput) {
    // 1. 拖曳
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500'); };
    dropZone.ondragleave = (e) => { e.preventDefault(); dropZone.classList.remove('border-blue-500'); };
    dropZone.ondrop = (e) => { 
        e.preventDefault(); 
        dropZone.classList.remove('border-blue-500'); 
        handleFile(e.dataTransfer.files[0]); 
    };
    
    // 2. 點擊區塊 -> 觸發 Input
    // (前提：index.html 必須移除 onclick，否則這裡會觸發第二次)
    dropZone.onclick = (e) => {
        // 避免點擊到遮罩或 input 自己時重複觸發
        if (e.target !== fileInput && !e.target.closest('#loading-overlay')) {
            fileInput.click();
        }
    };

    // 3. Input 阻斷冒泡 (防止回傳給 dropZone)
    fileInput.onclick = (e) => e.stopPropagation();
    
    // 4. 選檔變更
    fileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
            fileInput.value = ''; 
        }
    };
}

// 2. 檔案處理 (改用遮罩，不破壞 DOM)
function handleFile(file) {
    if (!file) return;
    if (errorMsg) errorMsg.classList.add('hidden');
    
    // 顯示遮罩
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = async (e) => {
        const success = await processCSV(e.target.result);
        
        // 如果失敗，隱藏遮罩讓使用者重試；如果成功，UI 會切換到報表
        if (!success && overlay) {
             overlay.classList.add('hidden');
        }
    };
    reader.readAsText(file, 'Big5');
}

// 3. 核心處理 (解析 CSV)
async function processCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    
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

    const sigColIndex = headers.findIndex(h => h.startsWith('TradeDate#'));
    const headerString = headers[sigColIndex];
    
    if (lines.length <= headerIndex + 1) return showError("❌ 檔案無資料");
    
    let rawDateStr = lines[headerIndex + 1].split(',')[sigColIndex].trim().replace(/"/g, '');
    let firstDate = rawDateStr.includes('/') ? rawDateStr.split('/')[0] : rawDateStr;

    const isSafe = verifyCSV(headerString, firstDate);
    if (!isSafe) return showError("❌ 驗證失敗：防偽簽章不符");

    const userInfo = parseXQSignature(headerString);
    if (userInfo.isExpired) return showError(`❌ 權限已於 ${userInfo.date} 到期`);

    showUserStatus(userInfo, true);

    const stockJson = {
        status: 'ok',
        mode: 'full',
        dates: rawDateStr.split('/'),
        names: {},
        data: {},
        userInfo: userInfo
    };

    const col = (name) => headers.findIndex(h => h === name || h === name.replace(/"/g, ''));
    
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

        const idIdx = keyMap.id;
        const nameIdx = keyMap.name;
        if (idIdx === -1 || nameIdx === -1) continue;

        const id = row[idIdx].replace('.TW', '');
        const name = row[nameIdx];

        if (id && name) {
            stockJson.names[id] = name;
            const stockObj = {};
            const parseArr = (idx) => (idx === -1 || !row[idx]) ? [] : row[idx].split('/').map(v => parseFloat(v) || 0);

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

    try { await saveToDB(stockJson); } catch (e) { console.error(e); }

    injectDataToCore(stockJson);

    if (dropZone) dropZone.style.display = 'none';
    if (reportContainer) reportContainer.classList.remove('hidden');
    
    if (typeof renderReportView === 'function') renderReportView();

    return true;
}

// 4. 輔助函式
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
        if (data[id].p_rank) window.csvStockData[id] = data[id].p_rank[0];
        if (data[id].v_rank) window.csvBigOrderData[id] = data[id].v_rank[0];
        if (data[id].close) window.csvCloseData[id] = data[id].close[0];
        if (data[id].volhigh) window.csvVolHighData[id] = data[id].volhigh[0];
    }
}

// 5. IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveToDB(data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(data, 'latest');
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function loadFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get('latest');
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function clearDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

// 6. UI Helpers
function showError(msg) {
    if (errorMsg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
        // 隱藏 Loading 遮罩
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('hidden');
    } else {
        alert(msg);
    }
    return false;
}

function showUserStatus(info, showResetBtn = false) {
    const el = document.getElementById('user-status');
    if (!el) return;
    
    let btnHtml = '';
    if (showResetBtn) {
        btnHtml = `
            <div class="w-full pt-2 border-t border-gray-100 mt-1">
                <button onclick="handleReset()" class="w-full text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 py-1 rounded transition-colors flex items-center justify-center gap-1">
                    <i class="fas fa-trash-alt"></i> 重新上傳
                </button>
            </div>
        `;
    }

    el.innerHTML = `
        <div class="bg-white/95 backdrop-blur p-3 rounded-xl shadow-lg border border-gray-200 flex flex-col items-center gap-2 w-32 transition-all hover:shadow-xl hover:scale-105">
            <div class="text-center w-full border-b border-gray-100 pb-2">
                <div class="text-[10px] text-gray-400 uppercase tracking-wider">User ID</div>
                <div class="font-bold text-gray-800 text-lg leading-tight font-mono">${info.userID}</div>
            </div>
            <div class="w-full text-center">
                <span class="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100">
                    ${info.statusText}
                </span>
            </div>
            <div class="text-center w-full pt-1">
                <div class="text-[10px] text-gray-400">EXPIRY</div>
                <div class="font-medium text-xs ${info.isExpired ? 'text-red-500' : 'text-green-600'}">
                    ${info.date}
                </div>
            </div>
            ${btnHtml}
        </div>
    `;
}

window.handleReset = async function() {
    if (confirm("確定要清除目前資料並重新上傳嗎？")) {
        await clearDB();
        location.reload();
    }
}

// 7. 防偽
function parseXQSignature(fullString) {
    const HEADER = "TradeDate#";
    if (!fullString || !fullString.startsWith(HEADER)) return { valid: false };
    
    // ... (保留原本的解碼邏輯) ...
    const content = fullString.substring(HEADER.length);
    const MAP_DATE = "QwErTyUiOp";
    const MAP_ID   = "abcdefghij";
    function decodeDigit(char) {
        const idx = MAP_DATE.indexOf(char);
        return idx > -1 ? idx.toString() : "?";
    }
    if (content.length < 13) return { valid: false };

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
        if (expDate < today) isExpired = true;
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