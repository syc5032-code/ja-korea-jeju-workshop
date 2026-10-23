/* ==========================================================================
   2026 JA Korea One JA Retreat in Jeju - 6 Missions & AI Grading Engine
   ========================================================================== */

const STORAGE_KEY = 'JA_JEJU_2026_MISSION_STATE_V3';
const MY_TEAM_AUTH_KEY = 'JA_JEJU_2026_MY_TEAM_AUTH';
const MY_TEAM_ID_KEY = 'JA_JEJU_2026_MY_TEAM_ID';

// 10/30(금) 미션별 자동 오픈 스케줄 (KST 기준)
const MISSION_OPEN_SCHEDULE = {
  1: { iso: '2026-10-30T09:20:00+09:00', timeLabel: '10/30(금) 09:20 오픈', shortTime: '09:20', title: '미션 1 · 제주 여행 포스터' },
  2: { iso: '2026-10-30T13:00:00+09:00', timeLabel: '10/30(금) 13:00 오픈', shortTime: '13:00', title: '미션 2 · 제주 발견 (5종+히든)' },
  3: { iso: '2026-10-30T14:30:00+09:00', timeLabel: '10/30(금) 14:30 오픈', shortTime: '14:30', title: '미션 3 · 깜짝 N행시 동영상' },
  4: { iso: '2026-10-30T15:30:00+09:00', timeLabel: '10/30(금) 15:30 오픈', shortTime: '15:30', title: '미션 4 · 팀별 주인공 사진' },
  5: { iso: '2026-10-30T16:00:00+09:00', timeLabel: '10/30(금) 16:00 오픈', shortTime: '16:00', title: "미션 5 · 보너스 그림자 'JA'" },
  6: { iso: '2026-10-30T18:30:00+09:00', timeLabel: '10/30(금) 18:30 오픈', shortTime: '18:30', title: '미션 6 · 저녁 개인미션' }
};

const JEJU_COMMON_ITEMS = [
  { id: 'stone', label: '현무암 돌담', icon: '🪨' },
  { id: 'tangerine', label: '귤 / 귤나무', icon: '🍊' },
  { id: 'sea', label: '제주 바다', icon: '🌊' },
  { id: 'palm', label: '야자수', icon: '🌴' },
  { id: 'sign', label: "'제주' 글자 간판·표지", icon: '🪧' }
];

const JEJU_HIDDEN_ITEMS = [
  { id: 'harubang', label: '돌하르방', icon: '🗿' },
  { id: 'jeongnang', label: '정낭', icon: '🪵' },
  { id: 'bangsatap', label: '방사탑', icon: '🗼' },
  { id: 'haenyeo', label: '해녀 조형물/벽화', icon: '🤿' }
];

const N_POEM_WORDS = ['제이에이', '귤하르방', '돌하르방', '제주바람', '오메기떡'];

function createDefaultTeamData(id, name) {
  return {
    id,
    name,
    m1: {
      photo: '',
      caption: '',
      submittedAt: '',
      graded: false,
      subScores: { vibe: 8, chemistry: 9, poster: 7 },
      score: 0,
      oneLineReview: ''
    },
    m2: {
      photos: [],
      itemPhotos: {},
      commonChecked: [],
      hiddenChecked: '',
      submittedAt: '',
      memo: '',
      graded: false,
      verifiedCommon: [],
      verifiedHidden: null,
      score: 0,
      oneLineReview: ''
    },
    m3: {
      kakaoSubmitted: false,
      poemText: '',
      submittedAt: '',
      votedForTeamId: null
    },
    m4: {
      photo: '',
      heroName: '',
      submittedAt: '',
      graded: false,
      subScores: { heroFocus: 12, teamwork: 10, creativity: 7 },
      score: 0,
      oneLineReview: ''
    },
    m5: {
      passed: false,
      photo: '',
      submittedAt: '',
      graded: false,
      subScores: { base: 4, jaShape: 4, teamwork: 2 },
      score: 0,
      oneLineReview: ''
    }
  };
}

function syncM2State(team) {
  if (!team || !team.m2) return;
  if (!team.m2.itemPhotos || typeof team.m2.itemPhotos !== 'object') {
    team.m2.itemPhotos = {};
  }
  const commonIds = JEJU_COMMON_ITEMS.map(x => x.id);
  const hiddenIds = JEJU_HIDDEN_ITEMS.map(x => x.id);

  team.m2.commonChecked = commonIds.filter(id => Boolean(team.m2.itemPhotos[id]));
  const activeHidden = hiddenIds.find(id => Boolean(team.m2.itemPhotos[id]));
  team.m2.hiddenChecked = activeHidden || '';

  // photos 배열도 하위 호환성 및 API 전송을 위해 자동 동기화 유지
  team.m2.photos = [
    ...team.m2.commonChecked.map(id => team.m2.itemPhotos[id]),
    ...(team.m2.hiddenChecked ? [team.m2.itemPhotos[team.m2.hiddenChecked]] : [])
  ];
}

function sanitizeTeams(teamsObj) {
  const result = {
    1: createDefaultTeamData(1, '1팀'),
    2: createDefaultTeamData(2, '2팀'),
    3: createDefaultTeamData(3, '3팀')
  };
  if (!teamsObj || typeof teamsObj !== 'object') return result;
  [1, 2, 3].forEach(id => {
    const raw = teamsObj[id] || teamsObj[String(id)];
    if (raw && typeof raw === 'object') {
      result[id] = {
        id,
        name: raw.name || `${id}팀`,
        m1: typeof raw.m1 === 'object' ? { ...result[id].m1, ...raw.m1 } : result[id].m1,
        m2: (() => {
          const m2Raw = typeof raw.m2 === 'object' ? raw.m2 : {};
          const m2Obj = {
            ...result[id].m2,
            ...m2Raw,
            itemPhotos: (m2Raw.itemPhotos && typeof m2Raw.itemPhotos === 'object') ? { ...m2Raw.itemPhotos } : {},
            commonChecked: Array.isArray(m2Raw.commonChecked) ? [...m2Raw.commonChecked] : [],
            hiddenChecked: m2Raw.hiddenChecked || '',
            photos: Array.isArray(m2Raw.photos) ? [...m2Raw.photos] : []
          };
          // 기존 데이터(사진 배열만 있고 itemPhotos가 비어있는 경우) 안전 마이그레이션
          if (Object.keys(m2Obj.itemPhotos).length === 0 && m2Obj.photos.length > 0) {
            const claimed = [...m2Obj.commonChecked];
            if (m2Obj.hiddenChecked) claimed.push(m2Obj.hiddenChecked);
            m2Obj.photos.forEach((src, idx) => {
              const targetId = claimed[idx] || (idx < JEJU_COMMON_ITEMS.length ? JEJU_COMMON_ITEMS[idx].id : null);
              if (targetId) {
                m2Obj.itemPhotos[targetId] = src;
              }
            });
          }
          return m2Obj;
        })(),
        m3: typeof raw.m3 === 'object' ? { ...result[id].m3, ...raw.m3 } : result[id].m3,
        m4: typeof raw.m4 === 'object' ? { ...result[id].m4, ...raw.m4 } : result[id].m4,
        m5: typeof raw.m5 === 'object' ? { ...result[id].m5, ...raw.m5 } : result[id].m5
      };
      syncM2State(result[id]);
    }
  });
  return result;
}

function getTeam(teamId) {
  const tid = Number(teamId) || 1;
  if (!appState.teams) appState.teams = sanitizeTeams({});
  if (!appState.teams[tid]) {
    appState.teams[tid] = createDefaultTeamData(tid, `${tid}팀`);
  }
  return appState.teams[tid];
}

function getInitialState() {
  return {
    updatedAt: 0,
    mode: 'participant',
    selectedTeamId: 1,
    tfUnlocked: false,
    tfFilter: 'all',
    ceremonySlide: 'missions',
    scheduleConfig: {
      forceOpenAll: true,
      manualOpen: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true }
    },
    settings: {
      adminPin: '2026',
      apiKey: '',
      aiModel: 'gpt-4o',
      aiPersona: 'warm',
      cloudDbUrl: '',
      teamPins: { 1: '', 2: '', 3: '' }
    },
    m3Config: {
      selectedWord: '제이에이',
      tfTieBreakerVoteTeamId: null
    },
    m6Config: {
      answerKeyJisoo: '',
      answerKeyYechan: '',
      winnerId: null,
      submissions: []
    },
    teams: {
      1: createDefaultTeamData(1, '1팀'),
      2: createDefaultTeamData(2, '2팀'),
      3: createDefaultTeamData(3, '3팀')
    }
  };
}

let appState = loadState();
let m6TimerInterval = null;
let m6RemainingSeconds = 180;
let isSyncingCloud = false;

function loadState() {
  try {
    const base = getInitialState();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return {
      ...base,
      ...parsed,
      mode: 'participant',
      tfUnlocked: false,
      scheduleConfig: { ...base.scheduleConfig, ...(parsed.scheduleConfig || {}) },
      settings: {
        ...base.settings,
        ...(parsed.settings || {}),
        teamPins: {
          1: '',
          2: '',
          3: '',
          ...((parsed.settings && parsed.settings.teamPins) || {})
        }
      },
      m3Config: { ...base.m3Config, ...(parsed.m3Config || {}) },
      m6Config: { ...base.m6Config, ...(parsed.m6Config || {}) },
      teams: sanitizeTeams(parsed.teams || base.teams)
    };
  } catch (e) {
    return getInitialState();
  }
}

function saveState(skipCloudPush = false) {
  try {
    appState.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    if (!skipCloudPush) {
      pushToCloudDb();
    }
  } catch (e) {
    showToast('브라우저 저장 용량이 가득 찼습니다. 백업을 진행해 주세요.', 'error');
  }
}

/* ==========================================================================
   10/30(금) TIME-BASED MISSION UNLOCK LOGIC
   ========================================================================== */

function isMissionOpen(missionNum) {
  if (appState.scheduleConfig?.forceOpenAll) return true;
  if (appState.scheduleConfig?.manualOpen?.[missionNum]) return true;
  const sched = MISSION_OPEN_SCHEDULE[missionNum];
  if (!sched) return true;
  const targetMs = new Date(sched.iso).getTime();
  return Date.now() >= targetMs;
}

function getMissionCountdownInfo(missionNum) {
  const sched = MISSION_OPEN_SCHEDULE[missionNum];
  const targetMs = new Date(sched.iso).getTime();
  const diff = targetMs - Date.now();
  if (diff <= 0) return { open: true, text: '오픈 완료' };

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');

  const dayStr = days > 0 ? `${days}일 ` : '';
  return {
    open: false,
    text: `${dayStr}${hours}:${mins}:${secs} 후 자동 오픈`
  };
}

function toggleForceOpenAllMissions() {
  appState.scheduleConfig.forceOpenAll = !appState.scheduleConfig.forceOpenAll;
  saveState();
  renderAll();
  showToast(
    appState.scheduleConfig.forceOpenAll
      ? '🔓 [테스트 모드] 참가자 화면의 모든 미션(1~6번)이 즉시 오픈되었습니다!'
      : '⏰ [스케줄 모드] 10/30(금) 지정된 시간에 맞춰 순차 오픈되도록 설정되었습니다.',
    'info'
  );
}

function toggleMissionManualOpen(missionNum) {
  if (!appState.scheduleConfig.manualOpen) {
    appState.scheduleConfig.manualOpen = {};
  }
  appState.scheduleConfig.manualOpen[missionNum] = !appState.scheduleConfig.manualOpen[missionNum];
  saveState();
  renderAll();
  const isNowManual = appState.scheduleConfig.manualOpen[missionNum];
  showToast(
    isNowManual
      ? `🔓 미션 ${missionNum}번을 참가자 화면에 즉시 오픈했습니다!`
      : `⏰ 미션 ${missionNum}번을 10/30(금) ${MISSION_OPEN_SCHEDULE[missionNum].shortTime} 자동 오픈으로 되돌렸습니다.`,
    'info'
  );
}

/* ==========================================================================
   SUPABASE CLOUD REAL-TIME SYNC (모든 기기 자동 저장 & 실시간 공유)
   ========================================================================== */

const SUPABASE_URL = 'https://nsrzhqcxmejnstlfjhed.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xkn_YhxEOR0kn7coRE9faA_0LH2lD56';
const SUPABASE_TABLE = 'jeju_mission_state';

async function pushToCloudDb() {
  if (isSyncingCloud) return;
  try {
    isSyncingCloud = true;
    const payload = {
      id: 'main_board',
      updated_at: appState.updatedAt,
      data: {
        updatedAt: appState.updatedAt,
        settings: appState.settings,
        scheduleConfig: appState.scheduleConfig,
        m3Config: appState.m3Config,
        m6Config: appState.m6Config,
        teams: appState.teams
      }
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?on_conflict=id`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });
    updateCloudBadge(res.ok);
  } catch (e) {
    updateCloudBadge(false);
  } finally {
    isSyncingCloud = false;
  }
}

async function pullFromCloudDb() {
  if (isSyncingCloud) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.main_board&select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) {
      updateCloudBadge(false);
      return;
    }
    const rows = await res.json();
    const row = rows?.[0];
    if (row && row.data && row.updated_at > (appState.updatedAt || 0)) {
      const remote = row.data;
      appState.updatedAt = row.updated_at;
      if (remote.settings) appState.settings = { ...appState.settings, ...remote.settings };
      if (remote.scheduleConfig) appState.scheduleConfig = remote.scheduleConfig;
      if (remote.m3Config) appState.m3Config = remote.m3Config;
      if (remote.m6Config) appState.m6Config = remote.m6Config;
      if (remote.teams) appState.teams = sanitizeTeams(remote.teams);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      renderAll();
    }
    updateCloudBadge(true);
  } catch (e) {
    updateCloudBadge(false);
  }
}

function updateCloudBadge(connected) {
  const badge = document.getElementById('cloud-sync-badge');
  if (!badge) return;
  if (connected) {
    badge.textContent = '🟢 Supabase 실시간 동기화 중';
    badge.className = 'text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-400/40';
  } else {
    badge.textContent = '🟠 Supabase 테이블 생성 대기중';
    badge.className = 'text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/40';
  }
}

function copyShareLinkWithDb(forTf = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete('db');
  if (forTf) url.searchParams.set('tf', '1');
  else url.searchParams.delete('tf');
  navigator.clipboard.writeText(url.toString());
  showToast(forTf ? '다른 TF용 대시보드 링크가 복사되었습니다!' : '참가자 배포용 링크가 복사되었습니다!', 'success');
}

function formatNowTime(includeSeconds = true) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return includeSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  const bg = type === 'error' ? 'bg-rose-600' : type === 'success' ? 'bg-emerald-600' : 'bg-[#1D5266]';
  el.className = `${bg} text-white text-xs sm:text-sm font-bold px-4 py-3 rounded-2xl shadow-xl transition-all duration-300 pointer-events-auto flex items-center gap-2`;
  el.innerHTML = `<span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : '💡'}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

/* ==========================================================================
   SCORE CALCULATION LOGIC (1 ~ 5번 팀 미션 자동 집계)
   ========================================================================== */

function getMission2Score(team) {
  if (team.m2.graded) {
    const verifiedCommon = team.m2.verifiedCommon || [];
    const commonCount = Math.min(3, verifiedCommon.length);
    const commonScore = commonCount * 5;
    const hiddenScore = team.m2.verifiedHidden ? 5 : 0;
    const total = (team.m2.score !== undefined && team.m2.score !== null) ? Number(team.m2.score) : (commonScore + hiddenScore);
    return { commonScore, hiddenScore, total, graded: true };
  }
  const commonCount = Math.min(3, (team.m2.commonChecked || []).length);
  const commonScore = commonCount * 5;
  const hiddenScore = team.m2.hiddenChecked ? 5 : 0;
  return { commonScore, hiddenScore, total: commonScore + hiddenScore, graded: false };
}

function getMission3VotesAndScores() {
  const votes = { 1: 0, 2: 0, 3: 0 };
  [1, 2, 3].forEach(tid => {
    const target = appState.teams[tid]?.m3?.votedForTeamId;
    if (target && target !== tid && votes[target] !== undefined) {
      votes[target] += 1;
    }
  });

  const totalVotesCast = Object.values(votes).reduce((a, b) => a + b, 0);
  const isThreeWayTie = (votes[1] === 1 && votes[2] === 1 && votes[3] === 1);
  const tfPick = appState.m3Config.tfTieBreakerVoteTeamId;

  const finalVotes = { ...votes };
  if (isThreeWayTie && tfPick && finalVotes[tfPick] !== undefined) {
    finalVotes[tfPick] += 1;
  }

  const scores = { 1: 0, 2: 0, 3: 0 };
  const anySubmittedOrVoted = totalVotesCast > 0 || [1, 2, 3].some(id => appState.teams[id].m3.kakaoSubmitted);

  if (anySubmittedOrVoted) {
    if (isThreeWayTie) {
      if (tfPick) {
        [1, 2, 3].forEach(id => { scores[id] = (id === tfPick) ? 30 : 25; });
      } else {
        [1, 2, 3].forEach(id => { scores[id] = 25; });
      }
    } else if (totalVotesCast > 0) {
      const sortedUnique = [...new Set([finalVotes[1], finalVotes[2], finalVotes[3]])].sort((a, b) => b - a);
      const rankPoints = [30, 25, 20];
      [1, 2, 3].forEach(id => {
        const rankIdx = sortedUnique.indexOf(finalVotes[id]);
        scores[id] = rankPoints[rankIdx] || 20;
      });
    }
  }

  return { teamVotes: votes, finalVotes, isThreeWayTie, tfPick, totalVotesCast, scores };
}

function getTeamScoreSummary(teamId) {
  const team = appState.teams[teamId];
  const m1 = Number(team.m1.score || 0);
  const m2Obj = getMission2Score(team);
  const m2 = m2Obj.total;
  const m3Obj = getMission3VotesAndScores();
  const m3 = m3Obj.scores[teamId] || 0;
  const m4 = Number(team.m4.score || 0);
  const m5 = team.m5.passed ? 0 : Number(team.m5.score || 0);

  const regularTotal = m1 + m2Obj.commonScore + m3 + m4;
  const bonusTotal = m2Obj.hiddenScore + m5;
  const grandTotal = regularTotal + bonusTotal;

  return { m1, m2, m2Common: m2Obj.commonScore, m2Hidden: m2Obj.hiddenScore, m3, m4, m5, regularTotal, bonusTotal, grandTotal };
}

function getSortedM6Submissions() {
  const list = [...(appState.m6Config.submissions || [])];
  return list.sort((a, b) => {
    const diffScore = (Number(b.correctCount) || 0) - (Number(a.correctCount) || 0);
    if (diffScore !== 0) return diffScore;
    return (a.timestampMs || 0) - (b.timestampMs || 0);
  });
}

/* ==========================================================================
   IMAGE UPLOAD & RESIZE HELPER
   ========================================================================== */

function compressImageFile(file, maxWidth = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function openLightbox(src) {
  if (!src) return;
  const modal = document.getElementById('modal-lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = src;
  modal.classList.remove('hidden');
}

function closeLightbox() {
  document.getElementById('modal-lightbox').classList.add('hidden');
}

/* ==========================================================================
   OPENAI GPT-4o VISION AI GRADING ENGINE (1, 4, 5번 미션)
   ========================================================================== */

function getPersonaInstruction(persona) {
  if (persona === 'variety') {
    return '예능 프로그램 메인 PD처럼 유쾌하고 재치 넘치는 말투로 사진 속 인물의 포즈나 표정 디테일을 콕 집어 한 줄 심사평을 작성하세요.';
  }
  if (persona === 'critic') {
    return '사진 예술가처럼 감성적이고 품격 있는 어조로 구도와 색감, 팀의 조화를 칭찬하는 한 줄 심사평을 작성하세요.';
  }
  return '따뜻하고 센스 넘치는 심사위원으로서 팀원들의 밝은 에너지와 사진 속 디테일을 기분 좋게 칭찬하는 한 줄 심사평을 작성하세요.';
}

function getMissionPromptConfig(missionNum, teamName) {
  const personaText = getPersonaInstruction(appState.settings.aiPersona);
  if (missionNum === 1) {
    return {
      title: '[미션 1] 제주 여행 포스터 (25점 만점)',
      systemPrompt: `당신은 '2026 JA Korea 제주 리트릿' 1번 미션 [우리 팀의 제주 여행 포스터] 전문 AI 심사위원입니다. ${personaText}
참가팀 '${teamName}'이 제출한 포스터 사진을 아래 [루브릭 채점 체크리스트]에 맞춰 객관적이고 공정하게 심사하세요.
(※ 촬영자 1명이 빠져 팀원 전원이 다 안 나왔더라도 인원수 관련 감점은 절대 하지 마세요.)

[루브릭 채점 체크리스트 - 총 25점 만점]
1. vibe (제주 랜드마크 & 분위기, 4~8점):
   - 제주 고유의 자연(바다, 오름, 유채꽃, 현무암 돌담 등) 또는 유명 명소 풍경이 확실히 드러남 (+8점)
   - 제주 야외이긴 하나 배경이 모호하거나 특색이 약함 (+6점)
   - 일반 실내/카페/식당 내부 등 제주 명소 분위기를 알기 어려움 (+4점)

2. chemistry (팀원 에너지 & 표정 케미, 6~9점):
   - 팀원 전원이 활짝 웃고 활기찬 포즈로 멋진 호흡과 케미를 뽐냄 (+9점)
   - 일부는 웃고 있으나 다소 정적이거나 평범한 포즈 (+7~8점)
   - 표정이 굳어 있거나 어색함 (+6점)

3. poster (포스터 완성도 & 구도, 5~8점):
   - 잡지 표지나 영화 포스터처럼 인물과 배경의 황금비율 및 안정적인 구도 (+8점)
   - 구도는 좋으나 수평이 살짝 기울어지거나 인물에 치우침 (+6~7점)
   - 단순한 단체 셀카 각도이거나 피사체가 잘림 (+5점)

[점수 및 심사평 작성 지침]
- totalScore = vibe + chemistry + poster (15 ~ 25점)
- oneLineReview: 각 항목별 점수 근거를 명확하게 언급하며 재치 있고 기분 좋은 60자 내외의 심사평 작성
  (예: "제주 바다 배경 탁월(+8), 팀원 표정 케미 만점(+9), 포스터 구도 우수(+7) 총 24점 드립니다!")

반드시 아래 JSON 형식으로만 응답하세요:
{
  "subScores": { "vibe": 8, "chemistry": 9, "poster": 7 },
  "totalScore": 24,
  "oneLineReview": "제주 바다 배경 탁월(+8), 팀원 표정 케미 만점(+9), 포스터 구도 우수(+7) 총 24점 드립니다!"
}`
    };
  }
  if (missionNum === 4) {
    return {
      title: '[미션 4] 팀별 주인공 사진 (30점 만점)',
      systemPrompt: `당신은 '2026 JA Korea 제주 리트릿' 4번 미션 [팀별 주인공 사진] 전문 AI 심사위원입니다. ${personaText}
참가팀 '${teamName}'이 제출한 주인공 사진을 아래 [루브릭 채점 체크리스트]에 맞춰 객관적이고 엄격하면서도 유쾌하게 심사하세요.
(※ 촬영자 제외 여부 등 인원수 관련 감점은 절대 하지 마세요.)

[루브릭 채점 체크리스트 - 총 30점 만점]
1. heroFocus (독보적 원탑 주인공 연출, 6~12점):
   - 시선 몰아주기, 손짓, 중앙 배치, 독점 포즈 등으로 1명이 '누가 봐도 확실한 주인공'임 (+11~12점)
   - 주인공 포즈가 있으나 주변 인물과 시선 분산이 다소 있음 (+8~10점)
   - 누가 주인공인지 한눈에 구분이 잘 안 됨 (+6~7점)

2. teamwork (팀원들의 몰아주기 리액션 & 연기력, 6~10점):
   - 주인공을 받들거나 감탄/경악/환호/절규하는 등 팀원들의 표정 연기력과 리액션이 압도적임 (+10점)
   - 주인공에게 집중하고 있으나 리액션이나 표정이 다소 얌전함 (+8~9점)
   - 팀원들의 호흡이 맞지 않거나 리액션이 약함 (+6~7점)

3. creativity (재치 & 스토리텔링, 5~8점):
   - 유명 밈 패러디, 영화/드라마 씬 재현 등 컨셉과 상황극 연출이 매우 독창적이고 유쾌함 (+8점)
   - 참신한 아이디어가 엿보이나 전형적인 몰아주기 포즈 (+6~7점)
   - 평범한 단체 포즈 수준 (+5점)

[점수 및 심사평 작성 지침]
- totalScore = heroFocus + teamwork + creativity (17 ~ 30점)
- oneLineReview: 각 항목별 점수 근거를 명시한 재치 넘치는 60자 내외의 심사평 작성
  (예: "주인공 원탑 연출 완벽(+12), 팀원들 몰아주기 연기력 폭발(+10), 컨셉 재치 우수(+7) 총 29점!")

반드시 아래 JSON 형식으로만 응답하세요:
{
  "subScores": { "heroFocus": 12, "teamwork": 10, "creativity": 7 },
  "totalScore": 29,
  "oneLineReview": "주인공 원탑 연출 완벽(+12), 팀원들 몰아주기 연기력 폭발(+10), 컨셉 재치 우수(+7) 총 29점!"
}`
    };
  }
  return {
    title: "[미션 5] 그림자 사진 'JA' (보너스 10점 만점)",
    systemPrompt: `당신은 '2026 JA Korea 제주 리트릿' 5번 보너스 미션 [해변 그림자 'JA'] 전문 AI 심사위원입니다. ${personaText}
참가팀 '${teamName}'이 백사장/해변/지면에 드리운 그림자로 'JA' 알파벳을 만든 사진을 심사하세요.

[루브릭 채점 체크리스트 - 보너스 총 10점 만점]
1. base (도전 기본 점수, 4점 고정):
   - 지면에 드리운 실제 그림자 사진을 정상 제출함 (+4점 고정)

2. jaShape ('JA' 알파벳 가독성, 2~4점):
   - 설명 없이 그림자만 보아도 알파벳 'J'와 'A' 형태를 즉시 뚜렷하게 읽을 수 있음 (+4점)
   - 형태가 다소 모호하여 유추해야 하거나 두 글자 중 한 글자만 선명함 (+3점)
   - 글자 형태 식별이 어렵거나 미흡함 (+2점)

3. teamwork (신체 협동 연출 난이도, 1~2점):
   - 팀원들이 전신, 팔다리, 손가락, 소품 등을 복합적으로 연결하여 협동한 노력이 돋보임 (+2점)
   - 1~2명의 단순 포즈 (+1점)

[점수 및 심사평 작성 지침]
- totalScore = base + jaShape + teamwork (7 ~ 10점)
- oneLineReview: 각 항목별 근거를 담은 60자 내외의 명쾌한 심사평 작성
  (예: "도전 기본(+4), JA 글자 식별도 매우 우수(+4), 신체 협동 연출력 우수(+2) 총 10점 만점!")

반드시 아래 JSON 형식으로만 응답하세요:
{
  "subScores": { "base": 4, "jaShape": 4, "teamwork": 2 },
  "totalScore": 10,
  "oneLineReview": "도전 기본(+4), JA 글자 식별도 매우 우수(+4), 신체 협동 연출력 우수(+2) 총 10점 만점!"
}`
  };
}

async function runAiGradeMission(teamId, missionNum) {
  const team = appState.teams[teamId];
  const mKey = `m${missionNum}`;
  const mData = team[mKey];

  if (!mData.photo) {
    showToast(`${team.name}의 미션 ${missionNum} 사진이 아직 등록되지 않았습니다.`, 'error');
    return;
  }

  const apiKey = (appState.settings.apiKey || '').trim();
  if (!apiKey) {
    showToast('OpenAI API 키가 설정되지 않아 설정 창을 엽니다.', 'info');
    openSettingsModal();
    return;
  }

  const btn = document.getElementById(`btn-ai-grade-${teamId}-${missionNum}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>AI 채점 중...</span>';
  }

  try {
    const cfg = getMissionPromptConfig(missionNum, team.name);
    const model = appState.settings.aiModel || 'gpt-4o';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: cfg.systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: `${team.name}의 ${cfg.title} 제출 사진입니다. 기준에 맞춰 채점하고 한 줄 근거를 작성해 주세요.` },
              { type: 'image_url', image_url: { url: mData.photo, detail: 'high' } }
            ]
          }
        ],
        temperature: 0.6,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API 오류 (${response.status})`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    mData.subScores = parsed.subScores || mData.subScores;
    mData.score = Number(parsed.totalScore) || 0;
    mData.oneLineReview = parsed.oneLineReview || '팀원들의 멋진 호흡이 돋보이는 작품입니다!';
    mData.graded = true;

    saveState();
    renderAll();
    showToast(`${team.name} 미션 ${missionNum} AI 채점 완료! (${mData.score}점)`, 'success');
  } catch (err) {
    showToast(`AI 채점 실패: ${err.message}`, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🤖</span><span>GPT AI 채점</span>';
    }
  }
}

async function runAiGradeMission2(teamId) {
  const team = appState.teams[teamId];
  syncM2State(team);
  const itemPhotos = team.m2?.itemPhotos || {};
  const photoEntries = Object.entries(itemPhotos).filter(([k, src]) => Boolean(src));

  if (photoEntries.length === 0) {
    showToast(`${team.name}의 2번 미션에 등록된 사진이 없습니다.`, 'error');
    return;
  }

  const apiKey = (appState.settings.apiKey || '').trim();
  if (!apiKey) {
    showToast('OpenAI API 키가 설정되지 않아 설정 창을 엽니다.', 'info');
    openSettingsModal();
    return;
  }

  const btn = document.getElementById(`btn-ai-grade-${teamId}-2`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>AI 정밀 사진 판독 중...</span>';
  }

  try {
    const personaText = getPersonaInstruction(appState.settings.aiPersona);

    const systemPrompt = `당신은 '2026 JA Korea 제주 리트릿' 2번 미션 [제주 발견 (5종 중 3종 + 히든 1종)] 정밀 사진 판독 AI 심사위원입니다. ${personaText}
참가팀 '${team.name}'이 항목별로 직접 지정하여 총 ${photoEntries.length}장의 사진을 제출했습니다.

[인증 대상 항목 정의 및 엄격한 판별 기준]
■ 흔한 5종 (최대 3종 인정, 1종당 5점 = 최대 15점):
- stone: '현무암 돌담' (제주 특유의 검은색 구멍 숭숭 뚫린 화산석 돌담. 일반 시멘트 벽, 실내 벽, 자갈바닥, 새/동물 그림, 잡초 등은 절대 불인정)
- tangerine: '귤 / 귤나무' (실제 감귤 열매 또는 감귤나무. 키위, 사과, 바나나, 주스캔 등 다른 과일이나 가짜는 절대 불인정!)
- sea: '제주 바다' (실제 제주 해변, 파도, 수평선 바다 풍경. 수영장, 호수, 욕조 등은 불인정)
- palm: '야자수' (실제 야자나무. 일반 가로수, 소나무 등은 불인정)
- sign: "'제주' 글자 간판·표지" (실제 간판이나 이정표에 '제주' 또는 'JEJU' 글자가 명확히 적힌 것)

■ 히든 4종 (최대 1종 인정, 인정 시 +5점 보너스):
- harubang: '돌하르방' (제주 전통 돌하르방 석상)
- jeongnang: '정낭' (제주 전통 대문 통나무와 정주석)
- bangsatap: '방사탑' (마을 액운을 막는 제주 둥근 돌탑)
- haenyeo: '해녀 조형물/벽화' (물질 도구를 든 해녀 동상, 조각, 또는 벽화)

[심사 지침]
제출된 각 사진을 해당 사진이 지정된 항목(ID)의 기준과 1:1로 엄격하게 대조하세요.
팀이 특정 항목으로 등록했더라도 사진 속 실제 대상과 일치하지 않는 엉뚱한 사진(예: 키위 사진 올리고 귤 등록, 새 일러스트 올리고 돌담 등록 등)은 단호하게 불인정(탈락) 처리하세요.
실제로 기준에 확실하게 부합하는 항목만 verifiedCommon 및 verifiedHidden에 넣으세요.
- verifiedCommon: 실제로 식별 통과된 흔한 5종의 ID 배열 (최대 3개까지만 인정, 예: ["stone", "sea"])
- verifiedHidden: 실제로 식별 통과된 히든 항목의 ID (없거나 불일치 시 null, 예: "harubang" 또는 null)
- commonScore: Math.min(3, verifiedCommon.length) * 5 (최대 15점)
- hiddenScore: verifiedHidden ? 5 : 0 (최대 5점)
- totalScore: commonScore + hiddenScore (0 ~ 20점)
- oneLineReview: 1:1 사진 판독 근거를 담은 60자 내외의 재치 있고 솔직한 심사평 (예: "귤 항목 사진은 키위네요 🥝 새 그림도 멋지지만 돌담이 아니어서 바다 1종만 5점 인정되었습니다!")

반드시 아래 JSON 형식으로만 응답하세요:
{
  "verifiedCommon": ["stone"],
  "verifiedHidden": null,
  "commonScore": 5,
  "hiddenScore": 0,
  "totalScore": 5,
  "oneLineReview": "심사평..."
}`;

    const userContent = [
      { type: 'text', text: `${team.name}의 2번 미션 [제주 발견] 항목별 제출 사진 ${photoEntries.length}장입니다. 각 사진이 지정된 항목에 실제로 부합하는지 1:1로 정밀하게 검증하여 채점해주세요.` }
    ];

    photoEntries.forEach(([itemId, src], idx) => {
      const isHidden = JEJU_HIDDEN_ITEMS.some(x => x.id === itemId);
      const meta = (isHidden ? JEJU_HIDDEN_ITEMS : JEJU_COMMON_ITEMS).find(x => x.id === itemId);
      const itemLabel = meta ? `${meta.icon} ${meta.label}` : itemId;
      const catName = isHidden ? '히든 미션 (보너스 +5점)' : '흔한 제주 5종 (+5점)';
      userContent.push({
        type: 'text',
        text: `[제출 사진 #${idx + 1}] 팀이 등록한 대상 항목: 【${catName} - ${itemLabel} (항목 ID: ${itemId})】`
      });
      userContent.push({
        type: 'image_url',
        image_url: { url: src, detail: 'high' }
      });
    });

    const model = appState.settings.aiModel || 'gpt-4o';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        max_tokens: 350
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API 오류 (${response.status})`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    team.m2.graded = true;
    team.m2.verifiedCommon = Array.isArray(parsed.verifiedCommon) ? parsed.verifiedCommon : [];
    team.m2.verifiedHidden = parsed.verifiedHidden || null;
    team.m2.score = Number(parsed.totalScore) || 0;
    team.m2.oneLineReview = parsed.oneLineReview || '';

    saveState();
    renderAll();
    showToast(`${team.name} 2번 미션 AI 판독 완료! (${team.m2.score}점 인정)`, 'success');
  } catch (err) {
    showToast(`2번 미션 AI 판독 실패: ${err.message}`, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🤖</span><span>사진 정밀 AI 판독 & 채점</span>';
    }
  }
}

async function gradeAllPendingPhotos() {
  const targets = [];
  [1, 2, 3].forEach(tid => {
    // 2번 미션 사진
    const m2 = appState.teams[tid].m2;
    if (m2?.photos?.length > 0) targets.push({ tid, mNum: 2 });
    // 1, 4, 5번 미션 사진
    [1, 4, 5].forEach(mNum => {
      const m = appState.teams[tid][`m${mNum}`];
      if (m.photo && !m.passed) targets.push({ tid, mNum });
    });
  });
  if (targets.length === 0) {
    showToast('채점할 제출 사진이 없습니다.', 'info');
    return;
  }
  for (const t of targets) {
    if (t.mNum === 2) {
      await runAiGradeMission2(t.tid);
    } else {
      await runAiGradeMission(t.tid, t.mNum);
    }
  }
}

function copyAiPromptToClipboard(teamId, missionNum) {
  const team = appState.teams[teamId];
  const cfg = getMissionPromptConfig(missionNum, team.name);
  navigator.clipboard.writeText(cfg.systemPrompt);
  showToast('채점 프롬프트가 복사되었습니다! ChatGPT에 사진과 함께 붙여넣으세요.', 'success');
}

/* ==========================================================================
   PARTICIPANT AUTH & TEAM NAME MANAGEMENT
   ========================================================================== */

let loginSelectedTeamId = 1;

function selectLoginTeam(teamId) {
  loginSelectedTeamId = Number(teamId);
  const curPin = (appState.settings.teamPins?.[loginSelectedTeamId] || '').trim();
  const isUnset = !curPin;

  [1, 2, 3].forEach(id => {
    const btn = document.getElementById(`btn-login-team-${id}`);
    const statusPill = document.getElementById(`login-pin-status-${id}`);
    const p = (appState.settings.teamPins?.[id] || '').trim();
    if (statusPill) {
      if (p) {
        statusPill.textContent = '🔒 설정됨';
        statusPill.className = 'text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
      } else {
        statusPill.textContent = '✨ 첫 등록';
        statusPill.className = 'text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300';
      }
    }
    if (!btn) return;
    if (id === loginSelectedTeamId) {
      btn.className = 'p-3 rounded-2xl border-2 font-extrabold text-xs flex flex-col items-center gap-1 transition bg-[#1D3C34] text-white border-[#1D3C34] shadow-sm';
    } else {
      btn.className = 'p-3 rounded-2xl border-2 font-extrabold text-xs flex flex-col items-center gap-1 transition bg-[#FCFBF7] text-[#1D3C34] border-[#E6E1D3] hover:border-[#1D3C34]';
    }
  });

  const curTeam = getTeam(loginSelectedTeamId);
  const titleEl = document.getElementById('login-modal-title');
  const subTitleEl = document.getElementById('login-modal-subtitle');
  const pinLabelEl = document.getElementById('label-team-login-pin');
  const pinHintEl = document.getElementById('login-pin-hint');
  const pinSubhintEl = document.getElementById('login-pin-subhint');
  const submitTextEl = document.getElementById('btn-login-submit-text');
  const submitIconEl = document.getElementById('btn-login-submit-icon');
  const pinInput = document.getElementById('input-team-login-pin');
  const nameInput = document.getElementById('input-team-login-name');
  const nameBoxEl = document.getElementById('login-team-name-box');
  const namePreviewEl = document.getElementById('login-team-name-preview');
  const nameDisplayEl = document.getElementById('login-team-name-display');

  if (pinInput) {
    pinInput.value = '';
    pinInput.focus();
  }

  if (isUnset) {
    // 최초 등록 모드 (첫 팀원이 비번 4자리와 팀명을 직접 세팅)
    if (nameBoxEl) nameBoxEl.classList.remove('hidden');
    if (namePreviewEl) namePreviewEl.classList.add('hidden');
    if (nameInput) {
      nameInput.value = curTeam.name || `${loginSelectedTeamId}팀`;
    }

    if (titleEl) titleEl.textContent = `${curTeam.name} 최초 등록 & 비밀번호 설정`;
    if (subTitleEl) subTitleEl.innerHTML = `우리 팀 첫 입장! <strong>숫자 4자리 비밀번호</strong>와 <strong>팀명</strong>을 정해주세요.`;
    if (pinLabelEl) pinLabelEl.textContent = '2️⃣ 사용할 팀 비밀번호 (숫자 4자리)';
    if (pinHintEl) pinHintEl.textContent = '숫자 4자리 필수';
    if (pinSubhintEl) {
      pinSubhintEl.textContent = '💡 여기서 정한 4자리 번호로 다른 팀원들도 입장하게 됩니다.';
      pinSubhintEl.classList.remove('hidden');
    }
    if (pinInput) pinInput.placeholder = '숫자 4자리 (예: 1234)';
    if (submitTextEl) submitTextEl.textContent = '우리 팀 비밀번호 & 팀명 등록하고 입장하기';
    if (submitIconEl) submitIconEl.textContent = '✨';
  } else {
    // 기존 설정된 비번으로 팀원 입장 모드 (팀명 입력칸 숨기고 비번 4자리만 입력)
    if (nameBoxEl) nameBoxEl.classList.add('hidden');
    if (namePreviewEl) {
      namePreviewEl.classList.remove('hidden');
      if (nameDisplayEl) nameDisplayEl.textContent = curTeam.name;
    }

    if (titleEl) titleEl.textContent = `${curTeam.name} 입장하기`;
    if (subTitleEl) subTitleEl.innerHTML = `팀원이 이미 등록을 완료했습니다!<br>공유받은 <strong>팀 비밀번호 4자리</strong>를 입력해주세요.`;
    if (pinLabelEl) pinLabelEl.textContent = '2️⃣ 팀 비밀번호 입력 (숫자 4자리)';
    if (pinHintEl) pinHintEl.textContent = '숫자 4자리';
    if (pinSubhintEl) {
      pinSubhintEl.textContent = '💡 비밀번호를 모르시는 경우 TF 운영진에게 문의하시면 즉시 확인 가능합니다.';
      pinSubhintEl.classList.remove('hidden');
    }
    if (pinInput) pinInput.placeholder = '비밀번호 4자리 입력';
    if (submitTextEl) submitTextEl.textContent = `${curTeam.name} 입장하기`;
    if (submitIconEl) submitIconEl.textContent = '🚀';
  }

  const errMsg = document.getElementById('login-error-msg');
  if (errMsg) errMsg.classList.add('hidden');
}

function openTeamLoginModal() {
  const modal = document.getElementById('modal-team-login');
  if (!modal) return;
  modal.classList.remove('hidden');

  [1, 2, 3].forEach(id => {
    const nameEl = document.getElementById(`login-preview-name-${id}`);
    if (nameEl) nameEl.textContent = getTeam(id).name;
  });

  const initialTid = Number(localStorage.getItem(MY_TEAM_ID_KEY)) || appState.selectedTeamId || 1;
  selectLoginTeam(initialTid);
}

function closeTeamLoginModal() {
  const modal = document.getElementById('modal-team-login');
  if (modal) modal.classList.add('hidden');
}

function submitTeamLogin() {
  const tid = loginSelectedTeamId;
  const pinInput = document.getElementById('input-team-login-pin');
  const enteredPin = (pinInput ? pinInput.value : '').trim();
  const errMsg = document.getElementById('login-error-msg');
  const existingPin = (appState.settings.teamPins?.[tid] || '').trim();

  if (!enteredPin) {
    if (errMsg) {
      errMsg.textContent = '비밀번호 숫자 4자리를 입력해주세요.';
      errMsg.classList.remove('hidden');
    }
    pinInput?.focus();
    return;
  }

  // 비밀번호 4자리 숫자 엄격 검증
  if (enteredPin.length !== 4 || !/^\d{4}$/.test(enteredPin)) {
    if (errMsg) {
      errMsg.textContent = '비밀번호는 반드시 숫자 4자리로 입력해주세요. (예: 1234)';
      errMsg.classList.remove('hidden');
    }
    pinInput?.focus();
    return;
  }

  if (!existingPin) {
    // 최초 등록: 첫 사람이 팀명과 4자리 비밀번호를 등록
    const nameInput = document.getElementById('input-team-login-name');
    const customName = (nameInput ? nameInput.value : '').trim();

    if (!customName) {
      if (errMsg) {
        errMsg.textContent = '우리 팀명을 1글자 이상 입력해주세요. (예: 감귤프렌즈)';
        errMsg.classList.remove('hidden');
      }
      nameInput?.focus();
      return;
    }

    // 동시 접속 시 다른 팀원이 방금 먼저 등록했는지 재확인
    const recheckPin = (appState.settings.teamPins?.[tid] || '').trim();
    if (recheckPin) {
      selectLoginTeam(tid);
      if (errMsg) {
        errMsg.textContent = '방금 다른 팀원이 비밀번호를 먼저 등록했습니다! 팀원에게 비밀번호를 확인 후 입력해주세요.';
        errMsg.classList.remove('hidden');
      }
      return;
    }

    if (!appState.settings.teamPins) appState.settings.teamPins = {};
    appState.settings.teamPins[tid] = enteredPin;
    appState.teams[tid].name = customName;

    appState.selectedTeamId = tid;
    localStorage.setItem(MY_TEAM_AUTH_KEY, 'true');
    localStorage.setItem(MY_TEAM_ID_KEY, String(tid));
    saveState();

    closeTeamLoginModal();
    renderAll();
    showToast(`🎉 '${customName}' 팀 등록 완료! 팀원들에게 비밀번호(${enteredPin})를 알려주세요.`, 'success');
    return;
  }

  // 기존 비밀번호 검증 (팀명은 변경하지 않고 기존 팀명 유지)
  if (enteredPin !== existingPin) {
    if (errMsg) {
      errMsg.textContent = '비밀번호 4자리가 일치하지 않습니다. (분실 시 TF 운영진에게 문의하세요)';
      errMsg.classList.remove('hidden');
    }
    pinInput?.select();
    return;
  }

  appState.selectedTeamId = tid;
  localStorage.setItem(MY_TEAM_AUTH_KEY, 'true');
  localStorage.setItem(MY_TEAM_ID_KEY, String(tid));
  saveState();

  closeTeamLoginModal();
  renderAll();
  showToast(`🎉 ${appState.teams[tid].name} 입장 완료!`, 'success');
}

function promptSwitchTeam() {
  if (confirm('다른 팀으로 변경하시겠습니까? 팀 비밀번호를 다시 입력해야 합니다.')) {
    localStorage.removeItem(MY_TEAM_AUTH_KEY);
    openTeamLoginModal();
  }
}

function openChangeTeamNameModal() {
  const modal = document.getElementById('modal-change-team-name');
  if (!modal) return;
  const team = getTeam(appState.selectedTeamId);
  const nameInput = document.getElementById('input-change-team-name');
  if (nameInput) {
    nameInput.value = team.name;
    setTimeout(() => nameInput.focus(), 100);
  }
  const pinInput = document.getElementById('input-change-team-pin');
  if (pinInput) {
    pinInput.value = '';
    pinInput.placeholder = '새 숫자 4자리 입력 (변경 시만)';
  }
  modal.classList.remove('hidden');
}

function closeChangeTeamNameModal() {
  const modal = document.getElementById('modal-change-team-name');
  if (modal) modal.classList.add('hidden');
}

function saveNewTeamName() {
  const nameInput = document.getElementById('input-change-team-name');
  const newName = (nameInput ? nameInput.value : '').trim();
  const pinInput = document.getElementById('input-change-team-pin');
  const newPin = (pinInput ? pinInput.value : '').trim();

  if (!newName) {
    showToast('팀명을 1글자 이상 입력해주세요.', 'error');
    return;
  }

  const tid = appState.selectedTeamId;
  appState.teams[tid].name = newName;

  if (newPin) {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showToast('새 비밀번호는 숫자 4자리여야 합니다. (예: 1234)', 'error');
      pinInput?.focus();
      return;
    }
    if (!appState.settings.teamPins) appState.settings.teamPins = {};
    appState.settings.teamPins[tid] = newPin;
    showToast(`팀명과 새 비밀번호(${newPin})가 저장되었습니다!`, 'success');
  } else {
    showToast(`팀명이 '${newName}'(으)로 변경되었습니다!`, 'success');
  }

  saveState();
  closeChangeTeamNameModal();
  renderAll();
}

/* ==========================================================================
   PARTICIPANT VIEW RENDERER & HANDLERS (10/30 시간별 오픈 적용)
   ========================================================================== */

function selectParticipantTeam(teamId) {
  appState.selectedTeamId = Number(teamId);
  localStorage.setItem(MY_TEAM_ID_KEY, String(teamId));
  saveState(true);
  renderParticipantView();
}

async function handlePhotoUpload(teamId, missionNum, inputEl) {
  const file = inputEl.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await compressImageFile(file, 1024, 0.8);
    const team = appState.teams[teamId];
    if (missionNum === 2) {
      // 2번 미션은 uploadM2ItemPhoto 로 세부 항목별 1:1 직접 업로드 처리됨
      showToast('2번 미션은 각 항목별 [사진 올리기] 버튼을 이용해 주세요.', 'info');
      return;
    } else {
      const mKey = `m${missionNum}`;
      team[mKey].photo = dataUrl;
      team[mKey].submittedAt = formatNowTime(false);
      if (missionNum === 5) team.m5.passed = false;
    }
    saveState();
    renderAll();
    showToast(`${team.name} 사진이 정상적으로 등록되었습니다!`, 'success');
  } catch (e) {
    showToast('사진 처리 중 오류가 발생했습니다.', 'error');
  }
}

async function uploadM2ItemPhoto(teamId, itemId, inputEl, isHidden = false) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  const team = appState.teams[teamId];
  if (!team) return;
  if (!team.m2.itemPhotos) team.m2.itemPhotos = {};

  const commonIds = JEJU_COMMON_ITEMS.map(x => x.id);
  const currentCommonCount = Object.keys(team.m2.itemPhotos).filter(k => commonIds.includes(k) && Boolean(team.m2.itemPhotos[k])).length;
  const alreadyHasThis = Boolean(team.m2.itemPhotos[itemId]);

  if (!isHidden && !alreadyHasThis && currentCommonCount >= 3) {
    showToast('흔한 제주 5종은 최대 3종까지만 등록할 수 있습니다. 변경하려면 기존 사진을 먼저 삭제해주세요.', 'info');
    inputEl.value = '';
    return;
  }

  let replacedHidden = false;
  if (isHidden) {
    const hiddenIds = JEJU_HIDDEN_ITEMS.map(x => x.id);
    hiddenIds.forEach(hid => {
      if (hid !== itemId && team.m2.itemPhotos[hid]) {
        delete team.m2.itemPhotos[hid];
        replacedHidden = true;
      }
    });
  }

  try {
    const dataUrl = await compressImageFile(file, 1024, 0.8);
    team.m2.itemPhotos[itemId] = dataUrl;
    team.m2.submittedAt = formatNowTime(false);

    if (team.m2.graded) {
      if (!isHidden && Array.isArray(team.m2.verifiedCommon) && !team.m2.verifiedCommon.includes(itemId) && team.m2.verifiedCommon.length < 3) {
        team.m2.verifiedCommon.push(itemId);
      }
      if (isHidden) {
        team.m2.verifiedHidden = itemId;
      }
      const cScore = Math.min(3, (team.m2.verifiedCommon || []).length) * 5;
      const hScore = team.m2.verifiedHidden ? 5 : 0;
      team.m2.score = cScore + hScore;
    }

    syncM2State(team);
    saveState();
    renderAll();

    const itemMeta = (isHidden ? JEJU_HIDDEN_ITEMS : JEJU_COMMON_ITEMS).find(x => x.id === itemId);
    const itemName = itemMeta ? `${itemMeta.icon} ${itemMeta.label}` : itemId;
    if (replacedHidden) {
      showToast(`${itemName} 사진 등록 완료! (이전 히든 사진이 교체되었습니다)`, 'success');
    } else {
      showToast(`${itemName} 사진이 성공적으로 등록되었습니다!`, 'success');
    }
  } catch (err) {
    showToast('사진 등록 중 오류가 발생했습니다.', 'error');
  }
  inputEl.value = '';
}

function removeM2ItemPhoto(teamId, itemId) {
  const team = appState.teams[teamId];
  if (!team || !team.m2?.itemPhotos) return;
  if (team.m2.itemPhotos[itemId]) {
    delete team.m2.itemPhotos[itemId];

    if (team.m2.graded) {
      if (Array.isArray(team.m2.verifiedCommon)) {
        const idx = team.m2.verifiedCommon.indexOf(itemId);
        if (idx >= 0) team.m2.verifiedCommon.splice(idx, 1);
      }
      if (team.m2.verifiedHidden === itemId) {
        team.m2.verifiedHidden = null;
      }
      const cScore = Math.min(3, (team.m2.verifiedCommon || []).length) * 5;
      const hScore = team.m2.verifiedHidden ? 5 : 0;
      team.m2.score = cScore + hScore;
    }

    syncM2State(team);
    saveState();
    renderAll();
    const itemMeta = [...JEJU_COMMON_ITEMS, ...JEJU_HIDDEN_ITEMS].find(x => x.id === itemId);
    const itemName = itemMeta ? `${itemMeta.icon} ${itemMeta.label}` : itemId;
    showToast(`${itemName} 사진이 삭제되었습니다.`, 'info');
  }
}

function removeM2Photo(teamId, idx) {
  const team = appState.teams[teamId];
  if (!team || !team.m2) return;
  const keys = Object.keys(team.m2.itemPhotos || {});
  if (keys[idx]) {
    removeM2ItemPhoto(teamId, keys[idx]);
  } else if (Array.isArray(team.m2.photos)) {
    team.m2.photos.splice(idx, 1);
    saveState();
    renderAll();
  }
}

function toggleM2CommonItem(teamId, itemId) {
  const team = appState.teams[teamId];
  if (!team || !team.m2) return;
  if (!team.m2.graded) {
    team.m2.graded = true;
    team.m2.verifiedCommon = [...(team.m2.commonChecked || [])];
    team.m2.verifiedHidden = team.m2.hiddenChecked || null;
  }
  team.m2.verifiedCommon = team.m2.verifiedCommon || [];
  const vIdx = team.m2.verifiedCommon.indexOf(itemId);
  if (vIdx >= 0) {
    team.m2.verifiedCommon.splice(vIdx, 1);
  } else {
    if (team.m2.verifiedCommon.length >= 3) {
      showToast('흔한 제주 5종은 최대 3종까지만 인정 가능합니다.', 'info');
      return;
    }
    team.m2.verifiedCommon.push(itemId);
  }
  const commonScore = Math.min(3, team.m2.verifiedCommon.length) * 5;
  const hiddenScore = team.m2.verifiedHidden ? 5 : 0;
  team.m2.score = commonScore + hiddenScore;
  saveState();
  renderAll();
}

function selectM2HiddenItem(teamId, itemId) {
  const team = appState.teams[teamId];
  if (!team || !team.m2) return;
  if (!team.m2.graded) {
    team.m2.graded = true;
    team.m2.verifiedCommon = [...(team.m2.commonChecked || [])];
    team.m2.verifiedHidden = team.m2.hiddenChecked || null;
  }
  team.m2.verifiedHidden = (team.m2.verifiedHidden === itemId) ? null : itemId;
  const commonScore = Math.min(3, (team.m2.verifiedCommon || []).length) * 5;
  const hiddenScore = team.m2.verifiedHidden ? 5 : 0;
  team.m2.score = commonScore + hiddenScore;
  saveState();
  renderAll();
}

function toggleM3KakaoSubmitted(teamId) {
  const team = appState.teams[teamId];
  team.m3.kakaoSubmitted = !team.m3.kakaoSubmitted;
  team.m3.submittedAt = team.m3.kakaoSubmitted ? formatNowTime(false) : '';
  saveState();
  renderAll();
  if (team.m3.kakaoSubmitted) {
    showToast(`${team.name} N행시 카톡 영상 제출 완료 체크!`, 'success');
  }
}

function castM3TeamVote(voterTeamId, targetTeamId) {
  if (voterTeamId === targetTeamId) {
    showToast('본인 팀에는 투표할 수 없습니다!', 'error');
    return;
  }
  appState.teams[voterTeamId].m3.votedForTeamId = targetTeamId;
  saveState();
  renderAll();
  showToast(`${appState.teams[voterTeamId].name}의 익명 투표가 완료되었습니다!`, 'success');
}

function toggleM5Pass(teamId) {
  const team = appState.teams[teamId];
  team.m5.passed = !team.m5.passed;
  if (team.m5.passed) {
    team.m5.score = 0;
    team.m5.submittedAt = '패스';
  }
  saveState();
  renderAll();
  showToast(team.m5.passed ? '그림자 미션 패스 처리되었습니다 (감점 없음).' : '패스가 해제되었습니다.', 'info');
}

function submitM6IndividualForm(e) {
  e.preventDefault();
  const name = document.getElementById('m6-p-name')?.value?.trim();
  const teamId = Number(document.getElementById('m6-p-team')?.value || appState.selectedTeamId);
  const jisooAns = document.getElementById('m6-p-jisoo')?.value?.trim() || '';
  const yechanAns = document.getElementById('m6-p-yechan')?.value?.trim() || '';

  if (!name) {
    showToast('이름을 입력해 주세요.', 'error');
    return;
  }
  if (!jisooAns && !yechanAns) {
    showToast('달라진 아이템 정답을 하나 이상 작성해 주세요.', 'error');
    return;
  }

  const entry = {
    id: 'm6_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name,
    teamId,
    teamName: appState.teams[teamId]?.name || `${teamId}팀`,
    jisooAns,
    yechanAns,
    submittedTime: formatNowTime(true),
    timestampMs: Date.now(),
    correctCount: 0
  };

  appState.m6Config.submissions.push(entry);
  saveState();
  renderAll();
  showToast(`${name}님 정답이 제출되었습니다! (${entry.submittedTime})`, 'success');
}

function renderLockedMissionCard(missionNum) {
  const sched = MISSION_OPEN_SCHEDULE[missionNum];
  const cd = getMissionCountdownInfo(missionNum);
  return `
    <div id="p-mission-${missionNum}" class="retreat-card-locked rounded-3xl p-6 sm:p-7 text-center relative overflow-hidden">
      <div class="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1 rounded-full bg-[#1D3C34] text-white mb-2.5 tracking-wider">
        <span>🔒 SECRET MISSION 0${missionNum}</span>
      </div>
      <h2 class="text-base sm:text-lg font-extrabold text-[#1D3C34]">미션 ${missionNum} · 비공개 미션</h2>
      <p class="text-xs sm:text-sm text-[#4A5255] mt-1">
        미션 주제와 상세 내용은 <strong class="text-[#F27A24]">${sched.timeLabel}</strong>에 정각 공개됩니다!
      </p>
      <div class="mt-3.5 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-[#E6E1D3] shadow-xs text-xs font-mono font-bold text-[#1D3C34]">
        <span>⏳</span>
        <span data-countdown-mission="${missionNum}">${cd.text}</span>
      </div>
    </div>
  `;
}

function renderParticipantView() {
  try {
    const tid = Number(appState.selectedTeamId || 1);
    const team = getTeam(tid);

    const tabsEl = document.getElementById('participant-team-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = `
        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#1D3C34] text-white font-extrabold text-xs shadow-xs">
          <span>🍊 우리 팀:</span>
          <span class="font-black text-[#FFD2B0]">${team.name}</span>
        </div>
        <button type="button" onclick="openChangeTeamNameModal()" class="px-2.5 py-1.5 rounded-xl bg-[#FFF3E8] hover:bg-[#FFE6D0] border border-[#F27A24]/30 text-[#F27A24] text-[11px] font-extrabold transition">
          ✏️ 팀명 변경
        </button>
        <button type="button" onclick="promptSwitchTeam()" class="px-2 py-1.5 rounded-xl bg-[#F5F2E8] hover:bg-[#E6E1D3] text-[#4A5255] text-[11px] font-bold transition" title="다른 팀으로 재로그인">
          🔄 팀 변경
        </button>
      `;
    }

  const nameSpan = document.getElementById('participant-current-team-name');
  if (nameSpan) nameSpan.textContent = team.name;

  const statuses = [
    { num: 1, openLabel: '1.여행포스터', secretLabel: '미션 1 (09:20)', done: Boolean(team.m1.photo) },
    { num: 2, openLabel: '2.제주발견', secretLabel: '미션 2 (13:00)', done: (team.m2.commonChecked?.length > 0 || team.m2.photos?.length > 0) },
    { num: 3, openLabel: '3.깜짝N행시', secretLabel: '미션 3 (14:30)', done: Boolean(team.m3.kakaoSubmitted) },
    { num: 4, openLabel: '4.팀별주인공', secretLabel: '미션 4 (15:30)', done: Boolean(team.m4.photo) },
    { num: 5, openLabel: '5.그림자JA', secretLabel: '미션 5 (16:00)', done: Boolean(team.m5.photo || team.m5.passed) }
  ];
  const doneCount = statuses.filter(s => s.done).length;
  const progText = document.getElementById('participant-progress-text');
  if (progText) progText.textContent = `${doneCount} / 5 완료`;

  const pillsEl = document.getElementById('participant-status-pills');
  if (pillsEl) {
    pillsEl.innerHTML = statuses.map(s => {
      const open = isMissionOpen(s.num);
      return `
        <div class="px-2 py-2 rounded-xl text-center border text-[11px] font-bold ${s.done ? 'bg-[#E9F0EC] border-[#1D3C34]/30 text-[#1D3C34]' : open ? 'bg-white border-[#E6E1D3] text-[#1D3C34]' : 'bg-[#F5F2E8] border-[#E6E1D3] text-[#4A5255]'}">
          <div>${s.done ? '✅ 제출완료' : open ? '🟢 오픈됨' : '🔒 비공개'}</div>
          <div class="text-[10px] mt-0.5 truncate">${open ? s.openLabel : s.secretLabel}</div>
        </div>
      `;
    }).join('');
  }

  const jumpEl = document.getElementById('participant-jump-pills');
  if (jumpEl) {
    const jumpMeta = [
      { num: 1, openTitle: '1. 여행 포스터', time: '09:20' },
      { num: 2, openTitle: '2. 제주 발견', time: '13:00' },
      { num: 3, openTitle: '3. 깜짝 N행시', time: '14:30' },
      { num: 4, openTitle: '4. 팀별 주인공', time: '15:30' },
      { num: 5, openTitle: '5. 그림자 JA', time: '16:00' },
      { num: 6, openTitle: '6. 저녁 개인미션', time: '18:30' }
    ];
    jumpEl.innerHTML = jumpMeta.map(j => {
      const open = isMissionOpen(j.num);
      return `
        <a href="#p-mission-${j.num}" class="shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl border transition ${open ? 'bg-white border-[#1D3C34]/30 text-[#1D3C34] hover:border-[#F27A24]' : 'bg-[#F5F2E8] border-[#E6E1D3] text-[#4A5255]'}">
          ${open ? `🍊 ${j.openTitle}` : `🔒 미션 ${j.num}`} <span class="text-[10px] text-[#F27A24] font-semibold">${j.time}</span>
        </a>
      `;
    }).join('');
  }

  const otherTeams = [1, 2, 3].filter(id => id !== tid);
  const container = document.getElementById('participant-missions-container');
  if (!container) return;

  const cards = [];

  // Mission 1 (10/30 09:20 오픈)
  if (!isMissionOpen(1)) {
    cards.push(renderLockedMissionCard(1));
  } else {
    cards.push(`
      <div id="p-mission-1" class="retreat-card rounded-3xl p-5 sm:p-6 border border-[#E6E1D3]">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="mission-num-badge text-white text-xs font-extrabold px-2.5 py-1 rounded-lg">미션 1 · 09:20 오픈</span>
            <h2 class="text-base sm:text-lg font-extrabold text-[#1D5266]">[관광지 사진] 우리 팀의 제주 여행 포스터</h2>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200">⏰ 12:30 제출 마감 · AI 채점</span>
        </div>
        <p class="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
          팀원들이 함께 나오고 관광지 분위기가 느껴지는 사진 1장을 체험 전후 안전한 곳에서 촬영해 <strong>12:30까지</strong> 제출해 주세요.
        </p>

        <!-- 💡 AI 심사위원이 보는 3대 핵심 채점 기준 -->
        <div class="mb-4 p-3 rounded-2xl bg-[#FFF8EE] border border-[#F27A24]/30 text-xs text-[#1D3C34]">
          <div class="font-extrabold flex items-center justify-between text-[#F27A24] mb-2">
            <span class="flex items-center gap-1.5">💡 <b>AI 심사위원이 보는 3대 핵심 채점 기준 (25점 만점)</b></span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#F27A24] border border-[#F27A24]/30">제출 시 15점 이상 보장</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] leading-tight">
            <div class="bg-white/90 p-2.5 rounded-xl border border-amber-200/50 shadow-2xs">
              <span class="font-bold text-[#1D5266] block mb-1">🌊 제주 분위기 (최대 8점)</span>
              <span class="text-slate-600">바다·오름·돌담 등 제주의 고유 자연/명소 풍경이 뚜렷한가</span>
            </div>
            <div class="bg-white/90 p-2.5 rounded-xl border border-amber-200/50 shadow-2xs">
              <span class="font-bold text-[#1D5266] block mb-1">😄 팀 표정 케미 (최대 9점)</span>
              <span class="text-slate-600">팀원 전원의 활짝 웃는 표정과 활기찬 에너지 넘치는 포즈</span>
            </div>
            <div class="bg-white/90 p-2.5 rounded-xl border border-amber-200/50 shadow-2xs">
              <span class="font-bold text-[#1D5266] block mb-1">🖼️ 포스터 구도 (최대 8점)</span>
              <span class="text-slate-600">영화나 여행 잡지 표지처럼 인물과 배경의 균형 잡힌 구도</span>
            </div>
          </div>
          <div class="text-[10px] text-slate-500 mt-2">* 촬영자 1명이 빠져도 인원수 감점은 전혀 없습니다! 편하고 즐겁게 촬영해 주세요.</div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <label class="flex flex-col items-center justify-center h-44 rounded-2xl border-2 border-dashed border-[#0097A7]/40 bg-[#F0F9FA]/60 hover:bg-[#E0F7FA]/50 cursor-pointer transition overflow-hidden relative">
            ${team.m1.photo
              ? `<img src="${team.m1.photo}" class="w-full h-full object-cover" /><span class="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">📸 사진 변경하기</span>`
              : `<span class="text-2xl mb-1">📷</span><span class="text-xs font-bold text-[#1D5266]">포스터 사진 1장 첨부하기</span><span class="text-[11px] text-slate-400 mt-0.5">터치하여 앨범/카메라에서 선택</span>`}
            <input type="file" accept="image/*" class="hidden" onchange="handlePhotoUpload(${tid}, 1, this)" />
          </label>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">포스터 한 줄 제목 / 컨셉 메모 (선택)</label>
              <input type="text" value="${team.m1.caption || ''}" onchange="appState.teams[${tid}].m1.caption=this.value;saveState();" placeholder="예: 바람도 쉬어가는 우리 팀의 제주" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white" />
            </div>
            <div class="p-3 rounded-xl ${team.m1.photo ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-slate-50 border border-slate-200 text-slate-500'} text-xs font-semibold">
              ${team.m1.photo ? `✅ 제출 완료 (${team.m1.submittedAt || '등록됨'}) · AI 채점 결과는 내일 아침 시상식에서 공개됩니다!` : '⏳ 아직 사진이 제출되지 않았습니다.'}
            </div>
          </div>
        </div>
      </div>
    `);
  }

  // Mission 2 (10/30 13:00 오픈)
  if (!isMissionOpen(2)) {
    cards.push(renderLockedMissionCard(2));
  } else {
    syncM2State(team);
    const commonPhotosCount = JEJU_COMMON_ITEMS.filter(it => Boolean(team.m2?.itemPhotos?.[it.id])).length;
    const hasHiddenPhoto = JEJU_HIDDEN_ITEMS.some(it => Boolean(team.m2?.itemPhotos?.[it.id]));
    const commonMaxed = commonPhotosCount >= 3;

    cards.push(`
      <div id="p-mission-2" class="retreat-card rounded-3xl p-5 sm:p-6 border border-[#E6E1D3]">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="mission-num-badge text-white text-xs font-extrabold px-2.5 py-1 rounded-lg">미션 2 · 13:00 오픈</span>
            <h2 class="text-base sm:text-lg font-extrabold text-[#1D5266]">[제주 발견] 흔한 제주 5종 중 3종 + 히든 1종</h2>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">⏰ 17:30 제출 마감 · 원래 동선에서만</span>
        </div>
        <p class="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
          원하는 항목 카드를 클릭해 발견한 사진을 바로 등록해 주세요! 사진은 언제든 <strong>[수정]</strong>하거나 <strong>[삭제]</strong>할 수 있습니다. (흔한 제주 5종 중 <strong>최대 3종</strong>, 히든 <strong>1종</strong>)
        </p>

        <div class="space-y-6">
          <!-- ① 흔한 제주 5종 -->
          <div>
            <div class="flex items-center justify-between mb-2.5">
              <div class="text-xs sm:text-sm font-extrabold text-[#1D5266] flex items-center gap-1.5">
                <span>① 흔한 제주 5종</span>
                <span class="text-[11px] font-medium text-slate-500">(서로 다른 3종 사진 등록 · 1종당 5점)</span>
              </div>
              <span class="text-xs font-black px-2.5 py-0.5 rounded-full ${commonPhotosCount >= 3 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-[#E0F7FA] text-[#0097A7] border border-[#0097A7]/30'}">
                ${commonPhotosCount}/3종 등록
              </span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
              ${JEJU_COMMON_ITEMS.map(item => {
                const photoSrc = team.m2?.itemPhotos?.[item.id];
                if (photoSrc) {
                  return `
                    <div class="rounded-2xl p-2.5 border-2 border-[#0097A7] bg-[#F0FAFA] flex flex-col justify-between shadow-xs transition">
                      <div class="flex items-center justify-between gap-1 mb-1.5">
                        <div class="flex items-center gap-1 min-w-0">
                          <span class="text-base">${item.icon}</span>
                          <span class="text-xs font-black text-[#1D5266] truncate">${item.label}</span>
                        </div>
                        <span class="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-[#0097A7] text-white shrink-0">등록됨</span>
                      </div>
                      <div class="relative w-full h-28 sm:h-32 rounded-xl overflow-hidden border border-[#0097A7]/30 bg-slate-100 group">
                        <img src="${photoSrc}" onclick="openLightbox('${photoSrc}')" class="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition duration-200" title="클릭하여 확대" />
                      </div>
                      <div class="grid grid-cols-2 gap-1.5 mt-2">
                        <label class="py-1 px-1.5 rounded-lg bg-white border border-[#0097A7]/40 hover:bg-[#E0F7FA] text-[#1D5266] text-[11px] font-bold text-center cursor-pointer transition flex items-center justify-center gap-1 shadow-2xs">
                          <span>🔄</span><span>수정</span>
                          <input type="file" accept="image/*" class="hidden" onchange="uploadM2ItemPhoto(${tid}, '${item.id}', this, false)" />
                        </label>
                        <button type="button" onclick="removeM2ItemPhoto(${tid}, '${item.id}')" class="py-1 px-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-2xs">
                          <span>🗑️</span><span>삭제</span>
                        </button>
                      </div>
                    </div>
                  `;
                } else if (commonMaxed) {
                  return `
                    <div onclick="showToast('흔한 제주 5종은 최대 3종까지만 등록 가능합니다. 변경을 원하시면 이미 등록된 항목을 먼저 [삭제]해주세요.', 'info')" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3 sm:p-4 flex flex-col items-center justify-center text-center opacity-60 cursor-not-allowed min-h-[140px] select-none">
                      <span class="text-2xl mb-1 grayscale">${item.icon}</span>
                      <span class="text-xs font-bold text-slate-500 leading-tight">${item.label}</span>
                      <span class="mt-2 text-[10px] font-bold text-slate-400 bg-slate-200/80 px-2 py-0.5 rounded-full">3종 완료</span>
                    </div>
                  `;
                } else {
                  return `
                    <label class="rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#0097A7] hover:bg-[#F0FAFA] bg-white cursor-pointer transition p-3 sm:p-4 flex flex-col items-center justify-center text-center group min-h-[140px]">
                      <span class="text-2xl mb-1 group-hover:scale-110 transition duration-150">${item.icon}</span>
                      <span class="text-xs font-bold text-slate-800 group-hover:text-[#1D5266] leading-tight">${item.label}</span>
                      <span class="mt-2.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 group-hover:bg-[#E0F7FA] text-slate-600 group-hover:text-[#0097A7] flex items-center gap-1 transition">
                        <span>📷</span><span>사진 올리기</span>
                      </span>
                      <input type="file" accept="image/*" class="hidden" onchange="uploadM2ItemPhoto(${tid}, '${item.id}', this, false)" />
                    </label>
                  `;
                }
              }).join('')}
            </div>
          </div>

          <!-- ② 히든 미션 4종 -->
          <div>
            <div class="flex items-center justify-between mb-2.5">
              <div class="text-xs sm:text-sm font-extrabold text-amber-900 flex items-center gap-1.5">
                <span>② 🌟 히든 미션 4종</span>
                <span class="text-[11px] font-medium text-amber-700">(1종 선택 보너스 +5점 · 돌하르방/정낭/방사탑/해녀)</span>
              </div>
              <span class="text-xs font-black px-2.5 py-0.5 rounded-full ${hasHiddenPhoto ? 'bg-amber-200 text-amber-950 border border-amber-400' : 'bg-amber-50 text-amber-800 border border-amber-200'}">
                ${hasHiddenPhoto ? '⭐ 1종 등록 완료' : '미등록 (0/1)'}
              </span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              ${JEJU_HIDDEN_ITEMS.map(item => {
                const photoSrc = team.m2?.itemPhotos?.[item.id];
                if (photoSrc) {
                  return `
                    <div class="rounded-2xl p-2.5 border-2 border-amber-500 bg-amber-50/90 flex flex-col justify-between shadow-xs transition">
                      <div class="flex items-center justify-between gap-1 mb-1.5">
                        <div class="flex items-center gap-1 min-w-0">
                          <span class="text-base">${item.icon}</span>
                          <span class="text-xs font-black text-amber-950 truncate">${item.label}</span>
                        </div>
                        <span class="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-600 text-white shrink-0">+5점</span>
                      </div>
                      <div class="relative w-full h-28 sm:h-32 rounded-xl overflow-hidden border border-amber-300 bg-amber-100 group">
                        <img src="${photoSrc}" onclick="openLightbox('${photoSrc}')" class="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition duration-200" title="클릭하여 확대" />
                      </div>
                      <div class="grid grid-cols-2 gap-1.5 mt-2">
                        <label class="py-1 px-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-[11px] font-bold text-center cursor-pointer transition flex items-center justify-center gap-1 shadow-2xs">
                          <span>🔄</span><span>수정</span>
                          <input type="file" accept="image/*" class="hidden" onchange="uploadM2ItemPhoto(${tid}, '${item.id}', this, true)" />
                        </label>
                        <button type="button" onclick="removeM2ItemPhoto(${tid}, '${item.id}')" class="py-1 px-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-2xs">
                          <span>🗑️</span><span>삭제</span>
                        </button>
                      </div>
                    </div>
                  `;
                } else {
                  return `
                    <label class="rounded-2xl border-2 border-dashed border-amber-300/80 hover:border-amber-500 hover:bg-amber-50/70 bg-white cursor-pointer transition p-3 sm:p-4 flex flex-col items-center justify-center text-center group min-h-[140px]">
                      <span class="text-2xl mb-1 group-hover:scale-110 transition duration-150">${item.icon}</span>
                      <span class="text-xs font-bold text-slate-800 group-hover:text-amber-900 leading-tight">${item.label}</span>
                      <span class="mt-2.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 group-hover:bg-amber-100 text-amber-800 flex items-center gap-1 transition">
                        <span>⭐</span><span>${hasHiddenPhoto ? '교체 올리기' : '히든 올리기'}</span>
                      </span>
                      <input type="file" accept="image/*" class="hidden" onchange="uploadM2ItemPhoto(${tid}, '${item.id}', this, true)" />
                    </label>
                  `;
                }
              }).join('')}
            </div>
            ${hasHiddenPhoto ? '<p class="text-[11px] text-amber-800/80 mt-2">* 히든 미션은 최대 1종만 인정됩니다. 다른 항목을 등록하면 기존 등록된 히든 사진이 자동으로 교체됩니다.</p>' : ''}
          </div>
        </div>
      </div>
    `);
  }

  // Mission 3 (10/30 14:30 오픈)
  if (!isMissionOpen(3)) {
    cards.push(renderLockedMissionCard(3));
  } else {
    cards.push(`
      <div id="p-mission-3" class="retreat-card rounded-3xl p-5 sm:p-6 border border-[#E6E1D3]">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="mission-num-badge text-white text-xs font-extrabold px-2.5 py-1 rounded-lg">미션 3 · 14:30 오픈</span>
            <h2 class="text-base sm:text-lg font-extrabold text-[#1D3C34]">[깜짝 N행시] 오늘의 제시어: 「${appState.m3Config.selectedWord}」</h2>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-[#FFF3E8] text-[#F27A24] border border-[#F27A24]/30">⏰ 15:15 제출 마감 · 카톡 영상 제출 & 팀 투표</span>
        </div>
        <p class="text-xs sm:text-sm text-[#4A5255] mb-4 leading-relaxed">
          오늘의 공통 단어 <strong>「${appState.m3Config.selectedWord}」</strong> 각 글자로 시작하는 문장을 이어 팀당 한 편을 <strong>카카오톡 단톡방에 동영상으로 제출</strong>해 주세요! 영상을 올린 후 아래 <strong>[제출 완료 체크]</strong> 버튼을 꼭 눌러주셔야 합니다.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- 1. 본인 팀 카톡 제출 체크 박스 -->
          <div class="p-4 rounded-2xl ${team.m3.kakaoSubmitted ? 'bg-[#E9F0EC] border-2 border-[#1D3C34]' : 'bg-[#FCFBF7] border border-[#E6E1D3]'} space-y-3 transition">
            <div class="flex items-center justify-between">
              <span class="text-xs font-extrabold text-[#1D3C34]">① ${team.name} 카톡 동영상 제출 체크</span>
              ${team.m3.kakaoSubmitted ? `<span class="text-[11px] font-bold text-[#1D3C34] bg-white px-2 py-0.5 rounded-full border border-[#1D3C34]/30">제출완료: ${team.m3.submittedAt || '확인됨'}</span>` : ''}
            </div>
            <p class="text-[11px] text-[#4A5255]">
              카카오톡 단톡방에 우리 팀의 N행시 영상을 전송하셨나요? 업로드 후 아래 버튼을 터치해 주세요.
            </p>
            <button type="button" onclick="toggleM3KakaoSubmitted(${tid})" class="w-full py-3.5 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs ${team.m3.kakaoSubmitted ? 'bg-[#1D3C34] text-white hover:bg-[#142B25]' : 'bg-[#F27A24] text-white hover:bg-[#d96514]'}">
              <span>${team.m3.kakaoSubmitted ? '✅ 카톡방에 영상 제출 완료함 (취소는 클릭)' : '🎬 카톡방에 영상 올렸어요! 제출 완료 체크'}</span>
            </button>
            <div>
              <label class="block text-[11px] font-bold text-[#4A5255] mb-1">우리 팀 N행시 내용 (선택 메모)</label>
              <textarea rows="2" onchange="appState.teams[${tid}].m3.poemText=this.value;saveState();" placeholder="단톡방에 올린 N행시 대사나 문구를 적어두셔도 좋습니다." class="w-full p-2.5 rounded-xl border border-[#E6E1D3] text-xs bg-white text-[#1D3C34]">${team.m3.poemText || ''}</textarea>
            </div>
          </div>

          <!-- 2. 타 팀 영상 감상 후 투표 -->
          <div class="p-4 rounded-2xl bg-[#F5F2E8] border border-[#E6E1D3] space-y-3">
            <div class="text-xs font-extrabold text-[#1D3C34]">② 🗳️ 다른 팀 N행시 영상 보고 투표하기</div>
            <p class="text-[11px] text-[#4A5255]">단톡방에 올라온 다른 두 팀의 영상을 감상한 후, <strong>재미·완성도</strong>가 더 뛰어난 팀 1곳에 투표해 주세요! (본인 팀 제외 1표, 득표 결과는 비공개)</p>
            <div class="grid grid-cols-2 gap-2.5 pt-1">
              ${otherTeams.map(otherId => {
                const otherTeam = appState.teams[otherId];
                const isVoted = team.m3.votedForTeamId === otherId;
                return `<button type="button" onclick="castM3TeamVote(${tid}, ${otherId})" class="py-3 px-3 rounded-xl border font-extrabold text-xs transition ${isVoted ? 'bg-[#1D3C34] text-white border-[#1D3C34] shadow-md' : 'bg-white text-[#1D3C34] border-[#E6E1D3] hover:border-[#1D3C34]'}">
                  ${isVoted ? '💘 투표 완료: ' : '👍 투표: '}${otherTeam.name}
                </button>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `);
  }

  // Mission 4 (10/30 15:30 오픈)
  if (!isMissionOpen(4)) {
    cards.push(renderLockedMissionCard(4));
  } else {
    cards.push(`
      <div id="p-mission-4" class="retreat-card rounded-3xl p-5 sm:p-6 border border-[#E6E1D3]">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="mission-num-badge text-white text-xs font-extrabold px-2.5 py-1 rounded-lg">미션 4 · 15:30 오픈</span>
            <h2 class="text-base sm:text-lg font-extrabold text-[#1D5266]">[창의 단체사진] 한 사람을 제주 여행의 주인공으로!</h2>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200">⏰ 17:30 제출 마감 · AI 채점</span>
        </div>
        <p class="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
          한 사람을 제주 여행의 주인공으로 만들어 주세요! 포즈를 연출해 사진 1장을 17:30까지 보내주세요. 표정 몰아주기는 선택, 편하고 안전한 방식으로요.
        </p>

        <!-- 💡 AI 심사위원이 보는 3대 핵심 채점 기준 -->
        <div class="mb-4 p-3 rounded-2xl bg-[#FFF8EE] border border-[#F27A24]/30 text-xs text-[#1D3C34]">
          <div class="font-extrabold flex items-center justify-between text-[#F27A24] mb-2">
            <span class="flex items-center gap-1.5">💡 <b>AI 심사위원이 보는 3대 핵심 채점 기준 (30점 만점)</b></span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#F27A24] border border-[#F27A24]/30">제출 시 17점 이상 보장</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] leading-tight">
            <div class="bg-white/90 p-2.5 rounded-xl border border-amber-200/50 shadow-2xs">
              <span class="font-bold text-[#1D5266] block mb-1">👑 원탑 주인공 (최대 12점)</span>
              <span class="text-slate-600">시선·손짓·포즈·중앙 배치로 누가 봐도 확실한 1인 주인공</span>
            </div>
            <div class="bg-white/90 p-2.5 rounded-xl border border-amber-200/50 shadow-2xs">
              <span class="font-bold text-[#1D5266] block mb-1">🎭 몰아주기 연기력 (최대 10점)</span>
              <span class="text-slate-600">주인공을 받들거나 감탄·환호·절규하는 팀원들의 폭발적 리액션</span>
            </div>
            <div class="bg-white/90 p-2.5 rounded-xl border border-amber-200/50 shadow-2xs">
              <span class="font-bold text-[#1D5266] block mb-1">💡 재치 & 스토리 (최대 8점)</span>
              <span class="text-slate-600">유쾌한 밈 패러디나 상황극 컨셉의 독창성과 웃음</span>
            </div>
          </div>
          <div class="text-[10px] text-slate-500 mt-2">* 촬영자 1명이 빠져도 인원수 감점은 전혀 없습니다!</div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <label class="flex flex-col items-center justify-center h-44 rounded-2xl border-2 border-dashed border-[#0097A7]/40 bg-[#F0F9FA]/60 hover:bg-[#E0F7FA]/50 cursor-pointer transition overflow-hidden relative">
            ${team.m4.photo
              ? `<img src="${team.m4.photo}" class="w-full h-full object-cover" /><span class="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">📸 사진 변경하기</span>`
              : `<span class="text-2xl mb-1">🌟</span><span class="text-xs font-bold text-[#1D5266]">팀별 주인공 사진 1장 첨부하기</span>`}
            <input type="file" accept="image/*" class="hidden" onchange="handlePhotoUpload(${tid}, 4, this)" />
          </label>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">오늘의 주인공 성함 / 컨셉 메모 (선택)</label>
              <input type="text" value="${team.m4.heroName || ''}" onchange="appState.teams[${tid}].m4.heroName=this.value;saveState();" placeholder="예: 오늘의 센터 주인공 OO님!" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white" />
            </div>
            <div class="p-3 rounded-xl ${team.m4.photo ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-slate-50 border border-slate-200 text-slate-500'} text-xs font-semibold">
              ${team.m4.photo ? `✅ 제출 완료 (${team.m4.submittedAt || '등록됨'})` : '⏳ 아직 사진이 제출되지 않았습니다.'}
            </div>
          </div>
        </div>
      </div>
    `);
  }

  // Mission 5 (10/30 16:00 오픈)
  if (!isMissionOpen(5)) {
    cards.push(renderLockedMissionCard(5));
  } else {
    cards.push(`
      <div id="p-mission-5" class="retreat-card rounded-3xl p-5 sm:p-6 border border-[#E6E1D3]">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="bg-amber-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-lg">미션 5 · 16:00 오픈 (보너스)</span>
            <h2 class="text-base sm:text-lg font-extrabold text-[#1D5266]">팀원 그림자로 ‘JA’ 만들기</h2>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">⏰ 17:30 제출 마감 · 패스 시 감점 없음</span>
        </div>
        <p class="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
          팀원 그림자로 <strong>‘JA’</strong>를 만들어 사진 1장을 찍어 주세요. 17:30까지 제출하면 보너스! 흐리거나 안전한 촬영 장소가 없으면 패스해도 감점은 없습니다.
        </p>

        <!-- 💡 AI 심사위원이 보는 3대 핵심 채점 기준 -->
        <div class="mb-4 p-3 rounded-2xl bg-[#FFF8EE] border border-amber-300 text-xs text-amber-950">
          <div class="font-extrabold flex items-center justify-between text-amber-900 mb-2">
            <span class="flex items-center gap-1.5">💡 <b>AI 심사위원이 보는 3대 핵심 채점 기준 (보너스 10점 만점)</b></span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-amber-900 border border-amber-300">제출 시 기본 4점 보장</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] leading-tight">
            <div class="bg-white/90 p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
              <span class="font-bold text-amber-900 block mb-1">✅ 도전 기본점 (4점 고정)</span>
              <span class="text-slate-600">지면에 드리운 실제 그림자 사진 정상 제출 시 기본 점수</span>
            </div>
            <div class="bg-white/90 p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
              <span class="font-bold text-amber-900 block mb-1">🔤 'JA' 가독성 (최대 4점)</span>
              <span class="text-slate-600">그림자만 보고도 알파벳 'J'와 'A' 형태를 즉시 판별 가능</span>
            </div>
            <div class="bg-white/90 p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
              <span class="font-bold text-amber-900 block mb-1">🤝 신체 협동 난이도 (최대 2점)</span>
              <span class="text-slate-600">전신, 팔다리, 손가락 등을 복합 활용한 팀 협동 노력</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <label class="flex flex-col items-center justify-center h-40 rounded-2xl border-2 border-dashed border-amber-400/60 bg-amber-50/40 hover:bg-amber-50 cursor-pointer transition overflow-hidden relative">
            ${team.m5.photo
              ? `<img src="${team.m5.photo}" class="w-full h-full object-cover" /><span class="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">📸 사진 변경하기</span>`
              : `<span class="text-2xl mb-1">👥</span><span class="text-xs font-bold text-amber-900">그림자 ‘JA’ 사진 1장 첨부하기</span>`}
            <input type="file" accept="image/*" class="hidden" onchange="handlePhotoUpload(${tid}, 5, this)" />
          </label>
          <div class="space-y-3">
            <button type="button" onclick="toggleM5Pass(${tid})" class="w-full py-2.5 px-4 rounded-xl border text-xs font-bold transition ${team.m5.passed ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'}">
              ${team.m5.passed ? '🌥️ 현재 [미션 패스(감점 없음)] 상태입니다 (클릭 시 해제)' : '🌥️ 흐리거나 장소가 마땅치 않아 패스하기 (감점 없음)'}
            </button>
            <div class="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 text-amber-900 text-xs font-semibold">
              ${team.m5.photo ? `✅ 보너스 사진 제출 완료 (${team.m5.submittedAt})` : team.m5.passed ? '✔️ 안전하게 패스 선택 완료 (감점 없음)' : '💡 사진을 제출하면 AI가 보너스 점수를 부여합니다.'}
            </div>
          </div>
        </div>
      </div>
    `);
  }

  // Mission 6 (10/30 18:30 오픈)
  if (!isMissionOpen(6)) {
    cards.push(renderLockedMissionCard(6));
  } else {
    cards.push(`
      <div id="p-mission-6" class="retreat-card rounded-3xl p-5 sm:p-6 border-2 border-[#F27A24]/40 bg-gradient-to-br from-white to-[#FFF3E8]">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="bg-[#1D5266] text-white text-xs font-extrabold px-2.5 py-1 rounded-lg">미션 6 · 18:30 오픈 (저녁 개인미션)</span>
            <h2 class="text-base sm:text-lg font-extrabold text-[#1D5266]">지수님·예찬님의 달라진 아이템을 찾아보세요!</h2>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">🎁 최다 정답자 1명 단독 시상</span>
        </div>
        <p class="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
          아침에 본 <strong>지수님·예찬님</strong>의 모습과 지금을 비교해 달라진 아이템을 찾아보세요! <strong>3분 안에</strong> 정답을 제출해 주세요. 서로 상의하지 않고 개인별로 참여해 주세요.
        </p>
        <form onsubmit="submitM6IndividualForm(event)" class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-slate-200/80">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">참가자 성함 (필수)</label>
            <input id="m6-p-name" type="text" placeholder="홍길동" required class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">소속 팀</label>
            <select id="m6-p-team" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white">
              ${[1, 2, 3].map(id => `<option value="${id}" ${id === tid ? 'selected' : ''}>${appState.teams[id].name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">🔍 지수님 달라진 아이템 (주관식)</label>
            <input id="m6-p-jisoo" type="text" placeholder="예: 안경 착용, 머리핀, 운동화 등" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">🔍 예찬님 달라진 아이템 (주관식)</label>
            <input id="m6-p-yechan" type="text" placeholder="예: 시계 뺌, 가디건 색상, 명찰 위치 등" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm" />
          </div>
          <div class="sm:col-span-2 pt-1">
            <button type="submit" class="w-full py-3 rounded-xl bg-[#1D5266] hover:bg-[#123746] text-white font-extrabold text-xs sm:text-sm shadow transition">
              🚀 개인미션 정답 제출하기 (제출 시각 자동 기록)
            </button>
          </div>
        </form>
      </div>
    `);
  }

  container.innerHTML = cards.join('');
  } catch (err) {
    console.error('renderParticipantView error:', err);
  }
}

/* ==========================================================================
   TF DASHBOARD VIEW RENDERER & HANDLERS (실시간 비공개 대시보드)
   ========================================================================== */

function setTfMissionFilter(filterVal) {
  appState.tfFilter = filterVal;
  document.querySelectorAll('.tf-filter-btn').forEach(btn => {
    btn.classList.remove('tab-active');
    btn.classList.add('text-slate-600');
  });
  const activeBtn = document.getElementById(`tf-tab-${filterVal}`);
  if (activeBtn) {
    activeBtn.classList.add('tab-active');
    activeBtn.classList.remove('text-slate-600');
  }
  renderTfDashboardView();
}

function updateAiManualScore(teamId, missionNum, newScore) {
  const mKey = `m${missionNum}`;
  const maxMap = { 1: 25, 4: 30, 5: 10 };
  const val = Math.max(0, Math.min(maxMap[missionNum], Number(newScore) || 0));
  appState.teams[teamId][mKey].score = val;
  appState.teams[teamId][mKey].graded = true;
  saveState();
  renderTfLeaderboard();
}

function updateAiOneLineReview(teamId, missionNum, text) {
  const mKey = `m${missionNum}`;
  appState.teams[teamId][mKey].oneLineReview = text;
  saveState();
}

function selectM3Word(word) {
  appState.m3Config.selectedWord = word;
  saveState();
  renderAll();
  showToast(`오늘의 N행시 공통 단어가 「${word}」(으)로 설정되었습니다!`, 'success');
}

function pickRandomM3Word() {
  const randomWord = N_POEM_WORDS[Math.floor(Math.random() * N_POEM_WORDS.length)];
  selectM3Word(randomWord);
}

function setTfTieBreakerVote(teamId) {
  appState.m3Config.tfTieBreakerVoteTeamId = (appState.m3Config.tfTieBreakerVoteTeamId === teamId) ? null : teamId;
  saveState();
  renderAll();
  if (appState.m3Config.tfTieBreakerVoteTeamId) {
    showToast(`TF팀 캐스팅보트 1표가 ${appState.teams[teamId].name}에 반영되었습니다!`, 'success');
  }
}

/* ==========================================================================
   MISSION 6: 맞춘 개수 체크 시 많은 순 자동 정렬 & 1등 당첨자 선택
   ========================================================================== */

function adjustM6CorrectCount(entryId, delta) {
  const item = appState.m6Config.submissions.find(s => s.id === entryId);
  if (!item) return;
  item.correctCount = Math.max(0, (Number(item.correctCount) || 0) + delta);
  saveState();
  renderTfDashboardView();
}

function setM6CorrectCountDirect(entryId, val) {
  const item = appState.m6Config.submissions.find(s => s.id === entryId);
  if (!item) return;
  item.correctCount = Math.max(0, Number(val) || 0);
  saveState();
  renderTfDashboardView();
}

function selectM6Winner(entryId) {
  appState.m6Config.winnerId = (appState.m6Config.winnerId === entryId) ? null : entryId;
  saveState();
  renderTfDashboardView();
  const winner = appState.m6Config.submissions.find(s => s.id === entryId);
  if (winner && appState.m6Config.winnerId) {
    showToast(`🎉 저녁 개인미션 1등 당첨자로 [${winner.name}님 (${winner.teamName})]이 선정되었습니다!`, 'success');
  }
}

function deleteM6Submission(entryId) {
  appState.m6Config.submissions = appState.m6Config.submissions.filter(s => s.id !== entryId);
  if (appState.m6Config.winnerId === entryId) appState.m6Config.winnerId = null;
  saveState();
  renderTfDashboardView();
}

function addM6ManualEntry() {
  const name = prompt('참가자 이름을 입력하세요:');
  if (!name) return;
  const jisooAns = prompt('지수님 달라진 아이템 작성 내용:') || '';
  const yechanAns = prompt('예찬님 달라진 아이템 작성 내용:') || '';
  appState.m6Config.submissions.push({
    id: 'm6_' + Date.now(),
    name: name.trim(),
    teamId: 1,
    teamName: appState.teams[1].name,
    jisooAns,
    yechanAns,
    submittedTime: formatNowTime(true),
    timestampMs: Date.now(),
    correctCount: 0
  });
  saveState();
  renderTfDashboardView();
}

function startM6Timer() {
  if (m6TimerInterval) return;
  m6TimerInterval = setInterval(() => {
    if (m6RemainingSeconds > 0) {
      m6RemainingSeconds--;
      updateM6TimerDisplay();
    } else {
      clearInterval(m6TimerInterval);
      m6TimerInterval = null;
      showToast('⏰ 3분 제한 시간이 종료되었습니다!', 'info');
    }
  }, 1000);
}

function pauseM6Timer() {
  if (m6TimerInterval) {
    clearInterval(m6TimerInterval);
    m6TimerInterval = null;
  }
}

function resetM6Timer() {
  pauseM6Timer();
  m6RemainingSeconds = 180;
  updateM6TimerDisplay();
}

function updateM6TimerDisplay() {
  const el = document.getElementById('m6-timer-display');
  if (!el) return;
  const m = String(Math.floor(m6RemainingSeconds / 60)).padStart(2, '0');
  const s = String(m6RemainingSeconds % 60).padStart(2, '0');
  el.textContent = `${m}:${s}`;
}

function renderMissionScheduleToggleBadge(missionNum) {
  const sched = MISSION_OPEN_SCHEDULE[missionNum];
  const open = isMissionOpen(missionNum);
  const manual = appState.scheduleConfig?.manualOpen?.[missionNum];
  return `
    <button onclick="toggleMissionManualOpen(${missionNum})" class="text-xs font-extrabold px-3 py-1 rounded-full border transition ${open ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'}" title="클릭하여 참가자 화면 즉시 오픈/스케줄 모드 전환">
      ${open ? `🔓 참가자 오픈됨 (${manual ? '수동오픈' : sched.shortTime})` : `🔒 ${sched.timeLabel} 대기중 (클릭 시 즉시 오픈)`}
    </button>
  `;
}

function renderTfLeaderboard() {
  const grid = document.getElementById('tf-leaderboard-grid');
  if (!grid) return;

  const forceBtn = document.getElementById('btn-force-open-all');
  if (forceBtn) {
    const isForced = Boolean(appState.scheduleConfig?.forceOpenAll);
    forceBtn.textContent = isForced ? '⏰ 10/30(금) 시간별 자동 오픈으로 되돌리기' : '🔓 테스트용 전체 미션 즉시 오픈 켜기';
    forceBtn.className = isForced
      ? 'text-xs font-extrabold px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 shadow transition'
      : 'text-xs font-extrabold px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 transition';
  }

  const list = [1, 2, 3].map(id => ({
    id,
    name: appState.teams[id].name,
    summary: getTeamScoreSummary(id)
  })).sort((a, b) => b.summary.grandTotal - a.summary.grandTotal);

  const medals = ['🥇 현재 1위', '🥈 현재 2위', '🥉 현재 3위'];

  grid.innerHTML = list.map((item, idx) => {
    const s = item.summary;
    const pin = (appState.settings.teamPins?.[item.id] || '').trim();
    return `
      <div class="p-4 rounded-2xl bg-white/10 border ${idx === 0 ? 'border-amber-400/80 bg-white/15' : 'border-white/15'} backdrop-blur-md">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-extrabold px-2.5 py-0.5 rounded-full ${idx === 0 ? 'bg-amber-400 text-slate-950' : 'bg-white/15 text-slate-200'}">${medals[idx]}</span>
          <span class="text-xs text-slate-300">정규 ${s.regularTotal} + 보너스 ${s.bonusTotal}</span>
        </div>
        <div class="flex items-baseline justify-between">
          <h3 class="text-lg font-extrabold text-white">${item.name}</h3>
          <div class="text-2xl font-black text-amber-300">${s.grandTotal}<span class="text-xs font-normal text-slate-300 ml-0.5">/ 115점</span></div>
        </div>

        <!-- Team PIN display for TF -->
        <div class="mt-2.5 flex items-center justify-between text-xs bg-black/35 px-3 py-1.5 rounded-xl border border-white/10">
          <span class="text-slate-200 font-bold flex items-center gap-1.5">
            <span>🔐 팀 접속 비밀번호:</span>
          </span>
          <span class="font-mono ${pin ? 'text-amber-300 font-black text-sm bg-amber-400/20 px-2 py-0.5 rounded-lg border border-amber-400/40' : 'text-rose-300 font-bold italic text-[11px] bg-rose-500/20 px-2 py-0.5 rounded-lg'}">
            ${pin ? `[ ${pin} ]` : '미설정 (최초 등록 대기)'}
          </span>
        </div>

        <div class="grid grid-cols-5 gap-1 mt-3 pt-2.5 border-t border-white/10 text-[10px] text-center text-slate-300">
          <div><div class="text-slate-400">1.포스터</div><div class="font-bold text-white">${s.m1}/25</div></div>
          <div><div class="text-slate-400">2.발견</div><div class="font-bold text-white">${s.m2}/20</div></div>
          <div><div class="text-slate-400">3.N행시</div><div class="font-bold text-white">${s.m3}/30</div></div>
          <div><div class="text-slate-400">4.주인공</div><div class="font-bold text-white">${s.m4}/30</div></div>
          <div><div class="text-amber-300">5.그림자</div><div class="font-bold text-amber-300">+${s.m5}</div></div>
        </div>
      </div>
    `;
  }).join('');

  const bar = document.getElementById('tf-team-pins-monitor-bar');
  if (bar) {
    bar.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-extrabold text-amber-300 flex items-center gap-1">
          <span>🔑 TF 관제 실시간 팀 비밀번호:</span>
        </span>
        ${[1, 2, 3].map(id => {
          const p = (appState.settings.teamPins?.[id] || '').trim();
          return `
            <span class="inline-flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-xl border border-white/15">
              <span class="font-extrabold text-white">${appState.teams[id].name}:</span>
              <span class="font-mono ${p ? 'text-amber-300 font-black' : 'text-rose-300 font-bold italic text-[11px]'}">${p ? `[ ${p} ]` : '미설정'}</span>
            </span>
          `;
        }).join('')}
      </div>
      <button type="button" onclick="openSettingsModal()" class="shrink-0 text-[11px] font-extrabold px-3 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 transition">
        ⚙️ 비번 직접 수정/초기화
      </button>
    `;
  }
}

function renderAiMissionPanel(missionNum, title, maxScore, criteriaDesc) {
  const mKey = `m${missionNum}`;
  return `
    <div class="glass-card rounded-3xl p-5 sm:p-6 border border-slate-200/90">
      <div class="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200/70">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="mission-num-badge text-white text-xs font-extrabold px-2.5 py-1 rounded-lg">미션 ${missionNum}</span>
            <h2 class="text-base sm:text-lg font-extrabold text-[#1D5266]">${title}</h2>
            <span class="text-xs font-extrabold text-[#0097A7] bg-[#E0F7FA] px-2.5 py-0.5 rounded-full">배점 ${missionNum === 5 ? '보너스 +' + maxScore : maxScore}점</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">${criteriaDesc}</p>
        </div>
        ${renderMissionScheduleToggleBadge(missionNum)}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        ${[1, 2, 3].map(tid => {
          const team = appState.teams[tid];
          const m = team[mKey];
          return `
            <div class="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-extrabold text-[#1D5266]">${team.name}</span>
                  <span class="text-[11px] font-bold ${m.photo ? 'text-emerald-600' : m.passed ? 'text-slate-500' : 'text-slate-400'}">
                    ${m.photo ? `✅ 제출 (${m.submittedAt || '완료'})` : m.passed ? '🌥️ 패스 (0점)' : '⏳ 미제출'}
                  </span>
                </div>

                <div class="relative h-44 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center mb-3">
                  ${m.photo
                    ? `<img src="${m.photo}" onclick="openLightbox('${m.photo}')" class="w-full h-full object-cover cursor-zoom-in" />`
                    : `<span class="text-xs text-slate-400">${m.passed ? '🌥️ 패스 선택한 팀입니다' : '아직 제출된 사진 없음'}</span>`}
                  <label class="absolute bottom-2 right-2 bg-black/75 hover:bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-full cursor-pointer">
                    📁 사진 업로드
                    <input type="file" accept="image/*" class="hidden" onchange="handlePhotoUpload(${tid}, ${missionNum}, this)" />
                  </label>
                </div>

                <div class="flex items-center gap-1.5 mb-3">
                  <button id="btn-ai-grade-${tid}-${missionNum}" onclick="runAiGradeMission(${tid}, ${missionNum})" class="flex-1 py-2 px-3 rounded-xl bg-[#1D5266] hover:bg-[#123746] text-white text-xs font-extrabold transition flex items-center justify-center gap-1">
                    <span>🤖</span><span>GPT AI 채점</span>
                  </button>
                  <button onclick="copyAiPromptToClipboard(${tid}, ${missionNum})" class="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold" title="ChatGPT용 프롬프트 복사">
                    📋 프롬프트
                  </button>
                </div>
              </div>

              <div class="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200/80 space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-extrabold text-slate-700">획득 점수 (만점 ${maxScore}점)</label>
                  <div class="flex items-center gap-1">
                    <input type="number" min="0" max="${maxScore}" value="${m.score || 0}" onchange="updateAiManualScore(${tid}, ${missionNum}, this.value)" class="w-16 px-2 py-1 rounded-lg border border-slate-300 text-right font-extrabold text-sm text-[#0097A7] bg-white" />
                    <span class="text-xs font-bold text-slate-500">점</span>
                  </div>
                </div>
                ${m.subScores && Object.keys(m.subScores).length > 0 ? `
                  <div class="flex flex-wrap gap-1.5 py-0.5">
                    ${Object.entries(m.subScores).map(([k, v]) => `
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">${k}: <b class="text-[#0097A7]">${v}점</b></span>
                    `).join('')}
                  </div>
                ` : ''}
                <div>
                  <label class="block text-[11px] font-bold text-slate-500 mb-1">💬 AI 한 줄 근거 (직접 수정 가능)</label>
                  <textarea rows="2" onchange="updateAiOneLineReview(${tid}, ${missionNum}, this.value)" placeholder="AI 채점 버튼을 누르면 한 줄 심사평이 자동 기록됩니다." class="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white text-slate-700">${m.oneLineReview || ''}</textarea>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderTfDashboardView() {
  renderTfLeaderboard();
  const f = appState.tfFilter;
  const container = document.getElementById('tf-missions-container');
  if (!container) return;

  const blocks = [];

  if (f === 'all' || f === 1) {
    blocks.push(renderAiMissionPanel(
      1,
      '[관광지 사진] 우리 팀의 제주 여행 포스터 (09:20 오픈 ~ 12:30 마감)',
      25,
      '루브릭 심사 기준: ① 제주 랜드마크 분위기(최대 8점) + ② 팀원 에너지·표정 케미(최대 9점) + ③ 포스터 완성도 구도(최대 8점) · 촬영자 인원수 감점 배제'
    ));
  }

  if (f === 'all' || f === 2) {
    blocks.push(`
      <div class="glass-card rounded-3xl p-5 sm:p-6 border border-slate-200/90 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200/70">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="mission-num-badge text-white text-xs font-extrabold px-2.5 py-1 rounded-lg">미션 2</span>
              <h2 class="text-base sm:text-lg font-extrabold text-[#1D5266]">[제주 발견] 흔한 제주 5종 중 3종 + 히든 1종 (최대 20점)</h2>
              <span class="text-xs font-extrabold text-[#0097A7] bg-[#E0F7FA] px-2.5 py-0.5 rounded-full">정규 15점 + 보너스 5점 = 20점 만점</span>
              ${renderMissionScheduleToggleBadge(2)}
            </div>
            <p class="text-xs text-slate-500 mt-1">10/30(금) 13:00 오픈 ~ 17:30 마감 · 🤖 GPT-4o Vision이 업로드된 사진을 판독하여 키위 등 다른 과일이나 엉뚱한 사진 제출을 자동 감지합니다.</p>
          </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          ${[1, 2, 3].map(tid => {
            const team = appState.teams[tid];
            syncM2State(team);
            const sc = getMission2Score(team);
            const hasPhotos = (team.m2.photos || []).length > 0;
            const isGraded = Boolean(team.m2.graded);
            const verifiedCommon = isGraded ? (team.m2.verifiedCommon || []) : (team.m2.commonChecked || []);
            const verifiedHidden = isGraded ? team.m2.verifiedHidden : team.m2.hiddenChecked;
            return `
              <div class="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-3">
                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm font-extrabold text-[#1D5266]">${team.name}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isGraded ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-500'}">
                      ${isGraded ? '🤖 AI 판독완료' : '판독 대기'}
                    </span>
                  </div>
                  <span class="text-sm font-black text-[#0097A7]">${sc.total}점 <span class="text-[11px] font-normal text-slate-400">(일반 ${sc.commonScore} + 히든 ${sc.hiddenScore})</span></span>
                </div>

                <!-- AI Grade Button -->
                <button id="btn-ai-grade-${tid}-2" onclick="runAiGradeMission2(${tid})" ${hasPhotos ? '' : 'disabled'} class="w-full py-2 px-3 rounded-xl ${hasPhotos ? 'bg-[#1D3C34] hover:bg-[#142B25] text-white shadow-xs' : 'bg-slate-100 text-slate-400 cursor-not-allowed'} text-xs font-extrabold transition flex items-center justify-center gap-1.5">
                  <span>🤖</span>
                  <span>${isGraded ? '사진 재판독 & 채점' : '제출 사진 AI 정밀 판독'}</span>
                </button>

                ${team.m2.oneLineReview ? `
                  <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed font-medium">
                    <span class="text-[#0097A7] font-bold">🤖 AI 심사평: </span>${team.m2.oneLineReview}
                  </div>
                ` : ''}

                <!-- 1:1 Item Photo Verification List -->
                <div class="space-y-2.5 pt-1">
                  <!-- 흔한 제주 5종 -->
                  <div>
                    <div class="text-[11px] font-bold text-slate-600 flex items-center justify-between mb-1.5">
                      <span>일반 5종 (최대 3종 인정)</span>
                      <span class="text-[10px] text-slate-400">버튼으로 인정/불인정 토글</span>
                    </div>
                    <div class="space-y-1.5">
                      ${JEJU_COMMON_ITEMS.map(item => {
                        const photoSrc = team.m2?.itemPhotos?.[item.id];
                        const verified = verifiedCommon.includes(item.id);
                        if (photoSrc) {
                          return `
                            <div class="flex items-center justify-between gap-2 p-1.5 rounded-xl border ${verified ? 'bg-[#E0F7FA]/50 border-[#0097A7]' : 'bg-rose-50/60 border-rose-200'}">
                              <div class="flex items-center gap-2 min-w-0">
                                <img src="${photoSrc}" onclick="openLightbox('${photoSrc}')" class="w-10 h-10 rounded-lg object-cover border cursor-zoom-in shrink-0" title="클릭하여 확대" />
                                <div class="min-w-0">
                                  <div class="text-xs font-bold text-slate-800 truncate">${item.icon} ${item.label}</div>
                                  <div class="text-[10px] font-extrabold ${verified ? 'text-[#0097A7]' : 'text-rose-500'}">
                                    ${isGraded ? (verified ? '✅ AI 인정 (+5점)' : '❌ AI 불인정 (0점)') : '📷 사진 등록됨'}
                                  </div>
                                </div>
                              </div>
                              <button type="button" onclick="toggleM2CommonItem(${tid}, '${item.id}')" class="px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 transition ${verified ? 'bg-white border border-[#0097A7] text-[#1D5266] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300' : 'bg-white border border-slate-300 text-slate-600 hover:bg-[#E0F7FA] hover:text-[#0097A7] hover:border-[#0097A7]'}">
                                ${verified ? '불인정 전환' : '인정 전환'}
                              </button>
                            </div>
                          `;
                        } else {
                          return `
                            <div class="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 text-xs">
                              <span class="text-[11px]">${item.icon} ${item.label}</span>
                              <span class="text-[10px]">미제출</span>
                            </div>
                          `;
                        }
                      }).join('')}
                    </div>
                  </div>

                  <!-- 히든 미션 4종 -->
                  <div class="pt-1.5 border-t border-slate-100">
                    <div class="text-[11px] font-bold text-amber-800 flex items-center justify-between mb-1.5">
                      <span>히든 4종 (최대 1종 인정 · +5점)</span>
                    </div>
                    <div class="space-y-1.5">
                      ${JEJU_HIDDEN_ITEMS.map(item => {
                        const photoSrc = team.m2?.itemPhotos?.[item.id];
                        const verified = verifiedHidden === item.id;
                        if (photoSrc) {
                          return `
                            <div class="flex items-center justify-between gap-2 p-1.5 rounded-xl border ${verified ? 'bg-amber-50 border-amber-500' : 'bg-rose-50/60 border-rose-200'}">
                              <div class="flex items-center gap-2 min-w-0">
                                <img src="${photoSrc}" onclick="openLightbox('${photoSrc}')" class="w-10 h-10 rounded-lg object-cover border cursor-zoom-in shrink-0" title="클릭하여 확대" />
                                <div class="min-w-0">
                                  <div class="text-xs font-bold text-amber-950 truncate">${item.icon} ${item.label}</div>
                                  <div class="text-[10px] font-extrabold ${verified ? 'text-amber-800' : 'text-rose-500'}">
                                    ${isGraded ? (verified ? '⭐ 히든 인정 (+5점)' : '❌ AI 불인정 (0점)') : '⭐ 히든 사진 등록됨'}
                                  </div>
                                </div>
                              </div>
                              <button type="button" onclick="selectM2HiddenItem(${tid}, '${item.id}')" class="px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 transition ${verified ? 'bg-white border border-amber-500 text-amber-900 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300' : 'bg-white border border-slate-300 text-slate-600 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-500'}">
                                ${verified ? '불인정 전환' : '인정 전환'}
                              </button>
                            </div>
                          `;
                        } else {
                          return '';
                        }
                      }).join('')}
                      ${!JEJU_HIDDEN_ITEMS.some(it => Boolean(team.m2?.itemPhotos?.[it.id])) ? '<div class="text-[11px] text-slate-400 p-2 bg-slate-50 rounded-xl text-center">히든 미션 사진 미제출</div>' : ''}
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `);
  }

  if (f === 'all' || f === 3) {
    const vInfo = getMission3VotesAndScores();
    blocks.push(`
      <div class="glass-card rounded-3xl p-5 sm:p-6 border border-slate-200/90 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200/70">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="mission-num-badge text-white text-xs font-extrabold px-2.5 py-1 rounded-lg">미션 3</span>
              <h2 class="text-base sm:text-lg font-extrabold text-[#1D5266]">[깜짝 N행시] 카톡 동영상 제출 & 팀별 상호 투표 (30점 만점)</h2>
              ${renderMissionScheduleToggleBadge(3)}
            </div>
            <p class="text-xs text-slate-500 mt-1">10/30(금) 14:30 오픈 ~ 15:15 마감 · 최다 득표 1위(30점) / 2위(25점) / 3위(20점) · 동점 시 TF 캐스팅보트 1표</p>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            ${N_POEM_WORDS.map(w => `
              <button onclick="selectM3Word('${w}')" class="px-2.5 py-1 rounded-lg text-xs font-bold border ${appState.m3Config.selectedWord === w ? 'bg-[#1D5266] text-white border-[#1D5266]' : 'bg-white text-slate-600 border-slate-200'}">${w}</button>
            `).join('')}
            <button onclick="pickRandomM3Word()" class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">🎲 랜덤 추첨</button>
          </div>
        </div>

        ${vInfo.isThreeWayTie ? `
          <div class="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div class="text-xs sm:text-sm font-extrabold text-amber-900">⚖️ 1표 : 1표 : 1표 동점 발생! TF팀 캐스팅보트(결승 1표)를 선택해 주세요!</div>
              <p class="text-xs text-amber-800 mt-0.5">TF팀이 선택한 팀이 최종 우승(30점)을 차지하며, 나머지 두 팀은 공동 2위(25점)가 부여됩니다.</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              ${[1, 2, 3].map(tid => `
                <button onclick="setTfTieBreakerVote(${tid})" class="px-3.5 py-2 rounded-xl text-xs font-extrabold border transition ${vInfo.tfPick === tid ? 'bg-amber-500 text-slate-950 border-amber-600 shadow' : 'bg-white text-slate-700 border-amber-300 hover:bg-amber-100'}">
                  ${vInfo.tfPick === tid ? '👑 TF 선택: ' : 'TF 투표: '}${appState.teams[tid].name}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          ${[1, 2, 3].map(tid => {
            const team = appState.teams[tid];
            const otherTeams = [1, 2, 3].filter(id => id !== tid);
            return `
              <div class="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-extrabold text-[#1D5266]">${team.name}</span>
                  <span class="text-sm font-black text-[#0097A7]">${vInfo.scores[tid]}점 <span class="text-xs font-bold text-amber-600">(총 ${vInfo.finalVotes[tid]}표)</span></span>
                </div>
                <button onclick="toggleM3KakaoSubmitted(${tid})" class="w-full py-2 rounded-xl text-xs font-bold border ${team.m3.kakaoSubmitted ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}">
                  ${team.m3.kakaoSubmitted ? `✅ 카톡 영상 제출 완료 (${team.m3.submittedAt || '확인됨'})` : '⏳ 카톡 영상 미제출 (클릭 시 제출 체크)'}
                </button>
                <div class="text-xs space-y-1.5">
                  <div class="font-bold text-slate-600">${team.name}이 투표한 팀 (본인 팀 제외):</div>
                  <div class="grid grid-cols-2 gap-1.5">
                    ${otherTeams.map(oid => `
                      <button onclick="castM3TeamVote(${tid}, ${oid})" class="py-1.5 rounded-lg text-xs font-bold border ${team.m3.votedForTeamId === oid ? 'bg-[#1D5266] text-white border-[#1D5266]' : 'bg-slate-50 text-slate-600 border-slate-200'}">
                        → ${appState.teams[oid].name} 투표
                      </button>
                    `).join('')}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `);
  }

  if (f === 'all' || f === 4) {
    blocks.push(renderAiMissionPanel(
      4,
      '[창의 단체사진] 한 사람을 제주 여행의 주인공으로! (15:30 오픈 ~ 17:30 마감)',
      30,
      '루브릭 심사 기준: ① 독보적 원탑 주인공 연출(최대 12점) + ② 팀원 몰아주기 리액션·연기력(최대 10점) + ③ 재치·스토리텔링(최대 8점) · 인원수 감점 배제'
    ));
  }

  if (f === 'all' || f === 5) {
    blocks.push(renderAiMissionPanel(
      5,
      "[보너스 미션] 팀원 그림자로 'JA' 만들기 (16:00 오픈 ~ 17:30 마감)",
      10,
      "패스 시 감점 없음 · 루브릭 심사 기준: ① 도전 기본 점수(4점 고정) + ② 'JA' 알파벳 가독성(최대 4점) + ③ 신체 협동 난이도(최대 2점)"
    ));
  }

  if (f === 'all' || f === 6) {
    const sortedSubs = getSortedM6Submissions();
    const currentWinner = sortedSubs.find(s => s.id === appState.m6Config.winnerId);

    blocks.push(`
      <div class="glass-card rounded-3xl p-5 sm:p-6 border-2 border-amber-300/80 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/70">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="bg-[#1D5266] text-white text-xs font-extrabold px-2.5 py-1 rounded-lg">미션 6 · 18:30 오픈</span>
              <h2 class="text-base sm:text-lg font-extrabold text-[#1D5266]">지수님·예찬님 달라진 아이템 찾기 (맞춘 개수 순 자동 정렬 & 1등 선정)</h2>
              ${renderMissionScheduleToggleBadge(6)}
            </div>
            <p class="text-xs text-slate-500 mt-1">
              TF에서 각 참가자의 <strong>[맞춘 개수 (+ / -)]</strong>를 체크하면 즉시 <strong>① 맞춘 개수 많은 순 → ② 제출 시각 빠른 순</strong>으로 자동 정렬되며, <strong>[👑 1등 선택]</strong>으로 우승자를 확정합니다!
            </p>
          </div>

          <div class="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-2xl">
            <span id="m6-timer-display" class="font-mono text-xl font-black text-amber-400">03:00</span>
            <button onclick="startM6Timer()" class="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500">시작</button>
            <button onclick="pauseM6Timer()" class="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600">정지</button>
            <button onclick="resetM6Timer()" class="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600">리셋</button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <label class="block text-xs font-extrabold text-slate-700 mb-1">📌 [TF 참고용] 지수님 실제 달라진 아이템 메모</label>
            <input type="text" value="${appState.m6Config.answerKeyJisoo || ''}" onchange="appState.m6Config.answerKeyJisoo=this.value;saveState();" placeholder="예: 1.안경 2.머리핀 3.운동화" class="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white" />
          </div>
          <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <label class="block text-xs font-extrabold text-slate-700 mb-1">📌 [TF 참고용] 예찬님 실제 달라진 아이템 메모</label>
            <input type="text" value="${appState.m6Config.answerKeyYechan || ''}" onchange="appState.m6Config.answerKeyYechan=this.value;saveState();" placeholder="예: 1.시계 뺌 2.가디건 3.명찰" class="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white" />
          </div>
          <div class="p-3.5 rounded-2xl ${currentWinner ? 'bg-amber-100 border-2 border-amber-500' : 'bg-slate-50 border border-slate-200'} flex items-center justify-between">
            <div>
              <div class="text-[11px] font-bold text-amber-900">🏆 현재 선정된 1등 당첨자</div>
              <div class="text-sm font-black text-[#1D5266] mt-0.5">
                ${currentWinner ? `👑 ${currentWinner.name} (${currentWinner.teamName}) · ${currentWinner.correctCount}개 정답` : '아래 목록에서 [1등 선택]을 눌러주세요'}
              </div>
            </div>
            <button onclick="addM6ManualEntry()" class="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 shrink-0">+ 수동 추가</button>
          </div>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 text-xs">
                <th class="py-3 px-3 font-extrabold w-16 text-center">순위</th>
                <th class="py-3 px-3 font-extrabold">참가자 (팀)</th>
                <th class="py-3 px-3 font-extrabold">지수님 답안 (주관식)</th>
                <th class="py-3 px-3 font-extrabold">예찬님 답안 (주관식)</th>
                <th class="py-3 px-3 font-extrabold text-center w-24">제출 시각</th>
                <th class="py-3 px-3 font-extrabold text-center w-36">✅ 맞춘 개수 체크</th>
                <th class="py-3 px-3 font-extrabold text-center w-40">👑 1등 당첨자 선택</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200/70">
              ${sortedSubs.length === 0 ? `
                <tr>
                  <td colspan="7" class="py-8 text-center text-slate-400 text-xs">아직 제출된 개인미션 답안이 없습니다.</td>
                </tr>
              ` : sortedSubs.map((sub, idx) => {
                const isWinner = appState.m6Config.winnerId === sub.id;
                return `
                  <tr class="${isWinner ? 'winner-glow font-bold' : idx === 0 && sub.correctCount > 0 ? 'bg-amber-50/50' : 'hover:bg-slate-50'} transition">
                    <td class="py-3 px-3 text-center font-black ${idx === 0 ? 'text-amber-600' : 'text-slate-500'}">
                      ${isWinner ? '👑 1등' : `${idx + 1}위`}
                    </td>
                    <td class="py-3 px-3 font-bold text-[#1D5266]">
                      ${sub.name} <span class="text-[11px] font-semibold text-slate-500">(${sub.teamName})</span>
                    </td>
                    <td class="py-3 px-3 text-slate-700">${sub.jisooAns || '-'}</td>
                    <td class="py-3 px-3 text-slate-700">${sub.yechanAns || '-'}</td>
                    <td class="py-3 px-3 text-center font-mono text-xs text-slate-500">${sub.submittedTime}</td>
                    <td class="py-3 px-3">
                      <div class="flex items-center justify-center gap-1.5">
                        <button onclick="adjustM6CorrectCount('${sub.id}', -1)" class="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-sm leading-none">-</button>
                        <input type="number" min="0" value="${sub.correctCount || 0}" onchange="setM6CorrectCountDirect('${sub.id}', this.value)" class="w-12 text-center font-black text-sm border border-slate-300 rounded-lg py-1 bg-white text-[#0097A7]" />
                        <button onclick="adjustM6CorrectCount('${sub.id}', 1)" class="w-7 h-7 rounded-lg bg-[#0097A7] hover:bg-[#00838F] text-white font-black text-sm leading-none">+</button>
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                      <div class="flex items-center justify-center gap-1">
                        <button onclick="selectM6Winner('${sub.id}')" class="px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${isWinner ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-100 hover:bg-amber-100 text-slate-700 border border-slate-300'}">
                          ${isWinner ? '👑 1등 확정됨' : '🏆 1등 선택'}
                        </button>
                        <button onclick="deleteM6Submission('${sub.id}')" class="text-slate-400 hover:text-rose-600 px-1.5" title="삭제">✕</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `);
  }

  container.innerHTML = blocks.join('');
}

/* ==========================================================================
   CEREMONY VIEW, MODALS, EXPORT & INITIALIZATION
   ========================================================================== */

function setCeremonySlide(slideName) {
  appState.ceremonySlide = slideName;
  renderCeremonyView();
}

function renderCeremonyView() {
  const area = document.getElementById('ceremony-content-area');
  if (!area) return;
  const slide = appState.ceremonySlide || 'missions';

  if (slide === 'missions') {
    area.innerHTML = `
      <div class="space-y-6">
        ${[
          { num: 1, key: 'm1', title: '미션 1 · 제주 여행 포스터 (25점 만점)' },
          { num: 4, key: 'm4', title: '미션 4 · 팀별 주인공 사진 (30점 만점)' },
          { num: 5, key: 'm5', title: "미션 5 · 보너스 그림자 'JA' (+10점)" }
        ].map(mInfo => `
          <div class="glass-card rounded-3xl p-6 border border-slate-200">
            <h2 class="text-lg sm:text-xl font-extrabold text-[#1D5266] mb-4">${mInfo.title}</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
              ${[1, 2, 3].map(tid => {
                const t = appState.teams[tid];
                const m = t[mInfo.key];
                return `
                  <div class="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div class="h-52 bg-slate-100 flex items-center justify-center overflow-hidden">
                      ${m.photo ? `<img src="${m.photo}" onclick="openLightbox('${m.photo}')" class="w-full h-full object-cover cursor-zoom-in" />` : `<span class="text-xs text-slate-400">사진 미제출 / 패스</span>`}
                    </div>
                    <div class="p-4 flex-1 flex flex-col justify-between space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="font-extrabold text-base text-[#1D5266]">${t.name}</span>
                        <span class="font-black text-lg text-[#0097A7]">${m.score || 0}점</span>
                      </div>
                      <p class="text-xs sm:text-sm text-slate-700 bg-[#F0F9FA] p-3 rounded-xl border border-[#0097A7]/20">
                        💬 ${m.oneLineReview || '심사평이 아직 입력되지 않았습니다.'}
                      </p>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    return;
  }

  if (slide === 'individual') {
    const sorted = getSortedM6Submissions();
    const winner = sorted.find(s => s.id === appState.m6Config.winnerId) || sorted[0];
    area.innerHTML = `
      <div class="glass-card rounded-3xl p-8 text-center max-w-2xl mx-auto border-2 border-amber-400">
        <div class="text-4xl mb-2">🎁</div>
        <div class="text-xs font-extrabold uppercase tracking-widest text-amber-700 mb-1">Mission 6 · 저녁 개인미션 최다 정답 MVP</div>
        <h2 class="text-2xl sm:text-3xl font-black text-[#1D5266] mb-4">지수님·예찬님 달라진 아이템 찾기 우승자</h2>
        ${winner ? `
          <div class="p-6 rounded-2xl winner-glow my-4">
            <div class="text-3xl font-black text-[#1D5266]">👑 ${winner.name} 님 <span class="text-base font-bold text-slate-600">(${winner.teamName})</span></div>
            <div class="text-lg font-extrabold text-amber-700 mt-2">총 ${winner.correctCount}개 정답 · 제출 시각 ${winner.submittedTime}</div>
            <div class="text-xs text-slate-600 mt-3 space-y-1">
              <div>• 지수님 답안: ${winner.jisooAns || '-'}</div>
              <div>• 예찬님 답안: ${winner.yechanAns || '-'}</div>
            </div>
          </div>
        ` : `<p class="text-sm text-slate-500 py-6">아직 선정된 1등 당첨자가 없습니다.</p>`}
      </div>
    `;
    return;
  }

  const ranked = [1, 2, 3].map(id => ({
    id,
    name: appState.teams[id].name,
    summary: getTeamScoreSummary(id)
  })).sort((a, b) => b.summary.grandTotal - a.summary.grandTotal);

  const badges = ['🥇 최종 우승 (1위)', '🥈 준우승 (2위)', '🥉 3위'];
  area.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      ${ranked.map((r, i) => `
        <div class="glass-card rounded-3xl p-6 text-center border-2 ${i === 0 ? 'border-amber-400 winner-glow scale-105' : 'border-slate-200'}">
          <div class="text-sm font-black text-amber-700 mb-1">${badges[i]}</div>
          <h3 class="text-2xl font-black text-[#1D5266] mb-2">${r.name}</h3>
          <div class="text-4xl font-black text-[#0097A7] mb-4">${r.summary.grandTotal}<span class="text-sm font-bold text-slate-500 ml-1">점</span></div>
          <div class="text-xs text-slate-600 space-y-1 text-left bg-white/80 p-3.5 rounded-2xl border border-slate-200/80">
            <div class="flex justify-between"><span>1. 여행 포스터 (AI)</span><strong>${r.summary.m1}점</strong></div>
            <div class="flex justify-between"><span>2. 제주 발견 (체크+히든)</span><strong>${r.summary.m2}점</strong></div>
            <div class="flex justify-between"><span>3. 깜짝 N행시 (투표)</span><strong>${r.summary.m3}점</strong></div>
            <div class="flex justify-between"><span>4. 팀별 주인공 (AI)</span><strong>${r.summary.m4}점</strong></div>
            <div class="flex justify-between text-amber-700"><span>5. 그림자 JA (보너스)</span><strong>+${r.summary.m5}점</strong></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function switchMode(newMode) {
  if (newMode === 'participant') {
    appState.mode = 'participant';
    appState.tfUnlocked = false;
    saveState(true);
    renderAll();
    return;
  }
  if ((newMode === 'tf' || newMode === 'ceremony') && !appState.tfUnlocked) {
    openPinModal();
    return;
  }
  appState.mode = newMode;
  saveState(true);
  renderAll();
}

function handleTfAccess() {
  if (appState.tfUnlocked && appState.mode !== 'participant') {
    switchMode('participant');
  } else {
    openPinModal();
  }
}

function openPinModal() {
  document.getElementById('pin-error-msg').classList.add('hidden');
  document.getElementById('input-tf-pin').value = '';
  document.getElementById('modal-pin').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-tf-pin').focus(), 50);
}

function closePinModal() {
  document.getElementById('modal-pin').classList.add('hidden');
}

function submitPinLogin(e) {
  e.preventDefault();
  const val = document.getElementById('input-tf-pin').value.trim();
  const pin = appState.settings.adminPin || '2026';
  if (val === pin) {
    appState.tfUnlocked = true;
    appState.mode = 'tf';
    closePinModal();
    saveState(true);
    renderAll();
    showToast('TF 운영진 전용 대시보드가 열렸습니다.', 'success');
  } else {
    document.getElementById('pin-error-msg').classList.remove('hidden');
  }
}

function openSettingsModal() {
  document.getElementById('setting-cloud-url').value = appState.settings.cloudDbUrl || '';
  document.getElementById('setting-api-key').value = appState.settings.apiKey || '';
  document.getElementById('setting-ai-model').value = appState.settings.aiModel || 'gpt-4o';
  document.getElementById('setting-ai-persona').value = appState.settings.aiPersona || 'warm';
  document.getElementById('setting-team-1').value = appState.teams[1].name;
  document.getElementById('setting-team-2').value = appState.teams[2].name;
  document.getElementById('setting-team-3').value = appState.teams[3].name;
  const pins = appState.settings.teamPins || {};
  const pin1El = document.getElementById('setting-team-1-pin');
  const pin2El = document.getElementById('setting-team-2-pin');
  const pin3El = document.getElementById('setting-team-3-pin');
  if (pin1El) pin1El.value = pins[1] || '';
  if (pin2El) pin2El.value = pins[2] || '';
  if (pin3El) pin3El.value = pins[3] || '';
  document.getElementById('setting-admin-pin').value = appState.settings.adminPin || '2026';
  document.getElementById('modal-settings').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('modal-settings').classList.add('hidden');
}

function saveSettingsModal() {
  appState.settings.cloudDbUrl = document.getElementById('setting-cloud-url').value.trim();
  appState.settings.apiKey = document.getElementById('setting-api-key').value.trim();
  appState.settings.aiModel = document.getElementById('setting-ai-model').value;
  appState.settings.aiPersona = document.getElementById('setting-ai-persona').value;
  appState.teams[1].name = document.getElementById('setting-team-1').value.trim() || '1팀';
  appState.teams[2].name = document.getElementById('setting-team-2').value.trim() || '2팀';
  appState.teams[3].name = document.getElementById('setting-team-3').value.trim() || '3팀';
  const pin1El = document.getElementById('setting-team-1-pin');
  const pin2El = document.getElementById('setting-team-2-pin');
  const pin3El = document.getElementById('setting-team-3-pin');
  appState.settings.teamPins = {
    1: pin1El ? pin1El.value.trim() : '',
    2: pin2El ? pin2El.value.trim() : '',
    3: pin3El ? pin3El.value.trim() : ''
  };
  appState.settings.adminPin = document.getElementById('setting-admin-pin').value.trim() || '2026';
  saveState();
  closeSettingsModal();
  renderAll();
  showToast('설정이 저장되었습니다!', 'success');
}

function loadDemoSampleData() {
  appState.teams[1].m1.score = 24;
  appState.teams[1].m1.oneLineReview = '푸른 제주 바다와 팀원들의 환한 미소가 실제 여행사 메인 포스터처럼 완벽하게 어우러졌습니다!';
  appState.teams[1].m2.commonChecked = ['stone', 'tangerine', 'sea'];
  appState.teams[1].m2.hiddenChecked = 'harubang';
  appState.teams[1].m3.kakaoSubmitted = true;
  appState.teams[1].m3.votedForTeamId = 2;
  appState.teams[1].m4.score = 28;
  appState.teams[1].m4.oneLineReview = '센터 주인공을 향한 열정적인 손짓과 리액션 호흡이 단연 돋보이는 작품입니다!';
  appState.teams[1].m5.score = 9;
  appState.teams[1].m5.oneLineReview = '햇살 아래 몸으로 만든 J와 A 그림자 실루엣이 선명하고 재치 넘칩니다!';

  appState.teams[2].m1.score = 23;
  appState.teams[2].m1.oneLineReview = '돌담길을 배경으로 자연스러운 포즈와 따뜻한 팀 케미가 빛나는 한 컷입니다.';
  appState.teams[2].m2.commonChecked = ['sea', 'palm', 'sign'];
  appState.teams[2].m3.kakaoSubmitted = true;
  appState.teams[2].m3.votedForTeamId = 3;
  appState.teams[2].m4.score = 29;
  appState.teams[2].m4.oneLineReview = '표정 몰아주기까지 아끼지 않은 팀원들의 살신성인 호흡이 큰 웃음을 선사합니다!';
  appState.teams[2].m5.score = 8;
  appState.teams[2].m5.oneLineReview = '손가락과 팔을 연결해 정교하게 만든 JA 그림자 아이디어가 훌륭합니다!';

  appState.teams[3].m1.score = 24;
  appState.teams[3].m1.oneLineReview = '야자수와 제주 하늘 아래 영화 포스터 같은 감성적인 구도가 인상적입니다!';
  appState.teams[3].m2.commonChecked = ['stone', 'sea', 'sign'];
  appState.teams[3].m2.hiddenChecked = 'haenyeo';
  appState.teams[3].m3.kakaoSubmitted = true;
  appState.teams[3].m3.votedForTeamId = 1;
  appState.teams[3].m4.score = 27;
  appState.teams[3].m4.oneLineReview = '주인공 한 분을 돋보이게 만든 V자 대열 구도가 아주 감각적입니다!';
  appState.teams[3].m5.passed = true;

  appState.m6Config.submissions = [
    { id: 's1', name: '김민지', teamId: 1, teamName: appState.teams[1].name, jisooAns: '안경 벗음, 머리핀 추가, 운동화 끈 색깔', yechanAns: '시계 뺌, 가디건 착용', submittedTime: '19:10:12', timestampMs: 1000, correctCount: 4 },
    { id: 's2', name: '박준혁', teamId: 2, teamName: appState.teams[2].name, jisooAns: '안경, 머리핀, 귀걸이', yechanAns: '시계, 명찰 위치', submittedTime: '19:10:25', timestampMs: 2000, correctCount: 4 },
    { id: 's3', name: '이수현', teamId: 3, teamName: appState.teams[3].name, jisooAns: '안경 착용 여부, 신발', yechanAns: '시계 뺌', submittedTime: '19:10:08', timestampMs: 500, correctCount: 3 }
  ];
  appState.m6Config.winnerId = 's1';

  saveState();
  closeSettingsModal();
  renderAll();
  showToast('테스트용 샘플 점수와 개인미션 답안이 채워졌습니다!', 'success');
}

function resetAllMissionData() {
  if (!confirm('모든 팀 점수와 제출 데이터를 초기화하시겠습니까?')) return;
  const keepSettings = appState.settings;
  appState = getInitialState();
  appState.settings = keepSettings;
  appState.tfUnlocked = true;
  appState.mode = 'tf';
  saveState();
  closeSettingsModal();
  renderAll();
  showToast('모든 미션 데이터가 초기화되었습니다.', 'info');
}

function exportCsvReport() {
  const rows = [
    ['팀명', '1.여행포스터(25)', '1.AI한줄근거', '2.제주발견_일반(15)', '2.제주발견_히든(5)', '3.깜짝N행시(30)', '4.팀별주인공(30)', '4.AI한줄근거', '5.그림자JA(+10)', '5.AI한줄근거', '총점(115만점)']
  ];
  [1, 2, 3].forEach(tid => {
    const t = appState.teams[tid];
    const s = getTeamScoreSummary(tid);
    rows.push([
      t.name,
      s.m1,
      `"${(t.m1.oneLineReview || '').replace(/"/g, '""')}"`,
      s.m2Common,
      s.m2Hidden,
      s.m3,
      s.m4,
      `"${(t.m4.oneLineReview || '').replace(/"/g, '""')}"`,
      s.m5,
      `"${(t.m5.oneLineReview || '').replace(/"/g, '""')}"`,
      s.grandTotal
    ]);
  });

  const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `2026_JA제주워크숍_미션채점결과_${formatNowTime(false).replace(':', '')}.csv`;
  a.click();
}

function exportJsonBackup() {
  const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `JA제주워크숍_미션백업_${Date.now()}.json`;
  a.click();
}

function importJsonBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      appState = Object.assign(getInitialState(), parsed);
      appState.tfUnlocked = true;
      saveState();
      renderAll();
      showToast('백업 데이터를 성공적으로 복원했습니다!', 'success');
    } catch (err) {
      showToast('유효하지 않은 백업 파일입니다.', 'error');
    }
  };
  reader.readAsText(file);
}

function renderAll() {
  const vParticipant = document.getElementById('view-participant');
  const vTf = document.getElementById('view-tf');
  const vCeremony = document.getElementById('view-ceremony');
  const badge = document.getElementById('current-mode-badge');
  const btnP = document.getElementById('btn-participant-mode');
  const btnC = document.getElementById('btn-ceremony-mode');
  const btnS = document.getElementById('btn-tf-settings');
  const tfLabel = document.getElementById('tf-btn-label');

  vParticipant.classList.add('hidden');
  vTf.classList.add('hidden');
  vCeremony.classList.add('hidden');
  btnP.classList.add('hidden');
  btnC.classList.add('hidden');
  btnS.classList.add('hidden');

  if (appState.mode === 'tf' && appState.tfUnlocked) {
    btnP.classList.remove('hidden');
    btnC.classList.remove('hidden');
    btnS.classList.remove('hidden');
    vTf.classList.remove('hidden');
    badge.textContent = '🔒 TF 운영진 비공개 대시보드';
    badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E8] text-[#F27A24] border border-[#F27A24]/30';
    tfLabel.textContent = '🔒 잠그고 나가기';
    renderTfDashboardView();
  } else if (appState.mode === 'ceremony' && appState.tfUnlocked) {
    btnP.classList.remove('hidden');
    btnS.classList.remove('hidden');
    vCeremony.classList.remove('hidden');
    badge.textContent = '🌅 다음날 아침 시상식 발표 모드 (TF 전용)';
    badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E8] text-[#F27A24] border border-[#F27A24]/30';
    tfLabel.textContent = '🔒 잠그고 나가기';
    renderCeremonyView();
  } else {
    vParticipant.classList.remove('hidden');
    badge.textContent = '참가자 제출 모드';
    badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E9F0EC] text-[#1D3C34] border border-[#1D3C34]/20';
    tfLabel.textContent = 'TF 대시보드';
    renderParticipantView();
  }
}

// 1초마다 미션 오픈 카운트다운 업데이트 & 정각 도달 시 자동 오픈
let lastOpenMask = '';
function tickMissionScheduleCountdowns() {
  const currentMask = [1, 2, 3, 4, 5, 6].map(n => isMissionOpen(n) ? '1' : '0').join('');
  if (lastOpenMask && currentMask !== lastOpenMask) {
    lastOpenMask = currentMask;
    renderAll();
    showToast('🎉 새로운 미션 오픈 시간이 되어 미션이 자동으로 열렸습니다!', 'success');
    return;
  }
  lastOpenMask = currentMask;

  document.querySelectorAll('[data-countdown-mission]').forEach(el => {
    const mNum = Number(el.getAttribute('data-countdown-mission'));
    const info = getMissionCountdownInfo(mNum);
    el.textContent = info.text;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // URL 파라미터(?db=..., ?tf=1, ?team=..., ?pin=...) 자동 인식
  const params = new URLSearchParams(window.location.search);
  const dbParam = params.get('db');
  if (dbParam && dbParam.startsWith('http')) {
    appState.settings.cloudDbUrl = dbParam;
    saveState(true);
  }
  if (params.get('tf') === '1' && !appState.tfUnlocked) {
    setTimeout(() => openPinModal(), 200);
  }

  // URL 파라미터(?team=1&pin=1111) 팀 자동 인증
  const teamParam = params.get('team');
  const pinParam = params.get('pin');
  if (teamParam && [1, 2, 3].includes(Number(teamParam))) {
    const tid = Number(teamParam);
    const validPin = (appState.settings.teamPins?.[tid] || '').trim();
    if (validPin && pinParam && pinParam === validPin) {
      localStorage.setItem(MY_TEAM_AUTH_KEY, 'true');
      localStorage.setItem(MY_TEAM_ID_KEY, String(tid));
      appState.selectedTeamId = tid;
    }
  }

  // 저장된 캐시에서 내 팀 복원
  const isAuthed = localStorage.getItem(MY_TEAM_AUTH_KEY) === 'true';
  const savedTeam = Number(localStorage.getItem(MY_TEAM_ID_KEY));
  if (isAuthed && [1, 2, 3].includes(savedTeam)) {
    appState.selectedTeamId = savedTeam;
  }

  renderAll();
  pullFromCloudDb();

  // 아직 팀 인증이 안 되어 있고, TF 모드도 아니라면 팀 로그인 모달 오픈
  if (!isAuthed && !appState.tfUnlocked && params.get('tf') !== '1') {
    setTimeout(() => openTeamLoginModal(), 250);
  }

  setInterval(tickMissionScheduleCountdowns, 1000);
  setInterval(pullFromCloudDb, 4000);
});
