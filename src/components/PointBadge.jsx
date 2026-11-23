// Кружок с номером точки маршрута — того же цвета, что точка и ведущий в неё отрезок на картах.
import { pinColors } from '@how-long-to/core'
import { useColorScheme } from '../useMediaQuery'

export function PointBadge({ index, size = 20, className = '' }) {
  const scheme = useColorScheme()
  return (
    <span
      className={`point-badge ${className}`}
      style={{ ...pinColors(index, scheme), width: size, height: size, fontSize: Math.round(size / 2) }}
    >
      {index + 1}
    </span>
  )
}
