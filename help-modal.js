// ==========================================
// help-modal.js - 使用教學視窗 (含樣式指南)
// ==========================================

window.HelpModal = {
    modalId: 'help-modal-overlay',
    
    init: function() {
        if (document.getElementById(this.modalId)) return;

        const html = `
        <style>
            #${this.modalId} {
                display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center;
                backdrop-filter: blur(2px);
            }
            .help-content {
                background: #fff; 
                width: 90%; max-width: 1000px; height: 85vh; 
                border-radius: 12px; display: flex; flex-direction: column;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2); overflow: hidden;
                animation: helpFadeIn 0.2s ease-out;
            }
            @keyframes helpFadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
            
            .help-header {
                padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;
                background: #f9fafb;
            }
            .help-body {
                padding: 30px; overflow-y: auto; line-height: 1.7; color: #374151; font-size: 16px;
            }
            
            /* 文章樣式 */
            .help-body h2 { font-size: 1.4em; font-weight: bold; color: #1f2937; margin-top: 35px; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
            .help-body h2:first-child { margin-top: 0; }
            .help-body h3 { font-size: 1.1em; font-weight: bold; color: #4b5563; margin-top: 20px; margin-bottom: 10px; }
            .help-body p { margin-bottom: 15px; text-align: justify; }
            .help-body ul { list-style-type: disc; padding-left: 25px; margin-bottom: 20px; color: #4b5563; }
            .help-body li { margin-bottom: 8px; }
            .help-body strong { color: #2563eb; font-weight: 600; }
            .help-body code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #db2777; font-size: 0.9em; border: 1px solid #e5e7eb; }
            .help-tip { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 4px 4px 0; color: #1e40af; font-size: 0.95em; }
            
            /* 樣式展示專用 */
            .color-box { width: 100%; height: 30px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
            .grid-cols-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
        </style>

        <div id="${this.modalId}">
            <div class="help-content">
                <div class="help-header">
                    <div class="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <i class="fas fa-book-reader text-blue-500"></i> 使用教學指南
                    </div>
                    <button onclick="window.HelpModal.close()" class="text-gray-400 hover:text-gray-600 text-3xl leading-none">&times;</button>
                </div>
                <div class="help-body" id="help-body-content"></div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById(this.modalId).addEventListener('click', (e) => {
            if (e.target.id === this.modalId) this.close();
        });
    },

    open: function() {
        this.init();
        document.getElementById('help-body-content').innerHTML = this.getContent();
        document.getElementById(this.modalId).style.display = 'flex';
    },

    close: function() {
        const modal = document.getElementById(this.modalId);
        if (modal) modal.style.display = 'none';
    },

    getContent: function() {
        return `
            <h2>1. 系統簡介</h2>
            <p>這是一個專為台股投資人設計的 <strong>PR (Percentile Rank) 排名系統</strong>。透過大數據分析，協助您快速找出市場中「股價強勢」與「成交量活絡」的個股或族群。</p>

            <img src="img/demp.png">
            
            <div class="help-tip">
                <i class="fas fa-lightbulb"></i> <strong>提示：</strong> 本系統完全在您的瀏覽器端執行，資料不會上傳至伺服器，請安心使用。
            </div>

            <h2>2. 快速上手步驟</h2>
            <ul>
                <li><strong>準備資料：</strong> 從 XQ 全球贏家匯出 CSV 檔案。</li>
                <li><strong>匯入系統：</strong> 點擊右上角的 <code>匯入 CSV 資料</code> 按鈕，系統會自動判斷個股或族群。</li>
                <li><strong>搜尋功能：</strong> 上方搜尋框支援輸入代碼 (2330) 或名稱 (台積電) 快速查找。</li>
            </ul>

            <h2>3. PR 值解讀</h2>
            <p>本系統使用熱力圖顏色來區分強弱：</p>
            <ul>
                <li><strong>價 PR (紅色系)：</strong> 數值 95~100 為極強勢區，背景為深紅色。</li>
                <li><strong>量 PR (藍色系)：</strong> 數值越高代表成交量相對歷史大量，動能強勁。</li>
                <li><strong>量創高 (★)：</strong> 當日成交量創下區間新高時顯示。</li>
            </ul>

            <h2>4. 圖表操作</h2>
            <p>點擊列表中的名稱可開啟 <strong>K 線走勢圖</strong>：</p>
            <ul>
                <li><strong>縮放：</strong> 滾動滑鼠滾輪。</li>
                <li><strong>查價：</strong> 移動滑鼠查看十字查價線數值。</li>
                <li><strong>圖例：</strong> 標題旁有 20MA(橘)、50MA(綠)、PR(紫) 等顏色說明。</li>
            </ul>

            <h2>5. 開發者樣式參考 (Tailwind CSS)</h2>
            <p>本系統使用 Tailwind CSS 框架，以下是系統中常用的顏色與 class 定義，供開發維護參考：</p>
            
            <h3>(A) 漲跌配色 (台股慣例)</h3>
            <div class="grid-cols-4">
                <div class="color-box" style="background-color: #dc2626;">漲 (text-red-600)</div>
                <div class="color-box" style="background-color: #ef4444;">漲底 (bg-red-500)</div>
                <div class="color-box" style="background-color: #16a34a;">跌 (text-green-600)</div>
                <div class="color-box" style="background-color: #22c55e;">跌底 (bg-green-500)</div>
            </div>

            <h3>(B) PR 熱力圖配色</h3>
            <div class="grid-cols-4">
                <div class="color-box" style="background-color: #C71585;">價PR 強 (紫紅)</div>
                <div class="color-box" style="background-color: #2962FF;">量PR 強 (寶藍)</div>
                <div class="color-box" style="background-color: #e5e7eb; color:#555;">無資料 (gray-200)</div>
                <div class="color-box" style="background-color: #f3f4f6; color:#555;">背景 (gray-100)</div>
            </div>

            <h3>(C) 常用排版 Class</h3>
            <ul>
                <li><code>flex</code> / <code>flex-col</code>：彈性佈局 (橫向/直向)</li>
                <li><code>justify-between</code>：左右撐開對齊</li>
                <li><code>items-center</code>：垂直置中</li>
                <li><code>p-4</code> / <code>m-2</code>：內距 padding / 外距 margin</li>
                <li><code>w-full</code> / <code>h-screen</code>：寬度 100% / 高度 100vh</li>
                <li><code>text-sm</code> / <code>font-bold</code>：小字體 / 粗體</li>
            </ul>
            <p>更多樣式請參考 <a href="https://tailwindcss.com/docs" target="_blank" style="color:#2563eb; text-decoration:underline;">Tailwind CSS 官方文件</a>。</p>
        `;
    }
};