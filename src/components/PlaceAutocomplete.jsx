// Поле выбора населённого пункта: выпадающий список с поиском (React Aria ComboBox).
// Без ввода — крупнейшие пункты, от двух букв — поиск; список подгружается порциями при прокрутке.
import { useEffect, useRef, useState } from 'react'
import { Button, Collection, ComboBox, Input, Label, ListBox, ListBoxItem, ListBoxLoadMoreItem, Popover, Text } from 'react-aria-components'
import { placeName, placeSubtitle, searchPlaces, t, topPlaces } from '@how-long-to/core'
import { Icon } from './Icon'

const PAGE = 30

export function PlaceAutocomplete({ label, value, onChange, autoFocus = false, className = '' }) {
  const [inputValue, setInputValue] = useState(() => placeName(value))
  const [query, setQuery] = useState('') // что показано: '' — крупнейшие пункты, иначе результаты поиска
  const [limit, setLimit] = useState(PAGE)
  const [found, setFound] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    let cancelled = false // пока искали, ввели другое — старый ответ не нужен
    setLoading(true)
    ;(query ? searchPlaces(query, limit) : topPlaces(limit))
      .then((list) => !cancelled && (setFound(list), setFailed(false)))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query, limit])

  // Пункт сменили снаружи (из истории, «Розвернути», карта) — текст поля за ним.
  useEffect(() => setInputValue(placeName(value)), [value])
  useEffect(() => () => clearTimeout(timer.current), [])

  function search(text) {
    clearTimeout(timer.current)
    const q = text.trim().length < 2 ? '' : text
    timer.current = setTimeout(() => {
      setQuery(q)
      setLimit(PAGE)
    }, q ? 120 : 0)
  }

  function handleInput(text) {
    setInputValue(text)
    // React Aria пишет в поле название выбранного пункта — повторно не ищем.
    if (text && text === placeName(value)) return
    if (!text && value) onChange(null) // стёрли название — пункт убран
    search(text)
  }

  const hasMore = !failed && found.length >= limit
  // Выбранный пункт должен оставаться в списке, иначе поле очистится.
  const items = value && !found.some((p) => p.id === value.id) ? [value, ...found] : found

  return (
    <ComboBox
      className={`field ${className}`}
      data-filled={inputValue ? true : undefined}
      items={items}
      inputValue={inputValue}
      onInputChange={handleInput}
      value={value?.id ?? null}
      onChange={(id) => onChange(id == null ? null : (items.find((p) => p.id === id) ?? null))}
      menuTrigger="focus"
      allowsEmptyCollection
      isInvalid={failed}
      autoFocus={autoFocus}
    >
      <Label className="field__label">{label}</Label>
      <div className="field__control">
        <Input className="field__input" placeholder={t('placeholder')} />
        {inputValue && (
          <Button
            slot={null}
            className="btn btn--icon"
            aria-label={t('clear')}
            onPress={() => {
              setInputValue('')
              onChange(null)
              search('')
            }}
          >
            <Icon name="close-circle" />
          </Button>
        )}
        <Button className="btn btn--icon">
          <Icon name="menu-down" />
        </Button>
      </div>
      {failed && (
        <Text slot="errorMessage" className="field__error">
          {t('loadError')}
        </Text>
      )}
      <Popover className="place-popover" offset={4}>
        <ListBox
          className="place-list"
          renderEmptyState={() => <div className="place-empty">{loading ? <span className="spinner" /> : t('noResults')}</div>}
        >
          <Collection items={items}>
            {(p) => (
              <ListBoxItem id={p.id} textValue={placeName(p)} className="place-option">
                <Text slot="label" className="place-option__title">
                  {placeName(p)}
                </Text>
                <Text slot="description" className="place-option__subtitle">
                  {placeSubtitle(p)}
                </Text>
              </ListBoxItem>
            )}
          </Collection>
          {hasMore && (
            <ListBoxLoadMoreItem className="place-more" isLoading={loading} onLoadMore={() => !loading && setLimit((n) => n + PAGE)}>
              <span className="spinner" />
            </ListBoxLoadMoreItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  )
}
