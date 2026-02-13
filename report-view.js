// ==========================================
// report-view.js - v10.0 (Layout & Dual Mode)
// ==========================================

// 全域狀態
const g_viewState = {
    activeTab: 'stock', // 'stock' | 'group'
    dataType: 'p_rank', // 'p_rank', 'v_rank', 'volhigh'
    days: 50,           // 50, 100, 200
    
    // 篩選條件 (同時生效)
    filter: {
        pr_min: 95, pr_max: 100,
        vr_min: 0,  vr_max: 100
    }
};

function renderReportView() {
    console.log("Rendering View v10.0...");
    const container = document.getElementById('report-container');
    if (!container) return;

    // 1. 取得當前 Tab 的資料源
    const currentData = window.dataContext && window.dataContext[g_viewState.activeTab];
    const hasData = !!(currentData && currentData.data && Object.keys(currentData.data).length > 0);

    // 2. 準備渲染 HTML
    let contentHtml = '';

    // A. 頂部導航列 (Row 1)
    contentHtml += renderTopBar(hasData, currentData ? currentData.updateTime : null);

    // B. 工具列 (Row 2) - 即使沒資料也要顯示工具列，讓使用者知道有哪些功能
    contentHtml += renderToolBar();

    // C. 內容區 (Row 3) - 表格 或 空狀態
    if (hasData) {
        contentHtml += renderTableArea(currentData);
    } else {
        contentHtml += renderEmptyState();
    }

    container.innerHTML = contentHtml;
    
    // 重新綁定事件 (因為 innerHTML 重繪了)
    bindEvents();
}

// --- Component: Row 1 Top Bar ---
function renderTopBar(hasData, updateTime) {
    const isStock = g_viewState.activeTab === 'stock';
    const activeClass = "border-b-2 border-blue-600 text-blue-600 font-bold bg-blue-50";
    const inactiveClass = "text-gray-500 hover:text-gray-700 hover:bg-gray-100";
    
    const btnLabel = hasData ? (isStock ? "🔄 更新個股 CSV" : "🔄 更新族群 CSV") : (isStock ? "📤 上傳個股 CSV" : "📤 上傳族群 CSV");
    const dateLabel = updateTime ? `<span class="text-xs text-gray-400 mr-2"><i class="far fa-clock"></i> ${updateTime.split(' ')[0]}</span>` : '';

    return `
    <div class="flex justify-between items-center bg-white p-2 rounded-t-xl border-b border-gray-200 shadow-sm">
        <div class="flex space-x-1">
            <button onclick="switchTab('stock')" class="px-6 py-2 rounded-t-lg transition-colors ${isStock ? activeClass : inactiveClass}">
                個股列表
            </button>
            <button onclick="switchTab('group')" class="px-6 py-2 rounded-t-lg transition-colors ${!isStock ? activeClass : inactiveClass}">
                族群列表
            </button>
        </div>

        <div class="flex items-center">
            ${dateLabel}
            <button onclick="triggerUpload()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium shadow transition-transform active:scale-95 flex items-center gap-2">
                <i class="fas fa-cloud-upload-alt"></i> ${btnLabel}
            </button>
        </div>
    </div>
    `;
}

// --- Component: Row 2 Tool Bar (Flex Wrap) ---
function renderToolBar() {
    return `
    <div class="bg-white p-3 border-b border-gray-200 shadow-sm flex flex-wrap gap-4 items-center text-sm">
        
        <div class="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
            <span class="text-gray-500 font-bold text-xs uppercase">顯示</span>
            <label class="flex items-center cursor-pointer hover:text-blue-600">
                <input type="radio" name="dataType" value="p_rank" ${g_viewState.dataType === 'p_rank' ? 'checked' : ''} class="mr-1 accent-blue-600"> 價PR
            </label>
            <label class="flex items-center cursor-pointer hover:text-blue-600">
                <input type="radio" name="dataType" value="v_rank" ${g_viewState.dataType === 'v_rank' ? 'checked' : ''} class="mr-1 accent-blue-600"> 量PR
            </label>
            <label class="flex items-center cursor-pointer hover:text-blue-600">
                <input type="radio" name="dataType" value="volhigh" ${g_viewState.dataType === 'volhigh' ? 'checked' : ''} class="mr-1 accent-blue-600"> 量創高
            </label>
        </div>

        <div class="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
            <span class="text-gray-500 font-bold text-xs uppercase">篩選</span>
            
            <div class="flex items-center gap-1">
                <span class="text-gray-600">價PR</span>
                <input type="number" id="filter-pr-min" value="${g_viewState.filter.pr_min}" class="w-12 px-1 py-0.5 border rounded text-center focus:ring-1 focus:ring-blue-500 outline-none">
                <span class="text-gray-400">~</span>
                <input type="number" id="filter-pr-max" value="${g_viewState.filter.pr_max}" class="w-12 px-1 py-0.5 border rounded text-center focus:ring-1 focus:ring-blue-500 outline-none">
            </div>

            <div class="w-px h-4 bg-gray-300 mx-1"></div>

            <div class="flex items-center gap-1">
                <span class="text-gray-600">量PR</span>
                <input type="number" id="filter-vr-min" value="${g_viewState.filter.vr_min}" class="w-12 px-1 py-0.5 border rounded text-center focus:ring-1 focus:ring-blue-500 outline-none">
                <span class="text-gray-400">~</span>
                <input type="number" id="filter-vr-max" value="${g_viewState.filter.vr_max}" class="w-12 px-1 py-0.5 border rounded text-center focus:ring-1 focus:ring-blue-500 outline-none">
            </div>
        </div>

        <div class="flex items-center gap-2 ml-auto">
            <span class="text-gray-500 font-bold text-xs uppercase mr-1">天數</span>
            ${renderDayBtn(50)}
            ${renderDayBtn(100)}
            ${renderDayBtn(200)}
        </div>
    </div>
    `;
}

function renderDayBtn(days) {
    const isActive = g_viewState.days === days;
    const cls = isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50";
    return `<button onclick="setDays(${days})" class="px-3 py-1 rounded border text-xs transition-colors ${cls}">${days}日</button>`;
}

// --- Component: Empty State ---
function renderEmptyState() {
    const label = g_viewState.activeTab === 'stock' ? '個股' : '族群';
    return `
    <div class="flex-1 flex flex-col items-center justify-center bg-white m-4 rounded-xl border-2 border-dashed border-gray-200">
        <div class="text-center p-8">
            <div class="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-folder-open text-3xl text-blue-500"></i>
            </div>
            <h3 class="text-xl font-bold text-gray-700 mb-2">尚無${label}資料</h3>
            <p class="text-gray-400 mb-6 text-sm">請上傳 CSV 檔案以開始分析矩陣數據</p>
            <button onclick="triggerUpload()" class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg transition-transform hover:-translate-y-1">
                <i class="fas fa-cloud-upload-alt mr-2"></i> 上傳${label} CSV
            </button>
        </div>
    </div>
    `;
}

// --- Component: Table Area ---
function renderTableArea(sourceData) {
    const allDates = sourceData.dates || [];
    const displayDates = allDates.slice(0, g_viewState.days);
    
    // 篩選邏輯 (同時篩選)
    let ids = Object.keys(sourceData.data || {});
    ids = ids.filter(id => {
        const d = sourceData.data[id];
        const latestPR = (d.p_rank && d.p_rank[0]) || 0;
        const latestVR = (d.v_rank && d.v_rank[0]) || 0;
        
        const f = g_viewState.filter;
        return (latestPR >= f.pr_min && latestPR <= f.pr_max) &&
               (latestVR >= f.vr_min && latestVR <= f.vr_max);
    });

    // 排序 (依據目前選擇的 dataType)
    ids.sort((a, b) => {
        const valA = getVal(sourceData, a, 0);
        const valB = getVal(sourceData, b, 0);
        return valB - valA;
    });

    // 限制顯示數量以保效能
    const renderIds = ids.slice(0, 100);

    return `
    <div class="flex-1 overflow-auto bg-white border-x border-b border-gray-200 rounded-b-xl relative">
        <table class="min-w-full border-separate" style="border-spacing: 0;">
            <thead class="bg-gray-50 sticky top-0 z-20 shadow-sm">
                <tr>
                    <th class="sticky left-0 bg-gray-50 px-2 py-2 text-center text-xs font-bold text-gray-500 border-b border-r border-gray-200 w-10 z-30">K線</th>
                    <th class="sticky left-10 bg-gray-50 px-2 py-2 text-left text-xs font-bold text-gray-500 border-b border-r border-gray-200 w-24 z-30">名稱</th>
                    <th class="px-2 py-2 text-center text-xs font-bold text-gray-500 border-b border-gray-200 w-20">走勢</th>
                    <th class="px-2 py-2 text-right text-xs font-bold text-gray-500 border-b border-r border-gray-200 w-16">漲幅</th>
                    ${displayDates.map(d => {
                        const dStr = d.length === 8 ? `${d.substring(4,6)}/${d.substring(6,8)}` : d;
                        return `<th class="px-0 py-2 text-center text-xs font-medium text-gray-500 border-b border-gray-100 w-[36px] min-w-[36px]">${dStr}</th>`;
                    }).join('')}
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                ${renderRows(sourceData, renderIds, displayDates)}
            </tbody>
        </table>
    </div>
    `;
}

function renderRows(sourceData, ids, dates) {
    if (ids.length === 0) return `<tr><td colspan="100" class="p-8 text-center text-gray-400">無符合篩選條件的資料</td></tr>`;

    // 建立日期映射
    const dateMap = {};
    (sourceData.dates || []).forEach((d, i) => dateMap[d] = i);

    return ids.map(id => {
        const name = sourceData.names[id] || id;
        const d = sourceData.data[id];
        const close = d.close || [];
        
        // 漲幅
        let changeText = "-";
        let changeClass = "text-gray-300";
        if (close.length >= 2 && close[1] > 0) {
            const val = ((close[0] - close[1]) / close[1]) * 100;
            changeText = (val > 0 ? "+" : "") + val.toFixed(1) + "%";
            changeClass = val > 0 ? "text-red-600 font-bold" : (val < 0 ? "text-green-600 font-bold" : "text-gray-900");
        }

        // 走勢圖 (SVG)
        const sparkSvg = generateSparkline(close.slice(0, 20).reverse(), changeClass.includes('red') ? 'red' : 'green');

        // 矩陣儲存格
        const cells = dates.map(dateStr => {
            const idx = dateMap[dateStr];
            const val = getMatrixVal(sourceData, id, idx);
            const style = getHeatmapStyle(val, g_viewState.dataType);
            return `<td class="p-0 border-b border-r border-dashed border-gray-100 h-8"><div class="w-full h-full flex items-center justify-center text-xs" style="${style}">${val || '-'}</div></td>`;
        }).join('');

        return `
            <tr class="hover:bg-blue-50 transition-colors group">
                <td class="sticky left-0 bg-white group-hover:bg-blue-50 text-center border-b border-r border-gray-200 z-10">
                    <button onclick="openChart('${id}')" class="text-blue-400 hover:text-blue-600"><i class="fas fa-chart-line"></i></button>
                </td>
                <td class="sticky left-10 bg-white group-hover:bg-blue-50 px-2 text-left border-b border-r border-gray-200 z-10">
                    <div class="font-bold text-gray-800 text-xs truncate">${id}</div>
                    <div class="text-[10px] text-gray-500 truncate">${name}</div>
                </td>
                <td class="p-1 text-center border-b border-gray-100">${sparkSvg}</td>
                <td class="px-2 text-right border-b border-r border-gray-200 text-xs font-mono ${changeClass}">${changeText}</td>
                ${cells}
            </tr>
        `;
    }).join('');
}

// --- Logic & Helpers ---

function switchTab(tab) {
    g_viewState.activeTab = tab;
    renderReportView();
}

function setDays(d) {
    g_viewState.days = d;
    renderReportView();
}

function triggerUpload() {
    const id = g_viewState.activeTab === 'stock' ? 'upload-stock' : 'upload-group';
    document.getElementById(id).click();
}

function bindEvents() {
    // 綁定 Radio
    document.querySelectorAll('input[name="dataType"]').forEach(el => {
        el.onchange = (e) => {
            g_viewState.dataType = e.target.value;
            renderReportView();
        };
    });
    // 綁定 Filter Inputs (使用 onchange 避免輸入時狂閃)
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
}

function getVal(source, id, idx) {
    // 依據當前 dataType 取得數值 (用於排序)
    const type = g_viewState.dataType;
    const d = source.data[id];
    if (type === 'p_rank') return (d.p_rank && d.p_rank[idx]) || 0;
    if (type === 'v_rank') return (d.v_rank && d.v_rank[idx]) || 0;
    return 0;
}

function getMatrixVal(source, id, idx) {
    const type = g_viewState.dataType;
    const d = source.data[id];
    if (type === 'p_rank') return (d.p_rank && d.p_rank[idx]);
    if (type === 'v_rank') return (d.v_rank && d.v_rank[idx]);
    if (type === 'volhigh') {
        const v = (d.volhigh && d.volhigh[idx]);
        return (v && v !== "0") ? "H" : "";
    }
    return "";
}

function getHeatmapStyle(val, type) {
    if (type === 'volhigh') {
        return val === "H" ? "background-color: #f59e0b; color: white; font-weight: bold;" : "";
    }
    if (!val && val !== 0) return "color: #ddd;";
    
    const v = parseFloat(val);
    if (v >= 97) return "background-color: #C71585; color: #fff; font-weight: 900;"; // 亮粉紅

    let r, g, b, textColor;
    const BASE = 240;
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

function generateSparkline(data, color) {
    if (!data || data.length < 2) return '';
    const w = 60, h = 20;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => `${(i/(data.length-1))*w},${h - ((v-min)/range)*h}`).join(' ');
    const stroke = color === 'red' ? '#dc2626' : '#16a34a';
    return `<svg width="${w}" height="${h}" class="mx-auto overflow-visible"><polyline fill="none" stroke="${stroke}" stroke-width="1.5" points="${points}" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
}

// 橋接開啟圖表
window.openChart = function(id) {
    // 為了讓 TrendModal 運作，我們需要把資料掛到 window 上讓它抓
    // 雖然這樣有點 hack，但為了相容舊的 modal 這是最快解法
    const currentData = window.dataContext[g_viewState.activeTab];
    window.fullStockData = currentData.data; // 暫時覆蓋
    window.csvDates = currentData.dates;
    
    const name = currentData.names[id] || id;
    if (window.TrendModal) window.TrendModal.open(id, name);
};