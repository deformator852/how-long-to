// Калькулятор целиком: цепочка точек (списком или кликами по карте), выбор аппаратов, результат и 3D-карта.
// Состояние — экземпляр useFlight() из core, его передают пропом: на главной — с историей маршрутов,
// на странице точности — свой у каждого примера. children — дополнительное содержимое под результатом
// (в той же колонке, что и форма).
import { Suspense, lazy, useImperativeHandle, useRef, useState } from 'react'
import { Tab, TabList, TabPanel, Tabs, ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { VEHICLES, placeName, t } from '@how-long-to/core'
import { useMediaQuery } from '../useMediaQuery'
import { EstimateResult } from './EstimateResult'
import { Icon } from './Icon'
import { PlaceAutocomplete } from './PlaceAutocomplete'
import { PointBadge } from './PointBadge'

// Leaflet грузится отдельным чанком — только когда открывают режим «Карта».
const RouteMap = lazy(() => import('./RouteMap'))
// MapLibre (~1,6 МБ вместе с воркером) — тоже отдельным чанком, только для 3D-вида в режиме «Список».
const Route3D = lazy(() => import('./Route3D'))

const VEHICLE_KEYS = Object.keys(VEHICLES)

/**
 * @param flight   экземпляр useFlight()
 * @param side     на широком экране 3D-карта — отдельной колонкой слева
 * @param mode / onModeChange — режим 'list' | 'map', если им управляет родитель (иначе — свой)
 * @param ref      → { fitMap() }: подогнать карту режима «Карта» под маршрут (после восстановления из истории)
 */
export function FlightCalculator({ flight, side = false, mode: modeProp, onModeChange, children, ref }) {
  const [ownMode, setOwnMode] = useState('list')
  const mode = modeProp ?? ownMode
  const setMode = (m) => {
    setOwnMode(m)
    onModeChange?.(m)
  }
  const wide = useMediaQuery('(min-width: 1280px)')
  const sideMap = side && mode === 'list' && wide
  const routeMap = useRef(null)
  const [focusKey, setFocusKey] = useState(null) // новый слот — сразу с фокусом

  useImperativeHandle(ref, () => ({ fitMap: () => setTimeout(() => routeMap.current?.fit()) }), [])

  const { stops, filledStops, vehicles, results } = flight
  const stopLabel = (i) => (i === 0 ? t('from') : i === stops.length - 1 ? t('to') : t('via'))

  return (
    <div className={sideMap ? 'layout-side' : ''}>
      {sideMap && (
        <aside className="layout-side__map">
          <Suspense>
            <Route3D points={flight.points} side />
          </Suspense>
        </aside>
      )}
      <div className="layout-side__main">
        <section className="card calc-form">
          <Tabs selectedKey={mode} onSelectionChange={setMode}>
            <TabList className="tab-list" aria-label={t('appTitle')}>
              <Tab id="list" className="tab">
                <Icon name="format-list-numbered" />
                {t('modeList')}
              </Tab>
              <Tab id="map" className="tab">
                <Icon name="map-marker-path" />
                {t('modeMap')}
              </Tab>
            </TabList>
            <hr className="divider" />

            <div className="calc-form__panel">
              <TabPanel id="list" className="stops">
                {stops.map((s, i) => (
                  <div key={s.key} className="stop-row">
                    <div className="stop-rail">
                      <PointBadge index={i} size={26} />
                    </div>
                    <PlaceAutocomplete
                      className="stop-field"
                      label={stopLabel(i)}
                      value={s.place}
                      onChange={(place) => flight.setPlace(s.key, place)}
                      autoFocus={s.key === focusKey}
                    />
                    {stops.length > 2 && (
                      <button
                        type="button"
                        className="btn btn--icon stop-remove"
                        title={t('removePoint')}
                        aria-label={t('removePoint')}
                        onClick={() => flight.removeStop(s.key)}
                      >
                        <Icon name="close" />
                      </button>
                    )}
                  </div>
                ))}
              </TabPanel>

              <TabPanel id="map">
                <div className="text-body-small text-muted" style={{ marginBottom: 8 }}>
                  {t('mapHint')}
                </div>
                <Suspense fallback={<div className="route-map" />}>
                  <RouteMap ref={routeMap} flight={flight} />
                </Suspense>
                {filledStops.length > 0 && (
                  <div className="row" style={{ marginTop: 12 }}>
                    {filledStops.map((s, i) => (
                      <span key={s.key} className="chip chip--tonal chip--sm">
                        <PointBadge index={i} size={18} />
                        {placeName(s.place)}
                        <button
                          type="button"
                          className="chip__close"
                          aria-label={t('removePoint')}
                          title={t('removePoint')}
                          onClick={() => flight.removeStop(s.key)}
                        >
                          <Icon name="close-circle" size={16} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </TabPanel>
            </div>
          </Tabs>

          <div className="calc-form__body">
            <div className="row">
              {mode === 'list' ? (
                <button type="button" className="btn btn--tonal" onClick={() => setFocusKey(flight.addStop())}>
                  <Icon name="plus" />
                  {t('addPoint')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--tonal"
                  disabled={!filledStops.length}
                  title={t('undoHint')}
                  onClick={flight.removeLastPoint}
                >
                  <Icon name="undo" />
                  {t('undo')}
                </button>
              )}
              <span className="spacer" />
              <button type="button" className="btn" title={t('reverseHint')} onClick={flight.reverse}>
                <Icon name="swap-vertical" />
                {t('reverse')}
              </button>
              <button type="button" className="btn" disabled={!filledStops.length && stops.length <= 2} onClick={flight.clear}>
                <Icon name="delete-outline" />
                {t('clear')}
              </button>
            </div>

            <hr className="divider" style={{ margin: '16px 0 12px' }} />

            <ToggleButtonGroup
              className="row vehicles"
              selectionMode="multiple"
              disallowEmptySelection
              selectedKeys={vehicles}
              onSelectionChange={(keys) => flight.setVehicles(VEHICLE_KEYS.filter((k) => keys.has(k)))}
              aria-label={t('multiHint')}
            >
              {VEHICLE_KEYS.map((key) => (
                <ToggleButton key={key} id={key} className="chip">
                  <Icon name="check" className="chip__check" />
                  <Icon name={VEHICLES[key].icon} />
                  {t(`${key}.title`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <div className="text-body-small text-muted" style={{ marginTop: 4 }}>
              {t('multiHint')}
            </div>
            <ul className="vehicle-notes text-body-small text-muted">
              {vehicles.map((key) => (
                <li key={key}>
                  {t(`${key}.title`)}: {t(`${key}.note`)}
                </li>
              ))}
            </ul>

            {vehicles.includes('custom') && (
              <label className="field field--prefixed custom-speed" data-filled="">
                <span className="field__label">{t('speed')}</span>
                <span className="field__control">
                  <Icon name="speedometer" className="field__prefix" />
                  <input
                    className="field__input"
                    type="number"
                    min="1"
                    value={flight.customSpeedKmh}
                    onChange={(e) => flight.setCustomSpeedKmh(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                  <span className="field__suffix">{t('kmh')}</span>
                </span>
              </label>
            )}
          </div>
        </section>

        <EstimateResult flight={flight} />

        {!sideMap && mode === 'list' && filledStops.length >= 2 && (
          <Suspense>
            <Route3D points={flight.points} className="route3d-card--below" />
          </Suspense>
        )}

        {!results.length && (
          <div className="alert" role="status">
            <Icon name="information-outline" />
            <div className="text-body-medium" style={{ fontSize: '1.0625rem', lineHeight: 1.5 }}>
              {t('emptyHint')}
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
