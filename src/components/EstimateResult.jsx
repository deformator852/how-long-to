// Результат: время по каждому выбранному аппарату и, для маршрута из 3+ точек, — до каждой точки.
import { useState } from 'react'
import { NUMBER_LOCALE, flightMinutes, formatDuration, placeName, t, vehicleShortTitle } from '@how-long-to/core'
import { Icon } from './Icon'
import { PointBadge } from './PointBadge'

const km = (v) => Math.round(v).toLocaleString(NUMBER_LOCALE)

export function EstimateResult({ flight }) {
  // В расчёте — от быстрого к медленному; кнопкой можно развернуть порядок.
  const [slowFirst, setSlowFirst] = useState(false)
  const { results: byTime, distanceKm, points, legsKm } = flight
  if (!byTime.length) return null

  const results = slowFirst ? [...byTime].reverse() : byTime
  let sum = 0
  const cumKm = [0, ...legsKm.map((d) => (sum += d))] // от старта до каждой точки
  const beyondRange = (r, i) => r.rangeKm != null && cumKm[i] > r.rangeKm

  return (
    <section className="card card--tonal result">
      <div className="card__header">
        <div className="text-body-medium">{t('resultTitle')}</div>
        <div className="row" style={{ marginTop: 8 }}>
          <span className="chip">
            <Icon name="map-marker-distance" />
            {km(distanceKm)} {points.length > 2 ? t('kmRoute') : t('kmStraight')}
          </span>
          {results.length > 1 && (
            <button type="button" className="btn btn--outlined btn--pill btn--sm btn--primary" onClick={() => setSlowFirst(!slowFirst)}>
              <Icon name={slowFirst ? 'sort-ascending' : 'sort-descending'} />
              {slowFirst ? t('sortSlowFirst') : t('sortFastFirst')}
            </button>
          )}
        </div>
      </div>

      <div className="card__body">
        {results.map((r, i) => (
          <div key={r.key} className={i > 0 ? 'result__item result__item--sep' : 'result__item'}>
            <div className="row">
              <Icon name={r.icon} />
              <span className="text-title-medium">{t(`${r.key}.title`)}</span>
              <span className="text-body-medium text-muted">
                {km(r.speedKmh)} {t('kmh')}
              </span>
            </div>
            <div className={`text-bold ${results.length === 1 ? 'text-display-medium' : 'text-headline-large'}`}>{formatDuration(r.minutes)}</div>
            {r.outOfRange && (
              <div className="text-body-small text-warning">
                <Icon name="alert" size={16} /> {t('outOfRange', { km: km(r.rangeKm) })}
              </div>
            )}
          </div>
        ))}
      </div>

      {points.length > 2 && (
        <div className="card__body">
          <div className="text-title-small" style={{ margin: '8px 0 4px' }}>
            {t('byPoints')}
          </div>
          {/* Колонок может быть много (по одной на аппарат) — на телефоне таблица прокручивается вбок. */}
          <div className="table-wrap">
            <table className="table legs-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('point')}</th>
                  <th className="num">{t('km')}</th>
                  {results.map((r) => (
                    <th key={r.key} className="num nowrap">
                      {vehicleShortTitle(r.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={i}>
                    <td>
                      <PointBadge index={i} />
                    </td>
                    <td>{placeName(p)}</td>
                    <td className="num nowrap">
                      {km(cumKm[i])}
                      {i > 1 && <div className="text-body-small text-muted">+{km(legsKm[i - 1])}</div>}
                    </td>
                    {results.map((r) => (
                      <td key={r.key} className={`num nowrap ${beyondRange(r, i) ? 'text-warning' : ''}`}>
                        {i > 0 ? formatDuration(flightMinutes(cumKm[i], r.speedKmh)) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
