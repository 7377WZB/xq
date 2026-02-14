// ==========================================
// script.js - v7.0 (UX: Loading Overlay on Init)
// ==========================================

const DB_NAME = 'StockAppDB';
const DB_VERSION = 2;
const KEY_STOCK = 'stock_data';
const KEY_GROUP = 'group_data';

// 全域資料容器
window.dataContext = {
    stock: null,
    group: null
};

// 1. 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // ★ UX 優化：初始化開始時，顯示載入遮罩
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');

    try {
        // 模擬一個極短的延遲，讓 UI 有機會渲染遮罩 (避免主執行緒直接被佔滿導致畫面沒變)
        await new Promise(r => setTimeout(r, 50));

        const stockData = await loadFromDB(KEY_STOCK);
        const groupData = await loadFromDB(KEY_GROUP);

        if (stockData) window.dataContext.stock = stockData;
        if (groupData) window.dataContext.group = groupData;

    } catch (e) {
        console.log("DB Load Info:", e);
    } finally {
        if (typeof renderReportView === 'function') {
            renderReportView();
        }
        
        // ★ UX 優化：資料載入與渲染完成後，隱藏遮罩
        // 稍微延遲一點點，確保渲染完成的視覺感
        if (overlay) {
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 300);
        }
    }
    
    setupUploadHandlers();
});

// 2. 綁定單一 Input
function setupUploadHandlers() {
    const csvInput = document.getElementById('upload-csv');

    if (csvInput) {
        csvInput.onclick = (e) => e.stopPropagation();
        csvInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
                csvInput.value = ''; 
            }
        };
    }
}

// 3. 檔案處理
function handleFile(file) {
    if (!file) return;
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');

    // 給一點時間讓 UI 顯示遮罩
    setTimeout(() => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const detectedType = await processCSV(e.target.result);
            
            if (detectedType) {
                const label = detectedType === 'stock' ? '個股' : '族群';
                
                // 1. 先渲染畫面
                if (typeof renderReportView === 'function') {
                    renderReportView();
                }
                
                // 2. 切換 Tab
                if (typeof window.switchTab === 'function') {
                    window.switchTab(detectedType);
                } else if (window.g_viewState) {
                    window.g_viewState.activeTab = detectedType;
                    renderReportView();
                }

                alert(`成功匯入 ${label} 資料！`);
            } else {
                alert("檔案解析失敗或格式不符");
            }
            
            if (overlay) overlay.classList.add('hidden');
        };
        reader.readAsText(file, 'Big5');
    }, 50);
}

// 4. 核心解析
async function processCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    
    // 定位 Header
    let headerIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 20); i++) { 
        if (lines[i].includes('TradeDate#')) {
            headerIndex = i;
            break;
        }
    }
    if (headerIndex === -1) return false;

    // 解析 Header
    const headers = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // 尋找代碼欄位 Index
    const idColIndex = headers.findIndex(h => h === '代碼');
    if (idColIndex === -1) return false;

    // 自動判斷類型
    let type = null;
    if (lines.length > headerIndex + 1) {
        const firstRow = lines[headerIndex + 1].split(',');
        if (firstRow.length > idColIndex) {
            const firstId = firstRow[idColIndex].trim().replace(/"/g, '');
            if (/^\d/.test(firstId)) {
                type = 'stock';
            } else if (/^[IJ]/.test(firstId)) {
                type = 'group';
            } else {
                return false; 
            }
        }
    }
    if (!type) return false;

    // 解析日期欄位
    const sigColIndex = headers.findIndex(h => h.startsWith('TradeDate#'));
    const headerString = headers[sigColIndex];
    let rawDateStr = lines[headerIndex + 1].split(',')[sigColIndex].trim().replace(/"/g, '');
    const allDates = rawDateStr.split('/');
    
    // 計算日期範圍
    let dateRangeStr = "";
    if (allDates.length > 0) {
        const fmt = (s) => {
            if (!s || s.length !== 8) return s;
            return `${s.substring(0,4)}/${s.substring(4,6)}/${s.substring(6,8)}`;
        };
        const latestDate = fmt(allDates[0]); 
        const targetIndex = allDates.length - 1;
        const oldestDate = fmt(allDates[targetIndex]);
        dateRangeStr = `${oldestDate} ~ ${latestDate}`;
    }

    if (!verifyCSV(headerString, allDates[0])) {
        alert("防偽簽章驗證失敗");
        return false;
    }

    const userInfo = parseXQSignature(headerString);

    const resultJson = {
        updateTime: dateRangeStr,
        dates: allDates,
        names: {},
        data: {},
        userInfo: userInfo
    };

    // 建立 Key Map
    const col = (name) => headers.findIndex(h => h === name || h === name.replace(/"/g, ''));
    const keyMap = {
        'id': col('代碼'), 'name': col('商品'), 'open': col('Open'),
        'high': col('High'), 'low': col('Low'), 'close': col('Close'),
        'vol': col('Volume'), 'p_rank': col('PriceRank'), 'v_rank': col('VolRank'),
        'sma20': col('Sma20'), 'sma50': col('Sma50'), 'sma150': col('Sma150'),
        'sma200': col('Sma200'), 'volhigh': col('VolHigh')
    };

    // 解析資料
    for (let i = headerIndex + 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        if (row.length < 5) continue;

        const id = row[keyMap.id].replace('.TW', '');
        const name = row[keyMap.name];

        if (id && name) {
            resultJson.names[id] = name;
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
            resultJson.data[id] = stockObj;
        }
    }

    // 儲存至全域與 DB
    window.dataContext[type] = resultJson;
    try {
        const key = (type === 'stock') ? KEY_STOCK : KEY_GROUP;
        await saveToDB(key, resultJson);
    } catch (e) { console.error(e); }

    return type;
}

// 5. IndexedDB (保持不變)
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('appData')) db.createObjectStore('appData');
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveToDB(key, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('appData', 'readwrite');
        const store = tx.objectStore('appData');
        store.put(data, key);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function loadFromDB(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('appData', 'readonly');
        const store = tx.objectStore('appData');
        const request = store.get(key);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// 6. 簽章解析與 Google Sheet 寫入
function parseXQSignature(fullString) {
    const HEADER = "TradeDate#";
    if (!fullString || !fullString.startsWith(HEADER)) return { valid: false };
    const content = fullString.substring(HEADER.length);
    const MAP_DATE = "QwErTyUiOp"; const MAP_ID = "abcdefghij";
    function decodeDigit(char) { const idx = MAP_DATE.indexOf(char); return idx > -1 ? idx.toString() : "?"; }
    
    const encStatus = content.substring(4, 5); 
    const encMMDD   = content.substring(5, 9); 
    const encYYYY   = content.substring(content.length - 4); 
    const encID     = content.substring(9, content.length - 4); 

    let yyyy = ""; for (let c of encYYYY) yyyy += decodeDigit(c);
    let mmdd = ""; for (let c of encMMDD) mmdd += decodeDigit(c);
    
    let rawIDReversed = "";
    for (let c of encID) {
        const idx = MAP_ID.indexOf(c);
        if (idx > -1) rawIDReversed += idx.toString(); else rawIDReversed += c;
    }
    const finalID = rawIDReversed.split("").reverse().join("");

    return {
        valid: true,
        userID: finalID,
        date: `${yyyy}/${mmdd.substring(0,2)}/${mmdd.substring(2)}`,
        statusText: (decodeDigit(encStatus) === "1") ? "綁定戶" : "VIP",
        isExpired: false 
    };
}

// ★ 修正：恢復寫入 Google Sheet 的功能
function verifyCSV(headerString, firstDateValue) {
    // 1. 解析資訊
    const userInfo = parseXQSignature(headerString);
    
    // 2. 準備要傳送的 payload
    const payload = {
        header: headerString,
        firstDate: firstDateValue,
        // 如果解析成功，直接傳送解析後的資料，方便後端紀錄
        parsed: userInfo.valid ? userInfo : null
    };

    // 3. 發送到 Google Apps Script
    // ★ 請務必將下方的網址換成您自己的 Web App URL
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz22VvtHXw5aeOpPeUXUBc7xir6RmUpDfZLLj6E_B5vyGzZVf2BqGJRxNpvDluMgU2P/exec"; 

    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // 重要：避免跨域錯誤
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(() => {
        console.log("Log sent to Google Sheet");
    }).catch(err => {
        console.error("Log failed", err);
    });

    return true; // 保持回傳 true 讓程式繼續執行
}