// @how-long-to/core — логика «Час підльоту», общая для веб-приложения и мобильного (React Native).
// Здесь нет ничего платформенного: ни DOM, ни fetch, ни localStorage — это передаёт приложение
// (configurePlaces({ load }), useFlight({ storage })).
export { NUMBER_LOCALE, t } from './i18n.js'
export { haversineKm } from './geo.js'
export { VEHICLES, flightMinutes, formatDuration } from './flight.js'
export { THEME_COLORS, contrastText, legColor, pinColors, pointColor } from './routeColors.js'
export { configurePlaces, loadPlaces, mapPoint, nearestPlace, placeName, placeSubtitle, searchPlaces, topPlaces } from './places.js'
export {
  HISTORY_KEY,
  deriveRoute,
  initialRouteState,
  newStop,
  nextHistory,
  padStops,
  parseHistory,
  routeActions,
  routeKey,
  routeReducer,
} from './route.js'
export { useFlight } from './useFlight.js'
export { bearing, routeGeometry } from './route3d.js'
export { REAL_CASES, SOURCES, buildCase, casePlaceIds, caseVerdict, vehicleShortTitle } from './cases.js'
