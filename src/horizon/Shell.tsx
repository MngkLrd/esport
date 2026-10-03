import { useEffect, useState, type ReactNode } from 'react'
import { FiAlignJustify, FiSearch } from 'react-icons/fi'
import { IoMdNotificationsOutline } from 'react-icons/io'

export type HorizonTab =
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

const NAV_ITEMS: Array<{ tab: HorizonTab; name: string; icon: string }> = [
  { tab: 'HQ', name: 'Home', icon: 'H' },
  { tab: 'World', name: 'World Circuit', icon: 'W' },
  { tab: 'Calendar', name: 'Calendar', icon: 'C' },
  { tab: 'Play', name: 'Matchday', icon: 'M' },
  { tab: 'Training', name: 'Training', icon: 'T' },
  { tab: 'Roster', name: 'Squad', icon: 'S' },
  { tab: 'Scout', name: 'Transfers', icon: 'X' },
  { tab: 'Packs', name: 'Packs', icon: 'P' },
  { tab: 'Finance', name: 'Finances', icon: 'F' },
  { tab: 'Inbox', name: 'News', icon: 'N' },
  { tab: 'Profile', name: 'Manager', icon: 'U' },
]

function HorizonSidebar({
  open,
  active,
  unread,
  onClose,
  onOpen,
}: {
  open: boolean
  active: HorizonTab
  unread: number
  onClose: () => void
  onOpen: (tab: HorizonTab) => void
}) {
  return (
    <div
      className={
        'sm:none duration-175 linear fixed !z-50 flex min-h-full flex-col bg-white pb-10 shadow-2xl shadow-white/5 transition-all dark:!bg-navy-800 dark:text-white md:!z-50 lg:!z-50 xl:!z-0 ' +
        (open ? 'translate-x-0' : '-translate-x-96')
      }
    >
      <button
        type="button"
        aria-label="Close navigation"
        className="absolute top-4 right-4 block cursor-pointer xl:hidden"
        onClick={onClose}
      >
        ×
      </button>

      <button type="button" onClick={() => onOpen('HQ')} className="mx-[56px] mt-[50px] flex items-center text-left">
        <div className="mt-1 ml-1 font-poppins text-[26px] font-bold uppercase text-navy-700 dark:text-white">
          ESPORT <span className="font-medium">AI</span>
        </div>
      </button>

      <div className="mt-[58px] mb-7 h-px bg-gray-300 dark:bg-white/30" />

      <ul className="mb-auto pt-1">
        {NAV_ITEMS.map((item) => {
          const activeRoute = active === item.tab
          return (
            <li key={item.tab}>
              <button type="button" className="relative mb-3 flex w-full hover:cursor-pointer" onClick={() => onOpen(item.tab)}>
                <span className="my-[3px] flex cursor-pointer items-center px-8">
                  <span className={activeRoute ? 'font-bold text-brand-500 dark:text-white' : 'font-medium text-gray-600'}>
                    <span className="inline-flex h-5 w-5 items-center justify-center text-sm">{item.icon}</span>
                  </span>
                  <span className={'leading-1 ml-4 flex ' + (activeRoute ? 'font-bold text-navy-700 dark:text-white' : 'font-medium text-gray-600')}>
                    {item.name}
                  </span>
                  {item.tab === 'Inbox' && unread > 0 && (
                    <span className="ml-3 rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-white">{unread}</span>
                  )}
                </span>
                {activeRoute ? <span className="absolute right-0 top-px h-9 w-1 rounded-lg bg-brand-500 dark:bg-brand-400" /> : null}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex justify-center">
        <div className="relative mt-14 flex w-[256px] justify-center rounded-[20px] bg-gradient-to-br from-[#868CFF] via-[#432CF3] to-brand-500 pb-4">
          <div className="absolute -top-12 flex h-24 w-24 items-center justify-center rounded-full border-[4px] border-white bg-gradient-to-b from-[#868CFF] to-brand-500 text-2xl font-bold text-white dark:!border-navy-800">
            EA
          </div>
          <div className="mt-16 flex h-fit flex-col items-center">
            <p className="text-lg font-bold text-white">Manager Hub</p>
            <p className="mt-1 px-4 text-center text-sm text-white">Career, club finances and progression in one place.</p>
            <button
              type="button"
              className="text-medium mt-7 block rounded-full bg-gradient-to-b from-white/50 to-white/10 py-[12px] px-11 text-center text-base text-white hover:bg-gradient-to-b hover:from-white/40 hover:to-white/5"
              onClick={() => onOpen('Profile')}
            >
              Open Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function HorizonNavbar({
  title,
  date,
  time,
  unread,
  level,
  credits,
  tokens,
  onOpenSidenav,
  onInbox,
}: {
  title: string
  date: string
  time: string
  unread: number
  level: number
  credits: string
  tokens: string
  onOpenSidenav: () => void
  onInbox: () => void
}) {
  return (
    <nav className="sticky top-4 z-40 flex flex-row flex-wrap items-center justify-between rounded-xl bg-white/10 p-2 backdrop-blur-xl dark:bg-[#0b14374d]">
      <div className="ml-[6px]">
        <div className="h-6 w-[224px] pt-1">
          <span className="text-sm font-normal text-navy-700 dark:text-white">Pages</span>
          <span className="mx-1 text-sm text-navy-700 dark:text-white"> / </span>
          <span className="text-sm font-normal capitalize text-navy-700 dark:text-white">{date} · {time}</span>
        </div>
        <p className="shrink text-[33px] capitalize text-navy-700 dark:text-white">
          <span className="font-bold capitalize">{title}</span>
        </p>
      </div>

      <div className="relative mt-[3px] flex h-[61px] w-[355px] flex-grow items-center justify-around gap-2 rounded-full bg-white px-2 py-2 shadow-xl shadow-shadow-500 dark:!bg-navy-800 dark:shadow-none md:w-[365px] md:flex-grow-0 md:gap-1 xl:w-[365px] xl:gap-2">
        <div className="flex h-full items-center rounded-full bg-lightPrimary text-navy-700 dark:bg-navy-900 dark:text-white xl:w-[225px]">
          <p className="pl-3 pr-2 text-xl"><FiSearch className="h-4 w-4 text-gray-400 dark:text-white" /></p>
          <div className="block h-full w-full rounded-full bg-lightPrimary px-2 text-sm font-medium leading-[45px] text-navy-700 dark:bg-navy-900 dark:text-white">
            LVL {level} · {credits} CR
          </div>
        </div>

        <button type="button" className="flex cursor-pointer text-xl text-gray-600 dark:text-white xl:hidden" onClick={onOpenSidenav} aria-label="Open navigation">
          <FiAlignJustify className="h-5 w-5" />
        </button>

        <button type="button" onClick={onInbox} className="relative cursor-pointer" aria-label="Inbox">
          <IoMdNotificationsOutline className="h-4 w-4 text-gray-600 dark:text-white" />
          {unread > 0 && <span className="absolute -top-2 -right-2 rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
        </button>

        <div className="flex h-10 min-w-10 items-center justify-center rounded-full bg-brand-500 px-3 text-xs font-bold text-white">
          {tokens}
        </div>
      </div>
    </nav>
  )
}

export default function HorizonShell({
  active,
  title,
  date,
  time,
  unread,
  level,
  credits,
  tokens,
  onOpen,
  children,
}: {
  active: HorizonTab
  title: string
  date: string
  time: string
  unread: number
  level: number
  credits: string
  tokens: string
  onOpen: (tab: HorizonTab) => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const onResize = () => setOpen(window.innerWidth >= 1200)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="dark flex h-full w-full">
      <HorizonSidebar open={open} active={active} unread={unread} onClose={() => setOpen(false)} onOpen={onOpen} />
      <div className="h-full w-full bg-lightPrimary dark:!bg-navy-900">
        <main className="mx-[12px] h-full flex-none transition-all md:pr-2 xl:ml-[313px]">
          <div className="h-full">
            <HorizonNavbar
              title={title}
              date={date}
              time={time}
              unread={unread}
              level={level}
              credits={credits}
              tokens={tokens}
              onOpenSidenav={() => setOpen(true)}
              onInbox={() => onOpen('Inbox')}
            />
            <div className="pt-5s mx-auto mb-auto h-full min-h-[84vh] p-2 md:pr-2">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
