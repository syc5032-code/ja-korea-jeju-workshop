/**
 * JA Korea 2026 One JA Retreat in Jeju - Application Logic
 * MS Forms Integration, D-Day Countdown (2026.10.29), Tab Switcher, Ambient Audio
 */

document.addEventListener('DOMContentLoaded', () => {
  // ----------------------------------------------------
  // 1. MS Forms External Survey Link
  // ----------------------------------------------------
  window.EXTERNAL_SURVEY_URL = "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=yrY3Sjkqn0eYu8nkVhEJsPX9pil_ti1HvCnbE0M58fBUNDRDWFE4Sk4zWDYwVUdVM0hYSVE4RjZaNy4u";

  // ----------------------------------------------------
  // 2. D-Day Countdown Timer (Target: 2026-10-29 13:30 KST 김포공항 집결)
  // ----------------------------------------------------
  const targetDate = new Date('2026-10-29T13:30:00+09:00').getTime();

  function updateCountdown() {
    const now = new Date().getTime();
    const distance = targetDate - now;

    const daysEl = document.getElementById('cd-days');
    const hoursEl = document.getElementById('cd-hours');
    const minsEl = document.getElementById('cd-mins');
    const secsEl = document.getElementById('cd-secs');

    if (!daysEl) return;

    if (distance < 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minsEl.textContent = '00';
      secsEl.textContent = '00';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minsEl.textContent = String(minutes).padStart(2, '0');
    secsEl.textContent = String(seconds).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // ----------------------------------------------------
  // 3. Scroll Reveal Animations (Intersection Observer)
  // ----------------------------------------------------
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
  );

  revealElements.forEach((el) => revealObserver.observe(el));

  // ----------------------------------------------------
  // 4. Survey Modal (Fallback only, links navigate directly to MS Forms)
  // ----------------------------------------------------
  const surveyModal = document.getElementById('survey-modal');
  const closeModalBtns = document.querySelectorAll('.js-close-survey-modal');
  const rsvpForm = document.getElementById('rsvp-form');
  const formSuccessView = document.getElementById('form-success-view');

  function closeSurveyModal() {
    if (surveyModal) {
      surveyModal.classList.add('hidden');
      surveyModal.classList.remove('flex');
      document.body.style.overflow = '';
    }
  }

  closeModalBtns.forEach((btn) => btn.addEventListener('click', closeSurveyModal));

  if (surveyModal) {
    surveyModal.addEventListener('click', (e) => {
      if (e.target === surveyModal) closeSurveyModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && surveyModal && !surveyModal.classList.contains('hidden')) {
      closeSurveyModal();
    }
  });

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('rsvp-name').value.trim();
      const role = document.getElementById('rsvp-role').value;
      const phone = document.getElementById('rsvp-phone').value.trim();
      const attendance = document.querySelector('input[name="attendance"]:checked')?.value || '참석';
      const notes = document.getElementById('rsvp-notes')?.value.trim() || '';

      const submissionData = {
        name,
        role,
        phone,
        attendance,
        notes,
        submittedAt: new Date().toISOString()
      };

      try {
        const history = JSON.parse(localStorage.getItem('ja_retreat_rsvp_list') || '[]');
        history.push(submissionData);
        localStorage.setItem('ja_retreat_rsvp_list', JSON.stringify(history));
      } catch (err) {
        console.warn('LocalStorage save error:', err);
      }

      triggerConfetti();

      if (formSuccessView) {
        rsvpForm.classList.add('hidden');
        formSuccessView.classList.remove('hidden');
        const attendeeNameSpan = document.getElementById('success-attendee-name');
        if (attendeeNameSpan) {
          attendeeNameSpan.textContent = `${name} 님`;
        }
      }

      showToast(`✨ ${name} 님의 참석 설문이 정상 접수되었습니다.`);
    });
  }

  // ----------------------------------------------------
  // 6. Floating CTA Visibility on Scroll
  // ----------------------------------------------------
  const floatingBar = document.getElementById('floating-cta-bar');
  const heroSection = document.getElementById('hero-section');
  const rsvpSection = document.getElementById('rsvp-section');

  window.addEventListener('scroll', () => {
    if (!floatingBar || !heroSection) return;
    const heroBottom = heroSection.getBoundingClientRect().bottom;
    const rsvpTop = rsvpSection ? rsvpSection.getBoundingClientRect().top : 99999;
    const windowHeight = window.innerHeight;

    if (heroBottom < 100 && rsvpTop > windowHeight - 120) {
      floatingBar.classList.remove('translate-y-32', 'opacity-0');
      floatingBar.classList.add('translate-y-0', 'opacity-100');
    } else {
      floatingBar.classList.add('translate-y-32', 'opacity-0');
      floatingBar.classList.remove('translate-y-0', 'opacity-100');
    }
  });

  // ----------------------------------------------------
  // 7. Copy to Clipboard & Toast System
  // ----------------------------------------------------
  window.copyTextToClipboard = function (text, message = '클립보드에 복사되었습니다.') {
    navigator.clipboard.writeText(text).then(
      () => showToast(message),
      (err) => {
        console.error('Copy failed', err);
        showToast('복사에 실패했습니다.');
      }
    );
  };

  function showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className =
        'fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white px-6 py-3.5 rounded-full text-sm font-medium shadow-2xl backdrop-blur-md border border-white/20 transition-all duration-300 transform translate-y-10 opacity-0 pointer-events-none flex items-center space-x-2';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `<span>${message}</span>`;
    toast.classList.remove('translate-y-10', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
      toast.classList.add('translate-y-10', 'opacity-0');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, 3200);
  }

  // ----------------------------------------------------
  // 8. Confetti Effect
  // ----------------------------------------------------
  function triggerConfetti() {
    const confettiCanvas = document.createElement('canvas');
    confettiCanvas.style.position = 'fixed';
    confettiCanvas.style.top = '0';
    confettiCanvas.style.left = '0';
    confettiCanvas.style.width = '100vw';
    confettiCanvas.style.height = '100vh';
    confettiCanvas.style.pointerEvents = 'none';
    confettiCanvas.style.zIndex = '99999';
    document.body.appendChild(confettiCanvas);

    const cCtx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#0097A7', '#1D5266', '#38BDF8', '#F59E0B', '#FB7185', '#10B981'];

    for (let i = 0; i < 80; i++) {
      pieces.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        w: Math.random() * 10 + 6,
        h: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 18,
        gravity: 0.35,
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 12,
        opacity: 1
      });
    }

    let startTime = Date.now();
    function animateConfetti() {
      const elapsed = Date.now() - startTime;
      cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.98;
        p.rotation += p.rSpeed;
        p.opacity = Math.max(0, 1 - elapsed / 2600);

        cCtx.save();
        cCtx.translate(p.x, p.y);
        cCtx.rotate((p.rotation * Math.PI) / 180);
        cCtx.fillStyle = p.color;
        cCtx.globalAlpha = p.opacity;
        cCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cCtx.restore();
      });

      if (elapsed < 2600) {
        requestAnimationFrame(animateConfetti);
      } else {
        confettiCanvas.remove();
      }
    }
    animateConfetti();
  }

  // ----------------------------------------------------
  // 9. Soothing Ambient Ocean Wave Synthesizer
  // ----------------------------------------------------
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  let audioCtx = null;
  let isSoundPlaying = false;
  let waveGainNode = null;
  let waveInterval = null;

  function initOceanSynth() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;

      waveGainNode = audioCtx.createGain();
      waveGainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(waveGainNode);
      waveGainNode.connect(audioCtx.destination);
      whiteNoise.start(0);

      let swell = true;
      waveInterval = setInterval(() => {
        if (!isSoundPlaying || !audioCtx) return;
        const now = audioCtx.currentTime;
        if (swell) {
          filter.frequency.setTargetAtTime(750, now, 2.5);
          waveGainNode.gain.setTargetAtTime(0.12, now, 2.5);
        } else {
          filter.frequency.setTargetAtTime(250, now, 3.2);
          waveGainNode.gain.setTargetAtTime(0.02, now, 3.2);
        }
        swell = !swell;
      }, 4500);

    } catch (e) {
      console.warn('AudioContext not supported', e);
    }
  }

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      if (!audioCtx) initOceanSynth();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

      isSoundPlaying = !isSoundPlaying;

      if (isSoundPlaying) {
        if (waveGainNode && audioCtx) waveGainNode.gain.setTargetAtTime(0.1, audioCtx.currentTime, 1);
        soundToggleBtn.innerHTML = `
          <svg class="w-4 h-4 text-[#0097A7] animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
          </svg>
          <span class="text-xs font-medium text-[#00838F]">제주 파도 소리 On</span>
        `;
        showToast('🌊 부드러운 제주의 파도 소리가 재생됩니다.');
      } else {
        if (waveGainNode && audioCtx) waveGainNode.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.8);
        soundToggleBtn.innerHTML = `
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path>
          </svg>
          <span class="text-xs font-medium text-slate-500">배경음 듣기</span>
        `;
      }
    });
  }

  // ----------------------------------------------------
  // 10. Share Invitation Link
  // ----------------------------------------------------
  window.shareInvitation = function () {
    const title = '2026 JA Korea One JA Retreat in Jeju';
    const text = '서로를 격려하고 더 깊은 유대로 하나 되는 2026 JA Korea 제주 리트릿으로 초대합니다.';
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({ title, text, url }).catch((err) => console.log('Share canceled', err));
    } else {
      copyTextToClipboard(url, '✨ 초대장 링크가 복사되었습니다. 카카오톡이나 메시지로 전달해 주세요.');
    }
  };
});
