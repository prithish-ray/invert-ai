import { NavLink } from 'react-router-dom'

const links = [
  { to: '/gate',    full: 'New Decision',      short: 'New'     },
  { to: '/journal', full: 'Journal',           short: 'Journal' },
  { to: '/bias',    full: 'Bias Fingerprint',  short: 'Bias'    },
]

export default function NavBar({ user, onLogout }) {
  return (
    <nav className="bg-forest-500 shadow-md">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 flex items-center justify-between"
           style={{ minHeight: '52px' }}>
        {/* Brand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-white font-bold text-base sm:text-lg tracking-tight">Invert</span>
          <span className="text-forest-200 text-xs font-medium hidden md:block">
            — Before you act, run your decision through Charlie first.
          </span>
        </div>

        {/* Nav links + user */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {links.map(({ to, full, short }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-forest-700'
                    : 'text-forest-100 hover:bg-forest-600'
                }`
              }
            >
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{full}</span>
            </NavLink>
          ))}

          {user && (
            <div className="flex items-center gap-1.5 sm:gap-2 ml-2 sm:ml-3 pl-2 sm:pl-3 border-l border-forest-400">
              <span className="text-forest-100 text-xs hidden sm:block truncate max-w-[100px]">
                {user.name}
              </span>
              <button
                onClick={onLogout}
                className="px-2 sm:px-2.5 py-1.5 text-xs text-forest-100 hover:bg-forest-600 rounded
                           transition-colors border border-forest-400 whitespace-nowrap"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
