export type TemplateTab =
  | 'HQ'
  | 'World'
  | 'Calendar'
  | 'Play'
  | 'Training'
  | 'Roster'
  | 'Packs'
  | 'Scout'
  | 'Finance'
  | 'Inbox'
  | 'Profile'

const NAV_ITEMS: Array<{ tab: TemplateTab; label: string; short: string }> = [
  { tab: 'HQ', label: 'Home', short: 'H' },
  { tab: 'World', label: 'World circuit', short: 'W' },
  { tab: 'Calendar', label: 'Calendar', short: 'C' },
  { tab: 'Play', label: 'Matchday', short: 'M' },
  { tab: 'Training', label: 'Training', short: 'T' },
  { tab: 'Roster', label: 'Squad', short: 'S' },
  { tab: 'Scout', label: 'Transfers', short: 'X' },
  { tab: 'Packs', label: 'Packs', short: 'P' },
  { tab: 'Finance', label: 'Finances', short: 'F' },
  { tab: 'Inbox', label: 'News', short: 'N' },
  { tab: 'Profile', label: 'Manager', short: 'U' },
]

export function TemplateSidebar({
  active,
  unread,
  onOpen,
}: {
  active: TemplateTab
  unread: number
  onOpen: (tab: TemplateTab) => void
}) {
  return (
    <aside className="navbar navbar-vertical navbar-expand-lg template-sidebar" data-bs-theme="dark">
      <div className="container-fluid">
        <div className="navbar-brand navbar-brand-autodark">
          <button type="button" className="btn btn-ghost-light w-100 justify-content-start px-2" onClick={() => onOpen('HQ')}>
            <span className="avatar avatar-sm bg-orange-lt text-orange me-2">EA</span>
            <span className="d-flex flex-column align-items-start">
              <strong>ESPORT AI</strong>
              <small className="text-secondary">MANAGER</small>
            </span>
          </button>
        </div>

        <div className="collapse navbar-collapse show">
          <ul className="navbar-nav pt-lg-3">
            {NAV_ITEMS.map((item) => (
              <li className={'nav-item ' + (active === item.tab ? 'active' : '')} key={item.tab}>
                <button
                  type="button"
                  className={'nav-link w-100 text-start ' + (active === item.tab ? 'active' : '')}
                  onClick={() => onOpen(item.tab)}
                >
                  <span className="nav-link-icon d-md-none d-lg-inline-block">
                    <span className="avatar avatar-xs bg-secondary-lt">{item.short}</span>
                  </span>
                  <span className="nav-link-title">{item.label}</span>
                  {item.tab === 'Inbox' && unread > 0 && (
                    <span className="badge bg-orange-lt text-orange ms-auto">{unread}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-auto px-3 pb-3">
            <div className="card card-sm bg-transparent border-secondary">
              <div className="card-body py-2">
                <div className="text-secondary small">Template base</div>
                <div className="fw-bold">Tabler + Flowbite layout</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export function TemplateHeader({
  title,
  date,
  time,
  statusTitle,
  statusDetail,
  unread,
  managerLevel,
  managerPercent,
  credits,
  packTokens,
  onStatus,
  onInbox,
  onProfile,
  onFinance,
}: {
  title: string
  date: string
  time: string
  statusTitle: string
  statusDetail: string
  unread: number
  managerLevel: number
  managerPercent: number
  credits: string
  packTokens: string
  onStatus: () => void
  onInbox: () => void
  onProfile: () => void
  onFinance: () => void
}) {
  return (
    <header className="navbar navbar-expand-md d-print-none template-header" data-bs-theme="dark">
      <div className="container-fluid">
        <div className="navbar-nav me-auto align-items-center">
          <div className="nav-item">
            <div className="page-pretitle mb-0">{date} · {time}</div>
            <div className="page-title mb-0">{title}</div>
          </div>
        </div>

        <div className="navbar-nav flex-row align-items-center gap-2">
          <button type="button" className="btn btn-ghost-secondary d-none d-xl-flex flex-column align-items-start px-3" onClick={onStatus}>
            <span className="text-secondary small">{statusTitle}</span>
            <strong className="text-body">{statusDetail}</strong>
          </button>

          <button type="button" className="btn btn-outline-secondary position-relative" onClick={onInbox}>
            Inbox
            {unread > 0 && <span className="badge bg-orange text-orange-fg ms-2">{unread}</span>}
          </button>

          <button type="button" className="btn btn-outline-secondary d-none d-lg-inline-flex" onClick={onProfile}>
            LVL {managerLevel}
            <span className="badge bg-secondary-lt text-secondary ms-2">{managerPercent}%</span>
          </button>

          <button type="button" className="btn btn-outline-secondary d-none d-lg-inline-flex" onClick={onFinance}>
            {credits} cr.
          </button>

          <span className="badge bg-orange-lt text-orange d-none d-md-inline-flex">{packTokens} tokens</span>
        </div>
      </div>
    </header>
  )
}
