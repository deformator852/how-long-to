// Иконка Material Design Icons (@mdi/font). name — без префикса «mdi-», как в VEHICLES из core.
export function Icon({ name, size, className = '' }) {
  return <span aria-hidden="true" className={`icon mdi mdi-${name} ${className}`} style={size ? { fontSize: size } : undefined} />
}
