import { useEffect, useRef, useState } from 'react'
import { VEHICLES, placeName, t, useFlight } from '@how-long-to/core'
import { FlightCalculator } from './components/FlightCalculator'
import { Icon } from './components/Icon'
import { RealCases } from './components/RealCases'
import { useMediaQuery } from './useMediaQuery'

const SOURCE_URL = 'https://github.com/deformator852/how-long-to'

const CONTACTS = [
  { label: 'kostneko30@gmail.com', href: 'mailto:kostneko30@gmail.com', icon: 'email-outline' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/nikita-kostenko141/', icon: 'linkedin' },
  { label: 'GitHub', href: 'https://github.com/deformator852', icon: 'github' },
]

/** localStorage, если браузер его даёт (в приватном режиме доступ может бросать исключение). */
function browserStorage() {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

// Страница «Наскільки точний застосунок» — по адресу #accuracy (ссылкой можно делиться), назад — кнопкой браузера.
const pageFromUrl = () => (location.hash === '#accuracy' ? 'accuracy' : 'main')

function routeLabel(points) {
  const names = points.map(placeName)
  return names.length <= 3 ? names.join(' → ') : `${names[0]} → … → ${names.at(-1)}`
}

export default function App() {
  // Калькулятор главной страницы — единственный, кто ведёт «Нещодавні маршрути».
  const flight = useFlight({ storage: browserStorage() })
  const calculator = useRef(null)
  const [mode, setMode] = useState('list') // режим калькулятора главной: 'list' или 'map'
  const [page, setPage] = useState(pageFromUrl)

  useEffect(() => {
    const sync = () => setPage(pageFromUrl())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  function go(to) {
    if (page === to) return
    window.history.pushState(null, '', to === 'accuracy' ? '#accuracy' : location.pathname + location.search)
    setPage(to)
    window.scrollTo({ top: 0 })
  }

  // На широком экране в режиме «Список» 3D-карта стоит слева от формы — странице нужна большая ширина.
  const wide = useMediaQuery('(min-width: 1280px)') && mode === 'list'
  const smAndUp = useMediaQuery('(min-width: 600px)')

  function restore(entry) {
    flight.restore(entry)
    calculator.current?.fitMap()
  }

  return (
    <div className="app">
      <header className="app-bar">
        <div className="app-bar__title">
          <Icon name="timer-outline" />
          {t('appTitle')}
        </div>
        <a
          href="#accuracy"
          className={`btn ${page === 'accuracy' ? 'btn--tonal' : ''}`}
          onClick={(e) => {
            e.preventDefault()
            go('accuracy')
          }}
        >
          <Icon name="check-decagram-outline" />
          {smAndUp ? t('accuracyLink') : t('accuracyLinkShort')}
        </a>
      </header>

      <main>
        {page === 'accuracy' ? (
          <div className="container" style={{ maxWidth: 760 }}>
            <a
              href="./"
              className="btn"
              style={{ marginBottom: 16 }}
              onClick={(e) => {
                e.preventDefault()
                go('main')
              }}
            >
              <Icon name="arrow-left" />
              {t('backToCalc')}
            </a>
            <RealCases />
          </div>
        ) : (
          <div className="container" style={{ maxWidth: wide ? 1600 : 760 }}>
            <FlightCalculator ref={calculator} flight={flight} mode={mode} onModeChange={setMode} side>
              {flight.history.length > 0 && (
                <>
                  <div className="text-title-medium" style={{ margin: '32px 0 8px' }}>
                    {t('recent')}
                  </div>
                  <div className="row">
                    {flight.history.map((h) => (
                      <button
                        key={h.key}
                        type="button"
                        className="chip chip--tonal"
                        title={h.points.map(placeName).join(' → ')}
                        onClick={() => restore(h)}
                      >
                        <Icon name={VEHICLES[h.vehicles[0]].icon} />
                        {routeLabel(h.points)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <p className="text-body-small text-muted" style={{ marginTop: 32 }}>
                {t('disclaimer')}{' '}
                <a href="https://www.geonames.org" target="_blank" rel="noopener">
                  GeoNames
                </a>{' '}
                (
                <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">
                  CC BY 4.0
                </a>
                ).
              </p>
            </FlightCalculator>
          </div>
        )}
      </main>

      <footer className="footer">
        <span className="chip chip--tonal chip--sm chip--primary">
          <Icon name="cellphone-arrow-down" />
          {t('mobileSoon')}
        </span>
        <div className="row" style={{ justifyContent: 'center' }}>
          <a href={SOURCE_URL} target="_blank" rel="noopener" className="btn btn--sm">
            <Icon name="source-branch" />
            {t('sourceCode')}
          </a>
          {CONTACTS.map((c) => (
            <a key={c.href} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noopener" className="btn btn--sm">
              <Icon name={c.icon} />
              {c.label}
            </a>
          ))}
        </div>
        <div className="text-body-small text-muted">{t('contact')}</div>
      </footer>
    </div>
  )
}
