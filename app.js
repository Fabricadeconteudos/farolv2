// State Management
let appData = {
  courses: [],
  professors: [],
  distratos_all: [],
  restricoes_all: []
};

let currentState = {
  activeTab: 'dashboard',
  
  // Catalog filter state
  catalogCategory: 'all',
  catalogSearch: '',
  catalogSort: 'name-asc',
  catalogOnlyPending: false,
  catalogPage: 1,
  pageSize: 24,
  
  // Professors filter state
  professorsSearch: '',
  professorsOnlyWarning: false,
  professorsPage: 1,
  profPageSize: 32
};

// Map sheet names to friendly names (mirroring python parser)
const categoryNamesMap = {
  ' PILOTO 1': 'Graduação - Piloto 1',
  'PILOTO 1.1': 'Graduação - Piloto 1.1',
  'PILOTO - Núcleo 02': 'Pós-Graduação - Núcleo 02',
  'PÓS + - Núcleo 4': 'Pós-Graduação - Núcleo 04',
  'NIVELAMENTO': 'Nivelamento',
  'PSICANÁLISE - MATRIZ NOVA': 'Psicanálise - Matriz Nova',
  'Núcleo 02 Pós - TOP10': 'Pós-Graduação - TOP10',
  'PSICANÁLISE': 'Psicanálise',
  'Núcleo 3 Cursos livres': 'Cursos Livres'
};

// Helper: Check if status represents completion
function isCompletedStatus(status) {
  if (!status) return false;
  const s = status.toString().trim().toLowerCase();
  return [
    'ok', 'pg', 'liberado', 'concluído', 'concluido', 
    'disciplina pronta', 'subir realize', 'sim', 'pronto'
  ].includes(s);
}

// Helper: Calculate progress for a course
function calculateCourseProgress(course) {
  let total = 0;
  let completed = 0;
  
  course.disciplines.forEach(disc => {
    Object.entries(disc.status).forEach(([key, value]) => {
      // Exclude payment or metadata fields from completion calculation
      if (['pagamento', 'conclusao', 'email', 'contato whatsapp', 'convites', 'contratos'].includes(key)) {
        return;
      }
      total++;
      if (isCompletedStatus(value)) {
        completed++;
      }
    });
  });
  
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

// Fetch and load data
document.addEventListener('DOMContentLoaded', () => {
  fetch('data.json')
    .then(response => {
      if (!response.ok) {
        throw new Error('Erro ao carregar dados do catálogo');
      }
      return response.json();
    })
    .then(data => {
      appData = data;
      initDashboard();
    })
    .catch(err => {
      console.error(err);
      const metricsSummary = document.getElementById('metrics-summary');
      if (metricsSummary) {
        metricsSummary.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3>Falha ao carregar catálogo</h3>
            <p>Verifique se o arquivo 'data.json' existe na pasta do projeto e recarregue a página.</p>
          </div>
        `;
      }
    });
});

// Switch active tab view
window.switchTab = function(tabName) {
  currentState.activeTab = tabName;
  
  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  const activeNavItem = document.getElementById(`nav-${tabName}`);
  if (activeNavItem) activeNavItem.classList.add('active');
  
  // Switch visible pane
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  const activePane = document.getElementById(`pane-${tabName}`);
  if (activePane) activePane.classList.add('active');
  
  // Dynamic header titles
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  
  if (tabName === 'dashboard') {
    pageTitle.textContent = 'Painel Geral';
    pageSubtitle.textContent = 'Visão unificada da produção de materiais didáticos e contratação de professores';
    renderDashboardCategories();
  } else if (tabName === 'catalog') {
    pageTitle.textContent = 'Catálogo de Produtos';
    pageSubtitle.textContent = 'Explore as matrizes curriculares, disciplinas e progresso do conteúdo';
    renderCatalogCategoriesBar();
    applyCatalogFilters(true);
  } else if (tabName === 'professors') {
    pageTitle.textContent = 'Diretório de Professores';
    pageSubtitle.textContent = 'Consulte o corpo docente, contatos diretos e restrições administrativas';
    applyProfessorsFilters(true);
  } else if (tabName === 'alerts') {
    pageTitle.textContent = 'Alertas Administrativos';
    pageSubtitle.textContent = 'Lista consolidada de restrições de contratação e distratos históricos';
    renderAlerts();
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Initialize Dashboard tab
function initDashboard() {
  // 1. Calculate Metrics
  const totalCourses = appData.courses.length;
  let totalDisciplines = 0;
  let totalDeliverables = 0;
  let completedDeliverables = 0;
  
  appData.courses.forEach(c => {
    totalDisciplines += c.disciplines.length;
    c.disciplines.forEach(disc => {
      Object.entries(disc.status).forEach(([key, value]) => {
        if (['pagamento', 'conclusao', 'email', 'contato whatsapp', 'convites', 'contratos'].includes(key)) {
          return;
        }
        totalDeliverables++;
        if (isCompletedStatus(value)) {
          completedDeliverables++;
        }
      });
    });
  });
  
  const totalProfessors = appData.professors.length;
  const overallProgress = totalDeliverables > 0 ? Math.round((completedDeliverables / totalDeliverables) * 100) : 0;
  
  // 2. Set stats values in DOM
  document.getElementById('stat-courses').textContent = totalCourses.toLocaleString();
  document.getElementById('stat-disciplines').textContent = totalDisciplines.toLocaleString();
  document.getElementById('stat-professors').textContent = totalProfessors.toLocaleString();
  document.getElementById('stat-completion').textContent = `${overallProgress}%`;
  
  // Render categories distribution cards
  renderDashboardCategories();
}

// Render the categories summary cards on Dashboard
function renderDashboardCategories() {
  const container = document.getElementById('dashboard-categories-distribution');
  if (!container) return;
  
  // Group courses by category
  const categoriesMap = {};
  appData.courses.forEach(c => {
    if (!categoriesMap[c.category]) {
      categoriesMap[c.category] = {
        name: c.category,
        sheet: c.sheet,
        coursesCount: 0,
        disciplinesCount: 0,
        totalDeliverables: 0,
        completedDeliverables: 0
      };
    }
    
    categoriesMap[c.category].coursesCount++;
    categoriesMap[c.category].disciplinesCount += c.disciplines.length;
    
    c.disciplines.forEach(disc => {
      Object.entries(disc.status).forEach(([key, value]) => {
        if (['pagamento', 'conclusao', 'email', 'contato whatsapp', 'convites', 'contratos'].includes(key)) return;
        categoriesMap[c.category].totalDeliverables++;
        if (isCompletedStatus(value)) {
          categoriesMap[c.category].completedDeliverables++;
        }
      });
    });
  });
  
  container.innerHTML = '';
  
  Object.values(categoriesMap).forEach(cat => {
    const progress = cat.totalDeliverables > 0 ? Math.round((cat.completedDeliverables / cat.totalDeliverables) * 100) : 0;
    
    const card = document.createElement('div');
    card.className = 'course-card';
    card.onclick = () => {
      // Filter catalog by this category
      currentState.catalogCategory = cat.name;
      switchTab('catalog');
    };
    
    card.innerHTML = `
      <span class="course-badge">${cat.name}</span>
      <h3 class="course-title" style="min-height: auto; margin-top: 0.5rem;">${cat.name}</h3>
      
      <div class="progress-bar-container" style="margin-top: 0.5rem;">
        <div class="progress-label-row">
          <span>Produção Concluída</span>
          <span>${progress}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>
      
      <div class="course-details-row" style="margin-top: 0.5rem;">
        <div class="course-detail-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>${cat.coursesCount} Cursos</span>
        </div>
        <div class="course-detail-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>${cat.disciplinesCount} Disciplinas</span>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// Render category chips in Catalog Tab
function renderCatalogCategoriesBar() {
  const container = document.getElementById('catalog-categories-bar');
  if (!container) return;
  
  // Extract unique categories
  const categories = ['all', ...new Set(appData.courses.map(c => c.category))];
  
  container.innerHTML = '';
  
  categories.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = `category-chip ${currentState.catalogCategory === cat ? 'active' : ''}`;
    chip.textContent = cat === 'all' ? 'Todas as Categorias' : cat;
    chip.onclick = () => {
      currentState.catalogCategory = cat;
      // update active classes
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyCatalogFilters(true);
    };
    container.appendChild(chip);
  });
}

// Toggle "Apenas Pendentes" filter in Catalog
window.togglePendingFilter = function() {
  currentState.catalogOnlyPending = !currentState.catalogOnlyPending;
  const btn = document.getElementById('btn-filter-pending');
  if (currentState.catalogOnlyPending) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
  applyCatalogFilters(true);
};

// Filter & Sort Catalog Data
let filteredCourses = [];
window.applyCatalogFilters = function(resetPage = false) {
  if (resetPage) {
    currentState.catalogPage = 1;
  }
  
  const searchInput = document.getElementById('catalog-search');
  currentState.catalogSearch = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  const sortSelect = document.getElementById('catalog-sort');
  currentState.catalogSort = sortSelect ? sortSelect.value : 'name-asc';
  
  // 1. Filter
  filteredCourses = appData.courses.filter(c => {
    // Filter by category
    if (currentState.catalogCategory !== 'all' && c.category !== currentState.catalogCategory) {
      return false;
    }
    
    // Filter by text search
    if (currentState.catalogSearch) {
      const matchCourseName = c.name.toLowerCase().includes(currentState.catalogSearch);
      
      const matchDisciplineName = c.disciplines.some(d => 
        d.name.toLowerCase().includes(currentState.catalogSearch)
      );
      
      const matchProfessorName = c.disciplines.some(d => 
        d.professor.toLowerCase().includes(currentState.catalogSearch)
      );
      
      if (!matchCourseName && !matchDisciplineName && !matchProfessorName) {
        return false;
      }
    }
    
    // Filter by only pending progress (< 100%)
    if (currentState.catalogOnlyPending) {
      const progress = calculateCourseProgress(c);
      if (progress >= 100) return false;
    }
    
    return true;
  });
  
  // 2. Sort
  filteredCourses.sort((a, b) => {
    if (currentState.catalogSort === 'name-asc') {
      return a.name.localeCompare(b.name);
    } else if (currentState.catalogSort === 'name-desc') {
      return b.name.localeCompare(a.name);
    } else if (currentState.catalogSort === 'disc-desc') {
      return b.disciplines.length - a.disciplines.length;
    } else if (currentState.catalogSort === 'disc-asc') {
      return a.disciplines.length - b.disciplines.length;
    } else if (currentState.catalogSort === 'progress-desc') {
      return calculateCourseProgress(b) - calculateCourseProgress(a);
    } else if (currentState.catalogSort === 'progress-asc') {
      return calculateCourseProgress(a) - calculateCourseProgress(b);
    }
    return 0;
  });
  
  renderCatalogGrid();
};

// Render the grid of catalog items
function renderCatalogGrid() {
  const grid = document.getElementById('catalog-grid');
  const paginBtn = document.getElementById('catalog-pagination');
  if (!grid) return;
  
  if (filteredCourses.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3>Nenhum curso encontrado</h3>
        <p>Tente alterar sua busca ou os filtros aplicados.</p>
      </div>
    `;
    if (paginBtn) paginBtn.style.display = 'none';
    return;
  }
  
  const endIdx = currentState.catalogPage * currentState.pageSize;
  const coursesToRender = filteredCourses.slice(0, endIdx);
  
  grid.innerHTML = '';
  
  coursesToRender.forEach(c => {
    const progress = calculateCourseProgress(c);
    
    const card = document.createElement('div');
    card.className = 'course-card';
    card.onclick = () => openCourseDrawer(c);
    
    card.innerHTML = `
      <span class="course-badge">${c.category}</span>
      <h3 class="course-title" title="${c.name}">${c.name}</h3>
      
      <div class="progress-bar-container">
        <div class="progress-label-row">
          <span>Aproveitamento</span>
          <span>${progress}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>
      
      <div class="course-details-row">
        <div class="course-detail-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>${c.disciplines.length} disciplinas</span>
        </div>
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  // Show / hide pagination button
  if (paginBtn) {
    if (filteredCourses.length > endIdx) {
      paginBtn.style.display = 'flex';
    } else {
      paginBtn.style.display = 'none';
    }
  }
}

// Load more courses (Pagination)
window.loadMoreCourses = function() {
  currentState.catalogPage++;
  renderCatalogGrid();
};

// ==================== DRAWER MODULE: COURSE DETAILS ====================
let activeCourse = null;
window.openCourseDrawer = function(course) {
  activeCourse = course;
  
  const drawerBackdrop = document.getElementById('course-drawer-backdrop');
  const drawer = document.getElementById('course-drawer');
  
  document.getElementById('drawer-course-badge').textContent = course.category;
  document.getElementById('drawer-course-title').textContent = course.name;
  
  const discCount = course.disciplines.length;
  document.getElementById('drawer-course-discipline-count').textContent = `${discCount} ${discCount === 1 ? 'disciplina' : 'disciplinas'}`;
  
  const progress = calculateCourseProgress(course);
  document.getElementById('drawer-course-progress-text').textContent = `${progress}% concluído`;
  
  // Populate disciplines list
  const discListContainer = document.getElementById('drawer-disciplines-list');
  discListContainer.innerHTML = '';
  
  course.disciplines.forEach(disc => {
    const card = document.createElement('div');
    card.className = 'discipline-item-card';
    
    // Period block
    const periodHtml = disc.period ? `<span class="discipline-period">${disc.period}</span>` : '';
    
    // Professor clickable row
    let profHtml = '<span style="font-size:0.85rem; color: var(--text-muted);">Sem professor indicado</span>';
    if (disc.professor && disc.professor !== 'None') {
      profHtml = `
        <div class="discipline-prof-row" onclick="openProfessorDetailsByName('${disc.professor.replace(/'/g, "\\'")}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span style="font-weight: 500;">${disc.professor}</span>
        </div>
      `;
    }
    
    // Render statuses
    let statusBadgesHtml = '';
    Object.entries(disc.status).forEach(([matName, matVal]) => {
      // Exclude payments and metadata
      if (['pagamento', 'conclusao'].includes(matName)) return;
      
      const cleanVal = (matVal || '').toString().trim();
      let statusClass = 'status-neutro';
      
      if (isCompletedStatus(cleanVal)) {
        statusClass = 'status-ok';
      } else if (['ajustes'].includes(cleanVal.toLowerCase())) {
        statusClass = 'status-ajustes';
      } else if (['análise', 'analise', 'entregue'].includes(cleanVal.toLowerCase())) {
        statusClass = 'status-analise';
      } else if (['atrasado', 'atraso'].includes(cleanVal.toLowerCase())) {
        statusClass = 'status-atrasado';
      }
      
      statusBadgesHtml += `
        <div class="material-status-badge ${statusClass}">
          <span class="material-label">${matName.replace('_', ' ')}</span>
          <span class="status-indicator">${cleanVal || 'Pendente'}</span>
        </div>
      `;
    });
    
    card.innerHTML = `
      <div class="discipline-header">
        <h4 class="discipline-name">${disc.name}</h4>
        ${periodHtml}
      </div>
      ${profHtml}
      <div class="discipline-status-grid">
        ${statusBadgesHtml}
      </div>
    `;
    
    discListContainer.appendChild(card);
  });
  
  drawerBackdrop.classList.add('open');
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden'; // Lock background scrolling
};

window.closeCourseDrawer = function() {
  const drawerBackdrop = document.getElementById('course-drawer-backdrop');
  const drawer = document.getElementById('course-drawer');
  
  if (drawerBackdrop) drawerBackdrop.classList.remove('open');
  if (drawer) drawer.classList.remove('open');
  document.body.style.overflow = 'auto'; // Unlock body scrolling
};

// Open Professor Card by Name
window.openProfessorDetailsByName = function(profName) {
  // Heuristic: Check if there's a compound string and match name
  // Try to find exact match first
  let prof = appData.professors.find(p => p.name === profName);
  
  if (!prof) {
    // try case-insensitive partial match
    prof = appData.professors.find(p => p.name.toLowerCase().includes(profName.toLowerCase()) || profName.toLowerCase().includes(p.name.toLowerCase()));
  }
  
  if (prof) {
    openProfessorModal(prof);
  } else {
    // If not found in aggregated list, generate a temporary mock prof object to show name
    openProfessorModal({
      name: profName,
      email: '',
      whatsapp: '',
      has_restriction: false,
      restriction: null,
      distratos: [],
      disciplines: []
    });
  }
};

// ==================== TAB 3: PROFESSORS LOGIC ====================
window.toggleProfWarningFilter = function() {
  currentState.professorsOnlyWarning = !currentState.professorsOnlyWarning;
  const btn = document.getElementById('btn-prof-warning');
  if (currentState.professorsOnlyWarning) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
  applyProfessorsFilters(true);
};

let filteredProfessors = [];
window.applyProfessorsFilters = function(resetPage = false) {
  if (resetPage) {
    currentState.professorsPage = 1;
  }
  
  const searchInput = document.getElementById('professors-search');
  currentState.professorsSearch = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  filteredProfessors = appData.professors.filter(p => {
    // Search query
    if (currentState.professorsSearch) {
      const matchName = p.name.toLowerCase().includes(currentState.professorsSearch);
      const matchDisc = p.disciplines.some(d => d.discipline.toLowerCase().includes(currentState.professorsSearch));
      const matchCourse = p.disciplines.some(d => d.course.toLowerCase().includes(currentState.professorsSearch));
      
      if (!matchName && !matchDisc && !matchCourse) return false;
    }
    
    // Active restrictions filter
    if (currentState.professorsOnlyWarning && !p.has_restriction) {
      return false;
    }
    
    return true;
  });
  
  // Sort professors alphabetically by name
  filteredProfessors.sort((a, b) => a.name.localeCompare(b.name));
  
  renderProfessorsGrid();
};

function renderProfessorsGrid() {
  const grid = document.getElementById('professors-grid');
  const paginBtn = document.getElementById('professors-pagination');
  if (!grid) return;
  
  if (filteredProfessors.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3>Nenhum professor encontrado</h3>
        <p>Altere a busca ou os filtros aplicados.</p>
      </div>
    `;
    if (paginBtn) paginBtn.style.display = 'none';
    return;
  }
  
  const endIdx = currentState.professorsPage * currentState.profPageSize;
  const profsToRender = filteredProfessors.slice(0, endIdx);
  
  grid.innerHTML = '';
  
  profsToRender.forEach(p => {
    // Generate restriction badge
    const restHtml = p.has_restriction ? `
      <div class="prof-card-restriction-badge">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Restrição</span>
      </div>
    ` : '';
    
    const discCount = p.disciplines_count || p.disciplines.length;
    
    const card = document.createElement('div');
    card.className = 'prof-directory-card';
    
    card.innerHTML = `
      <div class="prof-card-header">
        <h4 class="prof-card-name">${p.name}</h4>
        ${restHtml}
      </div>
      
      <div class="prof-card-info-row" style="margin-top: 0.5rem;">
        <span>Cursos / Disciplinas</span>
        <span style="font-weight: 600;">${discCount} ativas</span>
      </div>
      
      <div class="prof-card-actions" style="margin-top: 1rem;">
        <button class="prof-action-btn details-btn" onclick="openProfessorDetailsByName('${p.name.replace(/'/g, "\\'")}')">
          <span>Ver Contatos & Ficha</span>
        </button>
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  if (paginBtn) {
    if (filteredProfessors.length > endIdx) {
      paginBtn.style.display = 'flex';
    } else {
      paginBtn.style.display = 'none';
    }
  }
}

window.loadMoreProfessors = function() {
  currentState.professorsPage++;
  renderProfessorsGrid();
};

// ==================== PROFESSOR MODAL DETAILS VIEW ====================
window.openProfessorModal = function(prof) {
  const backdrop = document.getElementById('prof-modal-backdrop');
  
  document.getElementById('prof-modal-name').textContent = prof.name;
  
  // 1. WhatsApp contact
  const waLink = document.getElementById('prof-whatsapp-link');
  const waText = document.getElementById('prof-whatsapp-text');
  if (prof.whatsapp && prof.whatsapp !== 'None') {
    // format phone number for whatsapp link (wa.me)
    const cleanPhone = prof.whatsapp.toString().replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    waLink.href = `https://wa.me/${phoneWithCountry}`;
    waLink.style.pointerEvents = 'auto';
    waText.textContent = `Chamar no WhatsApp (${prof.whatsapp})`;
  } else {
    waLink.href = '#';
    waLink.style.pointerEvents = 'none';
    waText.textContent = 'WhatsApp não cadastrado';
  }
  
  // 2. Email contact
  const emailLink = document.getElementById('prof-email-link');
  const emailText = document.getElementById('prof-email-text');
  if (prof.email && prof.email !== 'None') {
    emailLink.href = `mailto:${prof.email}`;
    emailLink.style.pointerEvents = 'auto';
    emailText.textContent = prof.email;
  } else {
    emailLink.href = '#';
    emailLink.style.pointerEvents = 'none';
    emailText.textContent = 'E-mail não cadastrado';
  }
  
  // 3. Restriction warning banner
  const warningBanner = document.getElementById('prof-warning-banner');
  if (prof.has_restriction) {
    document.getElementById('prof-warning-reason').textContent = prof.restriction || 'Motivo não documentado.';
    warningBanner.style.display = 'flex';
  } else {
    warningBanner.style.display = 'none';
  }
  
  // 4. Distratos histories banner
  const distratoBanner = document.getElementById('prof-distrato-banner');
  const distratoText = document.getElementById('prof-distrato-details');
  if (prof.distratos && prof.distratos.length > 0) {
    const listStr = prof.distratos.map(d => 
      `- ${d.discipline || 'Disciplina'} (${d.offer || 'Oferta'}): ${d.reason || 'Pedido de distrato'}`
    ).join('<br>');
    distratoText.innerHTML = listStr;
    distratoBanner.style.display = 'flex';
  } else {
    distratoBanner.style.display = 'none';
  }
  
  // 5. Assigned disciplines tags
  const listContainer = document.getElementById('prof-assigned-list');
  listContainer.innerHTML = '';
  if (prof.disciplines && prof.disciplines.length > 0) {
    prof.disciplines.forEach(d => {
      const tag = document.createElement('div');
      tag.className = 'assigned-course-tag';
      tag.innerHTML = `
        <div>
          <div style="font-weight: 500;">${d.discipline}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${d.course}</div>
        </div>
        <span class="assigned-course-category">${d.category}</span>
      `;
      listContainer.appendChild(tag);
    });
  } else {
    listContainer.innerHTML = '<div style="color: var(--text-muted); font-size:0.85rem; padding: 0.5rem 0;">Nenhuma disciplina ativa encontrada no Farol para este professor.</div>';
  }
  
  backdrop.classList.add('open');
};

window.closeProfModal = function() {
  const backdrop = document.getElementById('prof-modal-backdrop');
  if (backdrop) backdrop.classList.remove('open');
};

// ==================== TAB 4: ALERTS AND RESTRICTIONS LOG ====================
function renderAlerts() {
  const restContainer = document.getElementById('restricoes-list-container');
  const distContainer = document.getElementById('distratos-list-container');
  
  if (restContainer) {
    if (appData.restricoes_all.length === 0) {
      restContainer.innerHTML = '<div style="color: var(--text-muted); font-size:0.9rem; padding: 1.5rem; text-align:center;">Nenhuma restrição registrada.</div>';
    } else {
      restContainer.innerHTML = '';
      appData.restricoes_all.forEach(r => {
        const card = document.createElement('div');
        card.className = 'alert-row-card';
        card.innerHTML = `
          <div class="alert-row-header">
            <span class="alert-row-name">${r.professor}</span>
          </div>
          <p class="alert-row-reason">${r.reason || 'Restrição contratual geral (Não Contratar).'}</p>
        `;
        restContainer.appendChild(card);
      });
    }
  }
  
  if (distContainer) {
    if (appData.distratos_all.length === 0) {
      distContainer.innerHTML = '<div style="color: var(--text-muted); font-size:0.9rem; padding: 1.5rem; text-align:center;">Nenhum distrato registrado.</div>';
    } else {
      distContainer.innerHTML = '';
      appData.distratos_all.forEach(d => {
        const card = document.createElement('div');
        card.className = 'alert-row-card';
        card.innerHTML = `
          <div class="alert-row-header">
            <span class="alert-row-name">${d.professor}</span>
            <span class="alert-row-date">${d.date || ''}</span>
          </div>
          <p class="alert-row-reason" style="border-left-color: #fb923c;">${d.reason || 'Distrato solicitado pelo docente.'}</p>
          <div class="alert-row-details">
            <span><strong>Disciplina:</strong> ${d.discipline}</span>
            <span><strong>Oferta:</strong> ${d.offer || 'N/A'}</span>
          </div>
        `;
        distContainer.appendChild(card);
      });
    }
  }
}
