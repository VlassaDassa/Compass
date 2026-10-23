// Page structure lives here, independently of the saved color palette.
export function productShell({page,label,navItems,extraNav,navLink,icon,esc,center}){
  const primary=[navItems[0],navItems[1],navItems[3],navItems[4],extraNav[0]],secondary=[navItems[2],...extraNav.slice(1)];
  return `<aside class="sidebar product-sidebar" aria-label="Главная навигация">
    <a href="#/" class="brand"><span class="brand-mark">${icon('compass')}</span><span class="brand-name">Компас</span></a>
    <button class="workspace-picker" data-action="centers">${icon('building')}<span>${esc(center)}</span>${icon('down')}</button>
    <nav class="primary-navigation" aria-label="Разделы">${primary.map(item=>navLink(item)).join('')}</nav>
    <details class="nav-more" ${secondary.some(item=>item[0]===page)?'open':''}><summary>${icon('more')}<span>Ещё</span>${icon('down')}</summary><nav aria-label="Дополнительные разделы">${secondary.map(item=>navLink(item)).join('')}<button class="nav-link" data-action="notifications">${icon('history')}<span>Обновления</span></button><a href="#/start" class="nav-link">${icon('rocket')}<span>Первый день</span></a></nav></details>
    <div class="sidebar-spacer"></div><a href="#/settings" class="nav-link ${page==='settings'?'active':''}">${icon('settings')}<span>Настройки</span></a>
    <button class="profile" data-action="profile"><span class="avatar">${icon('users')}</span><span class="profile-name">Мой профиль</span>${icon('down')}</button>
  </aside>
  <div class="app-shell"><header class="topbar"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Открыть меню">${icon('menu')}</button><div class="breadcrumbs"><span class="parent">${esc(center)}</span>${icon('chevron')}<strong>${label}</strong></div>${page?`<button class="top-search" data-action="search">${icon('search')}<span>Поиск</span><kbd>Ctrl K</kbd></button>`:''}</header>
    <main id="main-content" class="content" data-page="${esc(page||'home')}" tabindex="-1"></main>
    <nav class="mobile-nav" aria-label="Быстрая навигация">${[navItems[0],navItems[1],navItems[3],navItems[4]].map(item=>navLink(item,true)).join('')}<button data-action="menu" aria-label="Все разделы">${icon('menu')}<span>Ещё</span></button></nav>
  </div>`;
}

export function homeView({titleRow,icon,articles,articleRow,footer}){
  return `<section class="desk-home workspace-intro">${titleRow('Обзор','Найдите инструкцию или продолжите работу.',true)}
    <button class="home-search" data-action="search">${icon('search')}<span>Поиск по базе знаний</span><kbd>Ctrl K</kbd></button>
    <section class="home-documents" aria-labelledby="recent-title"><div class="section-heading"><h2 id="recent-title">Последние обновления</h2><a href="#/knowledge" class="text-link">Все статьи ${icon('arrow')}</a></div>
      <div class="article-list">${articles.slice(0,6).map(articleRow).join('')||'<p class="muted">Здесь появятся опубликованные инструкции.</p>'}</div>
    </section>
    <a class="home-onboarding" href="#/start">${icon('rocket')}<span>Первый день в команде?<small>Короткий маршрут по основным инструкциям</small></span>${icon('chevron')}</a>
  </section>${footer()}`;
}

export const settingsTabs=[['general','Общее'],['appearance','Оформление'],['users','Доступ'],['ai','ИИ-помощник'],['integrations','Интеграции']];
export function settingsFrame({tab,titleRow,footer}){
  return `${titleRow('Настройки','Рабочее пространство и параметры приложения.',false)}<div class="settings-layout"><nav class="settings-menu" aria-label="Разделы настроек">${settingsTabs.map(([id,label])=>`<a href="#/settings?tab=${id}" class="nav-link ${tab===id?'active':''}" ${tab===id?'aria-current="page"':''}>${label}</a>`).join('')}</nav><div class="settings-content" id="settings-content" data-settings-tab="${tab}"></div></div>${footer()}`;
}

export function libraryFilters({params,categories,esc,icon}){
  return `<div class="toolbar library-toolbar"><label class="search-field">${icon('search')}<input id="library-search" type="search" placeholder="Поиск по статьям" aria-label="Поиск по статьям" value="${esc(params.get('q')||'')}"></label><details class="filter-disclosure" ${params.get('category')?'open':''}><summary>${icon('filter')}Фильтры ${icon('down')}</summary><div class="filter-fields"><div><label for="category-filter">Раздел</label><select class="field-select" id="category-filter"><option value="">Все разделы</option>${categories.map(c=>`<option value="${c.id}" ${params.get('category')===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div><label for="department-filter">Отдел</label><select class="field-select" id="department-filter"><option value="">Все отделы</option><option>Бухгалтерия</option><option>Отдел продаж</option><option>Отдел кадров</option><option>IT-поддержка</option></select></div><div><label for="sort-filter">Сортировка</label><select class="field-select" id="sort-filter"><option value="updated">Сначала новые</option><option value="title">По названию</option><option value="minutes">Быстрые инструкции</option></select></div></div></details></div>`;
}
