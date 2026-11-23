// Страница «Наскільки точний застосунок»: хронология постов мониторингового канала и расчёт приложения
// для тех же точек (buildCase из core). «Перевірити самому» раскрывает в примере полноценный калькулятор
// с этим маршрутом — отдельный экземпляр useFlight, главную страницу и её историю он не трогает.
import { useEffect, useMemo, useState } from 'react'
import { Button, Disclosure, DisclosureGroup, DisclosurePanel, Heading } from 'react-aria-components'
import {
  NUMBER_LOCALE,
  REAL_CASES,
  buildCase,
  casePlaceIds,
  caseVerdict,
  formatDuration,
  loadPlaces,
  placeName,
  t,
  useFlight,
  vehicleShortTitle,
} from '@how-long-to/core'
import { FlightCalculator } from './FlightCalculator'
import { Icon } from './Icon'

const km = (v) => v.toLocaleString(NUMBER_LOCALE, { maximumFractionDigits: 1 })
const initialRoute = (c) => ({ points: c.points, vehicles: c.vehicles })

/** Калькулятор примера. Живёт, пока открыта страница: свернули и развернули — правки на месте. */
function CaseLab({ c }) {
  const flight = useFlight(initialRoute(c))
  return (
    <div className="case-lab">
      <div className="alert alert--compact">
        <Icon name="clock-outline" />
        <div className="spacer">{t('labHint', { real: formatDuration(c.realMin) })}</div>
        <button type="button" className="btn btn--sm" onClick={() => flight.restore(initialRoute(c))}>
          <Icon name="restore" />
          {t('labReset')}
        </button>
      </div>
      <FlightCalculator flight={flight} />
    </div>
  )
}

function CaseBody({ c }) {
  // Калькулятор создаётся при первом «Перевірити самому», дальше только прячется.
  const [shown, setShown] = useState(false)
  const [created, setCreated] = useState(false)
  const toggle = () => {
    setCreated(true)
    setShown(!shown)
  }

  return (
    <>
      <ol className="case-events">
        {c.events.map((e) => (
          <li key={e.post} className={e.measured ? 'case-event--measured' : ''}>
            <div className="row case-event__meta">
              <span className="text-bold">{e.time}</span>
              {e.offset && <span className="text-body-small text-muted">{e.offset}</span>}
              {e.appAt && (
                <span className="text-body-small text-primary">
                  {t('casesAppAt', { name: vehicleShortTitle(c.closest.key), time: e.appAt })}
                </span>
              )}
              <a href={e.url} target="_blank" rel="noopener" className="text-body-small">
                {e.source}
              </a>
            </div>
            <div className="text-body-medium">{e.text}</div>
          </li>
        ))}
      </ol>

      {c.points && (
        <div className="sheet text-body-medium" style={{ marginTop: 12 }}>
          <div>
            {c.points.map(placeName).join(' → ')}:{' '}
            <b>
              {km(c.distanceKm)} {c.points.length > 2 ? t('kmRoute') : t('kmStraight')}
            </b>
          </div>
          <div>
            {t('casesElapsed')}: <b>{formatDuration(c.realMin)}</b>
          </div>
          {c.estimates.map((e) => (
            <div key={e.key}>
              {t('casesEstimate', { name: vehicleShortTitle(e.key), speed: e.speedKmh })}: <b>{formatDuration(e.minutes)}</b>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>{caseVerdict(c)}</div>
          {c.note && <div className="text-muted" style={{ marginTop: 8 }}>{c.note}</div>}
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className={`btn ${shown ? 'btn--tonal btn--primary' : 'btn--filled'}`} disabled={!c.points} onClick={toggle}>
          <Icon name={shown ? 'chevron-up' : 'play-circle-outline'} />
          {shown ? t('labHide') : t('labShow')}
        </button>
      </div>

      {created && (
        <div hidden={!shown} style={{ marginTop: 16 }}>
          <CaseLab c={c} />
        </div>
      )}
    </>
  )
}

export function RealCases() {
  const [places, setPlaces] = useState(null) // Map id → пункт; null — справочник ещё не загружен (или не загрузился)

  useEffect(() => {
    let cancelled = false
    const ids = new Set(casePlaceIds())
    loadPlaces()
      .then((list) => !cancelled && setPlaces(new Map(list.filter((p) => ids.has(p.id)).map((p) => [p.id, p]))))
      .catch(() => {}) // без справочника остаётся хронология постов, без расчёта
    return () => {
      cancelled = true
    }
  }, [])

  const cases = useMemo(() => REAL_CASES.map((c) => buildCase(c, places)), [places])

  return (
    <section className="card">
      <div className="card__header">
        <h1 className="card__title text-title-large">{t('casesTitle')}</h1>
        <p className="card__subtitle">{t('casesHint')}</p>
      </div>

      {/* Первый (самый показательный) пример раскрыт сразу. */}
      <DisclosureGroup className="panels" allowsMultipleExpanded defaultExpandedKeys={[REAL_CASES[0].id]}>
        {cases.map((c) => (
          <Disclosure key={c.id} id={c.id} className="panel">
            <Heading className="panel__heading">
              <Button slot="trigger" className="panel__trigger">
                <div className="case-summary">
                  <div className="text-title-small">{c.title}</div>
                  <div className="text-body-small text-muted">
                    {c.date} · {c.target}
                  </div>
                  <div className="row" style={{ marginTop: 4 }}>
                    <span className="chip chip--tonal chip--sm">
                      <Icon name="clock-outline" />
                      {t('casesReal')}: {formatDuration(c.realMin)}
                    </span>
                    {c.appRange && (
                      <span className="chip chip--tonal chip--sm chip--primary">
                        <Icon name="calculator-variant-outline" />
                        {t('casesApp')}: {c.appRange}
                      </span>
                    )}
                  </div>
                </div>
                <Icon name="chevron-down" className="panel__chevron" />
              </Button>
            </Heading>
            <DisclosurePanel className="panel__content">
              <CaseBody c={c} />
            </DisclosurePanel>
          </Disclosure>
        ))}
      </DisclosureGroup>

      <p className="card__body text-body-small text-muted" style={{ margin: '16px 0 0' }}>
        {t('casesMethod')}
      </p>
    </section>
  )
}
