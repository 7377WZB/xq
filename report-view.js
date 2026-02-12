function renderReportView() {
        
    const FREEZE_STATUS_COL = true;
    let DISPLAY_LIMIT = 20;
    const LINK_ICON = '<span style="font-size: 12px; padding: 0 2px; border: 1px gray solid; cursor: pointer;">↗</span>'; 

    // 用來記憶捲軸位置的全域變數
    let historyScrollPos = {};

    // ★★★ 呼叫獨立模組開啟 K 線圖 ★★★
    function openKLineChart(id) {
        // 嘗試從記憶體或 DOM 取得名稱，讓標題更完整
        let name = '';
        // 如果是個股
        if (window.stockNameMap && window.stockNameMap[id]) name = window.stockNameMap[id];
        // 如果是族群
        else if (window.groupNames && window.groupNames[id]) name = window.groupNames[id];
        
        // 呼叫 trend-modal.js 的公開方法
        if (window.TrendModal) {
            window.TrendModal.open(id, name);
        } else {
            alert("錯誤：TrendModal 模組尚未載入");
        }
    }

    // ★★★ 無縫切換頁面處理函式 (SPA 核心 + 捲軸記憶) ★★★
    function handlePageSwitch(id, name, type) {
        // 1. 紀錄當下捲軸位置 (以當前 URL 為 Key)
        const currentKey = window.location.search || 'home';
        historyScrollPos[currentKey] = window.scrollY;

        // 2. 修改網址列 (不刷新頁面)
        const url = new URL(window.location);
        if (type === 'group') {
            url.searchParams.delete('stock_id');
            url.searchParams.set('group_id', id);
        } else {
            url.searchParams.delete('group_id');
            url.searchParams.set('stock_id', id);
        }
        window.history.pushState({}, '', url);

        // 3. 執行切換邏輯
        if (type === 'group') {
            if (typeof window.loadGroupDirectly === 'function') {
                window.loadGroupDirectly(id);
            } else {
                window.location.reload(); 
            }
        } else {
            restoreDashboardUI();
            if (typeof window.loadStockDirectly === 'function') {
                window.loadStockDirectly(id);
            } else if (typeof window.checkAndLoad === 'function') {
                window.checkAndLoad(); 
            } else {
                window.location.reload(); 
            }
        }
        
        // 切換後回到頂部
        window.scrollTo(0, 0);
    }

    // ★★★ 新增：監聽瀏覽器「上一頁/下一頁」按鈕 (popstate) ★★★
    window.addEventListener("popstate", function(e) {
        const urlParams = new URLSearchParams(window.location.search);
        const groupId = urlParams.get('group_id');
        const stockId = urlParams.get('stock_id');
        
        // 準備還原捲軸的 Key
        const restoreKey = window.location.search || 'home';

        if (groupId) {
            // 回到族群頁
            if (typeof window.loadGroupDirectly === 'function') {
                // 注意：因為 loadGroupDirectly 內部有非同步 fetch，這裡只能盡量還原
                // 若要精準還原，需要改寫 loadGroupDirectly 回傳 Promise，這裡先做基本處理
                window.loadGroupDirectly(groupId); 
            }
        } else if (stockId) {
            // 回到個股頁
            restoreDashboardUI();
            if (typeof window.loadStockDirectly === 'function') {
                window.loadStockDirectly(stockId);
            }
        } else {
            // 回到首頁 (無參數)
            restoreDashboardUI();
            if (typeof window.checkAndLoad === 'function') window.checkAndLoad();
        }

        // 嘗試還原捲軸位置 (給予一點延遲等待 DOM 渲染)
        setTimeout(() => {
            if (historyScrollPos[restoreKey] !== undefined) {
                window.scrollTo(0, historyScrollPos[restoreKey]);
            }
        }, 100); 
    });

    // ★★★ 輔助：還原首頁 UI ★★★
    function restoreDashboardUI() {
        const view = document.getElementById("group-report-view");
        if (view) view.remove();

        ['dashboard', 'dashboard-right', 'dashboard-calc'].forEach(did => {
            const el = document.getElementById(did);
            if (el) el.style.display = 'block';
        });
        
        const iframe = document.getElementById("stockFrame");
        if (iframe) iframe.style.display = 'block';

        const bottom = document.getElementById("bottom");
        if (bottom) bottom.style.marginLeft = "240px"; 
    }

    function generateNameCellHtml(id, name, type) {
        const kLineHtml = `<span style="cursor:pointer; margin-right:5px; font-size:1.1em;" onclick="openKLineChart('${id}')" title="K線圖">📈</span>`;

        const displayId = String(id).replace('.TW', '');
        const copyText = displayId.includes('.TW') ? displayId : `${displayId}.TW`; 
        const idHtml = `<span style="cursor:pointer; color:#1877F2; margin-right:5px; font-weight:bold;" onclick="copyToClipboard('${copyText}', this)" title="複製 ${copyText}">${displayId}</span>`;

        const nameHtml = `<span style="cursor:pointer; color:#000; margin-right:5px; font-weight:bold;" onclick="handlePageSwitch('${displayId}', '${name}', '${type}')" title="切換至 ${name}">${name}</span>`;

        const paramKey = (type === 'group') ? 'group_id' : 'stock_id';
        const linkHtml = `<a href="?${paramKey}=${displayId}" target="_blank" style="text-decoration:none; color:#555; cursor:pointer;" onclick="event.stopPropagation();">${LINK_ICON}</a>`;

        return `<td class="col-fixed" style="white-space:nowrap;">
            ${kLineHtml}
            ${idHtml}
            ${nameHtml}
            ${linkHtml}
        </td>`;
    }

    const SCROLLBAR_STYLE = `
    <style>
        .table-container::-webkit-scrollbar { height: 24px; }
        .table-container::-webkit-scrollbar-track { background: #f8f9fa; border-top: 1px solid #eee; }
        .table-container::-webkit-scrollbar-thumb {
            background-color: #bdc3c7; border-radius: 10px; border: 5px solid transparent;
            background-clip: content-box; transition: background-color 0.2s;
        }
        .table-container::-webkit-scrollbar-thumb:hover { background-color: #95a5a6; }
    </style>
    `;

    const STATUS_COL_STYLE = `
        min-width: 250px; max-width: 500px; white-space: normal; word-wrap: break-word; font-size: 1.2em; color: #555;
        text-align: left; padding: 5px 10px; line-height: 1.4; border-right: 1px solid #eee;
        ${FREEZE_STATUS_COL ? 'position:sticky; left:110px; z-index:5; background:#fff; border-right:2px solid #ddd;' : ''}
    `;

    const STATUS_HEADER_STYLE = `
        min-width: 100px;
        ${FREEZE_STATUS_COL ? 'position:sticky; left:110px; z-index:20; background:#f1f1f1; border-right:2px solid #ddd;' : ''}
    `;

    let currentReportState = {
        viewMode: 'single', 
        activeGroup: null,
        baseDateIndex: 0, 
        sortColIndex: null, 
        sortDir: 'desc',
        dateOrder: 'new_to_old', 
        pricePrMin: 0,   pricePrMax: 100,
        volPrMin: 80,    volPrMax: 100,
        dataType: 'price',      
        sortSource: 'price',
        renderedRows: [],       
        isSnapshotMode: false   
    };

    async function getSharedStockDetails() {
        if (window.globalStockDetailsCache) return window.globalStockDetailsCache;
        if (window.parent && window.parent.GLOBAL_STATUS_CACHE) {
            window.globalStockDetailsCache = window.parent.GLOBAL_STATUS_CACHE;
            return window.globalStockDetailsCache;
        }
        try {
            const data = await API.getAllStockDetails();
            window.globalStockDetailsCache = data;
            if (window.parent) window.parent.GLOBAL_STATUS_CACHE = data;
            return data;
        } catch (e) {
            console.error("Fetch Details Error", e);
            return [];
        }
    }

    function copyToClipboard(text, el) {
        if (!text) return;
        const showSuccess = () => {
            const originalColor = el.style.color;
            const originalWeight = el.style.fontWeight;
            el.style.color = '#4CAF50'; el.style.fontWeight = 'bold';
            const oldTitle = el.getAttribute('title');
            el.setAttribute('title', '已複製！');
            setTimeout(() => {
                el.style.color = originalColor; el.style.fontWeight = originalWeight; el.setAttribute('title', oldTitle || '');
            }, 600);
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(showSuccess).catch(() => fallbackCopyTextToClipboard(text, showSuccess));
        } else {
            fallbackCopyTextToClipboard(text, showSuccess);
        }
    }

    function fallbackCopyTextToClipboard(text, onSuccess) {
        var textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0"; textArea.style.left = "0"; textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus(); textArea.select();
        try {
            if (document.execCommand('copy') && onSuccess) onSuccess();
        } catch (err) { alert('複製失敗'); }
        document.body.removeChild(textArea);
    }

    function normalizeId(id) { return id ? id.toString().replace('.TW', '').trim() : ""; }

    function getDateIndices() {
        const total = window.csvDates ? window.csvDates.length : 0;
        const n = Math.min(total, DISPLAY_LIMIT); 
        
        const indices = [];
        if (currentReportState.dateOrder === 'new_to_old') {
            for (let i = 0; i < n; i++) indices.push(i);
        } else {
            for (let i = n - 1; i >= 0; i--) indices.push(i);
        }
        return indices;
    }

    function getLatestDateIndex() {
        return 0; 
    }

    function getCurrentDisplayData(id, isGroup = false) {
        const type = currentReportState.dataType;
        if (isGroup) {
            if (type === 'vol_high') return window.csvGroupVolHighData?.[id];
            return type === 'big_order' ? (window.csvGroupBigOrderData?.[id]) : (window.csvGroupData?.[id]);
        } else {
            if (type === 'vol_high') return window.csvVolHighData?.[id];
            return type === 'big_order' ? (window.csvBigOrderData?.[id]) : (window.csvStockData?.[id]);
        }
    }

    function getDataForSorting(id, isGroup = false) {
        const type = currentReportState.sortSource; 
        if (isGroup) {
            if (type === 'vol_high') return window.csvGroupVolHighData?.[id];
            return type === 'big_order' ? (window.csvGroupBigOrderData?.[id]) : (window.csvGroupData?.[id]);
        } else {
            if (type === 'vol_high') return window.csvVolHighData?.[id];
            return type === 'big_order' ? (window.csvBigOrderData?.[id]) : (window.csvStockData?.[id]);
        }
    }

    function getHeatmapStyle(val) {
        if (val === null || val === undefined || isNaN(val)) return "";
        
        const v = parseFloat(val);

        if (v >= 97) {
            return "background-color: #C71585; color: #fff; font-size: 1.3em; font-weight: 900;";
        }

        let r, g, b, textColor;
        const BASE = 230; 

        if (v >= 50) {
            const ratio = (v - 50) / 50; 
            r = 255; 
            g = Math.round(BASE - ((BASE - 60) * ratio)); 
            b = Math.round(BASE - ((BASE - 60) * ratio));
            textColor = (v >= 85) ? '#fff' : '#333';
        } else {
            const ratio = (50 - v) / 50; 
            r = Math.round(BASE - ((BASE - 40) * ratio)); 
            g = Math.round(BASE - ((BASE - 160) * ratio)); 
            b = Math.round(BASE - ((BASE - 40) * ratio));
            textColor = (v <= 15) ? '#fff' : '#333';
        }
        return `background-color: rgb(${r},${g},${b}); color: ${textColor};`;
    }

    function getSparklineHtml(data1, data2, width = 250, height = 40) {
        if ((!data1 || !data1.length) && (!data2 || !data2.length)) return "";
        
        const d1 = data1 ? [...data1].slice(0, DISPLAY_LIMIT).reverse() : [];
        const d2 = data2 ? [...data2].slice(0, DISPLAY_LIMIT).reverse() : [];
        
        const len = Math.max(d1.length, d2.length);
        if (len < 2) return "";
        const getCoords = (val, i) => {
            if (val === null || isNaN(val)) return null;
            // ★ 修改：分母改為 120，避免數值 100 時頂到天花板
            return { x: (i / (len - 1)) * width, y: height - (val / 100) * height };
        };
        const points1 = d1.map((v, i) => { const c = getCoords(v, i); return c ? `${c.x},${c.y}` : null; }).filter(p=>p).join(" ");
        const points2 = d2.map((v, i) => { const c = getCoords(v, i); return c ? `${c.x},${c.y}` : null; }).filter(p=>p).join(" ");
        let lastP1 = d1.length > 0 ? getCoords(d1[d1.length - 1], d1.length - 1) : null;

        return `<svg width="${width}" height="${height}" style="vertical-align: middle; overflow: visible;">
                <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" stroke="none"></rect>
                <line x1="0" y1="${height/2}" x2="${width}" y2="${height/2}" stroke="#999" stroke-dasharray="2" stroke-width="1"></line>
                <polyline points="${points2}" fill="none" stroke="#2196F3" stroke-width="1.5" stroke-dasharray="3,2" stroke-opacity="0.8" />
                <polyline points="${points1}" fill="none" stroke="#FF5722" stroke-width="2" stroke-opacity="1" />
                ${ lastP1 ? `<circle cx="${lastP1.x}" cy="${lastP1.y}" r="3" fill="#FF5722" />` : '' }
            </svg>`;
    }

    function toggleDataType(type) {
        if (currentReportState.dataType === type) return;
        currentReportState.dataType = type;
        currentReportState.isSnapshotMode = true;
        currentReportState.sortColIndex = null;
        currentReportState.sortDir = null;
        renderBreadcrumb();
        window.refreshGroupReportView();
    }

    function toggleDateOrder() {
        currentReportState.dateOrder = (currentReportState.dateOrder === 'new_to_old') ? 'old_to_new' : 'new_to_old';
        renderBreadcrumb();
        window.refreshGroupReportView();
    }

    function toggleSort(colIndex) {
        currentReportState.isSnapshotMode = false;
        currentReportState.sortSource = currentReportState.dataType;
        
        if (typeof colIndex === 'number') {
            currentReportState.baseDateIndex = colIndex;
        }

        if (currentReportState.sortColIndex === colIndex) {
            currentReportState.sortDir = (currentReportState.sortDir === 'desc') ? 'asc' : 'desc';
        } else {
            currentReportState.sortColIndex = colIndex;
            currentReportState.sortDir = 'desc';
        }
        
        window.refreshGroupReportView();
    }

    function loadGroupReportView(groupIndex) {
        const groupInfo = window.currentGroupData[groupIndex];
        if (!groupInfo) return;
        
        currentReportState.viewMode = 'single';
        currentReportState.activeGroup = groupInfo;
        currentReportState.isSnapshotMode = false; 
        
        currentReportState.sortColIndex = getLatestDateIndex();
        currentReportState.sortDir = 'desc';
        currentReportState.dateOrder = 'new_to_old';
        currentReportState.dataType = 'big_order';   
        currentReportState.sortSource = 'big_order'; 

        document.title = `${groupInfo.name} - 台股戰情室`;
        prepareEnvironment();
        renderBreadcrumb();
        renderSingleGroupTable();
    }

    window.loadGroupDirectly = function(groupId) {
        const cleanId = normalizeId(groupId);
        let gName = (window.groupNames && window.groupNames[cleanId]) ? window.groupNames[cleanId] : cleanId;

        currentReportState.viewMode = 'single';
        currentReportState.activeGroup = { id: cleanId, name: gName, stocks: [] };
        currentReportState.isSnapshotMode = false; 
        
        currentReportState.sortColIndex = getLatestDateIndex();
        currentReportState.sortDir = 'desc';
        currentReportState.dateOrder = 'new_to_old';
        currentReportState.dataType = 'big_order';   
        currentReportState.sortSource = 'big_order'; 

        prepareEnvironment();
        renderBreadcrumb(); 
        const container = document.getElementById("report-table-container");
        container.innerHTML = '<div style="padding:20px; text-align:center;"><div class="spinner" style="display:inline-block;"></div> 正在讀取族群資料...</div>';

        fetch(`proxy.php?mode=group_members&id=${cleanId}`).then(r=>r.json()).then(stocks=>{
            currentReportState.activeGroup.stocks = stocks;
            if (window.groupNames && window.groupNames[cleanId]) currentReportState.activeGroup.name = window.groupNames[cleanId];
            document.title = `${currentReportState.activeGroup.name} - 台股戰情室`;
            renderBreadcrumb(); 
            renderSingleGroupTable();
        }).catch(e=>{
            console.error(e);
            container.innerHTML = '<div style="padding:20px; color:red;">讀取失敗</div>';
        });
    };

    function loadAllGroupsOverview() {
        currentReportState.viewMode = 'all_groups';
        currentReportState.activeGroup = null;
        currentReportState.isSnapshotMode = false; 
        
        currentReportState.sortColIndex = getLatestDateIndex();
        currentReportState.sortDir = 'desc';
        
        currentReportState.dateOrder = 'new_to_old';
        currentReportState.dataType = 'big_order';   
        currentReportState.sortSource = 'big_order'; 

        // ★ 新增：更新上方標題顯示
        const nameDisplay = document.getElementById("stockNameDisplay");
        if (nameDisplay) nameDisplay.innerText = "總覽：族群、個股、成份股";

        document.title = "族群總覽 - 台股戰情室";
        prepareEnvironment();
        renderBreadcrumb();
        renderAllGroupsTable();
    }

    async function loadAllStocksOverview() {
        currentReportState.viewMode = 'all_stocks';
        currentReportState.activeGroup = null;
        currentReportState.isSnapshotMode = false; 
        
        currentReportState.sortColIndex = getLatestDateIndex(); 
        currentReportState.sortDir = 'desc';                    
        
        currentReportState.dateOrder = 'new_to_old';
        
        currentReportState.dataType = 'big_order';   
        currentReportState.sortSource = 'big_order'; 
        
        currentReportState.volPrMin = 95;   
        currentReportState.volPrMax = 100;
        currentReportState.pricePrMin = 0; 
        currentReportState.pricePrMax = 100;

        document.title = "個股總覽 - 台股戰情室";

        prepareEnvironment();
        renderBreadcrumb();
        const container = document.getElementById("report-table-container");
        container.innerHTML = '<div style="padding:40px; text-align:center;"><div class="spinner" style="display:inline-block;"></div> 資料讀取與運算中...</div>';
        try {
            const details = await getSharedStockDetails();
            renderAllStocksTable(details); 
        } catch(e) {
            console.error(e);
            container.innerHTML = '<div style="padding:20px; color:red;">讀取失敗，請重試</div>';
        }
    }

    function loadGroupFromOverview(id, name) {}

    function updatePrFilter() {
        const pMin = document.getElementById('price-pr-min');
        const pMax = document.getElementById('price-pr-max');
        const vMin = document.getElementById('vol-pr-min');
        const vMax = document.getElementById('vol-pr-max');

        if (pMin) currentReportState.pricePrMin = parseFloat(pMin.value) || 0;
        if (pMax) currentReportState.pricePrMax = parseFloat(pMax.value) || 100;
        if (vMin) currentReportState.volPrMin = parseFloat(vMin.value) || 0;
        if (vMax) currentReportState.volPrMax = parseFloat(vMax.value) || 100;
        
        currentReportState.isSnapshotMode = false;
        
        if (currentReportState.viewMode === 'all_stocks') {
            getSharedStockDetails().then(details => renderAllStocksTable(details));
        }
    }

    function prepareEnvironment() {
        if (typeof closeModal === 'function') closeModal();
        const bottomDiv = document.getElementById("bottom");
        document.getElementById("stockFrame").style.display = "none";
        if (document.getElementById("dashboard")) document.getElementById("dashboard").style.display = "none";
        if (document.getElementById("dashboard-right")) document.getElementById("dashboard-right").style.display = "none";
        if (document.getElementById("dashboard-calc")) document.getElementById("dashboard-calc").style.display = "none";
        bottomDiv.style.marginLeft = "0";
        const oldView = document.getElementById("group-report-view");
        if (oldView) oldView.remove();
        bottomDiv.insertAdjacentHTML('beforeend', SCROLLBAR_STYLE + `<div id="group-report-view"><div class="report-header" id="report-breadcrumb" style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px; border-bottom:1px solid #ccc;"></div><div class="table-container" id="report-table-container"></div></div>`);
    }

    function renderBreadcrumb() {
        const container = document.getElementById("report-breadcrumb");
        if (!container) return;
        const linkStyle = "cursor:pointer; color:#0056b3; text-decoration:none;";
        const sep = "<span style='color:#999; margin:0 5px;'>/</span>";
        
        let leftHtml = `<div style="display:flex; align-items:center;"><span onclick="restoreMainView()" style="${linkStyle}">首頁</span>${sep}`;
        
        if (currentReportState.viewMode === 'all_groups') {
            leftHtml += ` <span style="font-weight:bold; color:#333;">族群總覽</span>`;
            leftHtml += `<span style="margin-left:20px;"><button onclick="loadAllStocksOverview()" style="padding:4px 10px; font-size:0.9em; cursor:pointer; background:#28A745; color:white; border:none; border-radius:4px;">⇆ 切換：個股總覽</button></span>`;
        } else if (currentReportState.viewMode === 'all_stocks') {
            leftHtml += `<span onclick="loadAllGroupsOverview()" style="${linkStyle}">族群總覽</span>${sep}<span style="font-weight:bold; color:#333;">個股總覽</span>`;
        } else {
            leftHtml += `<span onclick="loadAllGroupsOverview()" style="${linkStyle}">族群總覽</span>`;
            if (currentReportState.activeGroup) {
                const g = currentReportState.activeGroup;
                const idText = `${g.id}.TW`;
                leftHtml += `${sep} <span style="font-weight:bold; color:#333; display:inline-flex; align-items:center;">`;
                
                // ★ 修改：📊 圖示可點擊 -> 開啟 K 線圖
                leftHtml += `<span onclick="openKLineChart('${g.id}')" style="cursor:pointer; margin-right:4px; font-size:1.1em;" title="開啟K線圖">📊</span>`;
                
                leftHtml += `<span onclick="copyToClipboard('${idText}', this)" title="點擊複製代碼" style="color:red; cursor:pointer; margin:0 3px;">${idText}</span>`;
                leftHtml += `<span onclick="copyToClipboard('${g.name}', this)" title="點擊複製名稱" style="color:#333; cursor:pointer; margin:0 3px;">${g.name}</span></span>`;
            }
        }
        leftHtml += `</div>`;

        const activeStyle = "background:#FFA500; color:#000; border:1px solid #e69500; font-weight:bold;";
        const normalStyle = "background:#f9f9f9; color:#555; border:1px solid #ddd;";
        const btnBase = "cursor:pointer; font-size:0.9em; padding:4px 8px; border-radius:4px; text-decoration:none; margin-left:5px;";

        let rightHtml = `<div style="display:flex; align-items:center; gap:10px;">`;

        if (currentReportState.viewMode === 'all_stocks') {
            const inputStyle = "width:40px; padding:2px; text-align:center; border:1px solid #ccc; border-radius:4px;";
            
            rightHtml += `<div style="font-size:0.9em; color:#555; display:flex; align-items:center; gap:8px;">
                <div style="display:flex; align-items:center; background:#ffe5e5; padding:2px 5px; border-radius:4px;">
                    <label style="margin-right:3px; font-weight:bold;">價PR:</label>
                    <input type="number" id="price-pr-min" value="${currentReportState.pricePrMin}" onchange="updatePrFilter()" style="${inputStyle}">
                    <span style="margin:0 2px;">-</span>
                    <input type="number" id="price-pr-max" value="${currentReportState.pricePrMax}" onchange="updatePrFilter()" style="${inputStyle}">
                </div>

                <div style="display:flex; align-items:center; background:#e5e5ff; padding:2px 5px; border-radius:4px;">
                    <label style="margin-right:3px; font-weight:bold;">量PR:</label>
                    <input type="number" id="vol-pr-min" value="${currentReportState.volPrMin}" onchange="updatePrFilter()" style="${inputStyle}">
                    <span style="margin:0 2px;">-</span>
                    <input type="number" id="vol-pr-max" value="${currentReportState.volPrMax}" onchange="updatePrFilter()" style="${inputStyle}">
                </div>
            </div>`;
        }

        rightHtml += `
            <div style="display:flex; border:1px solid #ccc; border-radius:4px; overflow:hidden; margin-right:10px;">
                <button onclick="switchLimit(20)" style="padding:4px 8px; border:none; cursor:pointer; ${DISPLAY_LIMIT===20?'background:#007bff;color:#fff;':'background:#fff;color:#333;'}">20</button>
                <button onclick="switchLimit(50)" style="padding:4px 8px; border-left:1px solid #ccc; border-top:none; border-bottom:none; border-right:none; cursor:pointer; ${DISPLAY_LIMIT===50?'background:#007bff;color:#fff;':'background:#fff;color:#333;'}">50</button>
                <button onclick="switchLimit(100)" style="padding:4px 8px; border-left:1px solid #ccc; border-top:none; border-bottom:none; border-right:none; cursor:pointer; ${DISPLAY_LIMIT===100?'background:#007bff;color:#fff;':'background:#fff;color:#333;'}">100</button>
                <button onclick="switchLimit(200)" style="padding:4px 8px; border-left:1px solid #ccc; border-top:none; border-bottom:none; border-right:none; cursor:pointer; ${DISPLAY_LIMIT===200?'background:#007bff;color:#fff;':'background:#fff;color:#333;'}">200</button>
            </div>
        `;

        rightHtml += `<div style="display:flex;">
            <a onclick="toggleDataType('price')" style="${btnBase} ${currentReportState.dataType === 'price' ? activeStyle : normalStyle}">價 PR</a>
            <a onclick="toggleDataType('big_order')" style="${btnBase} ${currentReportState.dataType === 'big_order' ? activeStyle : normalStyle}">量 PR</a>
            <a onclick="toggleDataType('vol_high')" style="${btnBase} ${currentReportState.dataType === 'vol_high' ? activeStyle : normalStyle}">量創高</a>
        </div>`;

        const orderText = currentReportState.dateOrder === 'new_to_old' ? '日期：新 → 舊' : '日期：舊 → 新';
        rightHtml += `<a onclick="toggleDateOrder()" style="${btnBase} background:#f9f9f9;">⇆ ${orderText}</a></div>`;
        container.innerHTML = leftHtml + rightHtml;
    }

    function sortData(items, type) {
        if (currentReportState.sortColIndex === null) return items;
        const idx = currentReportState.sortColIndex;
        const dir = currentReportState.sortDir === 'desc' ? -1 : 1;
        return items.sort((a, b) => {
            let dataA, dataB;
            if (type === 'stock') {
                dataA = getDataForSorting(a.id, false); dataB = getDataForSorting(b.id, false);
            } else {
                dataA = getDataForSorting(normalizeId(a.id), true); dataB = getDataForSorting(normalizeId(b.id), true);
            }
            let valA, valB;
            if (idx === 'pct_change') {
                valA = calculatePct(normalizeId(a.id), type === 'group');
                valB = calculatePct(normalizeId(b.id), type === 'group');
                if (valA === null) valA = -999999; 
                if (valB === null) valB = -999999;
            } else {
                valA = (dataA && dataA[idx] !== null) ? dataA[idx] : -999;
                valB = (dataB && dataB[idx] !== null) ? dataB[idx] : -999;
            }
            return (valA - valB) * dir;
        });
    }

    function renderSingleGroupTable() {
        const groupInfo = currentReportState.activeGroup;
        if (!groupInfo) return;
        const container = document.getElementById("report-table-container");
        const dateIndices = getDateIndices();
        let tableHtml = generateTableHeader(dateIndices, true);

        const dataId = normalizeId(groupInfo.id);
        const groupData = getCurrentDisplayData(dataId, true);
        
        let gpData = window.csvGroupData[dataId] ? window.csvGroupData[dataId] : [];
        let gbData = window.csvGroupBigOrderData[dataId] ? window.csvGroupBigOrderData[dataId] : [];
        let groupChartHtml = getSparklineHtml(gpData, gbData, 250, 40);

        const groupPctVal = calculatePct(dataId, true);
        const groupPctHtml = getPctHtml(groupPctVal);

        tableHtml += `<tr style="background:#fff3e0; font-weight:bold; border-bottom:5px solid #000;">
            <td class="col-fixed" style="background: #000; color: #fff">★ <span style="cursor:pointer;" onclick="copyToClipboard('${groupInfo.name}', this)" title="點擊複製">${groupInfo.name}</span></td>
            <td style="${STATUS_COL_STYLE}"></td>
            <td style="padding:0; text-align:center; background:#fff;">${groupChartHtml}</td>
            ${groupPctHtml} `;
            
        if (groupData) dateIndices.forEach(idx => tableHtml += getCellHtml(groupData[idx], idx));
        else tableHtml += `<td colspan="${dateIndices.length}" style="color:#888;">-</td>`;
        tableHtml += `</tr>`;

        let displayStocks = [];
        
        if (currentReportState.isSnapshotMode && currentReportState.renderedRows) {
            displayStocks = currentReportState.renderedRows;
        } else {
            displayStocks = [...(groupInfo.stocks || [])];
            if (displayStocks.length > 0) displayStocks = sortData(displayStocks, 'stock');
            currentReportState.renderedRows = displayStocks; 
        }

        if (displayStocks.length > 0) {
            displayStocks.forEach(stock => {
                let statusText = stock.status || "";
                if (window.stockInfoMap && window.stockInfoMap[stock.id]) {
                    statusText = window.stockInfoMap[stock.id].s || statusText;
                }

                const displayData = getCurrentDisplayData(stock.id, false);
                let pData = window.csvStockData[stock.id] || [];
                let bData = window.csvBigOrderData[stock.id] || [];
                let chartHtml = getSparklineHtml(pData, bData, 250, 40);

                const stockPctVal = calculatePct(stock.id, false);
                const stockPctHtml = getPctHtml(stockPctVal);

                const nameCell = generateNameCellHtml(stock.id, stock.name, 'stock');

                tableHtml += `<tr>
                    ${nameCell}
                    <td style="${STATUS_COL_STYLE}">${statusText}</td>
                    <td style="padding:0; text-align:center; background:#fff;">${chartHtml}</td>
                    ${stockPctHtml} `;
                
                if (displayData) dateIndices.forEach(idx => tableHtml += getCellHtml(displayData[idx], idx));
                else tableHtml += `<td colspan="${dateIndices.length}" style="color:#ccc;">-</td>`;
                tableHtml += `</tr>`;
            });
        } else tableHtml += `<tr><td colspan="20" style="padding:20px; text-align:center;">無成分股資料</td></tr>`;

        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    }

    function renderAllStocksTable(details) {
        const container = document.getElementById("report-table-container");
        const stockList = details || window.globalStockDetailsCache;

        if (!stockList) return;
        const dateIndices = getDateIndices();
        let tableHtml = generateTableHeader(dateIndices, true);

        let filteredStocks = [];

        if (currentReportState.isSnapshotMode && currentReportState.renderedRows) {
            filteredStocks = currentReportState.renderedRows;
        } else {
            const latestDateIdx = getLatestDateIndex();
            stockList.forEach(stock => {
                const priceData = window.csvStockData[stock.id];
                const volData = window.csvBigOrderData[stock.id];

                const pVal = (priceData && priceData[latestDateIdx] !== null) ? priceData[latestDateIdx] : -1;
                const vVal = (volData && volData[latestDateIdx] !== null) ? volData[latestDateIdx] : -1;

                const matchPrice = (pVal >= currentReportState.pricePrMin && pVal <= currentReportState.pricePrMax);
                const matchVol = (vVal >= currentReportState.volPrMin && vVal <= currentReportState.volPrMax);

                if (matchPrice && matchVol) {
                    filteredStocks.push(stock);
                }
            });

            filteredStocks = sortData(filteredStocks, 'stock');
            currentReportState.renderedRows = filteredStocks; 
        }

        if (filteredStocks.length > 0) {
            filteredStocks.forEach(stock => {
                const displayData = getCurrentDisplayData(stock.id, false);
                const statusText = stock.status ? stock.status : "";
                let pData = window.csvStockData[stock.id] || [];
                let bData = window.csvBigOrderData[stock.id] || [];
                let chartHtml = getSparklineHtml(pData, bData, 250, 40);

                const stockPctVal = calculatePct(stock.id, false);
                const stockPctHtml = getPctHtml(stockPctVal);

                const nameCell = generateNameCellHtml(stock.id, stock.name, 'stock');

                tableHtml += `<tr>
                    ${nameCell}
                    <td style="${STATUS_COL_STYLE}">${statusText}</td>
                    <td style="padding:0; text-align:center; background:#fff;">${chartHtml}</td>
                    ${stockPctHtml} `;
                
                if (displayData) dateIndices.forEach(idx => tableHtml += getCellHtml(displayData[idx], idx));
                tableHtml += `</tr>`;
            });
        } else tableHtml += `<tr><td colspan="50" style="padding:40px; text-align:center; color:#666; font-size:1.2em;">無符合條件股票 (區間 ${currentReportState.prMin} ~ ${currentReportState.prMax})</td></tr>`;
        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    }

    function renderAllGroupsTable() {
        const container = document.getElementById("report-table-container");
        const dateIndices = getDateIndices();
        let tableHtml = generateTableHeader(dateIndices, false);
        
        let allGroups = [];

        if (currentReportState.isSnapshotMode && currentReportState.renderedRows) {
            allGroups = currentReportState.renderedRows;
        } else {
            allGroups = Object.keys(window.csvGroupData).map(gid => {
                return { id: gid, name: (window.groupNames && window.groupNames[gid]) ? window.groupNames[gid] : gid };
            });
            if (currentReportState.sortColIndex !== null) allGroups = sortData(allGroups, 'group');
            currentReportState.renderedRows = allGroups;
        }

        allGroups.forEach(g => {
            const prData = getCurrentDisplayData(g.id, true); 
            let pData = window.csvGroupData[g.id] || [];
            let bData = window.csvGroupBigOrderData[g.id] || [];
            let chartHtml = getSparklineHtml(pData, bData, 250, 40);

            const groupPctVal = calculatePct(g.id, true);
            const groupPctHtml = getPctHtml(groupPctVal);

            const nameCell = generateNameCellHtml(g.id, g.name, 'group');

            tableHtml += `<tr>
                ${nameCell}
                <td style="padding:0; text-align:center; background:#fff;">${chartHtml}</td>
                ${groupPctHtml} `;

            if (prData) dateIndices.forEach(idx => tableHtml += getCellHtml(prData[idx], idx));
            else dateIndices.forEach(idx => tableHtml += `<td>-</td>`);
            tableHtml += `</tr>`;
        });
        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    }

    function generateTableHeader(indices, showStatusCol) {
        let html = `<table class="pr-table"><thead><tr><th class="col-fixed">名稱</th>`;
        
        if (showStatusCol) html += `<th style="font-size: 1.2em; ${STATUS_HEADER_STYLE}">產業地位</th>`;
        
        html += `<th style="min-width:250px; background:#f4f4f4; font-size: 1.2em;">近 ${DISPLAY_LIMIT} 日走勢</th>`;
        
        const baseDateStr = window.csvDates[currentReportState.baseDateIndex] || "最新";
        
        let pctSortIcon = "", pctBgStyle = "background:#f8f9fa;";
        if (currentReportState.sortColIndex === 'pct_change') {
            pctSortIcon = currentReportState.sortDir === 'desc' ? " ▼" : " ▲";
            pctBgStyle = "background-color:#ffe0b2;"; 
        }
        html += `<th onclick="toggleSort('pct_change')" style="width:90px; min-width:90px; text-align:right; cursor:pointer; border-right:2px solid #ddd; ${pctBgStyle}">
                    漲幅%<br><span style="font-size:0.9em; color:#666; font-weight:normal;">(~ ${baseDateStr})</span>${pctSortIcon}
                </th>`;

        indices.forEach(idx => {
            const date = window.csvDates[idx];
            let sortIcon = "", bgStyle = "";
            
            if (currentReportState.sortColIndex === idx) {
                sortIcon = currentReportState.sortDir === 'desc' ? " ▼" : " ▲";
                bgStyle = "background-color:#ffe0b2;";
            }
            
            if (idx === currentReportState.baseDateIndex) {
                bgStyle += " border-bottom: 10px solid #673AB7;"; 
            }
            
            html += `<th onclick="toggleSort(${idx})" style="cursor:pointer; ${bgStyle}">${date}${sortIcon}</th>`;
        });
        html += `</tr></thead><tbody>`;
        return html;
    }

    function getCellHtml(val, colIdx) {
        // ★ 特殊處理：量創高模式下，0 顯示為 --
        if (currentReportState.dataType === 'vol_high' && (val === 0 || val === '0')) {
            let cellStyle = "color:#ccc;"; // 淡灰色
            if (colIdx !== undefined && colIdx === currentReportState.sortColIndex) {
                cellStyle += " border-left: 2px solid #ff9800; border-right: 2px solid #ff9800;";
            }
            return `<td style="${cellStyle}">--</td>`;
        }

        const heatStyle = getHeatmapStyle(val);
        let displayVal = val !== null ? val : "-";
        let cellStyle = heatStyle; 
        if (colIdx !== undefined && colIdx === currentReportState.sortColIndex) {
            cellStyle += " border-left: 2px solid #ff9800; border-right: 2px solid #ff9800;";
        }
        return `<td style="${cellStyle}">${displayVal}</td>`;
    }

    function restoreMainView() {
        if (typeof resetToHome === 'function') resetToHome();
        else {
            restoreDashboardUI();
            if (typeof window.checkAndLoad === 'function') window.checkAndLoad();
        }
    }

    window.refreshGroupReportView = function() {
        const view = document.getElementById("group-report-view");
        if (!view) return; 
        if (currentReportState.viewMode === 'single') renderSingleGroupTable();
        else if (currentReportState.viewMode === 'all_stocks') {
            getSharedStockDetails().then(details => renderAllStocksTable(details));
        }
        else if (currentReportState.viewMode === 'all_groups') renderAllGroupsTable();
    };

    document.addEventListener("DOMContentLoaded", function() {
        let tooltipEl = document.getElementById('custom-tooltip');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'custom-tooltip';
            document.body.appendChild(tooltipEl);
        }
        document.body.addEventListener('mouseover', function(e) {
            if (e.target && e.target.hasAttribute('data-tooltip')) {
                const text = e.target.getAttribute('data-tooltip');
                if (text) { tooltipEl.innerText = text; tooltipEl.style.display = 'block'; }
            }
        });
        document.body.addEventListener('mousemove', function(e) {
            if (tooltipEl && tooltipEl.style.display === 'block') {
                const x = e.clientX + 15;
                const y = e.clientY + 15;
                const maxX = window.innerWidth - tooltipEl.offsetWidth - 20;
                tooltipEl.style.left = Math.min(x, maxX) + 'px';
                tooltipEl.style.top = y + 'px';
            }
        });
        document.body.addEventListener('mouseout', function(e) {
            if (e.target && e.target.hasAttribute('data-tooltip') && tooltipEl) tooltipEl.style.display = 'none';
        });
    });

    function calculatePct(id, isGroup) {
        const parentWin = window.parent;
        const closeData = isGroup ? (parentWin.csvGroupCloseData || {}) : (parentWin.csvCloseData || {});
        const arr = closeData[id];
        if (!arr || arr.length === 0) return null;

        const latestPrice = arr[0];
        let targetIdx = currentReportState.baseDateIndex || 0;
        const basePrice = arr[targetIdx];

        if (latestPrice && basePrice && basePrice !== 0) {
            return ((latestPrice / basePrice) - 1) * 100;
        }
        return null;
    }

    function getPctHtml(val) {
        if (val === null) return '<td style="text-align:right; color:#ccc;">-</td>';
        
        let colorStyle = "color:#888;";
        let content = "0.0%";
        
        if (val > 0) {
            colorStyle = "color:#d50000; font-size: 1.1em; font-weight:bold;";
            content = "+" + val.toFixed(1) + "%";
        } else if (val < 0) {
            colorStyle = "color:#008000; font-size: 1.1em; font-weight:bold;";
            content = val.toFixed(1) + "%";
        }
        
        return `<td style="text-align:right; ${colorStyle} border-right:1px solid #eee;">${content}</td>`;
    }

    window.switchLimit = function(days) {
        DISPLAY_LIMIT = days;
        renderBreadcrumb(); 
        window.refreshGroupReportView(); 
    };
}