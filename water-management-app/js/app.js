/* ============================================================
 * 水利工程质量安全合规管理助手 —— 主逻辑
 * 纯前端静态应用，数据存于浏览器 localStorage
 * ============================================================ */

(function () {
  'use strict';
  const store = Store;
  const app = document.getElementById('app');
  const nav = document.getElementById('mainNav');
  const userBox = document.getElementById('userBox');
  const modalMask = document.getElementById('modalMask');
  const modalBox = document.getElementById('modalBox');
  const toastEl = document.getElementById('toast');

  let curUser = null;
  let toastTimer = null;

  /* ---------------- 启动 ---------------- */
  store.seedUsers();
  const s = store.getSession();
  if (s && store.listUsers().some(u => u.id === s.id)) curUser = store.listUsers().find(u => u.id === s.id);
  render();

  /* ---------------- 工具 ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }
  function userNameById(id) {
    const u = store.listUsers().find(x => x.id === id);
    return u ? u.name : '未知';
  }

  /* ---------------- 渲染框架 ---------------- */
  function render() {
    renderNav();
    renderUserBox();
    if (!curUser) { renderLogin(); return; }
    const page = currentPage();
    if (page === 'home') renderHome();
    else if (page === 'upload') renderUpload();
    else if (page === 'audit') renderAudit();
    else if (page === 'ledger') renderLedger();
    else if (page === 'users' && curUser.role === 'admin') renderUsers();
    else if (page === 'regs') renderRegs();
    else if (page === 'ai') renderAI();
    else renderHome();
    window.scrollTo(0, 0);
  }

  function currentPage() {
    const p = sessionStorage.getItem('wm_page') || 'home';
    return p;
  }
  function go(page) {
    sessionStorage.setItem('wm_page', page);
    render();
  }

  function canSee(page) {
    if (!curUser) return false;
    // 上传隐患：施工员 / 审核员 / 管理员均可使用
    if (page === 'upload') return true;
    // 待审核：审核员、管理员（管理员拥有全部功能权限）
    if (page === 'audit') return curUser.role !== 'builder';
    // 用户管理 / AI 接口：仅管理员
    if (page === 'users' || page === 'ai') return curUser.role === 'admin';
    return true; // home / ledger / regs 所有人可见
  }

  function renderNav() {
    const items = [
      { id: 'home', label: '首页' },
      { id: 'upload', label: '上传隐患' },
      { id: 'audit', label: '待审核' },
      { id: 'ledger', label: '整改台账' },
      { id: 'regs', label: '规范查询' },
      { id: 'users', label: '用户管理' },
      { id: 'ai', label: 'AI接口' }
    ];
    nav.innerHTML = '';
    if (!curUser) return;
    const cur = currentPage();
    for (const it of items) {
      if (!canSee(it.id)) continue;
      const b = document.createElement('button');
      b.textContent = it.label;
      b.className = cur === it.id ? 'active' : '';
      b.onclick = () => go(it.id);
      nav.appendChild(b);
    }
  }

  function renderUserBox() {
    if (!curUser) { userBox.innerHTML = ''; return; }
    const r = ROLES[curUser.role];
    userBox.innerHTML = `
      <div class="user-chip">
        <span>👤 ${esc(curUser.name)}</span>
        <span class="role-badge" style="background:#fff;color:var(--water-700)">${r.label}</span>
      </div>
      <button class="btn btn-sm" onclick="AppLogout()">退出</button>`;
  }

  /* ---------------- 登录 ---------------- */
  function renderLogin() {
    app.innerHTML = `
      <div class="login-wrap">
        <div class="login-hero">
          <h2>🌊 水利工程质量安全合规管理助手</h2>
          <p>以 AI 影像识别赋能现场安全质量隐患排查 · 湖北建投水利水电工程有限公司</p>
        </div>
        <div class="login-body">
          <h3 style="color:var(--ink);margin-bottom:16px">账号登录</h3>
          <div class="field"><label>账号</label><input class="input" id="loginUser" placeholder="请输入账号" autocomplete="username"/></div>
          <div class="field"><label>密码</label><input class="input" id="loginPass" type="password" placeholder="请输入密码" autocomplete="current-password"/></div>
          <button class="btn btn-primary btn-lg" style="width:100%" id="loginBtn">登 录</button>
          <div class="hint-box">
            <strong>内置演示账号：</strong><br/>
            管理员 admin / admin123<br/>
            审核员 shenheyuan / sh123<br/>
            施工员 shigongyuan / sg123
          </div>
        </div>
      </div>`;
    const doLogin = () => {
      const u = document.getElementById('loginUser').value;
      const p = document.getElementById('loginPass').value;
      const user = store.getUserByLogin(u, p);
      if (!user) { toast('账号或密码错误'); return; }
      curUser = user;
      store.setSession({ id: user.id });
      render();
      toast('欢迎回来，' + user.name);
    };
    document.getElementById('loginBtn').onclick = doLogin;
    document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  }

  window.AppLogout = () => {
    curUser = null;
    store.setSession(null);
    sessionStorage.setItem('wm_page', 'home');
    render();
  };

  /* ---------------- 首页 ---------------- */
  function stats(issues) {
    return {
      total: issues.length,
      pending: issues.filter(i => i.status === 'pending').length,
      confirmed: issues.filter(i => i.status === 'confirmed' || i.status === 'rectifying').length,
      rectified: issues.filter(i => i.status === 'rectified' || i.status === 'closed').length,
      high: issues.filter(i => i.risk === 'high').length
    };
  }

  function renderHome() {
    const issues = store.listIssues();
    const s = stats(issues);
    const recent = issues.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);

    const listHtml = recent.length
      ? recent.map(i => `
        <div class="card" style="cursor:pointer" onclick="goLedger('${i.id}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div>
              <strong style="color:var(--ink);font-size:14.5px">${esc(i.title)}</strong>
              <div class="muted" style="margin-top:4px">${esc(i.site || '')} · ${fmtTime(i.createdAt)}</div>
            </div>
            <span class="badge ${RISK_META[i.risk]?.cls || 'low'}">${RISK_META[i.risk]?.label || '低'}风险</span>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span class="badge ${STATUS_META[i.status].cls}">${STATUS_META[i.status].label}</span>
            <span class="muted">提交人：${esc(userNameById(i.builderId))}</span>
          </div>
        </div>`).join('')
      : '<div class="empty">暂无问题记录</div>';

    app.innerHTML = `
      <div class="hero-band">
        <div class="waves"></div>
        <h2>湖北建投水利水电工程有限公司</h2>
        <p>恪守质量安全底线 · 以智能影像识别守护每一处涉水工程建设现场</p>
      </div>

      <div class="card" style="margin-bottom:22px">
        <h3><span class="icon">🏢</span> 公司简介</h3>
        <div class="company-intro">
          <p><strong>湖北建投水利水电工程有限公司</strong>（以下简称“公司”）成立于湖北省域腹地，是一家集水利水电工程施工、质量安全管理、水生态环境治理与工程技术咨询服务于一体的专业化水利施工企业。公司注册资本雄厚，具备水利水电工程施工等多项专业资质，业务范围覆盖水库枢纽、堤防加固、泵站改造、河道整治、灌区配套、大中型水闸、引调水工程及市政给排水等领域。</p>
          <p>公司拥有一支以高级工程师为骨干、注册建造师和水工、机电、岩土等专业技术人才为支撑的施工与安全管理团队，配备先进的测量、试验检测和工程机械设备。先后承建并参与了一大批具有代表性的水利基础设施项目，积累了丰富的复杂地质与涉水作业条件下安全质量管理经验，工程质量合格率与交付满意度保持行业前列。</p>
          <p>作为涉水施工企业，公司始终将<strong>安全生产与工程质量合规</strong>置于企业生命线位置：建立健全覆盖“安全交底—过程检查—隐患整治—闭合销号”的安全生产责任体系，严格落实水利工程安全生产标准化建设要求，执行《水利水电工程施工质量检验与评定规程》SL176、《水利水电工程质量验收标准》SL223以及水利部各项安全管理导则，持续打造零事故、零缺陷的放心工程。</p>
          <p>面向新时代水利高质量发展，公司积极拥抱数字化管理手段，引入人工智能影像识别、信息化台账等工具，将“人防”与“技防”有机结合，推动隐患排查治理向精准化、智能化、闭环化升级。公司将始终秉承“质量为本、安全第一、诚信守约、服务至上”的经营理念，与社会各界携手共建安澜河湖、美丽家园。</p>
        </div>
        <div class="tag-row">
          <span class="tag">🔧 水利水电工程施工</span>
          <span class="tag">🛡️ 质量安全合规管理</span>
          <span class="tag">🌊 水生态环境治理</span>
          <span class="tag">📐 工程技术咨询</span>
          <span class="tag">🧪 试验检测服务</span>
        </div>
      </div>

      <div class="card" style="margin-bottom:22px">
        <h3><span class="icon">🏗️</span> 在建项目简介</h3>
        <p class="muted">公司当前承建的具有代表性的水利工程项目（类型化说明，具体项目名称/地点请按贵司资料替换）：</p>
        <div class="grid cols-2" style="margin-top:14px">
          <div class="reg-card"><strong style="color:var(--ink)">🏞️ 堤防加固与河道整治</strong>
            <div class="muted" style="margin-top:6px">涵盖流域治理、堤防达标加固、护岸工程与清淤疏浚，落实《堤防工程施工规范》SL260 施工与质量要求。</div>
          </div>
          <div class="reg-card"><strong style="color:var(--ink)">🏗️ 水库枢纽与除险加固</strong>
            <div class="muted" style="margin-top:6px">承担水库大坝、溢洪道、输水建筑物的建设与除险，执行《水利水电建设工程验收规程》SL223 全过程质量控制。</div>
          </div>
          <div class="reg-card"><strong style="color:var(--ink)">⚡ 泵站与引调水工程</strong>
            <div class="muted" style="margin-top:6px">机电设备安装、泵站改造与水系连通，强化水下、临水及机电作业安全管理。</div>
          </div>
          <div class="reg-card"><strong style="color:var(--ink)">🌾 灌区配套与农田水利</strong>
            <div class="muted" style="margin-top:6px">渠道衬砌、节制闸与田间配套工程，推进农业节水与粮食安全保障。</div>
          </div>
        </div>
        <div class="hint-box" style="margin-top:14px">
          <strong>说明：</strong>本「在建项目简介」为类型化示例，请将具体项目名称、位置、合同额与形象进度等，按随附的公司图片资料填写替换。
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card"><div class="num">${s.total}</div><div class="label">问题总数</div></div>
        <div class="stat-card"><div class="num">${s.pending}</div><div class="label">待审核</div></div>
        <div class="stat-card"><div class="num">${s.confirmed}</div><div class="label">确认/整改中</div></div>
        <div class="stat-card"><div class="num">${s.rectified}</div><div class="label">已整改销号</div></div>
        <div class="stat-card"><div class="num" style="color:var(--danger)">${s.high}</div><div class="label">高风险项</div></div>
      </div>

      <div class="section-title">📋 问题及整改情况预览 <span class="muted" style="font-size:13px;font-weight:400">（点击卡片跳转整改台账）</span></div>
      <div class="grid cols-2" id="previewGrid">${listHtml}</div>`;
    renderMiniBars();
  }
  function goLedger(id) {
    sessionStorage.setItem('wm_page', 'ledger');
    sessionStorage.setItem('wm_issue_focus', id);
    render();
  }

  /* 首页简易图表（用 div 做横条） */
  function renderMiniBars() {
    const issues = store.listIssues();
    const total = issues.length || 1;
    const before = issues.filter(i => i.status === 'pending' || i.status === 'confirmed').length;
    const done = issues.filter(i => i.status === 'rectified' || i.status === 'closed').length;
    const pct = (done / total * 100).toFixed(1);
    app.insertAdjacentHTML('beforeend', `
      <div class="card" style="margin-top:22px">
        <h3><span class="icon">📊</span> 整改闭合情况</h3>
        <div style="height:18px;border-radius:999px;background:var(--water-100);overflow:hidden;margin:6px 0 10px">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--ok),#3fd0a0);border-radius:999px"></div>
        </div>
        <div style="display:flex;gap:24px;font-size:13.5px;flex-wrap:wrap">
          <span>已完成并销号：<strong style="color:var(--ok)">${done}</strong> 项（${pct}%）</span>
          <span>办理中：<strong style="color:var(--warn)">${before}</strong> 项</span>
          <span class="link" onclick="go('ledger')">进入整改台账 →</span>
        </div>
      </div>`);
  }

  /* ---------------- 上传隐患（施工员） ---------------- */
  function renderUpload() {
    app.innerHTML = `
      <div class="section-title">📸 上传施工现场照片，AI 智能识别隐患</div>
      <div class="card">
        <h3><span class="icon">🧠</span> AI 影像识别</h3>
        <p class="muted">上传现场照片后，系统将调用 AI 图像识别接口，依据水利工程安全、质量技术规范自动识别隐患并生成整改意见。AI 不确定的项会提示<strong style="color:var(--warn)">“需现场核实”</strong>，请施工员实地确认。</p>

        <div class="field" style="margin-top:14px">
          <label>隐患标题</label>
          <input class="input" id="upTitle" placeholder="如：堤防迎水侧临边高处作业无防护" />
        </div>
        <div class="field">
          <label>施工部位 / 位置</label>
          <input class="input" id="upSite" placeholder="如：#3 闸室上游围堰右侧" />
        </div>
        <div class="field">
          <label>现场补充说明（可选，可帮助AI更准确判断）</label>
          <textarea class="input" id="upNote" placeholder="可描述现场环境、作业内容等，较多张照片时AI可能抽样识别"></textarea>
        </div>

        <div class="field">
          <label>上传现场照片（可多选，支持 jpg/png）</label>
          <div class="dropzone" id="dropzone">
            <div style="font-size:34px">📷</div>
            <p style="font-weight:600">点击选择照片，或拖拽到此处</p>
            <p class="muted">不超过 6 张，每张会自动压缩以利于上传识别</p>
            <input type="file" id="fileInput" accept="image/*" multiple style="display:none" />
          </div>
          <div class="photo-previews" id="upPhotos"></div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary btn-lg" id="analyzeBtn">🚀 开始 AI 识别</button>
          <button class="btn btn-ghost btn-lg" onclick="go('home')">返回</button>
        </div>
        <div id="upResult"></div>
      </div>`;

    let photos = [];
    const previews = document.getElementById('upPhotos');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');

    function addFiles(files) {
      const arr = Array.from(files);
      for (const f of arr) {
        if (photos.length >= 6) { toast('最多上传6张'); break; }
        if (!/^image\//.test(f.type)) continue;
        const reader = new FileReader();
        reader.onload = e => {
          const src = e.target.result;
          compressImage(src, img => { photos.push(img); draw(); });
        };
        reader.readAsDataURL(f);
      }
    }
    dropzone.onclick = () => fileInput.click();
    fileInput.onchange = () => { addFiles(fileInput.files); fileInput.value = ''; };
    dropzone.ondragover = e => { e.preventDefault(); dropzone.classList.add('dragover'); };
    dropzone.ondragleave = () => dropzone.classList.remove('dragover');
    dropzone.ondrop = e => { e.preventDefault(); dropzone.classList.remove('dragover'); addFiles(e.dataTransfer.files); };

    function draw() {
      previews.innerHTML = photos.map((p, i) => `
        <div class="ph"><img src="${p}" alt="照片${i+1}"/><button class="del" data-i="${i}">✕</button></div>`).join('');
      previews.querySelectorAll('.del').forEach(b => b.onclick = () => { photos.splice(+b.dataset.i, 1); draw(); });
    }

    document.getElementById('analyzeBtn').onclick = async () => {
      const title = document.getElementById('upTitle').value.trim();
      const site = document.getElementById('upSite').value.trim();
      const note = document.getElementById('upNote').value.trim();
      const resultEl = document.getElementById('upResult');
      const btn = document.getElementById('analyzeBtn');
      if (!title) { toast('请填写隐患标题'); return; }
      if (!photos.length) { toast('请至少上传一张图片'); return; }
      btn.disabled = true;
      resultEl.innerHTML = `<div class="ai-result"><span class="loader"></span> AI 正在识别照片中的安全隐患，请稍候……</div>`;
      try {
        const aiResult = await AI.analyze(photos, note);
        renderAIResult(resultEl, { title, site, note, aiResult, photos });
      } catch (e) {
        resultEl.innerHTML = `<div class="ai-result" style="border-color:var(--danger)">识别失败：${esc(e.message)}</div>`;
      } finally {
        btn.disabled = false;
      }
    };
  }

  /* 压缩图片到适合上传与存储的尺寸 */
  function compressImage(dataUrl, cb) {
    const img = new Image();
    img.onload = () => {
      const MAX = 900;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        const r = Math.max(w, h);
        w = Math.round(w * MAX / r); h = Math.round(h * MAX / r);
      }
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(cv.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => cb(dataUrl);
    img.src = dataUrl;
  }

  function renderAIResult(container, { title, site, note, aiResult, photos }) {
    if (aiResult.fallback && aiResult.error) {
      container.innerHTML = `<div class="ai-result" style="border-color:var(--warn)">
        <p>⚠️ <strong>AI 在线识别暂不可用</strong>：${esc(aiResult.error)}</p>
        <p class="muted">已启用本地规则提示，请施工员务必现场核实每一项。<button class="link" style="background:none;border:none" onclick="openAISettings()">前往配置 AI 接口 →</button></p>
      </div>`;
    }
    const risks = aiResult.risks || [];
    const riskCards = risks.map((r, i) => `
      <div class="risk-item ${r.uncertain ? '' : 'suggest'}" style="${r.uncertain ? '' : 'border-left-color:var(--ok)'}">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <strong style="color:var(--ink)">${i + 1}. ${esc(r.title)}</strong>
          <span class="badge ${RISK_META[r.level]?.cls || 'low'}">${RISK_META[r.level]?.label || '低'}风险</span>
        </div>
        <div class="muted" style="margin-top:5px">${esc(r.description || '')}</div>
        <div style="margin-top:6px;font-size:13px">📖 规范依据：${esc(r.rule || '—')}</div>
        <div style="margin-top:6px;font-size:13px">🛠️ 整改措施：${esc(r.action || '—')}</div>
        ${r.uncertain ? '<div style="margin-top:6px"><span class="badge medium">需现场核实</span> <span class="muted">该隐患 AI 判断把握不足，请在下方勾选并经现场核实后确认。</span></div>' : ''}
        <label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:13px;cursor:pointer">
          <input type="checkbox" class="risk-confirm" data-i="${i}" checked> 我已在现场核实，确认并入台账
        </label>
      </div>`).join('');

    container.innerHTML = `
      <div class="ai-result">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:10px">
          <strong style="color:var(--ink);font-size:16px">🔍 AI 识别结果</strong>
          <span class="muted">AI评估：${esc(aiResult.summary || '')}</span>
        </div>
        ${riskCards || '<div class="empty">未识别出明确隐患</div>'}
        <div class="form-actions" style="margin-top:12px">
          <button class="btn btn-success btn-lg" id="submitIssue">✅ 全部确认并提交审核员</button>
          <button class="btn btn-ghost" id="redoBtn">重新识别</button>
        </div>
      </div>`;
    document.getElementById('redoBtn').onclick = () => renderUpload();

    document.getElementById('submitIssue').onclick = () => {
      const kept = risks.filter((r, i) => [...document.querySelectorAll('.risk-confirm')].some((c) => c.checked && +c.dataset.i === i));
      if (!kept.length) { toast('请至少确认一项隐患'); return; }
      const maxRisk = ['high', 'medium', 'low'].find(lv => kept.some(r => r.level === lv)) || 'medium';
      const issue = store.saveIssue({
        id: Store.uid(),
        title: title || '未命名隐患',
        site: site || '',
        note: note || '',
        photos: photos.slice(0, 4),
        risks: kept,
        summary: aiResult.summary || '',
        risk: maxRisk,
        status: 'pending',
        builderId: curUser.id,
        auditorId: null,
        aiFallback: !!aiResult.fallback,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        history: [
          { t: '提交审核', by: curUser.id, at: Date.now(), content: '施工员提交，等待审核员确认' }
        ]
      });
      toast('已提交，等待审核员确认');
      go('ledger');
      sessionStorage.setItem('wm_issue_focus', issue.id);
      render();
    };
  }

  /* ---------------- 待审核（审核员） ---------------- */
  function renderAudit() {
    const list = store.listIssues().filter(i => i.status === 'pending')
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    app.innerHTML = `
      <div class="section-title">🕵️ 待审核清单 <span class="muted" style="font-size:13px">审核员确认后形成整改台账</span></div>
      <div id="auditList">${list.length
        ? list.map(issueCard.bind(null, 'audit')).join('')
        : '<div class="card empty">暂无待审核的问题</div>'}</div>`;
  }

  function issueCard(mode, i) {
    const s = STATUS_META[i.status];
    return `
      <div class="card" style="margin-bottom:16px" id="issue_${i.id}">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <strong style="color:var(--ink);font-size:16px">${esc(i.title)}</strong>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <span class="badge ${RISK_META[i.risk]?.cls||'low'}">${RISK_META[i.risk]?.label||'低'}风险</span>
            <span class="badge ${s.cls}">${s.label}</span>
          </div>
        </div>
        <div class="muted" style="margin:4px 0 8px">${esc(i.site||'未填部位')} · ${fmtTime(i.createdAt)} · 提交人：${esc(userNameById(i.builderId))}${i.note ? ' · 说明：' + esc(i.note) : ''}${i.aiFallback ? ' · <span style="color:var(--warn)">本地识别</span>' : ''}</div>
        ${i.photos && i.photos.length ? `<div class="photo-previews">${i.photos.map(p=>`<div class="ph"><img src="${p}"/></div>`).join('')}</div>` : '<div class="muted">未附照片</div>'}
        <div style="margin-top:10px">
          ${(i.risks||[]).map((r,ix)=>`
            <div class="risk-item ${r.uncertain?'':'suggest'}" style="${r.uncertain?'':'border-left-color:var(--ok)'}">
              <div style="display:flex;justify-content:space-between;gap:8px"><strong>${ix+1}. ${esc(r.title)}</strong><span class="badge ${RISK_META[r.level]?.cls||'low'}">${RISK_META[r.level]?.label||'低'}</span></div>
              <div style="margin-top:4px">📖 ${esc(r.rule||'—')}</div>
              <div>🛠️ ${esc(r.action||'—')}</div>
              ${r.uncertain?'<span class="badge medium" style="margin-top:4px">需现场核实</span>':''}
            </div>`).join('')}
        </div>
        <div class="form-actions" style="margin-top:12px">${actionsFor(i, mode)}</div>
      </div>`;
  }

  /* 根据角色与状态给出操作按钮 */
  function actionsFor(i, mode) {
    const b = [];
    if (i.status === 'pending' && mode === 'audit') {
      b.push(`<button class="btn btn-success btn-sm" onclick="ApprConfirmIssue('${i.id}')">✅ 确认入台账</button>`);
      b.push(`<button class="btn btn-warn btn-sm" onclick="ApprEditIssue('${i.id}')">✏️ 修改意见</button>`);
    }
    if (i.status === 'confirmed') {
      b.push(`<button class="btn btn-warn btn-sm" onclick="ApprStartRectify('${i.id}')">🔧 开始整改</button>`);
    }
    if (i.status === 'rectifying') {
      b.push(`<button class="btn btn-success btn-sm" onclick="ApprMarkRectified('${i.id}')">✅ 标记已整改</button>`);
    }
    if (i.status === 'rectified') {
      b.push(`<button class="btn btn-secondary btn-sm" onclick="ApprCloseIssue('${i.id}')">🔒 销号</button>`);
    }
    // 台账编辑：审核员与管理员可编辑（删除、修改）
    if (mode === 'ledger' && (curUser.role === 'auditor' || curUser.role === 'admin')) {
      b.push(`<button class="btn btn-secondary btn-sm" onclick="ApprEditIssue('${i.id}')">✏️ 编辑台账</button>`);
    }
    // 施工员、审核员、管理员均可删除
    if (curUser.role === 'builder' || curUser.role === 'auditor' || curUser.role === 'admin') {
      b.push(`<button class="btn btn-danger-ghost btn-sm" onclick="ApprDeleteIssue('${i.id}')">🗑️ 删除</button>`);
    }
    return b.join('');
  }

  /* 审核通过 → confirmed */
  window.ApprConfirmIssue = (id) => {
    const i = store.getIssue(id);
    if (!i) return;
    i.status = 'confirmed';
    i.auditorId = curUser.id;
    i.history = i.history || [];
    i.history.push({ t: '审核确认', by: curUser.id, at: Date.now(), content: '审核员确认问题属实，纳入整改台账' });
    store.saveIssue(i);
    toast('已确认并入台账');
    render();
  };

  window.ApprStartRectify = (id) => {
    const i = store.getIssue(id);
    if (!i) return;
    i.status = 'rectifying';
    i.history.push({ t: '开始整改', by: curUser.id, at: Date.now(), content: '已下达整改任务' });
    store.saveIssue(i); toast('已下达整改，进入整改中'); render();
  };
  window.ApprMarkRectified = (id) => {
    const i = store.getIssue(id);
    if (!i) return;
    i.status = 'rectified';
    i.rectifiedAt = Date.now();
    i.history.push({ t: '已整改', by: curUser.id, at: Date.now(), content: '施工单位报告已完成整改' });
    store.saveIssue(i); toast('已标记整改完成'); render();
  };
  window.ApprCloseIssue = (id) => {
    const i = store.getIssue(id);
    if (!i) return;
    i.status = 'closed';
    i.history.push({ t: '销号', by: curUser.id, at: Date.now(), content: '现场复核通过，完成销号' });
    store.saveIssue(i); toast('已完成销号'); render();
  };
  window.ApprDeleteIssue = (id) => {
    openConfirm('确定删除该问题记录？删除后不可恢复。', () => {
      store.deleteIssue(id); toast('已删除'); render();
    });
  };

  /* 修改/编辑台账（审核员、管理员） */
  window.ApprEditIssue = (id) => {
    const i = store.getIssue(id);
    if (!i) return;
    openModal(`
      <h3>✏️ 编辑问题与整改台账</h3>
      <div class="field"><label>隐患标题</label><input class="input" id="edTitle" value="${esc(i.title)}"/></div>
      <div class="field"><label>风险等级</label>
        <select class="input" id="edRisk">
          ${Object.keys(RISK_META).map(k=>`<option value="${k}" ${i.risk===k?'selected':''}>${RISK_META[k].label}风险</option>`).join('')}
        </select></div>
      <div class="field"><label>处理状态</label>
        <select class="input" id="edStatus">
          ${Object.keys(STATUS_META).map(k=>`<option value="${k}" ${i.status===k?'selected':''}>${STATUS_META[k].label}</option>`).join('')}
        </select></div>
      <div class="field"><label>整改意见（可增补/修改）</label>
        <textarea class="input" id="edAction" rows="3">${esc((i.risks||[]).map(r=>'· '+(r.title)+'：'+(r.action||'')).join('\n'))}</textarea></div>
      <div class="form-actions">
        <button class="btn btn-primary" id="edSave">保存</button>
        <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      </div>`);
    document.getElementById('edSave').onclick = () => {
      i.title = document.getElementById('edTitle').value.trim() || i.title;
      i.risk = document.getElementById('edRisk').value;
      i.status = document.getElementById('edStatus').value;
      const ta = document.getElementById('edAction').value;
      if (ta.trim()) {
        const lines = ta.split('\n').map(l=>l.trim()).filter(Boolean);
        i.risks = lines.map((l,ix)=>({
          title: ('整改项' + (ix+1)), action: l.replace(/^[·\-]\s*/, ''), rule: '', description: '', level: i.risk||'medium', uncertain:false
        }));
        i.summary = '台账已由审核员编辑调整';
      }
      i.history.push({ t: '台账编辑', by: curUser.id, at: Date.now(), content: '审核员/管理员编辑了台账' });
      store.saveIssue(i);
      closeModal(); toast('台账已更新'); render();
    };
  };

  /* ---------------- 整改台账（所有人可见，含流转） ---------------- */
  function renderLedger() {
    const focus = sessionStorage.getItem('wm_issue_focus') || '';
    sessionStorage.removeItem('wm_issue_focus');
    const issues = store.listIssues().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    const rows = issues.map(i => `
      <div id="row_${i.id}">${issueCard('ledger', i)}</div>`).join('');
    app.innerHTML = `
      <div class="section-title">📋 问题与整改台账 <span class="muted" style="font-size:13px">施工员在此反馈整改进度，审核员/管理员可维护</span></div>
      <div id="ledgerList">${issues.length ? rows : '<div class="card empty">台账为空</div>'}</div>`;
    if (focus) {
      const el = document.getElementById('issue_' + focus);
      if (el) { el.style.boxShadow = '0 0 0 3px var(--warn)'; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  }

  // 提供整改进度反馈的表单（施工员侧附加）
  window.AppendRectifyNote = null; // 预留：施工员可追加整改说明

  /* ---------------- 用户管理（管理员） ---------------- */
  function renderUsers() {
    const users = store.listUsers();
    app.innerHTML = `
      <div class="section-title">👥 用户与权限管理 <span class="muted" style="font-size:13px">管理员可为用户赋予管理员/审核员/施工员身份</span></div>
      <div class="card" style="margin-bottom:18px">
        <h3><span class="icon">➕</span> 新增用户</h3>
        <div class="field" style="display:inline-block;vertical-align:top;margin-right:10px;width:200px"><label>账号</label><input class="input" id="nuUser"/></div>
        <div class="field" style="display:inline-block;vertical-align:top;margin-right:10px;width:200px"><label>姓名</label><input class="input" id="nuName"/></div>
        <div class="field" style="display:inline-block;vertical-align:top;margin-right:10px;width:200px"><label>初始密码</label><input class="input" id="nuPass" value="123456"/></div>
        <div class="field" style="display:inline-block;vertical-align:top;width:160px"><label>身份</label>
          <select class="input" id="nuRole"><option value="builder">施工员</option><option value="auditor">审核员</option><option value="admin">管理员</option></select></div>
        <div><button class="btn btn-primary" id="nuAdd">创建用户</button></div>
      </div>
      <div class="card">
        <div class="table-wrap"><table>
          <thead><tr><th>姓名</th><th>账号</th><th width="90">身份</th><th width="170">调整身份</th><th width="120">操作</th></tr></thead>
          <tbody>
            ${users.map(u=>`
              <tr>
                <td>${esc(u.name)}</td><td>${esc(u.username)}</td>
                <td><span class="badge ${ROLES[u.role].badge}">${ROLES[u.role].label}</span></td>
                <td>
                  <select class="input" style="padding:5px;font-size:12.5px" onchange="ApprSetRole('${u.id}', this.value)">
                    ${Object.keys(ROLES).map(k=>`<option value="${k}" ${u.role===k?'selected':''}>${ROLES[k].label}</option>`).join('')}
                  </select>
                </td>
                <td>${u.id === curUser.id ? '<span class="muted">当前账号</span>' : `<button class="btn btn-danger-ghost btn-sm" onclick="ApprDelUser('${u.id}')">删除</button>`}</td>
              </tr>`).join('')}
          </tbody></table></div>
      </div>`;
    document.getElementById('nuAdd').onclick = () => {
      const un = document.getElementById('nuUser').value.trim();
      const nm = document.getElementById('nuName').value.trim();
      const pw = document.getElementById('nuPass').value || '123456';
      const role = document.getElementById('nuRole').value;
      if (!un || !nm) { toast('请填写账号与姓名'); return; }
      if (store.findByUsername(un)) { toast('该账号已存在'); return; }
      store.createUser({ username: un, name: nm, password: pw, role, phone: '' });
      toast('用户已创建'); render();
    };
  }
  window.ApprSetRole = (id, role) => {
    const u = store.listUsers().find(x => x.id === id);
    if (!u) return;
    u.role = role; store.saveUser(u); toast('身份已更新为「' + ROLES[role].label + '」');
  };
  window.ApprDelUser = (id) => {
    openConfirm('确定删除该用户？', () => { store.deleteUser(id); toast('已删除'); render(); });
  };

  /* ---------------- 规范查询 ---------------- */
  function renderRegs() {
    const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, '');
    const kw = norm(sessionStorage.getItem('wm_reg_kw') || '');
    const cat = sessionStorage.getItem('wm_reg_cat') || '全部';
    const cats = ['全部', ...new Set(REGULATIONS.map(r => r.category))];
    const list = REGULATIONS.filter(r =>
      (cat === '全部' || r.category === cat) &&
      (norm(r.name).includes(kw) || norm(r.src || '').includes(kw))
    );
    const chips = cats.map(c => `
      <button class="btn btn-sm ${c === cat ? 'btn-primary' : 'btn-ghost'}" style="margin:0 6px 6px 0"
        onclick="RegFilter('${c}')">${esc(c)}</button>`).join('');
    const cards = list.map(r => `
      <div class="reg-card">
        <div class="reg-name">📘 <a href="${r.link}" target="_blank" rel="noopener">${esc(r.name)}</a>
          <span class="badge low" style="margin-left:6px">${esc(r.category || '')}</span></div>
        <div class="reg-desc">来源：${esc(r.src || '—')} · 点击下方按钮跳转到权威平台在线查询该规范。</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn btn-secondary btn-sm" href="${r.link}" target="_blank" rel="noopener">🔍 在线查询</a>
          <span class="muted" style="line-height:26px">${esc(r.link)}</span>
        </div>
      </div>`).join('');
    app.innerHTML = `
      <div class="section-title">📖 水利工程规范查询 <span class="muted" style="font-size:13px">共 ${REGULATIONS.length} 部 · 点击即跳转权威来源查询</span></div>
      <div class="card" style="margin-bottom:18px">
        <div class="field" style="margin:0"><input class="input" id="regKw" placeholder="输入规范名称 / 编号关键字过滤，如：质量 / 安全 / 施工 / SL176" value="${esc(sessionStorage.getItem('wm_reg_kw') || '')}"/></div>
        <div class="tag-row">${chips}</div>
        <div class="muted" style="margin-top:8px">数据来源：全国标准信息公共服务平台（含水利部归口行业标准 SL）、国家法律法规数据库、住建部等行业/国标权威渠道。点击「在线查询」将打开对应权威平台的检索结果页。</div>
      </div>
      <div class="grid cols-3">${cards || '<div class="empty">无匹配结果</div>'}</div>`;
    document.getElementById('regKw').addEventListener('input', e => {
      sessionStorage.setItem('wm_reg_kw', e.target.value);
      renderRegs();
    });
  }
  window.RegFilter = (c) => {
    sessionStorage.setItem('wm_reg_cat', c);
    renderRegs();
  };

  /* ---------------- AI 接口设置（管理员） ---------------- */
  function renderAI() {
    const c = AI.cfg();
    app.innerHTML = `
      <div class="section-title">🤖 AI 接口设置 <span class="muted" style="font-size:13px">管理员可在此配置在线视觉模型接口地址与密钥</span></div>
      <div class="card" style="max-width:640px">
        <h3><span class="icon">🔌</span> 接口参数</h3>
        <div class="field"><label>接口地址 BaseURL（OpenAI 兼容，自动追加 /chat/completions）</label><input class="input" id="aiBase" value="${esc(c.baseUrl)}"/></div>
        <div class="field"><label>模型名称（需支持图片视觉输入）</label><input class="input" id="aiModel" value="${esc(c.model)}"/></div>
        <div class="field"><label>API Key</label><input class="input" id="aiKey" type="password" value="${esc(c.apiKey)}" placeholder="sk-…"/></div>
        <div class="hint-box">
          <strong>说明：</strong>系统会调用 <code>/chat/completions</code> 发送 JSON 视觉请求，要求模型按水利工程安全质量规范识别照片隐患并输出整改意见。若接口不可用，将自动回退到本地规则识别并标记“需现场核实”。
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" id="aiSave">保存并测试</button>
          <button class="btn btn-ghost" id="aiClearKey">清空密钥</button>
        </div>
      </div>`;
    document.getElementById('aiSave').onclick = () => {
      const baseUrl = document.getElementById('aiBase').value.trim();
      const model = document.getElementById('aiModel').value.trim();
      const apiKey = document.getElementById('aiKey').value.trim();
      if (!baseUrl || !apiKey) { toast('请填写接口地址与密钥'); return; }
      Store.setAIConfig({ baseUrl, model, apiKey });
      toast('配置已保存'); render();
    };
    document.getElementById('aiClearKey').onclick = () => {
      Store.setAIConfig({ baseUrl: c.baseUrl, model: c.model, apiKey: '' });
      toast('密钥已清空'); render();
    };
  }
  window.openAISettings = () => { sessionStorage.setItem('wm_page', 'ai'); render(); };

  /* ---------------- 弹窗与确认 ---------------- */
  function openModal(html) {
    modalBox.innerHTML = html;
    modalMask.style.display = 'flex';
  }
  window.closeModal = () => { modalMask.style.display = 'none'; modalBox.innerHTML = ''; };
  modalMask.addEventListener('click', e => { if (e.target === modalMask) closeModal(); });

  function openConfirm(msg, cb) {
    openModal(`
      <h3>⚠️ 确认操作</h3>
      <p style="color:var(--muted);margin:10px 0 20px">${esc(msg)}</p>
      <div class="form-actions">
        <button class="btn btn-danger" id="okBtn">确认</button>
        <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      </div>`);
    document.getElementById('okBtn').onclick = () => { closeModal(); cb && cb(); };
  }

  /* 供内联事件处理器使用的全局入口 */
  window.go = go;
  window.goLedger = goLedger;
  window.Store = store;
})();