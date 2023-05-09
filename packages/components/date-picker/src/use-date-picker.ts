import {
  CalendarBaseProps,
  UseCalendarProps,
  isAfterMaxDate,
  isBeforeMinDate,
} from '@yamada-ui/calendar'
import {
  CSSUIObject,
  HTMLUIProps,
  layoutStylesProperties,
  ThemeProps,
  useTheme,
} from '@yamada-ui/core'
import {
  FormControlOptions,
  formControlProperties,
  useFormControlProps,
} from '@yamada-ui/form-control'
import { PopoverProps } from '@yamada-ui/popover'
import { useControllableState } from '@yamada-ui/use-controllable-state'
import { useOutsideClick } from '@yamada-ui/use-outside-click'
import {
  isActiveElement,
  useUpdateEffect,
  dataAttr,
  createContext,
  getEventRelatedTarget,
  handlerAll,
  isContains,
  mergeRefs,
  pickObject,
  PropGetter,
  splitObject,
  omitObject,
  Dict,
} from '@yamada-ui/utils'
import dayjs from 'dayjs'
import {
  ChangeEvent,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useRef,
  useState,
} from 'react'

type DatePickerContext = Omit<
  UseDatePickerReturn,
  'getContainerProps' | 'getPopoverProps' | 'getCalendarProps' | 'onClear'
> & {
  styles: Record<string, CSSUIObject>
}

export const [DatePickerProvider, useDatePickerContext] = createContext<DatePickerContext>({
  strict: false,
  name: 'DatePickerContext',
})

type Value = Date | null | undefined

type CalendarProps = Omit<UseCalendarProps<Value>, 'prevRef' | 'typeRef' | 'nextRef'>

type CalendarThemeProps = ThemeProps<'Calendar'>

type UseDatePickerBaseProps = Omit<
  PopoverProps,
  | 'initialFocusRef'
  | 'closeOnButton'
  | 'isOpen'
  | 'trigger'
  | 'autoFocus'
  | 'restoreFocus'
  | 'openDelay'
  | 'closeDelay'
> &
  FormControlOptions &
  CalendarProps & {
    pattern?: RegExp
    parseDate?: (value: string) => Value
    inputFormat?: string
    isClearable?: boolean
    closeOnSelect?: boolean
    allowInput?: boolean
    calendarProps?: CalendarBaseProps
  }

export type UseDatePickerProps = Omit<
  HTMLUIProps<'input'>,
  keyof UseDatePickerBaseProps | 'disabled' | 'required' | 'readOnly' | 'size'
> &
  UseDatePickerBaseProps & {
    calendarVariant?: CalendarThemeProps['variant']
    calendarSize?: CalendarThemeProps['size']
    calendarColorStyle?: CalendarThemeProps['colorStyle']
  }

export const useDatePicker = ({
  parseDate,
  defaultIsOpen,
  closeOnBlur = true,
  placement = 'bottom-start',
  duration = 0.2,
  defaultValue,
  type,
  defaultType,
  onChangeType,
  month,
  defaultMonth,
  onChangeMonth,
  firstDayOfWeek,
  amountOfMonths,
  paginateBy,
  withWeekdays,
  disableOutsideDays,
  minDate,
  maxDate,
  locale,
  inputFormat = 'YYYY/MM/DD',
  yearFormat,
  monthFormat,
  weekdayFormat,
  dateFormat,
  weekendDays,
  today,
  excludeDate,
  calendarVariant,
  calendarSize,
  calendarColorStyle,
  holidays,
  withHeader,
  withControls,
  withLabel,
  calendarProps,
  placeholder,
  closeOnSelect = true,
  allowInput = true,
  pattern = /[^0-9\-\/]/g,
  ...rest
}: UseDatePickerProps) => {
  const { theme } = useTheme()

  rest = useFormControlProps(rest)

  locale ??= theme.__config.date?.locale ?? 'en'

  const { id } = rest

  const formControlProps = pickObject(rest, formControlProperties)
  const [containerProps, inputProps] = splitObject(
    omitObject(rest as Dict, ['id', 'value', 'onChange']),
    layoutStylesProperties,
  )

  const stringToDate = useCallback(
    (value: string): Value => {
      let date = parseDate ? parseDate(value) : dayjs(value, inputFormat, locale).toDate()

      if (date == null) return date

      if (maxDate && isAfterMaxDate(date, maxDate)) date = maxDate
      if (minDate && isBeforeMinDate(date, minDate)) date = minDate

      return date
    },
    [inputFormat, locale, maxDate, minDate, parseDate],
  )

  const dateToString = useCallback(
    (value: Value): string | undefined => {
      if (value == null) return undefined

      if (maxDate && isAfterMaxDate(value, maxDate)) value = maxDate
      if (minDate && isBeforeMinDate(value, minDate)) value = minDate

      return dayjs(value)
        .locale(locale ?? 'en')
        .format(inputFormat)
    },
    [inputFormat, locale, maxDate, minDate],
  )

  const [isOpen, setIsOpen] = useState<boolean>(defaultIsOpen ?? false)
  const [value, setValue] = useControllableState<Date | undefined | null>({
    value: rest.value,
    defaultValue,
    onChange: rest.onChange,
  })
  const [inputValue, setInputValue] = useState<string | undefined>(dateToString(value))

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onOpen = useCallback(() => {
    if (formControlProps.disabled || formControlProps.readOnly) return

    setIsOpen(true)

    if (allowInput && inputRef.current) inputRef.current.focus()

    rest.onOpen?.()
  }, [allowInput, formControlProps, rest])

  const onClose = useCallback(() => {
    setIsOpen(false)

    inputRef.current?.blur()

    rest.onClose?.()
  }, [rest])

  const onClear = useCallback(
    (ev: MouseEvent<HTMLDivElement>) => {
      ev.stopPropagation()

      setValue(null)
      setInputValue(undefined)

      if (allowInput && inputRef.current) inputRef.current.focus()
    },
    [allowInput, setValue],
  )

  const onClick = useCallback(() => {
    if (isOpen) {
      if (allowInput && inputRef.current) inputRef.current.focus()
    } else {
      onOpen()
    }
  }, [allowInput, isOpen, onOpen])

  const onFocus = useCallback(() => {
    if (!isOpen) onOpen()
  }, [isOpen, onOpen])

  const onBlur = useCallback(
    (ev: FocusEvent<HTMLDivElement>) => {
      const relatedTarget = getEventRelatedTarget(ev)

      if (isContains(containerRef.current, relatedTarget)) return

      if (!closeOnBlur) return

      const inputValue = dateToString(value)

      setInputValue(inputValue)

      if (isOpen) onClose()
    },
    [closeOnBlur, dateToString, isOpen, onClose, value],
  )

  const onKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLDivElement>) => {
      if (formControlProps.disabled || formControlProps.readOnly) return

      const actions: Record<string, Function | undefined> = {
        Enter: onClose,
      }

      const action = actions[ev.key]

      if (!action) return

      ev.preventDefault()
      ev.stopPropagation()

      action(ev)
    },
    [formControlProps, onClose],
  )

  const onChange = useCallback(
    (value: Date | undefined | null) => {
      const inputValue = dateToString(value)

      setValue(value)
      setInputValue(inputValue)

      if (closeOnSelect && value) onClose()
    },
    [closeOnSelect, dateToString, onClose, setValue],
  )

  useUpdateEffect(() => {
    if (inputRef.current && isActiveElement(inputRef.current)) return

    const inputValue = dateToString(value)

    setInputValue(inputValue)
  }, [value])

  useOutsideClick({
    ref: containerRef,
    handler: onClose,
    enabled: closeOnBlur,
  })

  const getContainerProps: PropGetter = useCallback(
    (props = {}, ref = null) => ({
      ref: mergeRefs(containerRef, ref),
      ...containerProps,
      ...props,
      ...formControlProps,
      onClick: handlerAll(props.onClick, rest.onClick, onClick),
      onFocus: handlerAll(props.onFocus, rest.onFocus, onFocus),
      onBlur: handlerAll(props.onBlur, rest.onBlur, onBlur),
    }),
    [containerProps, formControlProps, onBlur, onClick, onFocus, rest],
  )

  const getPopoverProps = useCallback(
    (props?: PopoverProps): PopoverProps => ({
      ...rest,
      ...props,
      isOpen,
      onOpen,
      onClose,
      placement,
      duration,
      trigger: 'never',
      closeOnButton: false,
    }),
    [duration, isOpen, onClose, onOpen, placement, rest],
  )

  const getFieldProps: PropGetter = useCallback(
    (props = {}, ref = null) => {
      const style: CSSProperties = {
        ...props.style,
        ...(!allowInput ? { cursor: 'pointer' } : {}),
      }

      return {
        ref,
        tabIndex: !allowInput ? 0 : -1,
        ...props,
        ...formControlProps,
        style,
        'data-active': dataAttr(isOpen),
        'aria-expanded': dataAttr(isOpen),
        onKeyDown: handlerAll(props.onKeyDown, rest.onKeyDown, onKeyDown),
      }
    },
    [allowInput, formControlProps, isOpen, rest, onKeyDown],
  )

  const getCalendarProps = useCallback(
    (props?: CalendarProps): CalendarProps => ({
      ...props,
      type,
      defaultType,
      onChangeType,
      month,
      defaultMonth,
      onChangeMonth,
      firstDayOfWeek,
      amountOfMonths,
      paginateBy,
      withWeekdays,
      disableOutsideDays,
      yearFormat,
      monthFormat,
      weekdayFormat,
      dateFormat,
      weekendDays,
      today,
      holidays,
      withHeader,
      withControls,
      withLabel,
      variant: calendarVariant,
      size: calendarSize,
      colorStyle: calendarColorStyle,
      ...calendarProps,
      value,
      defaultValue,
      onChange,
      minDate,
      maxDate,
      excludeDate,
      locale,
    }),
    [
      amountOfMonths,
      calendarColorStyle,
      calendarProps,
      calendarSize,
      calendarVariant,
      dateFormat,
      defaultMonth,
      defaultType,
      defaultValue,
      disableOutsideDays,
      excludeDate,
      firstDayOfWeek,
      holidays,
      locale,
      maxDate,
      minDate,
      month,
      monthFormat,
      onChange,
      onChangeMonth,
      onChangeType,
      paginateBy,
      today,
      type,
      value,
      weekdayFormat,
      weekendDays,
      withControls,
      withHeader,
      withLabel,
      withWeekdays,
      yearFormat,
    ],
  )

  return {
    inputRef,
    id,
    placeholder,
    allowInput,
    closeOnSelect,
    value,
    pattern,
    setValue,
    inputValue,
    setInputValue,
    stringToDate,
    dateToString,
    excludeDate,
    formControlProps,
    inputProps,
    isOpen,
    onOpen,
    onClose,
    onClear,
    getContainerProps,
    getPopoverProps,
    getFieldProps,
    getCalendarProps,
  }
}

export type UseDatePickerReturn = ReturnType<typeof useDatePicker>

export const useDatePickerInput = () => {
  const {
    inputRef,
    formControlProps,
    inputProps,
    id,
    allowInput,
    placeholder,
    pattern,
    setValue,
    stringToDate,
    inputValue,
    setInputValue,
  } = useDatePickerContext()

  const onChange = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      let inputValue = ev.target.value

      inputValue = inputValue.replace(pattern, '')

      const value = stringToDate(inputValue)

      setInputValue(inputValue)

      if (dayjs(value).isValid()) {
        setValue(value)
      } else {
        setValue(null)
      }
    },
    [pattern, stringToDate, setInputValue, setValue],
  )

  const getInputProps: PropGetter = useCallback(
    (props = {}, ref = null) => {
      const style: CSSProperties = {
        ...props.style,
        ...(inputProps as { style?: CSSProperties }).style,
        ...(!allowInput ? { pointerEvents: 'none' } : {}),
      }

      return {
        ref: mergeRefs(ref, inputRef),
        placeholder,
        ...formControlProps,
        ...inputProps,
        ...props,
        style,
        id,
        tabIndex: !allowInput ? -1 : 0,
        value: inputValue ?? '',
        cursor: formControlProps.readOnly ? 'default' : 'text',
        pointerEvents: formControlProps.disabled ? 'none' : 'auto',
        onChange: handlerAll(props.onChange, onChange),
      }
    },
    [inputProps, allowInput, inputRef, placeholder, formControlProps, id, inputValue, onChange],
  )

  return { getInputProps }
}

export type UseDatePickerInputReturn = ReturnType<typeof useDatePickerInput>
