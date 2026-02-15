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
                        <i class="fas fa-book-reader text-blue-500"></i> 使用指南與操作說明
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

<h2>1. 什麼是 PR 值？</h2>

<p>PR ( Percentile Rank ) 即「百分等級」。應用在考試分數，可以做學生排名；應用在股票市場，則可做個股排名。</p>

<p>當某檔股票的股價 <span class="font-bold text-gray-900">PR = 95</span>，代表它的表現贏過市場 <span class="font-bold text-gray-900">95%</span> 的個股，可視為強勢股；反之，PR = 20 代表股價表現疲弱，處於市場的後段班。</p>

<p>投資大師 <a href="https://www.books.com.tw/products/0010889387" target="_blank" style="color:#2563eb; text-decoration:underline; font-weight:500;">威廉．歐尼爾 ( William O'Neil )</a> 著名的「RS（相對強度）」指標，正是運用此概念。他發現飆股在起漲前，股價的 PR 值通常會維持在高檔。</p>

<div class="help-tip">
    <i class="fas fa-lightbulb mr-1 text-amber-500"></i><span class="font-bold text-gray-900"> 觀察：</span> 當「股價 PR」由弱轉強，是否為起漲的開始？
</div>

<a href="img/demo01.png" target="_blank"><img src="img/demo01.png"></a>

<h2>2. 雙 PR 指標</h2>

<h3 style="color:#dc2626; display:flex; align-items:center; gap:8px;">
    <i class="fas fa-chart-line"></i> 股價 PR
</h3>

<p style="margin-bottom:8px;"><span class="font-bold">判斷強弱</span>：將全台上市櫃個股的漲跌進行排名。</p>

<ul>
    <li>數值越高，代表股價走勢強過同業與大盤。</li>
    <li>排除表現落後的弱勢股，鎖定強勢的主流部隊。</li>
</ul>

<div style="margin-bottom: 16px;">

<h3 style="color:#2563eb; display:flex; align-items:center; gap:8px;">
    <i class="fas fa-chart-line"></i> 籌碼 PR
</h3>

<p style="margin-bottom:8px;"><span class="font-bold">偵測動能</span>：針對特定籌碼的流進流出進行排名。</p>

<ul>
    <li>數值越高，代表資金湧入越積極，市場熱度高。</li>
    <li>市場資金有限，具有排他性，往往會優先流向表現突出的標的。</li>
</ul>

<div class="help-tip">
    <i class="fas fa-lightbulb mr-1 text-amber-500"></i><span class="font-bold text-gray-900"> 觀察：</span> 飆股的「股價 PR」與「籌碼 PR」，是否有同時維持在高檔的特性？
</div>
    
<a href="img/demo02.png" target="_blank"><img src="img/demo02.png"></a>

<h2>3. 使用配備</h2>
<ul>
    <li>別用手機：雖然</li>
    <li>安裝XQ全球贏家：從 XQ 全球贏家匯出 CSV 檔案。</li>
    <li>搜尋功能：上方搜尋框支援輸入代碼 (2330) 或名稱 (台積電) 快速查找。</li>
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

        `;
    }
};