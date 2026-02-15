// ==========================================
// report-view.js - v17.0 (Button Fix & Left Align)
// ==========================================

const g_viewState = {
    activeTab: 'stock', // 'stock' | 'group'
    
    // 控制目前要顯示幾筆 (預設 50)
    renderLimit: 50,

    // 顯示設定
    displayType: 'p_rank', // 'p_rank', 'v_rank', 'volhigh'
    
    // 排序設定
    sortType: 'p_rank',    
    sortCol: 0,            // 0=最新, 或 'change'
    sortDir: 'desc',       
    baseDateIndex: 0,
    
    // 日期排序
    dateOrder: 'new_to_old', // 'new_to_old' | 'old_to_new'

    days: 50,
    filter: {
        pr_min: 95, pr_max: 100,
        vr_min: 0,  vr_max: 100
    }
};

function renderReportView() {
    const container = document.getElementById('report-container');
    if (!container) return;

    const currentData = window.dataContext && window.dataContext[g_viewState.activeTab];
    const hasData = !!(currentData && currentData.data && Object.keys(currentData.data).length > 0);
    
    const userInfo = (currentData && currentData.userInfo) || 
                     (window.dataContext.stock && window.dataContext.stock.userInfo) ||
                     (window.dataContext.group && window.dataContext.group.userInfo);

    let contentHtml = '';
    contentHtml += renderHeaderRow(userInfo);
    contentHtml += renderNavRow(hasData, currentData ? currentData.updateTime : null);
    contentHtml += renderFilterRow();

    if (hasData) {
        contentHtml += renderTableArea(currentData);
    } else {
        contentHtml += renderEmptyState();
    }

    // 包覆一層容器以控制寬度 (95%) 與置中
    container.innerHTML = `<div class="w-[95%] mx-auto flex flex-col h-full shadow-2xl rounded-2xl overflow-hidden border border-gray-200 bg-white my-4">${contentHtml}</div>`;
    
    // 綁定事件 (包含搜尋功能)
    bindEvents();
    
    // 點擊外部關閉搜尋選單
    document.addEventListener('click', (e) => {
        const searchContainer = document.getElementById('nav-search-container');
        if (searchContainer && !searchContainer.contains(e.target)) {
            closeSearchDropdown();
        }
    });
}

// --- Row 1: Header ---
function renderHeaderRow(userInfo) {
    let userHtml = '';
    if (userInfo) {
        const statusColor = userInfo.statusText === 'VIP' ? 'text-amber-500' : 'text-blue-500';
        const expColor = userInfo.isExpired ? 'text-red-500' : 'text-green-600';
        userHtml = `
            <div class="flex items-center gap-3 text-sm">
                <div class="flex items-center gap-1 text-gray-600 border-r border-gray-300 pr-3 mr-1">
                    <i class="fas fa-user-circle text-gray-400"></i>
                    <span class="font-mono font-bold text-gray-800">${userInfo.userID}</span>
                </div>
                <div class="flex items-center gap-1 font-bold ${statusColor} border-r border-gray-300 pr-3 mr-1">
                    <i class="fas fa-crown text-xs"></i> ${userInfo.statusText}
                </div>
                <div class="text-xs text-gray-400">
                    使用期限：<span class="${expColor} font-mono">${userInfo.date}</span>
                </div>
            </div>
        `;
    } else {
        userHtml = `<span class="text-xs text-gray-400">訪客</span>`;
    }

    return `
    <div class="flex justify-between items-center bg-white p-3 rounded-t-xl border-b border-gray-200">
        <div class="flex items-center gap-2">
            <div class="bg-blue-600 w-1 h-6 rounded-full"></div>
            <h1 class="text-xl font-bold text-gray-800 tracking-wide">⚡台股 PR 排名</h1>
            
            <button onclick="window.HelpModal.open()" class="ml-3 px-2 py-0.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 text-sm font-medium transition-all flex items-center gap-1" title="查看新手指南">
                <i class="far fa-question-circle"></i> 使用說明
            </button>
        </div>
        <div class="flex items-center">
            ${userHtml}
        </div>
    </div>
    `;
}

// --- Row 2: Nav (含搜尋框) ---
function renderNavRow(hasData, updateTime) {
    const isStock = g_viewState.activeTab === 'stock';
    const activeClass = "bg-blue-600 text-white shadow-md border-blue-600";
    const inactiveClass = "bg-white text-gray-500 hover:bg-gray-50 border-gray-200";
    
    const btnLabel = "匯入 CSV 資料";
    const dateLabel = updateTime ? `<span class="text-sm text-gray-500 font-mono mr-4 hidden md:inline"><i class="far fa-clock"></i> ${updateTime}</span>` : '';

    const placeholder = isStock ? "2330 or 台積電" : "記憶體 or I023290";
    
    const searchHtml = `
        <div id="nav-search-container" class="relative mx-4 w-64">
            <div class="relative group">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i class="fas fa-search text-gray-400 group-focus-within:text-blue-500 transition-colors"></i>
                </div>
                <input type="text" id="nav-search-input" 
                    class="block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:placeholder-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-all" 
                    placeholder="${placeholder}" autocomplete="off" ${!hasData ? 'disabled' : ''}>
                <div class="absolute inset-y-0 right-0 flex items-center">
                   <button id="nav-search-btn" class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 mr-1 rounded text-xs border border-gray-300 transition-colors" ${!hasData ? 'disabled' : ''}>查詢</button>
                </div>
            </div>
            <div id="nav-search-dropdown" class="absolute mt-1 w-full bg-white shadow-xl max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm hidden z-50">
            </div>
        </div>
    `;

    return `
    <div class="flex flex-wrap justify-between items-center bg-gray-50 p-3 border-b border-gray-200 px-4 gap-2">
        <div class="flex rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-white shrink-0">
            <button onclick="switchTab('stock')" class="px-6 py-2 text-sm font-medium transition-colors border-r ${isStock ? activeClass : inactiveClass}">
                個股列表
            </button>
            <button onclick="switchTab('group')" class="px-6 py-2 text-sm font-medium transition-colors ${!isStock ? activeClass : inactiveClass}">
                族群列表
            </button>
        </div>

        ${searchHtml}

        <div class="flex items-center shrink-0 ml-auto">
            ${dateLabel}
            <button onclick="triggerUpload()" class="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap">
                <i class="fas fa-cloud-upload-alt"></i> ${btnLabel}
            </button>
        </div>
    </div>
    `;
}

// --- Row 3: Filter ---
function renderFilterRow() {
    const dateOrderText = g_viewState.dateOrder === 'new_to_old' ? '日期：新 ➢ 舊' : '日期：舊 ➢ 新';

    return `
    <div class="bg-white p-3 border-b border-gray-200 flex flex-wrap justify-between items-center px-4 gap-4">
        <div class="flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                <span class="text-gray-500 font-bold text-xs uppercase">顯示：</span>
                <label class="flex items-center cursor-pointer hover:text-blue-600 text-sm font-medium">
                    <input type="radio" name="displayType" value="p_rank" ${g_viewState.displayType === 'p_rank' ? 'checked' : ''} class="mr-2 accent-blue-600"><span class="text-red-600 font-bold">股價 PR</span>
                </label>
                <label class="flex items-center cursor-pointer hover:text-blue-600 text-sm font-medium">
                    <input type="radio" name="displayType" value="v_rank" ${g_viewState.displayType === 'v_rank' ? 'checked' : ''} class="mr-2 accent-blue-600"><span class="text-blue-600 font-bold">籌碼 PR</span>
                </label>
                <label class="flex items-center cursor-pointer hover:text-blue-600 text-sm font-medium">
                    <input type="radio" name="displayType" value="volhigh" ${g_viewState.displayType === 'volhigh' ? 'checked' : ''} class="mr-2 accent-blue-600">籌碼創高
                </label>
            </div>

            <div class="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 text-sm font-medium">
                <span class="text-gray-500 font-bold text-xs uppercase">篩選：</span>
                <div class="flex items-center gap-2">
                    <span class="text-red-600 font-bold">股價 PR</span>
                    <input type="number" id="filter-pr-min" value="${g_viewState.filter.pr_min}" class="w-16 px-2 py-1 border rounded text-center text-sm focus:ring-1 focus:ring-blue-500 outline-none">
                    <span class="text-gray-400">~</span>
                    <input type="number" id="filter-pr-max" value="${g_viewState.filter.pr_max}" class="w-16 px-2 py-1 border rounded text-center text-sm focus:ring-1 focus:ring-blue-500 outline-none">
                </div>
                <div class="w-px h-4 bg-gray-300 mx-2"></div>
                <div class="flex items-center gap-2">
                    <span class="text-blue-600 font-bold">籌碼 PR</span>
                    <input type="number" id="filter-vr-min" value="${g_viewState.filter.vr_min}" class="w-16 px-2 py-1 border rounded text-center text-sm focus:ring-1 focus:ring-blue-500 outline-none">
                    <span class="text-gray-400">~</span>
                    <input type="number" id="filter-vr-max" value="${g_viewState.filter.vr_max}" class="w-16 px-2 py-1 border rounded text-center text-sm focus:ring-1 focus:ring-blue-500 outline-none">
                </div>
            </div>
        </div>

        <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
                ${renderDayBtn(50)}
                ${renderDayBtn(100)}
                ${renderDayBtn(200)}
            </div>
            <button onclick="toggleDateOrder()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded border border-gray-300 text-sm transition-colors flex items-center gap-2">
                <span class="text-lg font-bold leading-none pb-1">⇆</span> ${dateOrderText}
            </button>
        </div>
    </div>
    `;
}

function renderDayBtn(days) {
    const isActive = g_viewState.days === days;
    const cls = isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50";
    return `<button onclick="setDays(${days})" class="px-4 py-1.5 rounded border text-sm transition-colors ${cls}">近${days}日</button>`;
}

// --- Component: Empty State ---
function renderEmptyState() {
    const label = g_viewState.activeTab === 'stock' ? '個股' : '族群';
    return `
    <div class="flex-1 flex flex-col items-center justify-center bg-white m-4 rounded-xl border-2 border-dashed border-gray-200">
        <div class="text-center p-8">
            <div class="bg-blue-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <i class="fas fa-folder-open text-4xl text-blue-500"></i>
            </div>
            <h3 class="text-2xl font-bold text-gray-700 mb-3">尚無${label}資料</h3>
            <p class="text-gray-500 mb-8 text-base">請匯入 XQ 匯出的 CSV 檔案 (個股或族群皆可)</p>
            <button onclick="triggerUpload()" class="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl font-bold shadow-lg transition-transform hover:-translate-y-1 text-lg">
                <i class="fas fa-cloud-upload-alt mr-2"></i> 匯入 CSV 資料
            </button>
        </div>
    </div>
    `;
}

// ==========================================
// report-view.js - v20.0 (Back to In-Table Button, Left Aligned)
// ==========================================

// ==========================================
// report-view.js - v20.0 (Back to In-Table Button, Left Aligned)
// ==========================================

function renderTableArea(sourceData) {
    const allDates = sourceData.dates || [];
    let displayDates = allDates.slice(0, g_viewState.days);
    if (g_viewState.dateOrder === 'old_to_new') {
        displayDates.reverse();
    }
    
    let ids = Object.keys(sourceData.data || {});
    ids = ids.filter(id => {
        const d = sourceData.data[id];
        const latestPR = (d.p_rank && d.p_rank[0]) || 0;
        const latestVR = (d.v_rank && d.v_rank[0]) || 0;
        const f = g_viewState.filter;
        return (latestPR >= f.pr_min && latestPR <= f.pr_max) &&
               (latestVR >= f.vr_min && latestVR <= f.vr_max);
    });

    ids.sort((a, b) => {
        let valA = -999, valB = -999;
        if (g_viewState.sortCol === 'change') {
            valA = calculatePct(sourceData, a) || -999999;
            valB = calculatePct(sourceData, b) || -999999;
        } else {
            valA = getValByType(sourceData, a, g_viewState.sortCol, g_viewState.sortType);
            valB = getValByType(sourceData, b, g_viewState.sortCol, g_viewState.sortType);
        }
        return g_viewState.sortDir === 'desc' ? valB - valA : valA - valB;
    });

    const currentLimit = g_viewState.renderLimit || 50;
    const renderIds = ids.slice(0, currentLimit);
    const remainingCount = ids.length - renderIds.length;

    const baseDateStr = allDates[g_viewState.baseDateIndex] || "最新";

    // 計算總欄位數 (colspan 用)
    // 名稱(1) + PR走勢(1) + 漲幅(1) + 日期欄位數
    const totalCols = 3 + displayDates.length;

    // 1. 產生表格內容
    let rowsHtml = renderRows(sourceData, renderIds, displayDates);

    // 2. 按鈕區塊 (表格內部 + 靠左對齊)
    // 這樣點擊時會有明確的「往下推」視覺效果
    if (remainingCount > 0) {
        rowsHtml += `
            <tr id="load-more-row">
                <td colspan="${totalCols}" class="p-4 bg-gray-50 border-t border-gray-200 text-left">
                    <button onclick="loadMoreData()" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all inline-flex items-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 ml-2">
                        <i class="fas fa-arrow-circle-down"></i>
                        <span>載入更多資料 (還有 ${remainingCount} 筆)</span>
                    </button>
                </td>
            </tr>
        `;
    }

    return `
    <div class="flex-1 overflow-auto bg-white border-x border-b border-gray-200 rounded-b-xl relative table-container">
        <table class="min-w-full border-separate" style="border-spacing: 0;">
            <thead class="bg-gray-50 sticky top-0 z-40 shadow-sm">
                <tr>
                    <th class="sticky left-0 bg-gray-50 px-3 py-2 text-left text-base font-bold text-gray-700 border-b border-r border-gray-200 w-[110px] min-w-[110px] z-50">名稱</th>
                    
                    <th class="px-2 py-2 text-center text-base font-bold text-gray-700 border-b border-gray-200 w-[200px] min-w-[200px]">PR 走勢</th>
                    
                    ${renderSortHeader('change', `
                        <div class="flex flex-col items-end leading-tight">
                            <span>漲幅%</span>
                            <span class="text-xs text-gray-400 font-normal whitespace-nowrap mt-1">(~${baseDateStr})</span>
                        </div>
                    `, 'text-right w-[100px] min-w-[100px] px-3')}

                    ${displayDates.map(d => {
                        const dStr = d.length === 8 ? `${d.substring(4,6)}/${d.substring(6,8)}` : d;
                        const originalIndex = allDates.indexOf(d);
                        return renderSortHeader(originalIndex, dStr, 'text-center w-[70px] min-w-[70px] px-0');
                    }).join('')}
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                ${rowsHtml}
            </tbody>
        </table>
    </div>
    `;
}

function renderSortHeader(colKey, labelHtml, cssClass) {
    const isSorted = g_viewState.sortCol === colKey;
    const isBase = colKey === g_viewState.baseDateIndex;
    
    let bgStyle = "bg-gray-50 text-gray-600";
    let icon = "";
    let borderStyle = "border-b border-gray-200";

    if (isSorted) {
        bgStyle = "bg-orange-100 text-orange-900 font-bold";
        icon = g_viewState.sortDir === 'desc' ? " ▼" : " ▲";
    }
    
    if (isBase && typeof colKey === 'number') {
        borderStyle = "bg-purple-100 text-purple-900 border-b-4 border-purple-600";
    }

    const clickArg = typeof colKey === 'string' ? `'${colKey}'` : colKey;

    return `
    <th onclick="toggleSort(${clickArg})" 
        class="${cssClass} py-1 text-base font-medium cursor-pointer transition-colors ${bgStyle} ${borderStyle} hover:bg-gray-100 select-none relative group">
        <div class="flex items-center justify-center h-full w-full">
            ${labelHtml} <span class="ml-1 text-[10px] ${isSorted ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}">${icon || '▼'}</span>
        </div>
    </th>`;
}

function renderRows(sourceData, ids, displayDates) {
    if (ids.length === 0) return `<tr><td colspan="100" class="p-10 text-center text-gray-400 text-xl">無符合篩選條件的資料</td></tr>`;

    const allDates = sourceData.dates || [];
    const dateMap = {};
    allDates.forEach((d, i) => dateMap[d] = i);

    return ids.map(id => {
        const name = sourceData.names[id] || id;
        const pctVal = calculatePct(sourceData, id);
        const pctHtml = getPctHtml(pctVal);

        const pData = getRawDataByType(sourceData, id, 'p_rank', g_viewState.days); 
        const vData = getRawDataByType(sourceData, id, 'v_rank', g_viewState.days); 
        
        const priceColor = '#dc2626'; 
        const volColor = '#2563eb';   

        const sparkSvg = generateDualSparkline(pData, vData, priceColor, volColor);

        const cells = displayDates.map((dateStr) => {
            const idx = dateMap[dateStr];
            const val = getMatrixVal(sourceData, id, idx);
            const style = getHeatmapStyle(val);
            const displayVal = (val === 0 || (val && val !== "-")) ? val : '-';

            let borderClass = "border-b border-r border-dashed border-gray-100";
            if (idx === g_viewState.sortCol) {
                borderClass = "border-b border-r-2 border-l-2 border-orange-300 border-dashed border-gray-100";
            }
            return `<td class="p-0 h-10 ${borderClass}"><div class="w-full h-full flex items-center justify-center text-sm font-bold" style="${style}">${displayVal}</div></td>`;
        }).join('');

        return `
            <tr class="hover:bg-blue-50 transition-colors group">
                <td class="sticky left-0 bg-white group-hover:bg-blue-50 border-b border-r border-gray-200 z-30">
                    <div class="flex items-center gap-3 px-3 h-full">
                        <button onclick="openChart('${id}')" class="text-blue-500 hover:text-blue-700 text-lg flex-shrink-0" title="開啟K線圖">
                            <i class="fas fa-chart-line"></i>
                        </button>
                        <div class="overflow-hidden">
                            <div onclick="copyStockCode('${id}')" class="font-bold text-gray-800 text-base truncate cursor-pointer hover:text-blue-600 hover:underline transition-colors" title="點擊複製 ${id}.TW">${id}</div>
                            <div class="text-sm text-gray-500 truncate">${name}</div>
                        </div>
                    </div>
                </td>
                
                <td class="p-1 text-center border-b border-gray-100">${sparkSvg}</td>
                ${pctHtml}
                ${cells}
            </tr>
        `;
    }).join('');
}

// --- Logic Helpers ---

function toggleDateOrder() {
    g_viewState.dateOrder = (g_viewState.dateOrder === 'new_to_old') ? 'old_to_new' : 'new_to_old';
    renderReportView();
}

function toggleSort(colKey) {
    if (typeof colKey === 'number') {
        g_viewState.baseDateIndex = colKey;
    }
    if (g_viewState.sortCol === colKey) {
        g_viewState.sortDir = (g_viewState.sortDir === 'desc') ? 'asc' : 'desc';
    } else {
        g_viewState.sortCol = colKey;
        g_viewState.sortDir = 'desc';
        if (typeof colKey === 'number') {
            g_viewState.sortType = g_viewState.displayType; 
        }
    }
    renderReportView();
}

function calculatePct(sourceData, id) {
    const d = sourceData.data[id];
    if (!d || !d.close) return null;
    const closeArr = d.close;
    if (closeArr.length === 0) return null;
    const latestPrice = closeArr[0]; 
    const baseIdx = g_viewState.baseDateIndex;
    const basePrice = closeArr[baseIdx];
    if (latestPrice && basePrice && basePrice !== 0) {
        return ((latestPrice - basePrice) / basePrice) * 100;
    }
    return null;
}

function getPctHtml(val) {
    let css = "text-gray-400 font-mono";
    let text = "-";
    const isSortCol = g_viewState.sortCol === 'change';
    const borderStyle = isSortCol ? "border-x-2 border-orange-300 bg-orange-50" : "border-r border-gray-200";

    if (val !== null) {
        const fixed = val.toFixed(1) + "%";
        if (val > 0) {
            css = "text-red-600 font-bold font-mono text-base";
            text = "+" + fixed;
        } else if (val < 0) {
            css = "text-green-600 font-bold font-mono text-base";
            text = fixed;
        } else {
            css = "text-gray-900 font-mono text-base";
            text = fixed;
        }
    }
    return `<td class="px-4 text-right border-b ${css} ${borderStyle}">
        <div class="flex flex-col justify-center h-full">${text}</div>
    </td>`;
}

function switchTab(tab) {
    g_viewState.activeTab = tab;

    if (tab === 'group') {
        g_viewState.filter.pr_min = 0;
        g_viewState.filter.pr_max = 100;
        g_viewState.renderLimit = 500;
    } else {
        g_viewState.filter.pr_min = 95;
        g_viewState.filter.pr_max = 100;
        g_viewState.renderLimit = 50;
    }
    
    g_viewState.sortCol = 0;
    g_viewState.sortDir = 'desc';
    g_viewState.dateOrder = 'new_to_old';

    renderReportView();
}

function setDays(d) {
    g_viewState.days = d;
    renderReportView();
}

function triggerUpload() {
    const el = document.getElementById('upload-csv');
    if (el) el.click();
    else alert("找不到上傳元件 (upload-csv)，請檢查 HTML");
}

window.loadMoreData = function() {
    const container = document.querySelector('.table-container');
    const scrollTop = container ? container.scrollTop : 0;

    g_viewState.renderLimit += 50;
    
    renderReportView();

    const newContainer = document.querySelector('.table-container');
    if (newContainer) {
        newContainer.scrollTop = scrollTop;
    }
};

function bindEvents() {
    document.querySelectorAll('input[name="displayType"]').forEach(el => {
        el.onchange = (e) => {
            g_viewState.displayType = e.target.value;
            renderReportView();
        };
    });
    const bindInput = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.onchange = (e) => {
            g_viewState.filter[key] = parseFloat(e.target.value) || 0;
            renderReportView();
        };
    };
    bindInput('filter-pr-min', 'pr_min');
    bindInput('filter-pr-max', 'pr_max');
    bindInput('filter-vr-min', 'vr_min');
    bindInput('filter-vr-max', 'vr_max');

    const searchInput = document.getElementById('nav-search-input');
    const searchBtn = document.getElementById('nav-search-btn');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => handleSearchInput(e.target.value));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchEnter();
            }
        });
        searchInput.addEventListener('focus', (e) => handleSearchInput(e.target.value)); 
    }
    if (searchBtn) {
        searchBtn.addEventListener('click', () => handleSearchEnter());
    }
}

function handleSearchInput(keyword) {
    const dropdown = document.getElementById('nav-search-dropdown');
    if (!dropdown || !keyword.trim()) {
        closeSearchDropdown();
        return;
    }

    const currentData = window.dataContext && window.dataContext[g_viewState.activeTab];
    if (!currentData || !currentData.data) return;

    const matches = searchAlgorithm(keyword, currentData.names);
    
    if (matches.length === 0) {
        dropdown.innerHTML = '<div class="px-4 py-2 text-gray-500 text-sm">無符合結果</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    const html = matches.map(item => `
        <div onclick="selectSearchResult('${item.id}')" 
             class="px-4 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center group transition-colors border-b border-gray-100 last:border-0">
            <div class="flex items-center gap-2">
                <span class="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-xs group-hover:bg-blue-100 group-hover:text-blue-700">${item.id}</span>
                <span class="text-gray-700 group-hover:text-blue-800">${item.name}</span>
            </div>
            <i class="fas fa-chevron-right text-gray-300 text-xs group-hover:text-blue-400"></i>
        </div>
    `).join('');

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
}

function searchAlgorithm(keyword, namesMap) {
    keyword = keyword.toUpperCase();
    const exact = [];
    const start = [];
    const partial = [];
    const nameMatch = [];

    for (let id in namesMap) {
        const name = namesMap[id] || "";
        const idUpper = id.toUpperCase();
        
        if (idUpper === keyword) {
            exact.push({ id, name });
        } else if (idUpper.startsWith(keyword)) {
            start.push({ id, name });
        } else if (name.includes(keyword)) {
            nameMatch.push({ id, name });
        } else if (idUpper.includes(keyword)) { 
            partial.push({ id, name });
        }
    }
    return [...exact, ...start, ...nameMatch, ...partial].slice(0, 10);
}

function handleSearchEnter() {
    const dropdown = document.getElementById('nav-search-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden') && dropdown.children.length > 0) {
        const firstItem = dropdown.querySelector('div[onclick]');
        if (firstItem) {
            firstItem.click(); 
        }
    } else {
        const input = document.getElementById('nav-search-input');
        if (input && input.value.trim()) {
            const currentData = window.dataContext && window.dataContext[g_viewState.activeTab];
            const matches = searchAlgorithm(input.value.trim(), currentData.names);
            if (matches.length > 0) {
                selectSearchResult(matches[0].id);
            }
        }
    }
}

function selectSearchResult(id) {
    const currentData = window.dataContext && window.dataContext[g_viewState.activeTab];
    if (!currentData) return;
    openChart(id);
    const input = document.getElementById('nav-search-input');
    if (input) input.value = '';
    closeSearchDropdown();
}

function closeSearchDropdown() {
    const dropdown = document.getElementById('nav-search-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

function getValByType(source, id, idx, type) {
    const d = source.data[id];
    if (type === 'p_rank') return (d.p_rank && d.p_rank[idx]) || -999;
    if (type === 'v_rank') return (d.v_rank && d.v_rank[idx]) || -999;
    
    if (type === 'volhigh') {
        const v = (d.volhigh && d.volhigh[idx]);
        return (v && v !== "0") ? parseFloat(v) : -999; 
    }
    return -999;
}

function getRawDataByType(source, id, type, limit) {
    const d = source.data[id];
    let arr = [];
    if (type === 'p_rank') arr = d.p_rank || [];
    else if (type === 'v_rank') arr = d.v_rank || [];
    return arr.slice(0, limit);
}

function getMatrixVal(source, id, idx) {
    const type = g_viewState.displayType;
    const d = source.data[id];
    
    if (type === 'p_rank') {
        const val = d.p_rank && d.p_rank[idx];
        return (val === 0 || val) ? val : ""; 
    }
    if (type === 'v_rank') {
        const val = d.v_rank && d.v_rank[idx];
        return (val === 0 || val) ? val : ""; 
    }
    
    if (type === 'volhigh') {
        const v = (d.volhigh && d.volhigh[idx]);
        if (!v || v === "0" || v === 0) return "-";
        return v; 
    }
    return "";
}

function getHeatmapStyle(val) {
    if (val === null || val === undefined || val === "" || val === "-") return "color: #e5e7eb;"; 
    const v = parseFloat(val);
    if (isNaN(v)) return "color: #e5e7eb;";

    if (v >= 97) return "background-color: #C71585; color: #fff;"; 

    let r, g, b, textColor;
    const BASE = 245; 
    
    if (v >= 50) {
        const ratio = (v - 50) / 50; 
        r = 255; 
        g = Math.round(BASE - ((BASE - 60) * ratio)); 
        b = Math.round(BASE - ((BASE - 60) * ratio));
        textColor = (v >= 80) ? '#fff' : '#374151'; 
    } else {
        const ratio = (50 - v) / 50; 
        r = Math.round(BASE - ((BASE - 40) * ratio)); 
        g = Math.round(BASE - ((BASE - 160) * ratio)); 
        b = Math.round(BASE - ((BASE - 40) * ratio));
        textColor = (v <= 20) ? '#fff' : '#374151';
    }
    return `background-color: rgb(${r},${g},${b}); color: ${textColor};`;
}

function generateDualSparkline(data1, data2, color1, color2) {
    if ((!data1 || data1.length < 2) && (!data2 || data2.length < 2)) return '';
    const w = 200, h = 32; 

    const d1 = data1 ? [...data1].reverse() : [];
    const d2 = data2 ? [...data2].reverse() : [];
    
    const makePoints = (data) => {
        if (!data || data.length < 2) return '';
        const min = 0, max = 100;
        return data.map((v, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((v - min) / (max - min)) * h;
            return `${x},${y}`;
        }).join(' ');
    };

    const pts1 = makePoints(d1); 
    const pts2 = makePoints(d2); 

    return `
    <svg width="${w}" height="${h}" class="mx-auto overflow-visible">
        <polyline fill="none" stroke="${color2}" stroke-width="1.5" points="${pts2}" stroke-dasharray="3,2" stroke-opacity="0.8" />
        <polyline fill="none" stroke="${color1}" stroke-width="2" points="${pts1}" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;
}

window.openChart = function(id) {
    const currentData = window.dataContext[g_viewState.activeTab];
    window.fullStockData = currentData.data; 
    window.csvDates = currentData.dates;
    
    const name = currentData.names[id] || id;
    if (window.TrendModal) window.TrendModal.open(id, name);
};

window.copyStockCode = function(id) {
    const text = `${id}.TW`;
    const showSuccess = () => console.log(`已複製: ${text}`);

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(showSuccess)
            .catch(() => fallbackCopy(text)); 
    } else {
        fallbackCopy(text);
    }
};

function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('複製錯誤', err);
    }
    document.body.removeChild(textArea);
}