/**
 * Vercel Serverless Function: /api/auth
 * 2026 JA Korea Jeju Retreat - Unified TF Session Authentication
 * Provides secure HttpOnly cookie session, CSRF protection, and shared brute-force defense.
 */

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nsrzhqcxmejnstlfjhed.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_xkn_YhxEOR0kn7coRE9faA_0LH2lD56';
const SUPABASE_TABLE = 'jeju_mission_state';

// In-memory L1 cache for fast response
const l1AuthFailures = new Map();

function signToken(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

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

async function getSharedAuditData() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.api_security_audit&select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const rows = await res.json();
      return rows?.[0]?.data || { ipLimits: {}, authFailures: {} };
    }
  } catch (e) {}
  return {
    ipLimits: {},
    authFailures: Object.fromEntries(l1AuthFailures)
  };
}

function saveSharedAuditAsync(data) {
  fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?on_conflict=id`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      id: 'api_security_audit',
      updated_at: Date.now(),
      data
    })
  }).catch(() => {});
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const action = url.searchParams.get('action') || (req.body && req.body.action) || 'me';

  const serverAdminPin = (process.env.TF_ADMIN_PIN || '').trim();
  const sessionSecret = (process.env.SESSION_SECRET || serverAdminPin || '').trim();

  // 1. 세션 확인 엔드포인트: GET /api/auth?action=me
  if (req.method === 'GET' || action === 'me') {
    if (!serverAdminPin) {
      return res.status(200).json({
        authenticated: false,
        serverConfigured: false,
        message: '서버 환경변수(TF_ADMIN_PIN) 설정 대기 중'
      });
    }

    const cookies = parseCookies(req);
    const session = verifyToken(cookies.tf_session, sessionSecret);
    if (session && session.role === 'tf_admin') {
      return res.status(200).json({
        authenticated: true,
        serverConfigured: true,
        csrfToken: session.csrfToken,
        expiresAt: session.exp
      });
    }
    return res.status(200).json({
      authenticated: false,
      serverConfigured: true
    });
  }

  // 2. 로그아웃 엔드포인트: POST /api/auth?action=logout
  if (action === 'logout') {
    const isProd = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `tf_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`);
    return res.status(200).json({ ok: true, message: 'TF 운영진 세션이 안전하게 종료되었습니다.' });
  }

  // 3. 로그인 엔드포인트: POST /api/auth?action=login
  if (req.method !== 'POST' || action === 'login') {
    if (!serverAdminPin) {
      return res.status(500).json({
        error: '서버 환경변수(TF_ADMIN_PIN)가 설정되어 있지 않아 로그인이 거부됩니다. Vercel 프로젝트 대시보드(Settings > Environment Variables)에서 TF_ADMIN_PIN을 등록해 주세요.'
      });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const auditData = await getSharedAuditData();
    const failRecord = auditData.authFailures[clientIp] || l1AuthFailures.get(clientIp);

    // 행사장 동일 Wi-Fi 고려: 10분 내 10회 실패 시 10분 차단 (실수 허용 범위 확보)
    if (failRecord && failRecord.lockedUntil && failRecord.lockedUntil > now) {
      const remainSec = Math.ceil((failRecord.lockedUntil - now) / 1000);
      return res.status(403).json({
        error: `반복된 TF 인증 실패로 인해 해당 IP의 접근이 일시 차단되었습니다. (${remainSec}초 후 재시도 가능)`
      });
    }

    const { pin } = req.body || {};
    const enteredPin = String(pin || '').trim();

    if (!enteredPin || enteredPin !== serverAdminPin) {
      const currentFails = (failRecord && failRecord.resetAt > now) ? (failRecord.count + 1) : 1;
      const isNowLocked = currentFails >= 10;
      const updatedFail = {
        count: currentFails,
        resetAt: now + 10 * 60 * 1000,
        lockedUntil: isNowLocked ? (now + 10 * 60 * 1000) : null
      };

      auditData.authFailures[clientIp] = updatedFail;
      l1AuthFailures.set(clientIp, updatedFail);
      saveSharedAuditAsync(auditData);

      return res.status(401).json({
        error: isNowLocked
          ? 'TF 관리자 PIN 10회 연속 오류로 해당 IP가 10분간 차단되었습니다.'
          : `TF 운영진 관리자 PIN이 올바르지 않습니다. (오류 ${currentFails}/10회)`
      });
    }

    // 로그인 성공 시 해당 IP 실패 기록 초기화
    if (auditData.authFailures[clientIp]) {
      delete auditData.authFailures[clientIp];
      l1AuthFailures.delete(clientIp);
      saveSharedAuditAsync(auditData);
    }

    // 안전한 세션 토큰 및 CSRF 토큰 발급 (유효기간 8시간, 리트릿 행사 당일 충분)
    const csrfToken = crypto.randomBytes(16).toString('hex');
    const sessionId = crypto.randomBytes(8).toString('hex');
    const exp = now + 8 * 60 * 60 * 1000;

    const sessionPayload = {
      role: 'tf_admin',
      sessionId,
      csrfToken,
      clientIp,
      createdAt: now,
      exp
    };

    const token = signToken(sessionPayload, sessionSecret);
    const isProd = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';

    const cookieParts = [
      `tf_session=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${8 * 3600}`,
      isProd ? 'Secure' : ''
    ].filter(Boolean).join('; ');

    res.setHeader('Set-Cookie', cookieParts);
    return res.status(200).json({
      ok: true,
      message: 'TF 운영진 인증 세션이 성공적으로 발급되었습니다.',
      csrfToken,
      expiresAt: exp
    });
  }

  return res.status(405).json({ error: '지원되지 않는 요청 메서드입니다.' });
};
