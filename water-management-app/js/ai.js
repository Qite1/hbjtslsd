/* ============ AI 接口层：识别照片安全隐患并提出整改意见 ============ */

const AI = (() => {
  // 默认接入：OpenAI 兼容 /chat/completions 视觉接口。apikey 已预填，baseUrl 可按实际服务地址调整
  // （可在「AI 接口」页面中由管理员修改）。
  const DEFAULT_CONFIG = {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: 'sk-b253b08c86e14822bd521bad4a360093'
  };

  function cfg() {
    const c = Store.getAIConfig() || {};
    return Object.assign({}, DEFAULT_CONFIG, c);
  }

  function systemPrompt() {
    return [
      '你是一名资深的水利水电工程质量安全专家，精通《水利水电工程施工质量检验与评定规程》SL176、' +
      '《水利水电工程质量验收标准》SL223、《水利安全生产标准化通用规范》SL/T528 等水利工程安全质量技术规范。',
      '你会收到施工员上传的施工现场照片（可能多张）。请：',
      '1) 逐张识别照片中存在的质量隐患与安全隐患（如高处作业未佩戴安全带、临边临水未设防护、深基坑无支护、' +
      '临时用电私拉乱接、脚手架不规范、围堰渗漏、混凝土浇筑缺陷、施工机械防护缺失、安全帽/救生衣未穿戴等）。',
      '2) 对每一项隐患引用适用的水利工程规范条款，并给出具体、可执行的整改措施。',
      '3) 对无法从照片中确证的隐患（可能被遮挡、角度不清、需要现场复核），请明确标注“需现场核实”。',
      '你必须以 JSON 返回，不要输出任何其他内容，格式如下：',
      '{"risks":[{"title":"隐患标题","description":"隐患描述与规范依据","level":"high|medium|low",' +
      '"rule":"引用的规范名称与条款","action":"针对性整改措施","uncertain":false}],' +
      '"summary":"整体简要评估"}',
      '其中 uncertain=true 表示该隐患需要在现场由施工员进一步核实确认。'
    ].join('\n');
  }

  /* 调用远程接口。多张图时合并为一张多图请求是 OpenAI 的 images 数组；
     为兼容更多中转服务，这里取其中至多一张（第一张）作为图片输入，并说明。 */
  async function callRemote(photosDataUrl, extraNote) {
    const c = cfg();
    if (!c.baseUrl || !c.apiKey) throw new Error('未配置AI服务地址或密钥，请在「AI接口设置」中填写后重试');

    const imageParts = photosDataUrl.slice(0, 3).map(url => ({
      type: 'image_url', image_url: { url }
    }));

    const userText = (extraNote ? ('现场补充说明：' + extraNote + '\n') : '') +
      '请识别以下施工现场照片中的质量与安全隐患，并按规范给出整改意见。' +
      (photosDataUrl.length > 3 ? '（本次取前3张作为代表进行分析）' : '');

    const body = {
      model: c.model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: [{ type: 'text', text: userText }, ...imageParts] }
      ]
    };

    const url = c.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.apiKey },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error('AI服务返回 ' + resp.status + '：' + t.slice(0, 200));
    }
    const data = await resp.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error('AI服务未返回有效结果');
    const json = content.replace(/```json|```/g, '').trim();
    const idx = json.indexOf('{'), end = json.lastIndexOf('}');
    return JSON.parse(json.slice(idx, end + 1));
  }

  /* 本地规则关键词回退：接口失败或未配置时给出基础提示，同时标记需现场核实。
     保证应用离线/接口不通也能演示完整闭环。 */
  const KEYWORDS = [
    { kw: ['安全帽', '头盔'], title: '个人防护装备——未佩戴安全帽', rule: '《水利安全生产标准化通用规范》SL/T528', action: '立即要求作业人员佩戴合格安全帽，并加强入场安全交底与日常检查记录。' },
    { kw: ['安全带', '临边', '护栏', '围栏'], title: '高处/临边作业防护', rule: '《水利水电工程施工安全管理导则》及高处作业有关规定', action: '临边高处作业需设置牢固防护栏杆、安全网并正确系挂安全带，完善警示标识。' },
    { kw: ['基坑', '支护', '挡土'], title: '基坑/沟槽开挖支护', rule: '《水利水电工程基坑施工安全技术规范》', action: '基坑开挖应按规定放坡或设置支护体系，设置上下通道，并做好排水与位移监测。' },
    { kw: ['电线', '电缆', '电箱', '配电'], title: '临时用电安全隐患', rule: '《施工现场临时用电安全技术规范》JGJ46', action: '规范三级配电两级保护，杜绝私拉乱接，线缆架空或穿管敷设并设漏电保护装置。' },
    { kw: ['脚手架', '支架', '排架'], title: '脚手架/模板支架搭设', rule: '《水利水电工程施工安全技术规范》相关规定', action: '支架须按方案搭设并验收合格后使用，设置连墙、剪刀撑，严禁超载堆放。' },
    { kw: ['盾构', '隧洞', '渗漏', '裂缝'], title: '水工结构/衬砌质量隐患', rule: '《水工混凝土施工规范》SL677及质量验收规程', action: '对裂缝、渗漏部位查明原因，按方案采取灌浆/封堵处理，并加强质量验收与观测。' },
    { kw: ['围堰', '水下滑坡', '洪水', '水位'], title: '度汛与围堰安全', rule: '《水利水电工程围堰设计规范》SL645', action: '复核围堰防渗与稳定，制定度汛预案，强化汛期巡查与应急物资配备。' },
    { kw: ['机械', '设备', '吊装', '挖掘机'], title: '机械设备作业安全', rule: '《施工人员安全技术操作规程》', action: '机械作业前检查调试，持证上岗，明确指挥信号，禁止无关人员进入作业半径。' },
    { kw: ['混凝土', '振捣', '蜂窝', '麻面'], title: '混凝土施工质量缺陷', rule: '《水工混凝土施工规范》SL677-2014', action: '加强分层浇筑与振捣控制，对蜂窝麻面按缺陷处理方案修补并履行质量验收程序。' },
    { kw: ['救生衣', '水上', '船', '水位'], title: '水上/临水作业防护', rule: '《水利水电工程施工安全管理导则》水上作业规定', action: '水上及临水作业须穿戴救生衣，配备救生器材并落实专人监护。' }
  ];
  function localAnalyze(extraNote) {
    const text = (extraNote || '').toLowerCase();
    const matched = [];
    const miss = ['安全帽', '安全带', '防护', '基坑', '围堰'].filter(k => !text.includes(k));
    for (const k of KEYWORDS) {
      if (k.kw.some(x => text.includes(x))) {
        matched.push({ title: k.title, description: k.rule, rule: k.rule, action: k.action, level: 'medium', uncertain: true });
      }
    }
    if (matched.length === 0) {
      const r = {};
      miss.forEach((m, i) => r['现场核实点' + (i + 1)] = m);
      matched.push({
        title: '待现场核实的隐患（本地识别）',
        description: 'AI接口暂不可用，无法做图像级识别。请施工员依据照片对照以下要点现地认真核实。',
        rule: '图像AI未启用，建议在「AI接口设置」中配置可用的视觉模型接口以获得照片级识别。',
        action: '请对照：' + miss.join('、') + '等方面在现地进行核实并据实登记整改。',
        level: 'medium', uncertain: true
      });
    }
    return { risks: matched, summary: 'AI接口未能调用，本结果由本地规则生成，所有隐患均需施工员现场核实确认。' };
  }

  /* 对外主入口。成功返回远端结果；失败则回退本地规则并在结果标记 fallback=true */
  async function analyze(photosDataUrl, extraNote) {
    try {
      const res = await callRemote(photosDataUrl, extraNote);
      res.fallback = false;
      return res;
    } catch (e) {
      const fallback = localAnalyze(extraNote);
      fallback.fallback = true;
      fallback.error = String((e && e.message) || e);
      return fallback;
    }
  }

  return { analyze, cfg, defaultConfig: DEFAULT_CONFIG };
})();

/* node 环境下导出（浏览器加载时 module 未定义，不受影响） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AI;
}