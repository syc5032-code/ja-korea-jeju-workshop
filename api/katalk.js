/**
 * Vercel Serverless Function: /api/katalk
 * 2026 JA Korea Jeju Retreat - TF KakaoTalk Announcement Management & Multi-device Sync API
 * 
 * Features:
 * 1. Strict TF Session Authentication & Participant Blocking (HttpOnly Cookie + CSRF)
 * 2. Multi-device Shared State via Supabase (isolated row 'tf_katalk_announcements')
 * 3. Optimistic Concurrency Control (Version & Conflict Detection)
 * 4. Status Tracking: 'draft' (문구 준비) -> 'reserved' (카톡 예약 등록 완료) -> 'sent' (발송 확인 완료)
 * 5. Reservation Snapshot & Post-Reservation Modification Warning
 * 6. Audit Logging: Modifier name, server timestamp, and versioning
 */

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nsrzhqcxmejnstlfjhed.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_xkn_YhxEOR0kn7coRE9faA_0LH2lD56';
const SUPABASE_TABLE = 'jeju_mission_state';
const KATALK_ROW_ID = 'tf_katalk_announcements';

const DEFAULT_KATALK_MESSAGES = [
  {
    id: 1,
    time: "1일차 21:30",
    scheduledDate: "2026-09-21",
    scheduledTime: "21:30",
    badge: "🌙 1일차 밤",
    title: "🌙 [1일차 21:30] 레크리에이션 직후: 모바일 미션앱 사전 팀 등록 안내",
    notes: "정각 단톡방 발송",
    content: `[🍊 2026 JA Korea 제주 리트릿 — 조별 미션앱 사전 등록 안내]

임직원 여러분, 오늘 저녁 레크리에이션 배틀 수고 많으셨습니다! 🎉
내일 신나는 2일차 투어와 함께 진행될 <One JA 조별 미션앱>을 사전 오픈합니다.

내일 아침 출발 전 원활한 진행을 위해, 지금 각 팀별로 접속하여 [팀 등록]을 마쳐주세요! 👇
🔗 미션 웹앱 바로가기: https://ja-korea-jeju-workshop-hxcf.vercel.app/mission

📌 [오늘 밤 30초 사전 등록 방법]
1. 링크 접속 후 우리 팀(1팀 / 2팀 / 3팀) 선택
2. 각 팀의 대표 1명이 오늘 정해진 <우리 팀명>과 <비밀번호 4자리>를 입력하고 [팀 등록 완료] 클릭!
3. 정해진 4자리 비밀번호를 팀원들에게 공유하면, 팀원들도 비번만 치고 즉시 입장 완료!

※ 오늘 밤 한 번만 로그인해 두시면 스마트폰에 자동 저장되어, 내일은 비밀번호 입력 없이 바로 미션을 즐기실 수 있습니다.
모두 편안한 밤 되시고, 내일 아침 설레는 투어로 뵙겠습니다! 굿밤 되세요! 🌙🍊`
  },
  {
    id: 2,
    time: "2일차 09:00",
    scheduledDate: "2026-09-22",
    scheduledTime: "09:00",
    badge: "🚗 출발",
    title: "🚗 [2일차 09:00] 출발 안내: 2일차 미션 데이 스타트!",
    notes: "정각 단톡방 발송",
    content: `[🍊 2026 JA Korea 제주 리트릿 — 2일차 미션 데이 스타트!]

상쾌한 제주의 아침입니다! 🌿
전용 스타리아와 함께하는 서남부 힐링 투어 & One JA 조별 미션 데이가 드디어 시작됩니다.

어젯밤 등록하신 팀 전용 미션 화면이 준비되어 있으니, 이동하시면서 앱을 가볍게 둘러보세요!
🔗 미션 웹앱 바로가기: https://ja-korea-jeju-workshop-hxcf.vercel.app/mission

⏰ [첫 번째 미션 오픈 예고]
잠시 후 09:20에 <미션 1>이 오픈됩니다! 과연 어떤 미션일까요?

차량 전담 기사님과 함께 안전하고 행복한 여행 되시길 바랍니다. 출발합니다! 🚗💨✨`
  },
  {
    id: 3,
    time: "09:20",
    scheduledDate: "2026-09-22",
    scheduledTime: "09:20",
    badge: "📸 미션 1",
    title: "📸 [09:20] 미션 1 오픈 안내 (마감 12:30)",
    notes: "정각 단톡방 발송",
    content: `[미션 1 오픈! 🎬]

지금 미션 웹앱에 첫 번째 미션인 <미션 1>이 오픈되었습니다!
어떤 미션인지 지금 바로 웹앱에 접속하여 확인하고 도전해 보세요! 

⏰ 제출 마감: 오늘 12:30까지
🔗 미션 확인하기: https://ja-korea-jeju-workshop-hxcf.vercel.app/mission

※ 웹앱 카드 상단에 [💡 AI 심사위원이 보는 3대 핵심 채점 기준]이 안내되어 있으니 꼭 확인 후 촬영해 주세요! 📸✨`
  },
  {
    id: 4,
    time: "12:00",
    scheduledDate: "2026-09-22",
    scheduledTime: "12:00",
    badge: "⏰ 마감임박",
    title: "⏰ [12:00] 미션 1 마감 30분 전 리마인드",
    notes: "정각 단톡방 발송",
    content: `[미션 1 마감 30분 전 안내 ⏰]

<미션 1> 제출 마감이 30분 남았습니다!
점심 식사 전, 촬영하신 사진을 미션 웹앱에 꼭 업로드해 주세요!

• 마감 시각: 12:30 칼마감 (이후 AI 심사 돌입!)
🔗 미션 웹앱 바로가기: https://ja-korea-jeju-workshop-hxcf.vercel.app/mission

맛있는 점심 식사 되세요! 🍱😋`
  },
  {
    id: 5,
    time: "13:00",
    scheduledDate: "2026-09-22",
    scheduledTime: "13:00",
    badge: "🔍 미션 2",
    title: "🔍 [13:00] 미션 2 오픈 안내 (마감 17:30)",
    notes: "정각 단톡방 발송",
    content: `[미션 2 오픈! 🔎]

오후 일정을 여는 <미션 2>가 지금 오픈되었습니다!
과연 어떤 보물찾기 미션일까요? 지금 바로 웹앱에서 확인해 보세요!

⏰ 제출 마감: 오늘 17:30까지
📍 참여 방법: 미션 웹앱에서 항목 확인 ➡️ 각 버튼을 눌러 사진 1:1 등록!
🔗 미션 확인하기: https://ja-korea-jeju-workshop-hxcf.vercel.app/mission

※ 억지로 찾으러 가지 마시고 이동 동선 안에서 자연스럽게 발견해 보세요! 🚗💨`
  },
  {
    id: 6,
    time: "14:30",
    scheduledDate: "2026-09-22",
    scheduledTime: "14:30",
    badge: "🎬 미션 3",
    title: "🎬 [14:30] 미션 3 깜짝 오픈 안내 (동영상 마감 15:15)",
    notes: "정각 단톡방 발송",
    content: `[미션 3 깜짝 오픈! ⚡]

드디어 기다리던 깜짝 미션, <미션 3>이 오픈되었습니다!
지금 바로 웹앱에서 미션 내용과 오늘의 제시어를 확인하고, 완성된 동영상을 이 단톡방에 올려주세요!

⏰ 동영상 제출 마감: 15:15까지 (단 45분간!)
📍 참여 방법: 웹앱에서 제시어 확인 ➡️ 동영상 촬영 ➡️ [카톡 단톡방]에 영상 업로드 ➡️ 웹앱에서 [제출 완료 체크] 클릭!
🔗 미션 확인하기: https://ja-korea-jeju-workshop-hxcf.vercel.app/mission

15:15에 영상 접수가 마감되면 곧바로 상호 투표가 시작됩니다! 🎬🔥`
  },
  {
    id: 7,
    time: "15:15",
    scheduledDate: "2026-09-22",
    scheduledTime: "15:15",
    badge: "🗳️ 투표",
    title: "🗳️ [15:15] 미션 3 상호 투표 시작 안내 (투표 마감 15:30)",
    notes: "정각 단톡방 발송",
    content: `[미션 3 상호 투표 시작! 🗳️]

모든 팀의 센스 넘치는 영상이 단톡방에 접수되었습니다!
단톡방 영상을 감상하신 후, 지금 바로 미션 웹앱에서 가장 마음에 드는 팀에 투표해 주세요!

⏰ 투표 마감: 15:30까지 (15분간)
📍 투표 방법: 미션 웹앱 접속 ➡️ [미션 3] 카드 ➡️ [센스 만점 타 팀 투표하기] 클릭!
(※ 공정성을 위해 본인 팀에는 투표할 수 없습니다.)
🔗 투표하러 가기: https://ja-korea-jeju-workshop-hxcf.vercel.app/mission

여러분의 한 표가 우승팀을 결정합니다! 지금 바로 투표하세요! 🏃‍♂️💨`
  },
  {
    id: 8,
    time: "15:30",
    scheduledDate: "2026-09-22",
    scheduledTime: "15:30",
    badge: "👑 미션 4",
    title: "👑 [15:30] 미션 4 오픈 안내 (마감 17:30)",
    notes: "정각 단톡방 발송",
    content: `[미션 4 오픈! 👑]

지금 미션 웹앱에 <미션 4>가 오픈되었습니다!
어떤 흥미진진한 단체 미션인지 지금 바로 웹앱에서 확인하고 도전해 보세요!

⏰ 제출 마감: 오늘 17:30까지
🔗 미션 확인하기: https://ja-korea-jeju-workshop-hxcf.vercel.app/mission

팀원들의 멋진 호흡과 연기력을 기대합니다! 😆🙌`
  },
  {
    id: 9,
    time: "16:00",
    scheduledDate: "2026-09-22",
    scheduledTime: "16:00",
    badge: "🌟 미션 5",
    title: "🌟 [16:00] 미션 5 보너스 오픈 안내 (마감 17:30)",
    notes: "정각 단톡방 발송",
    content: `[미션 5 오픈! (보너스 미션) 🌟]

보너스 점수를 획득할 수 있는 <미션 5>가 지금 오픈되었습니다!
지금 바로 웹앱에 접속해 미션 내용을 확인해 보세요!

⏰ 제출 마감: 오늘 17:30까지
🔗 미션 확인하기: https://ja-korea-jeju-workshop-hxcf.vercel.app/mission

※ 날씨나 주변 상황이 여의치 않은 경우, 웹앱에서 [🌥️ 패스하기]를 누르시면 감점 없이 0점 처리됩니다. 안전이 최우선입니다! 🏖️✨`
  },
  {
    id: 10,
    time: "17:00",
    scheduledDate: "2026-09-22",
    scheduledTime: "17:00",
    badge: "🚨 마감임박",
    title: "🚨 [17:00] 전체 야외 미션 마감 30분 전 리마인드",
    notes: "정각 단톡방 발송",
    content: `[야외 전체 미션 마감 30분 전! 🚨]

오후 17:30에 모든 야외 미션(미션 2, 4, 5) 접수가 최종 마감됩니다!
웹앱에 접속하셔서 아직 제출하지 못했거나 수정하고 싶은 사진이 없는지 최종 점검해 주세요!

• 최종 마감: 17:30 칼마감 (이후 AI 심사 돌입!)
🔗 미션 점검하기: https://ja-korea-jeju-workshop-hxcf.vercel.app/mission

모두 숙소(헤르멘하우스)까지 안전하게 복귀하시길 바랍니다! 🚗🏡`
  },
  {
    id: 11,
    time: "17:30",
    scheduledDate: "2026-09-22",
    scheduledTime: "17:30",
    badge: "🏁 마감/만찬",
    title: "🏁 [17:30] 야외 미션 최종 마감 & 저녁 일정 안내",
    notes: "정각 단톡방 발송",
    content: `[야외 미션 최종 마감! 수고하셨습니다 👏]

2일차 조별 야외 미션이 모두 종료되었습니다!
하루 동안 열정적으로 미션에 참여해 주신 모든 임직원분들께 감사드립니다.

지금부터 TF 운영팀과 GPT AI 심사위원단의 정밀 채점이 진행됩니다.
최종 결과는 저녁 19:30 만찬 시상식에서 대형 스크린으로 대공개됩니다!

📌 [저녁 일정 안내]
• 18:30: 헤르멘하우스 바베큐 만찬 & 미션 6 깜짝 골든벨 현장 퀴즈
• 19:30: One JA 제주 리트릿 어워즈 (시상식 및 베스트 컷 감상)

숙소에서 편안히 쉬시고 맛있는 흑돼지 바베큐 파티에서 뵙겠습니다! 🥩🍷✨`
  },
  {
    id: 12,
    time: "18:30",
    scheduledDate: "2026-09-22",
    scheduledTime: "18:30",
    badge: "🔔 미션 6",
    title: "🔔 [18:30] 미션 6 현장 골든벨 퀴즈 오픈",
    notes: "정각 단톡방 발송",
    content: `[미션 6 현장 골든벨 오픈! 🔔]

헤르멘하우스 만찬장 스페셜 미션 <미션 6>이 지금 오픈되었습니다!
지금 바로 웹앱에 접속해 미션을 확인하고 정답을 제출해 주세요!

⏰ 제한 시간: 단 3분! (타이머 카운트다운 시작)
📍 참여 방법: 미션 웹앱 ➡️ [미션 6] 카드 ➡️ 본인 이름과 정답 입력 후 [제출] 클릭!
🔗 미션 참여하기: https://ja-korea-jeju-workshop-hxcf.vercel.app/mission

가장 많이 맞추고 가장 빨리 제출한 1등에게는 스페셜 개인 선물이 주어집니다! 지금 관찰하세요! 👀⚡`
  }
];

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const key = parts.shift().trim();
      list[key] = decodeURIComponent(parts.join('='));
    });
  }
  return list;
}

function createDefaultState() {
  const now = Date.now();
  return {
    version: 1,
    updatedAt: now,
    updatedBy: '시스템 초기화',
    assignedManager: '송영채 TF',
    messages: DEFAULT_KATALK_MESSAGES.map(m => ({
      ...m,
      version: 1,
      status: 'draft', // 'draft' | 'reserved' | 'sent'
      reservedBy: null,
      reservedAt: null,
      sentConfirmedBy: null,
      sentConfirmedAt: null,
      reservedSnapshot: null, // { content, scheduledDate, scheduledTime, version, at, by }
      reconfirmedBy: null,
      reconfirmedAt: null,
      updatedBy: '시스템',
      updatedAt: now
    }))
  };
}

async function getSharedKatalkState() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${KATALK_ROW_ID}&select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const rows = await res.json();
      if (rows?.[0]?.data && Array.isArray(rows[0].data.messages)) {
        return rows[0].data;
      }
    }
  } catch (e) {
    // Supabase fetch failure fallback
  }
  return null;
}

async function saveSharedKatalkState(data) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?on_conflict=id`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      id: KATALK_ROW_ID,
      updated_at: data.updatedAt || Date.now(),
      data
    }),
    signal: controller.signal
  });
  clearTimeout(timeout);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Supabase 저장 실패 (${res.status}): ${errText}`);
  }
  return true;
}

module.exports = async function handler(req, res) {
  // CORS & Security Headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const serverAdminPin = (process.env.TF_ADMIN_PIN || '').trim();
  const sessionSecret = (process.env.SESSION_SECRET || serverAdminPin || '').trim();

  // 1. TF_ADMIN_PIN 미설정 시 거부
  if (!serverAdminPin) {
    return res.status(500).json({
      error: '서버 환경변수(TF_ADMIN_PIN)가 설정되어 있지 않아 접근이 차단됩니다.'
    });
  }

  // 2. TF 세션 인증 검증 (참가자 접근 차단)
  const cookies = parseCookies(req);
  const session = verifyToken(cookies.tf_session, sessionSecret);
  if (!session || session.role !== 'tf_admin') {
    return res.status(401).json({
      error: 'TF 운영진 인증 세션이 없거나 만료되었습니다. TF 대시보드에 먼저 로그인해 주세요.'
    });
  }

  // GET: 공지 목록 및 공동 관리 상태 조회
  if (req.method === 'GET') {
    try {
      let state = await getSharedKatalkState();
      if (!state) {
        state = createDefaultState();
        try {
          await saveSharedKatalkState(state);
        } catch (saveErr) {
          console.warn('[Katalk API] Initial state auto-save failed:', saveErr.message);
        }
      }
      return res.status(200).json({
        ok: true,
        data: state
      });
    } catch (err) {
      return res.status(500).json({
        error: `공지 목록 조회 중 오류가 발생했습니다: ${err.message}`
      });
    }
  }

  // POST: 공지 수정, 상태 변경, 초기화, 담당자 지정
  if (req.method === 'POST') {
    // CSRF 검증
    const clientCsrf = req.headers['x-csrf-token'];
    if (!clientCsrf || clientCsrf !== session.csrfToken) {
      return res.status(403).json({
        error: '유효하지 않은 요청입니다 (CSRF 검증 실패). 페이지를 새로고침한 후 다시 시도해 주세요.'
      });
    }

    const {
      action,
      expectedVersion,
      updaterName,
      messageId,
      patch,
      assignedManager,
      forceOverwrite
    } = req.body || {};

    const cleanUpdater = String(updaterName || '').trim() || 'TF 운영진';

    try {
      let current = await getSharedKatalkState();
      if (!current) {
        current = createDefaultState();
      }

      const serverVersion = current.version || 1;

      // 동시 수정 충돌 감지 (Optimistic Concurrency Control)
      if (expectedVersion !== undefined && expectedVersion !== null && !forceOverwrite) {
        if (Number(expectedVersion) < serverVersion) {
          // 단일 메시지 수정의 경우, 해당 메시지가 실제로 변경되었는지 정밀 대조
          if (action === 'update_single' && messageId) {
            const targetMsg = current.messages.find(m => m.id === Number(messageId));
            if (targetMsg && targetMsg.version > Number(expectedVersion)) {
              return res.status(409).json({
                conflict: true,
                error: `[동시 수정 충돌 안내] 다른 TF(${targetMsg.updatedBy || '운영진'})가 ${new Date(targetMsg.updatedAt || Date.now()).toLocaleTimeString('ko-KR')}에 이 공지를 먼저 수정했습니다. 서버 최신 내용을 확인한 후 다시 저장해 주세요.`,
                serverData: current
              });
            }
          } else if (action === 'set_manager' || action === 'reset_all') {
            return res.status(409).json({
              conflict: true,
              error: `[동시 수정 충돌 안내] 다른 TF가 먼저 공지 관리 설정을 수정했습니다. 최신 상태를 새로고침해 주세요.`,
              serverData: current
            });
          }
        }
      }

      const now = Date.now();
      let isUpdated = false;

      // 액션 1: 단일 공지 속성/문구/일정/상태 수정 (update_single)
      if (action === 'update_single' && messageId) {
        const idx = current.messages.findIndex(m => m.id === Number(messageId));
        if (idx === -1) {
          return res.status(404).json({ error: `공지 ID #${messageId}를 찾을 수 없습니다.` });
        }

        const msg = current.messages[idx];
        const p = patch || {};

        // 내용 변경
        if (typeof p.content === 'string') msg.content = p.content;
        // 일정 변경
        if (typeof p.scheduledDate === 'string') msg.scheduledDate = p.scheduledDate;
        if (typeof p.scheduledTime === 'string') msg.scheduledTime = p.scheduledTime;
        if (typeof p.title === 'string') msg.title = p.title;

        // 상태 변경
        if (p.status && ['draft', 'reserved', 'sent'].includes(p.status)) {
          const oldStatus = msg.status;
          msg.status = p.status;

          // 'reserved' (카톡 예약 등록 완료) 진입 시 예약 당시 스냅샷 저장
          if (p.status === 'reserved') {
            msg.reservedBy = p.reservedBy || cleanUpdater;
            msg.reservedAt = p.reservedAt || new Date(now).toLocaleString('ko-KR');
            msg.reservedSnapshot = {
              content: msg.content,
              scheduledDate: msg.scheduledDate,
              scheduledTime: msg.scheduledTime,
              version: msg.version || 1,
              savedAt: now,
              savedBy: cleanUpdater
            };
            msg.reconfirmedBy = null;
            msg.reconfirmedAt = null;
          } else if (p.status === 'sent') {
            msg.sentConfirmedBy = p.sentConfirmedBy || cleanUpdater;
            msg.sentConfirmedAt = p.sentConfirmedAt || new Date(now).toLocaleString('ko-KR');
          } else if (p.status === 'draft') {
            // 문구 준비로 되돌릴 때
            msg.reservedSnapshot = null;
          }
        }

        // 'reconfirm' (카톡 예약 내용 재확인 완료)
        if (p.reconfirm) {
          msg.reservedSnapshot = {
            content: msg.content,
            scheduledDate: msg.scheduledDate,
            scheduledTime: msg.scheduledTime,
            version: msg.version || 1,
            savedAt: now,
            savedBy: cleanUpdater
          };
          msg.reconfirmedBy = cleanUpdater;
          msg.reconfirmedAt = new Date(now).toLocaleString('ko-KR');
        }

        msg.version = (msg.version || 1) + 1;
        msg.updatedAt = now;
        msg.updatedBy = cleanUpdater;
        isUpdated = true;
      }

      // 액션 2: 공통 예약 담당자 지정 (set_manager)
      else if (action === 'set_manager') {
        const mgr = String(assignedManager || '').trim();
        if (!mgr) {
          return res.status(400).json({ error: '담당자 이름을 입력해 주세요.' });
        }
        current.assignedManager = mgr;
        isUpdated = true;
      }

      // 액션 3: 단일 공지 엑셀 원본 복구 (reset_single)
      else if (action === 'reset_single' && messageId) {
        const idx = current.messages.findIndex(m => m.id === Number(messageId));
        const defaultMsg = DEFAULT_KATALK_MESSAGES.find(m => m.id === Number(messageId));
        if (idx !== -1 && defaultMsg) {
          const prevStatus = current.messages[idx].status;
          current.messages[idx] = {
            ...defaultMsg,
            version: (current.messages[idx].version || 1) + 1,
            status: prevStatus || 'draft',
            reservedBy: current.messages[idx].reservedBy || null,
            reservedAt: current.messages[idx].reservedAt || null,
            sentConfirmedBy: current.messages[idx].sentConfirmedBy || null,
            sentConfirmedAt: current.messages[idx].sentConfirmedAt || null,
            reservedSnapshot: null, // 원본 복구 시 스냅샷 초기화
            reconfirmedBy: null,
            reconfirmedAt: null,
            updatedBy: cleanUpdater,
            updatedAt: now
          };
          isUpdated = true;
        }
      }

      // 액션 4: 전체 공지 엑셀 원본 복구 (reset_all)
      else if (action === 'reset_all') {
        current.messages = DEFAULT_KATALK_MESSAGES.map(m => ({
          ...m,
          version: 1,
          status: 'draft',
          reservedBy: null,
          reservedAt: null,
          sentConfirmedBy: null,
          sentConfirmedAt: null,
          reservedSnapshot: null,
          reconfirmedBy: null,
          reconfirmedAt: null,
          updatedBy: cleanUpdater,
          updatedAt: now
        }));
        isUpdated = true;
      } else {
        return res.status(400).json({ error: '유효하지 않은 요청 액션입니다.' });
      }

      if (isUpdated) {
        current.version = serverVersion + 1;
        current.updatedAt = now;
        current.updatedBy = cleanUpdater;
        await saveSharedKatalkState(current);
      }

      return res.status(200).json({
        ok: true,
        data: current
      });
    } catch (err) {
      return res.status(500).json({
        error: `서버 저장 처리 중 오류 발생: ${err.message}`
      });
    }
  }

  return res.status(405).json({ error: '지원되지 않는 요청 메서드입니다.' });
};
