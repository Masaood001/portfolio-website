import Lenis from 'lenis';
import { portfolioData } from './data/portfolio.js';

const TOTAL_FRAMES = 240;
const frames = new Array(TOTAL_FRAMES);
const frameStatus = new Uint8Array(TOTAL_FRAMES); // 0 = UNLOADED, 1 = LOADING, 2 = LOADED, 3 = ERROR
let loadedCount = 0;
let activeDownloads = 0;
let maxConcurrentDownloads = 4;

// DOM Elements
const canvas = document.getElementById('scroll-canvas');
const ctx = canvas.getContext('2d');
const loader = document.getElementById('loader');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// Cached DOM References for Animation Loop
let cachedHeroSection = null;
let cachedHeroGrid = null;
let cachedAboutSection = null;
let cachedAboutPanel = null;
let cachedAboutHeader = null;
let cachedAboutEdu = null;
let cachedAboutMeta = null;

// Cached Section Metrics (eliminates getBoundingClientRect from render loop)
let cachedHeroOffsetTop = 0;
let cachedHeroHeight = 0;
let cachedAboutOffsetTop = 0;
let cachedAboutHeight = 0;

// Animation State & Metrics Cache
let currentFrameIndex = 0;
let lastRenderedFrameIndex = -1;
let isLoaded = false;
let dpr = 1;
let viewportW = window.innerWidth;
let viewportH = window.innerHeight;
let maxScroll = 0;
let isReducedMotion = false;
let isMobile = false;

// Scroll & Velocity Cache
let lastScrollY = -1;
let scrollDirection = 1; // 1 = DOWN, -1 = UP
let prevFrameIndexForDirection = 0;

// Section Animation State Guards (eliminates redundant DOM/math updates)
let heroState = ''; // 'top' | 'animating' | 'bottom'
let aboutState = ''; // 'top' | 'animating' | 'bottom'

// Canvas Render Metrics Cache
let renderWidth = 0;
let renderHeight = 0;
let offsetX = 0;
let offsetY = 0;
let scaledRenderWidth = 0;
let scaledRenderHeight = 0;
let scaledOffsetX = 0;
let scaledOffsetY = 0;
let needsCanvasMetricsUpdate = true;

// Element Inline Style Cache (prevents unnecessary DOM mutations)
const prevStyles = new Map();

function setElementStyle(el, key, value) {
  let prev = prevStyles.get(el);
  if (!prev) {
    prev = {};
    prevStyles.set(el, prev);
  }
  if (prev[key] !== value) {
    prev[key] = value;
    el.style[key] = value;
  }
}

// Initialize Lenis Smooth Scroll with mobile-tuned touch response
const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const lenis = new Lenis({
  duration: isTouchDevice ? 0.8 : 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  touchMultiplier: 1.2,
});

// Update Layout & Viewport Metrics
function updateMetrics() {
  viewportW = window.innerWidth;
  viewportH = window.innerHeight;
  isMobile = viewportW <= 768;
  maxConcurrentDownloads = isMobile ? 2 : 4;
  dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2);
  maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportH);
  needsCanvasMetricsUpdate = true;
  heroState = '';
  aboutState = '';
  updateSectionMetrics();
}

// Pre-cache Section Offsets for Pure-Math Animation Calculations
function updateSectionMetrics() {
  const currentScroll = lenis ? (lenis.scroll || window.scrollY) : window.scrollY;
  if (cachedHeroSection) {
    const rect = cachedHeroSection.getBoundingClientRect();
    cachedHeroOffsetTop = rect.top + currentScroll;
    cachedHeroHeight = rect.height;
  }
  if (cachedAboutSection) {
    const rect = cachedAboutSection.getBoundingClientRect();
    cachedAboutOffsetTop = rect.top + currentScroll;
    cachedAboutHeight = rect.height;
  }
}

// Cache Static DOM References Once
function cacheDOMElements() {
  cachedHeroSection = document.querySelector('#home');
  cachedHeroGrid = document.querySelector('.hero-grid');
  cachedAboutSection = document.querySelector('#about');
  cachedAboutPanel = document.querySelector('#about .impact-panel');
  cachedAboutHeader = document.querySelector('#about .impact-header');
  cachedAboutEdu = document.querySelector('#about .education-section');
  cachedAboutMeta = document.querySelector('#about .about-meta-grid');
  updateSectionMetrics();
}

// Listen to Accessibility Preference Changes
function setupAccessibilityListener() {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  isReducedMotion = mediaQuery.matches;
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', (e) => {
      isReducedMotion = e.matches;
    });
  }
}

// Render Dynamic Portfolio Content from portfolio.js
function renderPortfolioData() {
  if (!portfolioData) return;

  // Document Title
  if (portfolioData.personal?.name) {
    document.title = `${portfolioData.personal.name} — Portfolio`;
  }

  // 1. HERO Section
  const nameTag = document.getElementById('hero-name-tag') || document.getElementById('hero-agency-tag');
  if (nameTag && portfolioData.personal?.name) {
    nameTag.textContent = `— ${portfolioData.personal.name}`;
  }

  const heroTitle = document.getElementById('hero-title');
  if (heroTitle && portfolioData.personal?.title) {
    heroTitle.innerHTML = `<span class="text-orange">${portfolioData.personal.title}</span>`;
  }

  const heroDesc = document.getElementById('hero-desc');
  if (heroDesc && portfolioData.personal?.shortIntro) {
    heroDesc.textContent = portfolioData.personal.shortIntro;
  }

  const heroTagline = document.getElementById('hero-tagline');
  if (heroTagline && portfolioData.personal?.tagline) {
    heroTagline.innerHTML = `<span class="tag-sub">[FOCUS]</span> <span>${portfolioData.personal.tagline}</span>`;
  }

  const heroLocation = document.getElementById('hero-location-text');
  if (heroLocation && portfolioData.personal?.shortIntro) {
    heroLocation.textContent = portfolioData.personal.shortIntro;
  }

  const heroEmailInput = document.getElementById('hero-email-display');
  if (heroEmailInput && portfolioData.contact?.email) {
    heroEmailInput.value = portfolioData.contact.email;
  }

  // 2. ABOUT ME Section
  const aboutStatement = document.getElementById('about-statement');
  if (aboutStatement && portfolioData.personal?.about) {
    aboutStatement.textContent = portfolioData.personal.about;
  }

  const eduGrid = document.getElementById('about-education-grid');
  if (eduGrid && portfolioData.education && portfolioData.education.length > 0) {
    eduGrid.innerHTML = portfolioData.education.map((edu, index) => `
      <div class="education-card" style="transition-delay: ${0.15 + index * 0.1}s;">
        <div class="edu-degree">${edu.degree}</div>
        <div class="edu-meta">${edu.college} • ${edu.year}</div>
        <div class="edu-desc">${edu.description}</div>
      </div>
    `).join('');
  }

  const interestsTags = document.getElementById('about-interests-tags');
  if (interestsTags && portfolioData.personal?.interests) {
    interestsTags.innerHTML = portfolioData.personal.interests.map(item => `
      <span class="skill-pill">💡 ${item}</span>
    `).join('');
  }

  const currentFocusText = document.getElementById('about-current-focus');
  if (currentFocusText && portfolioData.personal?.currentFocus) {
    currentFocusText.textContent = portfolioData.personal.currentFocus;
  }

  // 3. SKILLS & TECHNOLOGIES Section
  const langTags = document.getElementById('skills-languages-tags');
  if (langTags && portfolioData.skills?.programmingLanguages) {
    langTags.innerHTML = portfolioData.skills.programmingLanguages.map(s => `<span class="skill-pill"><code>&lt;/&gt;</code> ${s}</span>`).join('');
  }

  const webTags = document.getElementById('skills-web-tags');
  if (webTags && portfolioData.skills?.webDevelopment) {
    webTags.innerHTML = portfolioData.skills.webDevelopment.map(s => `<span class="skill-pill">🌐 ${s}</span>`).join('');
  }

  const backTags = document.getElementById('skills-backend-tags');
  if (backTags && portfolioData.skills?.backendDatabase) {
    backTags.innerHTML = portfolioData.skills.backendDatabase.map(s => `<span class="skill-pill">⚙️ ${s}</span>`).join('');
  }

  const aimlTags = document.getElementById('skills-aiml-tags');
  if (aimlTags && portfolioData.skills?.aiMl) {
    aimlTags.innerHTML = portfolioData.skills.aiMl.map(s => `<span class="skill-pill">🤖 ${s}</span>`).join('');
  }

  const toolTags = document.getElementById('skills-tools-tags');
  if (toolTags && portfolioData.skills?.tools) {
    toolTags.innerHTML = portfolioData.skills.tools.map(s => `<span class="skill-pill">🛠️ ${s}</span>`).join('');
  }

  const currentlyLearningTags = document.getElementById('currently-learning-tags');
  if (currentlyLearningTags && portfolioData.skills?.currentlyLearning) {
    currentlyLearningTags.innerHTML = portfolioData.skills.currentlyLearning.map(item => `
      <span class="skill-pill">🚀 ${item}</span>
    `).join('');
  }

  // PART 2 — CERTIFICATIONS Subsection
  const certsGrid = document.getElementById('skills-certifications-grid');
  const certsSubSection = document.querySelector('.certifications-subsection');
  const certsList = portfolioData.certifications || portfolioData.skills?.certifications;
  if (certsGrid && certsList && certsList.length > 0) {
    if (certsSubSection) certsSubSection.style.display = 'block';
    certsGrid.innerHTML = certsList.map(cert => `
      <div class="certification-card">
        <div class="cert-card-header">
          <div class="cert-badge-icon">📜</div>
          <div class="cert-header-text">
            <h4 class="cert-title">${cert.name}</h4>
            <div class="cert-issuer">${cert.issuer} ${cert.date ? `• <span class="cert-date">${cert.date}</span>` : ''}</div>
          </div>
        </div>
        ${cert.description ? `<p class="cert-desc">${cert.description}</p>` : ''}
        ${cert.url ? `
          <div class="cert-action">
            <a href="${cert.url}" target="_blank" rel="noopener" class="btn-cert-link">
              View Certificate ↗
            </a>
          </div>
        ` : ''}
      </div>
    `).join('');
  } else if (certsSubSection) {
    certsSubSection.style.display = 'none';
  }

  // 4. PROJECTS Showcase Section
  const projGrid = document.getElementById('projects-grid');
  if (projGrid && portfolioData.projects && portfolioData.projects.length > 0) {
    projGrid.innerHTML = portfolioData.projects.map(proj => `
      <div class="project-card">
        <div>
          <div class="project-card-top">
            <h3 class="project-title">${proj.name}</h3>
            <span class="project-status">${proj.status}</span>
          </div>
          <p class="project-desc">${proj.shortDescription}</p>
          <div class="project-tech-list">
            ${(proj.technologies || []).map(t => `<span class="tech-tag">${t}</span>`).join('')}
          </div>
        </div>
        <div class="project-links">
          ${proj.githubUrl ? `<a href="${proj.githubUrl}" target="_blank" rel="noopener" class="btn-project-link">GitHub ↗</a>` : ''}
          ${proj.liveDemoUrl ? `<a href="${proj.liveDemoUrl}" target="_blank" rel="noopener" class="btn-project-link">Live Demo ↗</a>` : ''}
        </div>
      </div>
    `).join('');
  }

  // 5. LEARNING JOURNEY Section
  const journeyContainer = document.getElementById('journey-roadmap-container');
  const journeyList = portfolioData.learningJourney || portfolioData.journey;
  if (journeyContainer && journeyList && journeyList.length > 0) {
    journeyContainer.innerHTML = journeyList.map(step => `
      <div class="roadmap-item">
        <div class="roadmap-stage-badge">${step.stage}</div>
        <div>
          <h4 class="roadmap-content-title">${step.title}</h4>
          <p class="roadmap-content-desc">${step.description}</p>
        </div>
      </div>
    `).join('');
  }

  const futureExplorationTags = document.getElementById('future-exploration-tags');
  if (futureExplorationTags && portfolioData.futureExploration) {
    futureExplorationTags.innerHTML = portfolioData.futureExploration.map(item => `
      <span class="skill-pill">🔭 ${item}</span>
    `).join('');
  }

  // 6. CONTACT Section
  const heroSocialPills = document.getElementById('hero-social-pills');
  const navSocialChips = document.getElementById('nav-social-chips');
  const contactDetailsRow = document.getElementById('contact-details-row');

  const socialItems = [];
  if (portfolioData.contact?.email) {
    socialItems.push(`<a href="mailto:${portfolioData.contact.email}" class="contact-chip-item">✉️ ${portfolioData.contact.email}</a>`);
  }
  if (portfolioData.contact?.github) {
    socialItems.push(`<a href="${portfolioData.contact.github}" target="_blank" rel="noopener" class="contact-chip-item">GitHub ↗</a>`);
  }
  if (portfolioData.contact?.linkedin) {
    socialItems.push(`<a href="${portfolioData.contact.linkedin}" target="_blank" rel="noopener" class="contact-chip-item">LinkedIn ↗</a>`);
  }
  if (portfolioData.contact?.twitter) {
    socialItems.push(`<a href="${portfolioData.contact.twitter}" target="_blank" rel="noopener" class="contact-chip-item">Twitter / 𝕏 ↗</a>`);
  }

  if (contactDetailsRow) {
    contactDetailsRow.innerHTML = socialItems.join('');
  }

  if (navSocialChips) {
    const chipsHtml = [];
    if (portfolioData.contact?.github) chipsHtml.push(`<a href="${portfolioData.contact.github}" target="_blank" rel="noopener" class="chip">GH</a>`);
    if (portfolioData.contact?.linkedin) chipsHtml.push(`<a href="${portfolioData.contact.linkedin}" target="_blank" rel="noopener" class="chip">in</a>`);
    if (portfolioData.contact?.twitter) chipsHtml.push(`<a href="${portfolioData.contact.twitter}" target="_blank" rel="noopener" class="chip">𝕏</a>`);
    navSocialChips.innerHTML = chipsHtml.join('');
  }

  if (heroSocialPills) {
    const pillsHtml = [];
    if (portfolioData.contact?.github) pillsHtml.push(`<a href="${portfolioData.contact.github}" target="_blank" rel="noopener" class="chip">GH</a>`);
    if (portfolioData.contact?.linkedin) pillsHtml.push(`<a href="${portfolioData.contact.linkedin}" target="_blank" rel="noopener" class="chip">in</a>`);
    if (portfolioData.contact?.twitter) pillsHtml.push(`<a href="${portfolioData.contact.twitter}" target="_blank" rel="noopener" class="chip">𝕏</a>`);
    heroSocialPills.innerHTML = pillsHtml.join('');
  }

  const contactMsg = document.getElementById('contact-message-text');
  if (contactMsg && portfolioData.contact?.message) {
    contactMsg.textContent = portfolioData.contact.message;
  }

  const heroContactBtn = document.getElementById('hero-contact-btn');
  if (heroContactBtn && portfolioData.contact?.email) {
    heroContactBtn.href = `mailto:${portfolioData.contact.email}`;
  }

  // 7. FOOTER Section
  const footerTagline = document.getElementById('footer-tagline');
  if (footerTagline && portfolioData.footer?.tagline) {
    footerTagline.textContent = portfolioData.footer.tagline;
  }

  const footerCopyright = document.getElementById('footer-copyright');
  if (footerCopyright && portfolioData.footer?.copyright) {
    footerCopyright.textContent = portfolioData.footer.copyright;
  }
}

function getFrameUrl(index) {
  const frameNumber = String(index + 1).padStart(3, '0');
  return `/frames/ezgif-frame-${frameNumber}.jpg`;
}

// Schedule queue processing during idle time to prevent blocking RAF scroll ticks
let queueScheduled = false;
function scheduleProcessQueue() {
  if (queueScheduled) return;
  queueScheduled = true;
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      queueScheduled = false;
      processQueue();
    }, { timeout: 50 });
  } else {
    setTimeout(() => {
      queueScheduled = false;
      processQueue();
    }, 16);
  }
}

// Low-level Async Frame Loader with Smart Memory & Pre-Decoding
function fetchFrame(index) {
  if (index < 0 || index >= TOTAL_FRAMES) return Promise.resolve(null);
  if (frameStatus[index] !== 0) return Promise.resolve(frames[index] || null);

  frameStatus[index] = 1; // LOADING
  activeDownloads++;

  return new Promise((resolve) => {
    const img = new Image();
    img.src = getFrameUrl(index);

    const onDone = (success) => {
      activeDownloads--;
      if (success) {
        frames[index] = img;
        frameStatus[index] = 2; // LOADED
        loadedCount++;
      } else {
        frameStatus[index] = 3; // ERROR
      }
      scheduleProcessQueue();
      resolve(frames[index] || null);
    };

    const targetIndex = Math.round(currentFrameIndex);
    const distance = Math.abs(index - targetIndex);
    const isCriticalOrNear = index < 5 || distance <= 15;

    // On mobile, decode critical/near frames to avoid main-thread decode stutter on active view,
    // while letting distant frames complete via onload to prevent RGBA texture memory bloat.
    if ('decode' in img && (!isMobile || isCriticalOrNear)) {
      img.decoding = 'async';
      const decodeAndDone = () => {
        img.decode().then(() => onDone(true)).catch(() => onDone(true));
      };
      if (img.complete) {
        decodeAndDone();
      } else {
        img.onload = decodeAndDone;
        img.onerror = () => onDone(false);
      }
    } else {
      if (img.complete) {
        onDone(true);
      } else {
        img.onload = () => onDone(true);
        img.onerror = () => onDone(false);
      }
    }
  });
}

// Determine Next Frame to Load based on Current Scroll Position, Direction & Keyframes
function getNextFrameToLoad() {
  const target = Math.round(currentFrameIndex);

  // 1. Direction-aware high priority window (+/- 20 frames around current position)
  const dir = scrollDirection >= 0 ? 1 : -1;
  for (let offset = 0; offset <= 20; offset++) {
    const primary = target + (offset * dir);
    if (primary >= 0 && primary < TOTAL_FRAMES && frameStatus[primary] === 0) return primary;

    const secondary = target - (offset * dir);
    if (secondary >= 0 && secondary < TOTAL_FRAMES && frameStatus[secondary] === 0) return secondary;
  }

  // 2. Timeline Keyframes (sampled every 10 frames across timeline for instant fallback)
  for (let i = 0; i < TOTAL_FRAMES; i += 10) {
    if (frameStatus[i] === 0) return i;
  }

  // 3. Sequential load for remaining frames
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    if (frameStatus[i] === 0) return i;
  }

  return -1;
}

// Process Queue up to maxConcurrentDownloads
function processQueue() {
  while (activeDownloads < maxConcurrentDownloads) {
    const nextIndex = getNextFrameToLoad();
    if (nextIndex === -1) break;
    fetchFrame(nextIndex);
  }
}

// Find Nearest Available Loaded Frame for Zero-Stutter Canvas Fallback
function getNearestLoadedFrame(targetIndex) {
  if (frameStatus[targetIndex] === 2 && frames[targetIndex]?.complete) {
    return targetIndex;
  }

  for (let delta = 1; delta < TOTAL_FRAMES; delta++) {
    const prev = targetIndex - delta;
    if (prev >= 0 && frameStatus[prev] === 2 && frames[prev]?.complete) {
      return prev;
    }
    const next = targetIndex + delta;
    if (next < TOTAL_FRAMES && frameStatus[next] === 2 && frames[next]?.complete) {
      return next;
    }
  }

  return -1;
}

// High-DPI & Responsive Canvas Sizing
function resizeCanvas() {
  updateMetrics();

  canvas.width = viewportW * dpr;
  canvas.height = viewportH * dpr;
  canvas.style.width = `${viewportW}px`;
  canvas.style.height = `${viewportH}px`;

  lastRenderedFrameIndex = -1; // Force re-render on resize
  renderFrame(Math.round(currentFrameIndex));
}

// Compute Canvas Aspect Contain Fit Offsets (cached with pre-scaled device coordinates)
function updateCanvasRenderMetrics(img) {
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const canvasAspect = viewportW / viewportH;

  if (canvasAspect > imgAspect) {
    renderHeight = viewportH;
    renderWidth = renderHeight * imgAspect;
    offsetX = (viewportW - renderWidth) / 2;
    offsetY = (viewportH - renderHeight) / 2;
  } else if (isMobile) {
    // On mobile portrait, scale renderHeight so the 3D scene fills screen height gracefully without 200px black voids
    renderHeight = Math.max(viewportH * 0.72, viewportW / imgAspect);
    renderWidth = renderHeight * imgAspect;
    offsetX = (viewportW - renderWidth) / 2;
    offsetY = (viewportH - renderHeight) / 2;
  } else {
    renderWidth = viewportW;
    renderHeight = renderWidth / imgAspect;
    offsetX = (viewportW - renderWidth) / 2;
    offsetY = (viewportH - renderHeight) / 2;
  }

  scaledRenderWidth = renderWidth * dpr;
  scaledRenderHeight = renderHeight * dpr;
  scaledOffsetX = offsetX * dpr;
  scaledOffsetY = offsetY * dpr;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = isMobile ? 'medium' : 'high';

  needsCanvasMetricsUpdate = false;
}

// Crisp HD Frame Rendering with Redraw Skipping & Nearest Frame Fallback
function renderFrame(index) {
  const drawIndex = getNearestLoadedFrame(index);
  if (drawIndex === -1) return;

  // Skip redraw if the actual frame drawn hasn't changed and dimensions are up to date
  if (drawIndex === lastRenderedFrameIndex && !needsCanvasMetricsUpdate) return;

  const img = frames[drawIndex];
  if (!img || !img.complete) return;

  if (needsCanvasMetricsUpdate || scaledRenderWidth === 0) {
    updateCanvasRenderMetrics(img);
  }

  // Opaque JPEG frame covers render area directly without expensive clearRect memory writes
  ctx.drawImage(img, scaledOffsetX, scaledOffsetY, scaledRenderWidth, scaledRenderHeight);

  lastRenderedFrameIndex = drawIndex;
}

// Setup Navigation & Observer
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-links a, a[href^="#"]');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const targetSection = document.querySelector(href);
        if (targetSection) {
          lenis.scrollTo(targetSection, { offset: -20 });
        }
      }
    });
  });

  // Intersection Observer for Active Nav Link Highlight
  const sections = document.querySelectorAll('section[id], footer[id]');
  const mainNavAnchors = document.querySelectorAll('.nav-links a');

  const observerOptions = {
    root: null,
    rootMargin: '-20% 0px -60% 0px',
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        mainNavAnchors.forEach(a => {
          const isTarget = a.getAttribute('href') === `#${id}`;
          if (a.classList.contains('active') !== isTarget) {
            a.classList.toggle('active', isTarget);
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));
}

// Setup Scroll Reveal Observer
function setupScrollReveals() {
  const revealElements = document.querySelectorAll('.reveal-on-scroll:not(#about .reveal-on-scroll):not(#about)');
  if (!revealElements.length) return;

  if (!('IntersectionObserver' in window) || isReducedMotion) {
    revealElements.forEach(el => el.classList.add('in-view'));
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.08
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealElements.forEach(el => observer.observe(el));
}

function clamp(val, min = 0, max = 1) {
  return Math.min(max, Math.max(min, val));
}

// Main Render Loop driven by single RAF
function animate(time) {
  lenis.raf(time);

  if (isLoaded) {
    const currentScrollY = lenis.scroll || window.scrollY;
    const scrollChanged = Math.abs(currentScrollY - lastScrollY) > 0.001;

    if (scrollChanged || needsCanvasMetricsUpdate) {
      lastScrollY = currentScrollY;

      const scrollProgress = maxScroll > 0 ? clamp(currentScrollY / maxScroll, 0, 1) : 0;
      currentFrameIndex = scrollProgress * (TOTAL_FRAMES - 1);

      // Determine scroll direction for frame preloading priority
      if (currentFrameIndex !== prevFrameIndexForDirection) {
        scrollDirection = currentFrameIndex >= prevFrameIndexForDirection ? 1 : -1;
        prevFrameIndexForDirection = currentFrameIndex;
      }

      const frameToRender = Math.round(currentFrameIndex);
      renderFrame(frameToRender);

      // 1. HERO EXIT (Pure Math, layout-thrash free, continuous, reversible)
      if (cachedHeroGrid && cachedHeroSection) {
        if (isReducedMotion) {
          setElementStyle(cachedHeroGrid, 'opacity', '1');
          setElementStyle(cachedHeroGrid, 'transform', 'none');
          setElementStyle(cachedHeroGrid, 'filter', 'none');
          setElementStyle(cachedHeroGrid, 'pointerEvents', 'auto');
        } else {
          const heroTop = cachedHeroOffsetTop - currentScrollY;
          const exitRange = cachedHeroHeight * 0.65;
          const heroExitProgress = clamp(-heroTop / exitRange, 0, 1);

          if (heroExitProgress <= 0) {
            if (heroState !== 'top') {
              heroState = 'top';
              setElementStyle(cachedHeroGrid, 'opacity', '1');
              setElementStyle(cachedHeroGrid, 'transform', 'translateY(0px) scale(1)');
              setElementStyle(cachedHeroGrid, 'filter', 'none');
              setElementStyle(cachedHeroGrid, 'pointerEvents', 'auto');
            }
          } else if (heroExitProgress < 1) {
            heroState = 'animating';
            const easeExit = Math.pow(heroExitProgress, 1.2);
            const heroOpacity = Math.max(0, 1 - easeExit);
            const heroTranslateY = -heroExitProgress * (isMobile ? 25 : 50);
            const heroScale = 1 - (heroExitProgress * 0.03);
            const heroBlur = isMobile ? 0 : (heroExitProgress * 4);

            setElementStyle(cachedHeroGrid, 'opacity', heroOpacity.toFixed(3));
            setElementStyle(cachedHeroGrid, 'transform', `translateY(${heroTranslateY.toFixed(1)}px) scale(${heroScale.toFixed(3)})`);
            setElementStyle(cachedHeroGrid, 'filter', heroBlur > 0.1 ? `blur(${heroBlur.toFixed(1)}px)` : 'none');
            setElementStyle(cachedHeroGrid, 'pointerEvents', heroExitProgress > 0.85 ? 'none' : 'auto');
          } else {
            if (heroState !== 'bottom') {
              heroState = 'bottom';
              setElementStyle(cachedHeroGrid, 'opacity', '0');
              setElementStyle(cachedHeroGrid, 'pointerEvents', 'none');
            }
          }
        }
      }

      // 2. ABOUT ENTRY & STAGGER (Pure Math, layout-thrash free, continuous, reversible)
      if (cachedAboutSection && cachedAboutPanel) {
        if (isReducedMotion) {
          setElementStyle(cachedAboutPanel, 'opacity', '1');
          setElementStyle(cachedAboutPanel, 'transform', 'none');
          if (cachedAboutHeader) { setElementStyle(cachedAboutHeader, 'opacity', '1'); setElementStyle(cachedAboutHeader, 'transform', 'none'); }
          if (cachedAboutEdu) { setElementStyle(cachedAboutEdu, 'opacity', '1'); setElementStyle(cachedAboutEdu, 'transform', 'none'); }
          if (cachedAboutMeta) { setElementStyle(cachedAboutMeta, 'opacity', '1'); setElementStyle(cachedAboutMeta, 'transform', 'none'); }
        } else {
          const aboutTop = cachedAboutOffsetTop - currentScrollY;
          const startPoint = viewportH * 0.95;
          const endPoint = viewportH * 0.25;
          const totalDist = startPoint - endPoint;
          const aboutProgress = clamp((startPoint - aboutTop) / totalDist, 0, 1);

          if (aboutProgress <= 0) {
            if (aboutState !== 'top') {
              aboutState = 'top';
              setElementStyle(cachedAboutPanel, 'opacity', '0');
              setElementStyle(cachedAboutPanel, 'transform', 'translateY(35px) scale(0.98)');
            }
          } else if (aboutProgress < 1) {
            aboutState = 'animating';
            const maxTranslate = isMobile ? 20 : 35;

            // Layer 1: Panel Container
            const panelP = clamp(aboutProgress / 0.7, 0, 1);
            const panelOpacity = Math.pow(panelP, 1.2);
            const panelY = (1 - panelP) * maxTranslate;
            const panelScale = 0.98 + (panelP * 0.02);

            setElementStyle(cachedAboutPanel, 'opacity', panelOpacity.toFixed(3));
            setElementStyle(cachedAboutPanel, 'transform', `translateY(${panelY.toFixed(1)}px) scale(${panelScale.toFixed(3)})`);

            // Layer 2: About Header & Statement (stagger 0.08)
            if (cachedAboutHeader) {
              const headerP = clamp((aboutProgress - 0.08) / 0.7, 0, 1);
              const headerOpacity = Math.pow(headerP, 1.2);
              const headerY = (1 - headerP) * (maxTranslate * 0.8);
              setElementStyle(cachedAboutHeader, 'opacity', headerOpacity.toFixed(3));
              setElementStyle(cachedAboutHeader, 'transform', `translateY(${headerY.toFixed(1)}px)`);
            }

            // Layer 3: Education Section (stagger 0.16)
            if (cachedAboutEdu) {
              const eduP = clamp((aboutProgress - 0.16) / 0.7, 0, 1);
              const eduOpacity = Math.pow(eduP, 1.2);
              const eduY = (1 - eduP) * (maxTranslate * 0.8);
              setElementStyle(cachedAboutEdu, 'opacity', eduOpacity.toFixed(3));
              setElementStyle(cachedAboutEdu, 'transform', `translateY(${eduY.toFixed(1)}px)`);
            }

            // Layer 4: Meta Grid Cards (stagger 0.24)
            if (cachedAboutMeta) {
              const metaP = clamp((aboutProgress - 0.24) / 0.7, 0, 1);
              const metaOpacity = Math.pow(metaP, 1.2);
              const metaY = (1 - metaP) * (maxTranslate * 0.8);
              setElementStyle(cachedAboutMeta, 'opacity', metaOpacity.toFixed(3));
              setElementStyle(cachedAboutMeta, 'transform', `translateY(${metaY.toFixed(1)}px)`);
            }
          } else {
            if (aboutState !== 'bottom') {
              aboutState = 'bottom';
              setElementStyle(cachedAboutPanel, 'opacity', '1');
              setElementStyle(cachedAboutPanel, 'transform', 'translateY(0px) scale(1)');
              if (cachedAboutHeader) { setElementStyle(cachedAboutHeader, 'opacity', '1'); setElementStyle(cachedAboutHeader, 'transform', 'translateY(0px)'); }
              if (cachedAboutEdu) { setElementStyle(cachedAboutEdu, 'opacity', '1'); setElementStyle(cachedAboutEdu, 'transform', 'translateY(0px)'); }
              if (cachedAboutMeta) { setElementStyle(cachedAboutMeta, 'opacity', '1'); setElementStyle(cachedAboutMeta, 'transform', 'translateY(0px)'); }
            }
          }
        }
      }

      // Trigger background queue processing as frame index updates
      scheduleProcessQueue();
    }
  }

  requestAnimationFrame(animate);
}

// Throttled Resize Event Handler with Mobile Address-Bar Thrash Shield
let resizeTimeout = null;
let lastWidth = window.innerWidth;
let lastHeight = window.innerHeight;

function handleResize() {
  if (resizeTimeout) cancelAnimationFrame(resizeTimeout);
  resizeTimeout = requestAnimationFrame(() => {
    const newW = window.innerWidth;
    const newH = window.innerHeight;

    // On mobile, ignore small height changes caused by address bar hide/show during scrolling
    const widthChanged = Math.abs(newW - lastWidth) > 2;
    const heightChanged = Math.abs(newH - lastHeight) > 80;

    if (!isMobile || widthChanged || heightChanged) {
      lastWidth = newW;
      lastHeight = newH;
      resizeCanvas();
    }
  });
}

// Initialize Application
async function init() {
  setupAccessibilityListener();
  cacheDOMElements();
  renderPortfolioData();
  setupNavigation();
  setupScrollReveals();

  window.addEventListener('resize', handleResize, { passive: true });
  resizeCanvas();

  // Load initial essential frames (frames 0 to 4) immediately for zero-perceived-latency UI
  const CRITICAL_FRAMES = [0, 1, 2, 3, 4];
  let loadedCritical = 0;

  await Promise.all(CRITICAL_FRAMES.map((idx) => {
    return fetchFrame(idx).then(() => {
      loadedCritical++;
      const pct = Math.floor((loadedCritical / CRITICAL_FRAMES.length) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressText) progressText.textContent = `${pct}%`;
    });
  }));

  isLoaded = true;
  renderFrame(0);

  if (loader) {
    loader.classList.add('hidden');
  }

  const heroSection = document.querySelector('.section-hero');
  if (heroSection) {
    heroSection.classList.add('hero-animated');
    setTimeout(() => {
      heroSection.classList.add('hero-animation-done');
    }, 1500);
  }

  requestAnimationFrame(animate);

  // Kick off background progressive frame preloader
  scheduleProcessQueue();
}

init();

