/* ============ 数据层：localStorage 持久化 ============ */
const Store = (() => {
  const USERS_KEY = 'wm_users';
  const ISSUES_KEY = 'wm_issues';
  const AI_KEY = 'wm_ai_config';
  const SESSION_KEY = 'wm_session';

  const uid = () => 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  const read = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  };
  const write = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  // ------- 用户 -------
  function seedUsers() {
    const list = read(USERS_KEY, []);
    if (list.length) return;
    list.push(
      { id: uid(), username: 'admin', password: 'admin123', name: '系统管理员', role: 'admin', phone: '', createdAt: Date.now() },
      { id: uid(), username: 'shenheyuan', password: 'sh123', name: '张审核员', role: 'auditor', phone: '', createdAt: Date.now() },
      { id: uid(), username: 'shigongyuan', password: 'sg123', name: '李施工员', role: 'builder', phone: '13800000000', createdAt: Date.now() }
    );
    write(USERS_KEY, list);
  }

  const getUserByLogin = (username, password) =>
    read(USERS_KEY, []).find(u => u.username === username.trim() && u.password === password);

  const listUsers = () => read(USERS_KEY, []);

  function saveUser(user) {
    const list = read(USERS_KEY, []);
    const i = list.findIndex(u => u.id === user.id);
    if (i >= 0) list[i] = user; else list.push(user);
    write(USERS_KEY, list);
  }

  const createUser = (user) => { user.id = uid(); user.createdAt = Date.now(); saveUser(user); return user; };
  const deleteUser = (id) => write(USERS_KEY, read(USERS_KEY, []).filter(u => u.id !== id));
  const findByUsername = (username) => read(USERS_KEY, []).find(u => u.username === username.trim());

  // ------- 问题台账 -------
  const listIssues = () => read(ISSUES_KEY, []);

  function saveIssue(issue) {
    const list = read(ISSUES_KEY, []);
    if (!issue.updatedAt) issue.updatedAt = Date.now();
    const i = list.findIndex(x => x.id === issue.id);
    if (i >= 0) list[i] = issue; else list.push(issue);
    write(ISSUES_KEY, list);
    return issue;
  }
  const getIssue = (id) => read(ISSUES_KEY, []).find(x => x.id === id);
  const deleteIssue = (id) => write(ISSUES_KEY, read(ISSUES_KEY, []).filter(x => x.id !== id));

  // ------- AI 配置 -------
  const getAIConfig = () => read(AI_KEY, { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: '' });
  const setAIConfig = (cfg) => write(AI_KEY, cfg);

  // ------- 会话 -------
  const getSession = () => read(SESSION_KEY, null);
  const setSession = (s) => s ? write(SESSION_KEY, s) : localStorage.removeItem(SESSION_KEY);

  return {
    uid, getUserByLogin, listUsers, saveUser, createUser, deleteUser, findByUsername,
    listIssues, saveIssue, getIssue, deleteIssue, getAIConfig, setAIConfig, getSession, setSession,
    seedUsers
  };
})();

/* 角色元信息 */
const ROLES = {
  admin:   { label: '管理员', badge: 'admin'   },
  auditor: { label: '审核员', badge: 'confirmed' },
  builder: { label: '施工员', badge: 'pending' }
};
const RISK_META = {
  high:   { label: '高', cls: 'high'   },
  medium: { label: '中', cls: 'medium' },
  low:    { label: '低', cls: 'low'    }
};
const STATUS_META = {
  pending:    { label: '待审核', cls: 'pending'    },
  confirmed:  { label: '已确认', cls: 'confirmed'  },
  rectifying: { label: '整改中', cls: 'rectifying' },
  rectified:  { label: '已整改', cls: 'rectified'  },
  closed:     { label: '已销号', cls: 'closed'     }
};

/* node 环境下导出（浏览器加载时 module 未定义，不受影响） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Store;
}