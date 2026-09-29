import Lenis from 'lenis';
import { portfolioData } from './data/portfolio.js';

const TOTAL_FRAMES = 240;
const frames = [];
let loadedCount = 0;

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

// Initialize Lenis Smooth Scroll
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  touchMultiplier: 2,
});

// Update Layout & Viewport Metrics
function updateMetrics() {
  viewportW = window.innerWidth;
  viewportH = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportH);
  needsCanvasMetricsUpdate = true;
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

// Preload Images Efficiently with Pre-Decoding
function preloadImages() {
  return new Promise((resolve) => {
    let completed = 0;

    const onFrameReady = () => {
      completed++;
      const percent = Math.floor((completed / TOTAL_FRAMES) * 100);
      
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `${percent}%`;

      if (completed === TOTAL_FRAMES) {
        isLoaded = true;
        resolve();
      }
    };

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = getFrameUrl(i);
      frames.push(img);

      const decodeAndNotify = () => {
        if ('decode' in img) {
          img.decode().then(onFrameReady).catch(onFrameReady);
        } else {
          onFrameReady();
        }
      };

      if (img.complete) {
        decodeAndNotify();
      } else {
        img.onload = decodeAndNotify;
        img.onerror = onFrameReady;
      }
    }
  });
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
  } else {
    renderWidth = viewportW;
    renderHeight = renderWidth / imgAspect;
  }

  offsetX = (viewportW - renderWidth) / 2;
  offsetY = (viewportH - renderHeight) / 2;

  scaledRenderWidth = renderWidth * dpr;
  scaledRenderHeight = renderHeight * dpr;
  scaledOffsetX = offsetX * dpr;
  scaledOffsetY = offsetY * dpr;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  needsCanvasMetricsUpdate = false;
}

// Crisp HD Frame Rendering with Redraw Skipping
function renderFrame(index) {
  // Skip redraw if frame index has not changed and dimensions are up to date
  if (index === lastRenderedFrameIndex && !needsCanvasMetricsUpdate) return;
  if (!frames[index] || !frames[index].complete) return;

  const img = frames[index];

  if (needsCanvasMetricsUpdate || scaledRenderWidth === 0) {
    updateCanvasRenderMetrics(img);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, scaledOffsetX, scaledOffsetY, scaledRenderWidth, scaledRenderHeight);

  lastRenderedFrameIndex = index;
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
    const scrollProgress = maxScroll > 0 ? clamp(currentScrollY / maxScroll, 0, 1) : 0;

    currentFrameIndex = scrollProgress * (TOTAL_FRAMES - 1);

    const frameToRender = Math.round(currentFrameIndex);
    renderFrame(frameToRender);

    const isMobile = viewportW <= 768;

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
          setElementStyle(cachedHeroGrid, 'opacity', '1');
          setElementStyle(cachedHeroGrid, 'transform', 'translateY(0px) scale(1)');
          setElementStyle(cachedHeroGrid, 'filter', 'none');
          setElementStyle(cachedHeroGrid, 'pointerEvents', 'auto');
        } else if (heroExitProgress < 1) {
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
          setElementStyle(cachedHeroGrid, 'opacity', '0');
          setElementStyle(cachedHeroGrid, 'pointerEvents', 'none');
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
      }
    }
  }

  requestAnimationFrame(animate);
}

// Throttled Resize Event Handler
let resizeTimeout = null;
function handleResize() {
  if (resizeTimeout) cancelAnimationFrame(resizeTimeout);
  resizeTimeout = requestAnimationFrame(() => {
    resizeCanvas();
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

  await preloadImages();

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
}

init();

