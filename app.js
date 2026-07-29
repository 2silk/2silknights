/**
 * 2silk作品集 - 页面切换与阅读器逻辑
 * 新架构：每个页面独立固定定位，独立滚动容器
 */

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM 引用 =====
  const sideNav = document.getElementById('sideNav');
  const menuToggle = document.getElementById('menuToggle');
  const overlay = document.getElementById('overlay');
  const navLinks = document.querySelectorAll('.nav-link');
  const pages = document.querySelectorAll('.page-container');
  const readerToc = document.getElementById('readerToc');
  const readerTocToggle = document.getElementById('readerTocToggle');
  const readerTocBackdrop = document.getElementById('readerTocBackdrop');

  // ===== 状态 =====
  let currentPage = 'home';
  let readerState = null;

  function setMobileReaderToc(open) {
    const isMobile = window.matchMedia('(max-width: 1024px)').matches;
    const shouldOpen = Boolean(open && isMobile && currentPage === 'reader');
    document.body.classList.toggle('reader-toc-open', shouldOpen);
    if (readerTocToggle) {
      readerTocToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }
  }

  function closeMobileReaderToc() {
    setMobileReaderToc(false);
  }

  // ===== 页面切换 =====
  function switchPage(pageId) {
    // 更新当前页面
    currentPage = pageId;

    // 隐藏所有页面
    pages.forEach(page => {
      page.classList.remove('active');
    });

    // 显示目标页面
    const target = document.getElementById(`container-${pageId}`);
    if (target) {
      target.classList.add('active');
      // 重置该页面的滚动位置
      const scrollArea = target.querySelector('.page-scroll, .reader-scroll, .h5-scroll');
      if (scrollArea) {
        scrollArea.scrollTop = 0;
      }
    }

    // 更新导航状态
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.page === pageId);
    });

    // 更新阅读器模式
    document.body.classList.toggle('reader-mode', pageId === 'reader');

    // 关闭菜单
    closeMenu();
    closeMobileReaderToc();

    // 更新当前页
    currentPage = pageId;

    // 离开河海津韵时关闭注释
    if (pageId !== 'hehaijinyun') {
      document.querySelectorAll('#container-hehaijinyun .h5-note').forEach(n => n.classList.remove('open'));
    }
  }

  // ===== 移动端菜单 =====
  function toggleMenu() {
    sideNav.classList.toggle('open');
    overlay.classList.toggle('show');
  }

  function closeMenu() {
    sideNav.classList.remove('open');
    overlay.classList.remove('show');
  }

  // ===== 作品卡片渲染 =====
  function renderWorks(category, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const works = WORKS_DATA?.[category];
    if (!works || works.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-dim);padding:40px;">暂无作品</p>';
      return;
    }

    container.innerHTML = works.map(work => {
      const wordCountStr = work.wordCount >= 10000
        ? `${(work.wordCount / 10000).toFixed(1)}万字`
        : `${work.wordCount}字`;

      const icons = {
        star: '†', moon: '◐', ocean: '≋',
        crown: '♛', leaf: '❦', fire: '❡', skull: '☠',
        clock: '◷', sun: '☉', mask: '◇', food: '§',
        dice: '◆', wave: '≋', brain: '◈',
        wand: '※', star2: '☆', heart: '♥'
      };
      const icon = work.pixelBg && icons[work.pixelBg] ? icons[work.pixelBg] : '◆';

      // 游戏卡片：显示外部链接而非字数
      const metaRight = work.url
        ? `<a href="${work.url}" target="_blank" class="card-link" onclick="event.stopPropagation()">去玩 →</a>`
        : `<span>${wordCountStr}</span>`;

      return `
        <div class="work-card${work.cover ? ' has-cover' : ''}" data-id="${work.id}" data-category="${category}">
          ${work.cover ? `<div class="card-cover"><img src="${work.cover}" alt="${work.title}" loading="lazy"></div>` : ''}
          <div class="card-top">
            ${!work.cover ? `<div class="pixel-avatar">${icon}</div>` : ''}
            <div class="card-title-group">
              <span class="card-tag">${work.type}</span>
              <h3 class="card-title">${work.title}</h3>
              ${work.fandom ? `<p class="card-fandom">${work.fandom}</p>` : ''}
            </div>
          </div>
          <p class="card-summary">${work.summary}</p>
          <div class="card-tags">
            ${work.tags.map(t => `<span>${t}</span>`).join('')}
          </div>
          <div class="card-meta">
            <span>${work.date}</span>
            ${metaRight}
          </div>
        </div>
      `;
    }).join('');

    // 绑定点击事件
    container.querySelectorAll('.work-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const category = card.dataset.category;
        const work = WORKS_DATA[category]?.find(w => w.id === id);
        if (work) {
          if (work.id === 'og5') {
            switchPage('hehaijinyun');
            history.pushState(null, '', '#hehaijinyun');
          } else if (work.url) {
            window.open(work.url, '_blank');
          } else {
            openReader(work, category);
          }
        }
      });
    });
  }

  // ===== 阅读器 =====
  function openReader(work, category) {
    // 规范化内容格式
    let sections = [];
    if (Array.isArray(work.content)) {
      sections = work.content.map(item =>
        typeof item === 'string' ? { type: 'text', text: item } : item
      );
    } else if (work.content) {
      sections = [{ type: 'text', text: work.content }];
    }

    // 把番外章节分离出来，放在藏头诗之后渲染
    let extraSections = [];
    const extraIndex = sections.findIndex(sec => sec.type === 'heading' && /^番外\b/.test((sec.text || '').trim()));
    if (extraIndex !== -1) {
      extraSections = sections.slice(extraIndex);
      sections = sections.slice(0, extraIndex);
    }

    const article = document.getElementById('readerArticle');
    const tocList = document.getElementById('readerTocList');
    const readerScroll = document.getElementById('readerScroll');

    article.innerHTML = '';
    article.className = 'reader-article';
    article.dataset.category = category;
    tocList.innerHTML = '';

    const chapters = [];
    const acrosticChars = [];
    let figureIndex = 0;

    const categoryLabels = {
      fanworks: '同人作品',
      originals: '原创作品',
      games: 'AVG作品',
      gameAnalysis: '游戏拆解'
    };

    function formatWordCount(value) {
      if (typeof value === 'number') {
        return value >= 10000 ? `${(value / 10000).toFixed(1)}万字` : `${value}字`;
      }
      if (typeof value === 'string') {
        return /字$/.test(value) ? value : `${value}字`;
      }
      return '';
    }

    // 合并所有标签（来源 + 原tags，避免重复）
    const allTags = [
      ...(work.fandom ? [work.fandom] : []),
      ...work.tags.filter(t => t !== work.fandom)
    ];

    const readerEyebrow = category === 'gameAnalysis'
      ? '旧报副刊 · 游戏拆解'
      : `作品阅读 · ${categoryLabels[category] || work.type}`;
    const aboutLabel = category === 'gameAnalysis' ? '本期导语' : '关于本作';
    const wordCountLabel = formatWordCount(work.wordCount);

    // 渲染文章头部
    const header = document.createElement('div');
    header.className = 'reader-article-header';
    header.innerHTML = `
      <div class="reader-kicker">${readerEyebrow}</div>
      <h1 class="reader-article-title">${work.title}</h1>
      <div class="reader-article-meta">
        <span>${work.type}</span>
        <span>${work.date}</span>
      </div>
      <div class="reader-article-tags">
        ${allTags.map(t => `<span>${t}</span>`).join('')}
      </div>
    `;
    article.appendChild(header);

    // 关于本作（移到最前面）
    const aboutIntro = document.createElement('div');
    aboutIntro.className = 'reader-about';
    aboutIntro.innerHTML = `
      <div class="reader-about-label">${aboutLabel}</div>
      <p class="reader-about-text">${work.summary}</p>
      <div class="reader-about-meta">
        <span>${work.type}</span>
        ${wordCountLabel ? `<span>${wordCountLabel}</span>` : ''}
        <span>${work.date}</span>
      </div>
      <div class="reader-about-tags">
        ${allTags.map(t => `<span>${t}</span>`).join('')}
      </div>
    `;
    article.appendChild(aboutIntro);

    // 简单 Markdown 转换
    function renderMarkdown(text) {
      return text
        // 图片标记 ![alt](url) — 但不会在 text 块中出现，预留
        // 链接 [text](url)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // 粗体 **text**
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // 斜体 *text*（排除 **）
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
        // 行内代码 `code`
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // 分隔线 ---（独立成段）
        .replace(/^---+$/gm, '<hr>');
    }

    // 渲染图片组
    function renderImageGroup(images) {
      const group = document.createElement('div');
      group.className = `reader-image-group count-${Math.min(images.length, 4)}`;

      images.forEach(imageSec => {
        figureIndex += 1;

        const wrapper = document.createElement('figure');
        wrapper.className = 'reader-image-wrapper';

        const img = document.createElement('img');
        img.src = imageSec.src || '';
        img.alt = (imageSec.caption || '').replace(/^图：/, '');
        img.className = 'reader-image';
        wrapper.appendChild(img);

        const cap = document.createElement('figcaption');
        cap.className = 'reader-caption';
        const label = `图 ${String(figureIndex).padStart(2, '0')}`;
        cap.innerHTML = imageSec.caption
          ? `<span class="reader-caption-label">${label}</span><span class="reader-caption-text">${imageSec.caption}</span>`
          : `<span class="reader-caption-label">${label}</span>`;
        wrapper.appendChild(cap);

        group.appendChild(wrapper);
      });

      article.appendChild(group);
    }

    // 渲染章节 / 段落
    function renderBlock(sec) {
      // ---------- heading 类型 ----------
      if (sec.type === 'heading') {
        const h = document.createElement('h3');
        h.className = 'reader-chapter';
        h.id = `ch-${chapters.length}`;
        h.textContent = sec.text || '';
        article.appendChild(h);
        chapters.push({ id: `ch-${chapters.length}`, label: sec.text || '', rest: '' });
        return;
      }

      const text = sec.text || '';
      const trimmed = text.trim();

      // 分隔符
      if (trimmed === '♢' || trimmed === '◇' || trimmed === '◆') {
        const div = document.createElement('div');
        div.className = 'reader-divider';
        div.textContent = '· · ·';
        article.appendChild(div);
        return;
      }

      // 章节标题
      const match = text.match(/^(第[一二三四五六七八九十\d]+章|序章|终章|尾声|前言|后记|番外)\s*(.+)?$/);
      if (match) {
        const label = match[1];
        const rest = (match[2] || '').trim();

        const chapter = document.createElement('h2');
        chapter.className = 'reader-chapter';
        chapter.id = `ch-${chapters.length}`;

        if (rest && label !== '番外') {
          const firstChar = rest.charAt(0);
          acrosticChars.push(firstChar);
          chapter.innerHTML = `
            <span class="chapter-label">${label}</span>
            <span class="acrostic-char">${firstChar}</span>${rest.slice(1)}
          `;
        } else if (rest) {
          chapter.innerHTML = `
            <span class="chapter-label">${label}</span>${rest}
          `;
        } else {
          chapter.innerHTML = `<span class="chapter-label">${label}</span>`;
        }

        article.appendChild(chapter);

        // 添加到目录
        chapters.push({ id: `ch-${chapters.length}`, label, rest });
        return;
      }

      // 对话
      if (text.startsWith('"') || text.startsWith('「') || /^["「]/.test(text)) {
        const p = document.createElement('p');
        p.className = 'reader-dialogue';
        p.innerHTML = renderMarkdown(text);
        article.appendChild(p);
        return;
      }

      // 普通段落（用 innerHTML 渲染 Markdown）
      const p = document.createElement('p');
      p.className = 'reader-paragraph';
      p.innerHTML = renderMarkdown(text);
      article.appendChild(p);
    }

    function renderSections(blocks) {
      for (let i = 0; i < blocks.length; i++) {
        const sec = blocks[i];
        if (sec.type === 'image') {
          const images = [sec];
          while (i + 1 < blocks.length && blocks[i + 1].type === 'image') {
            images.push(blocks[i + 1]);
            i += 1;
          }
          renderImageGroup(images);
          continue;
        }
        renderBlock(sec);
      }
    }

    renderSections(sections);

    // 渲染目录
    chapters.forEach((ch, idx) => {
      const item = document.createElement('div');
      item.className = 'toc-item';
      item.textContent = `${ch.label} ${ch.rest || ''}`.trim();
      item.addEventListener('click', () => {
        const el = document.getElementById(ch.id);
        if (el && readerScroll) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
        closeMobileReaderToc();
      });
      tocList.appendChild(item);
    });

    // 番外
    if (extraSections.length) {
      renderSections(extraSections);
    }

    // 齿牙为猾特殊处理：藏头诗在阅读完所有章节后显示在目录中
    if (work.id === 'fw0' && acrosticChars.length >= 2) {
      const acrostic = acrosticChars.join('');
      const tocAcrostic = document.createElement('div');
      tocAcrostic.className = 'toc-acrostic';
      tocAcrostic.innerHTML = `
        <div class="toc-acrostic-label">藏头诗</div>
        <div class="toc-acrostic-text">${acrostic}</div>
      `;
      tocList.appendChild(tocAcrostic);

      // 默认隐藏，阅读完所有章节后显示
      tocAcrostic.classList.add('hidden');

      const seenChapters = new Set();
      const chapterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = entry.target.id.replace('ch-', '');
            seenChapters.add(idx);
            if (seenChapters.size >= chapters.length) {
              tocAcrostic.classList.remove('hidden');
              chapterObserver.disconnect();
            }
          }
        });
      }, { threshold: 0.1, root: readerScroll });

      chapters.forEach(ch => {
        const el = document.getElementById(ch.id);
        if (el) chapterObserver.observe(el);
      });
    }

    // 更新标题
    document.getElementById('readerTopTitle').textContent = work.title;

    // 保存状态
    readerState = { category, chapters };

    // 切换到阅读器
    switchPage('reader');

    // 确保滚动到顶部
    if (readerScroll) {
      readerScroll.scrollTop = 0;
    }
  }

  // ===== 关闭阅读器 =====
  function closeReader() {
    const from = readerState?.category || 'fanworks';
    switchPage(from);
    readerState = null;
  }

  // ===== 事件绑定 =====
  menuToggle?.addEventListener('click', toggleMenu);
  overlay?.addEventListener('click', closeMenu);

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = link.dataset.page;
      switchPage(pageId);
      history.pushState(null, '', `#${pageId}`);
    });
  });

  document.getElementById('readerBack')?.addEventListener('click', closeReader);
  readerTocToggle?.addEventListener('click', () => {
    const expanded = readerTocToggle.getAttribute('aria-expanded') === 'true';
    setMobileReaderToc(!expanded);
  });
  readerTocBackdrop?.addEventListener('click', closeMobileReaderToc);
  readerToc?.addEventListener('click', (event) => {
    if (event.target === readerToc) {
      closeMobileReaderToc();
    }
  });
  window.addEventListener('resize', closeMobileReaderToc);

  // 首页按钮特殊处理
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = btn.dataset.nav;
      switchPage(pageId);
      history.pushState(null, '', `#${pageId}`);
    });
  });

  // Hash 变化处理
  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '') || 'home';
    if (hash !== currentPage) {
      switchPage(hash);
    }
  });

  // 初始化
  renderWorks('fanworks', 'fanworksGrid');
  renderWorks('originals', 'originalsGrid');
  renderWorks('games', 'gamesGrid');
  renderWorks('gameAnalysis', 'gameAnalysisGrid');

  // 初始页面
  const initialHash = location.hash.replace('#', '') || 'home';
  switchPage(initialHash);

  // ===== 河海津韵 H5 内嵌逻辑 =====

// Hotspot footnote toggles
const h5Notes = document.querySelectorAll('#container-hehaijinyun .h5-note');

function closeH5Notes() {
  h5Notes.forEach(note => note.classList.remove('open'));
}

document.querySelectorAll('#container-hehaijinyun .h5-hotspot').forEach(hotspot => {
  hotspot.addEventListener('click', e => {
    e.stopPropagation();
    const note = hotspot.querySelector('.h5-note');
    const wasOpen = note && note.classList.contains('open');
    closeH5Notes();
    if (!wasOpen && note) note.classList.add('open');
  });
});

h5Notes.forEach(note => {
  const btn = note.querySelector('.h5-note-close');
  if (btn) {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      note.classList.remove('open');
    });
  }
  note.addEventListener('click', e => e.stopPropagation());
});

document.getElementById('h5Scroll')?.addEventListener('click', () => closeH5Notes());

function scrollToH5Section(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeH5Notes();
    closeMobileReaderToc();
  }
});

// Nav dot click
document.querySelectorAll('#container-hehaijinyun .h5-nav-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    const target = dot.dataset.target;
    if (target) scrollToH5Section(target);
  });
});

// Nav dot tracking
const h5Sections = ['h5-part1','h5-part2','h5-end'];
const h5Dots = document.querySelectorAll('#container-hehaijinyun .h5-nav-dot');
const h5Observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      h5Dots.forEach((d,i) => d.classList.toggle('active', h5Sections[i] === entry.target.id));
    }
  });
}, { threshold: 0.5 });
h5Sections.forEach(id => {
  const el = document.getElementById(id);
  if (el) h5Observer.observe(el);
});


// Expose H5 functions for inline onclick handlers
window.scrollToH5Section = scrollToH5Section;
window.closeH5Note = closeH5Notes;

// H5 back button
document.getElementById('h5Back')?.addEventListener('click', () => {
  closeH5Notes();
  switchPage('originals');
  history.pushState(null, '', '#originals');
});


  // 数字动画与首页统计
  const statItems = document.querySelectorAll('.stat-item');

  // 同步实际数量
  statItems.forEach(item => {
    const category = item.dataset.category;
    const numEl = item.querySelector('.stat-num');
    if (category && numEl && WORKS_DATA?.[category]) {
      const count = WORKS_DATA[category].length;
      numEl.dataset.count = count;
      numEl.textContent = count;
    }
  });

  // 点击统计项跳转对应页面
  statItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.dataset.page;
      if (pageId && pages) {
        switchPage(pageId);
        history.pushState(null, '', `#${pageId}`);
      }
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        const start = parseInt(el.textContent) || 0;
        let current = start;
        const step = Math.max(1, Math.ceil(target / 30));
        const timer = setInterval(() => {
          current += step;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          el.textContent = current;
        }, 30);
        observer.unobserve(el);
      }
    });
  });

  document.querySelectorAll('.stat-num').forEach(el => observer.observe(el));
});
