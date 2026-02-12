// ==========================================
// script.js - v3.0 (IndexedDB Persistence)
// ==========================================

const DB_NAME = 'StockAppDB';
const STORE_NAME = 'csvData';
const DB_VERSION = 1;

// 1. 介面控制
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const errorMsg = document.getElementById('error-msg');
const reportContainer = document.getElementById('report-container');

// 初始化：檢查是否有庫存資料
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const savedData = await loadFromDB();
        if (savedData) {
            console.log("Found saved data in IndexedDB, loading...");
            // 恢復資料
            injectDataToCore(savedData);
            
            // 顯示 UI
            if (dropZone) dropZone.style.display = 'none';
            if (reportContainer) reportContainer.classList.remove('hidden');
            
            // 驗證並顯示身分 (雖然是舊資料，但還是顯示一下當初的簽章資訊)
            if (savedData.userInfo) {
                showUserStatus(savedData.userInfo, true); // true 表示顯示清除按鈕
            }

            // 呼叫渲染
            if (typeof renderReportView === 'function') {
                renderReportView();
            }
        }
    } catch (e) {
        console.log("No saved data or load error:", e);
    }
});

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
    
    // 顯示讀取中...
    if (dropZone) {
        const originalText = dropZone.innerHTML;
        dropZone.innerHTML = `<div class="text-blue-500 font-bold"><i class="fas fa-spinner fa-spin mr-2"></i>讀取與解析中...</div>`;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const success = await processCSV(e.target.result);
        if (!success && dropZone) {
             // 失敗還原 UI
             dropZone.innerHTML = `<i class="fas fa-cloud-upload-alt text-5xl text-blue-500 mb-4"></i><h2 class="text-2xl font-bold text-gray-700 mb-2">拖曳或點擊上傳 CSV</h2><p class="text-gray-400">支援 XS 選股匯出格式 (Big5)</p>`;
        }
    };
    // 強制 Big5 讀取 (符合 XQ 格式)
    reader.readAsText(file, 'Big5');
}

// 3. 核心處理
async function processCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    
    // A. 定位表頭
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
    
    let rawDateStr = lines[headerIndex + 1].split(',')[sigColIndex].trim().replace(/"/g, '');
    let firstDate = rawDateStr.includes('/') ? rawDateStr.split('/')[0] : rawDateStr;

    const isSafe = verifyCSV(headerString, firstDate);
    if (!isSafe) return showError("❌ 驗證失敗：防偽簽章不符");

    const userInfo = parseXQSignature(headerString);
    if (userInfo.isExpired) return showError(`❌ 權限已於 ${userInfo.date} 到期`);

    showUserStatus(userInfo, true);

    // C. 資料轉換
    const stockJson = {
        status: 'ok',
        mode: 'full',
        dates: rawDateStr.split('/'),
        names: {},
        data: {},
        userInfo: userInfo // 把 User Info 也存進去
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
            
            const parseArr = (idx) => {
                if (idx === -1 || !row[idx]) return [];
                return row[idx].split('/').map(v => parseFloat(v) || 0);
            };

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

    // D. 存入 IndexedDB (關鍵步驟)
    try {
        await saveToDB(stockJson);
        console.log("Data saved to IndexedDB");
    } catch (dbErr) {
        console.error("Failed to save to DB:", dbErr);
        // 存檔失敗不阻擋執行
    }

    // E. 注入並渲染
    injectDataToCore(stockJson);

    if (dropZone) dropZone.style.display = 'none';
    if (reportContainer) reportContainer.classList.remove('hidden');
    
    if (typeof renderReportView === 'function') {
        renderReportView(); 
    }

    return true;
}

// 4. 輔助函式：注入資料
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

// 5. IndexedDB 封裝 (Save/Load)
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
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

// 6. UI 輔助
function showError(msg) {
    if (errorMsg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    } else {
        alert(msg);
    }
    return false;
}

function showUserStatus(info, showResetBtn = false) {
    const el = document.getElementById('user-status');
    if (!el) return;
    
    // 直式卡片設計 (含重新上傳按鈕)
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

// 清除資料並重整
window.handleReset = async function() {
    if (confirm("確定要清除目前資料並重新上傳嗎？")) {
        await clearDB();
        location.reload();
    }
}

// 7. 防偽函式
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