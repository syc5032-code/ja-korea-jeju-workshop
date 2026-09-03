/**
 * Jeju Workshop Canvas Particle Engine
 * Subtle, calm, elegant particle accents (reduced count & gentle animation)
 */

(function () {
  const canvas = document.getElementById('sparkle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth || document.documentElement.clientWidth;
    canvas.height = window.innerHeight || document.documentElement.clientHeight;
  }
  resizeCanvas();

  let width = canvas.width;
  let height = canvas.height;

  let mouse = {
    x: width / 2,
    y: height / 2,
    radius: 80,
    active: false
  };

  const isMobile = width < 768;
  // Subtly reduced counts for a clean, premium, elegant atmosphere
  const petalCount = isMobile ? 6 : 12;
  const sparkleCount = isMobile ? 5 : 10;

  const petalColors = [
    'rgba(255, 230, 109, 0.55)',
    'rgba(254, 215, 170, 0.5)',
    'rgba(254, 205, 211, 0.55)',
    'rgba(224, 247, 250, 0.6)'
  ];

  const sparkleColors = [
    'rgba(0, 151, 167, ',
    'rgba(245, 158, 11, ',
    'rgba(14, 165, 233, '
  ];

  class Petal {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : -25;
      this.size = Math.random() * 5 + 4;
      this.color = petalColors[Math.floor(Math.random() * petalColors.length)];
      this.speedY = Math.random() * 0.7 + 0.3;
      this.speedX = Math.random() * 0.8 - 0.3;
      this.angle = Math.random() * Math.PI * 2;
      this.angularSpeed = (Math.random() - 0.5) * 0.02;
      this.swingOffset = Math.random() * 100;
      this.swingSpeed = Math.random() * 0.015 + 0.008;
      this.opacity = Math.random() * 0.35 + 0.3;
      this.flip = Math.random();
      this.flipSpeed = Math.random() * 0.02 + 0.008;
    }

    update() {
      this.y += this.speedY;
      this.x += Math.sin(this.y * this.swingSpeed + this.swingOffset) * 0.5 + this.speedX;
      this.angle += this.angularSpeed;
      this.flip += this.flipSpeed;

      if (mouse.active) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          this.x += (dx / dist) * force * 1.5;
          this.y += (dy / dist) * force * 1.2;
        }
      }

      if (this.y > height + 25 || this.x < -25 || this.x > width + 25) {
        this.reset();
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.scale(Math.sin(this.flip), 1);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(this.size * 0.8, -this.size * 0.6, this.size * 1.2, this.size * 0.4, 0, this.size * 1.2);
      ctx.bezierCurveTo(-this.size * 1.2, this.size * 0.4, -this.size * 0.8, -this.size * 0.6, 0, 0);
      ctx.fillStyle = this.color;
      ctx.fill();

      ctx.restore();
    }
  }

  class Sparkle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : Math.random() * height;
      this.baseRadius = Math.random() * 1.5 + 0.8;
      this.radius = this.baseRadius;
      this.baseColor = sparkleColors[Math.floor(Math.random() * sparkleColors.length)];
      this.alpha = Math.random() * 0.45 + 0.15;
      this.alphaSpeed = (Math.random() * 0.01 + 0.005) * (Math.random() > 0.5 ? 1 : -1);
      this.speedY = -(Math.random() * 0.3 + 0.1);
      this.speedX = (Math.random() - 0.5) * 0.2;
      this.twinkleRate = Math.random() * 0.03 + 0.01;
    }

    update() {
      this.y += this.speedY;
      this.x += this.speedX;
      this.alpha += this.alphaSpeed;

      if (this.alpha > 0.55) {
        this.alpha = 0.55;
        this.alphaSpeed = -this.alphaSpeed;
      } else if (this.alpha < 0.08) {
        this.alpha = 0.08;
        this.alphaSpeed = -this.alphaSpeed;
      }

      if (this.y < -15) {
        this.y = height + 15;
        this.x = Math.random() * width;
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);

      ctx.fillStyle = this.baseColor + this.alpha + ')';
      const size = this.radius * (1 + Math.sin(Date.now() * this.twinkleRate) * 0.3);

      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  const petals = Array.from({ length: petalCount }, () => new Petal());
  const sparkles = Array.from({ length: sparkleCount }, () => new Sparkle());

  let animationFrameId;
  let isRunning = true;

  function render() {
    if (!isRunning) return;
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < sparkles.length; i++) {
      sparkles[i].update();
      sparkles[i].draw();
    }

    for (let i = 0; i < petals.length; i++) {
      petals[i].update();
      petals[i].draw();
    }

    animationFrameId = requestAnimationFrame(render);
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
    width = canvas.width;
    height = canvas.height;
  });

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });

  window.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

  window.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.active = true;
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    mouse.active = false;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
    } else {
      isRunning = true;
      render();
    }
  });

  render();
})();
