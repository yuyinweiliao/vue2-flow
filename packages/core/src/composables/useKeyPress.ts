import { ref, watch } from 'vue'
import type { KeyFilter, KeyPredicate, MaybeRefOrGetter } from '@vueuse/core'
import { onKeyStroke, toValue, useEventListener } from '@vueuse/core'
import { useWindow } from './useWindow'
import { isBoolean, isFunction, isString } from '~/utils'

export function isInputDOMNode(event: KeyboardEvent): boolean {
  const target = (event.composedPath?.()?.[0] || event.target) as HTMLElement

  const hasAttribute = isFunction(target.hasAttribute) ? target.hasAttribute('contenteditable') : false

  const closest = isFunction(target.closest) ? target.closest('.nokey') : null

  // when an input field is focused we don't want to trigger deletion or movement of nodes
  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.nodeName) || hasAttribute || !!closest
}

// we want to be able to do a multi selection event if we are in an input field
function wasModifierPressed(event: KeyboardEvent) {
  return event.ctrlKey || event.metaKey || event.shiftKey
}

function isKeyMatch(pressedKey: string, keyToMatch: string, pressedKeys: Set<string>) {
  const keyCombination = keyToMatch.split('+').map((k) => k.trim().toLowerCase())

  if (keyCombination.length === 1) {
    return pressedKey === keyToMatch
  } else {
    pressedKeys.add(pressedKey.toLowerCase())
    return keyCombination.every((key) => pressedKeys.has(key))
  }
}

function createKeyPredicate(keyFilter: string | string[], pressedKeys: Set<string>): KeyPredicate {
  return (event: KeyboardEvent) => {
    // if the keyFilter is an array of multiple keys, we need to check each possible key combination
    if (Array.isArray(keyFilter)) {
      return keyFilter.some((key) => isKeyMatch(event.key, key, pressedKeys))
    }

    // if the keyFilter is a string, we need to check if the key matches the string
    return isKeyMatch(event.key, keyFilter, pressedKeys)
  }
}

/**
 * Reactive key press state
 *
 * @param keyFilter - Can be a boolean, a string or an array of strings. If it's a boolean, it will always return that value. If it's a string, it will return true if the key is pressed. If it's an array of strings, it will return true if any of the keys are pressed, or a combination is pressed (e.g. ['ctrl+a', 'ctrl+b'])
 * @param onChange - Callback function that will be called when the key state changes
 */
export function useKeyPress(keyFilter: MaybeRefOrGetter<KeyFilter | null>, onChange?: (keyPressed: boolean) => void) {
  const window = useWindow()

  const isPressed = ref(toValue(keyFilter) === true)

  let modifierPressed = false

  const pressedKeys = new Set<string>()

  watch(isPressed, () => {
    onChange?.(isPressed.value)
  })

  watch(
    () => toValue(keyFilter),
    (unrefKeyFilter) => {
      if (window && typeof window.addEventListener !== 'undefined') {
        useEventListener(window, 'blur', () => {
          isPressed.value = false
        })
      }

      if (isBoolean(unrefKeyFilter)) {
        isPressed.value = unrefKeyFilter
        return
      }

      if (Array.isArray(unrefKeyFilter) || (isString(unrefKeyFilter) && unrefKeyFilter.includes('+'))) {
        unrefKeyFilter = createKeyPredicate(unrefKeyFilter, pressedKeys)
      }

      if (unrefKeyFilter) {
        onKeyStroke(
          unrefKeyFilter,
          (e) => {
            modifierPressed = wasModifierPressed(e)

            if (!modifierPressed && isInputDOMNode(e)) {
              return
            }

            e.preventDefault()

            isPressed.value = true
          },
          { eventName: 'keydown' },
        )

        onKeyStroke(
          unrefKeyFilter,
          (e) => {
            if (isPressed.value) {
              if (!modifierPressed && isInputDOMNode(e)) {
                return
              }

              modifierPressed = false

              pressedKeys.clear()

              isPressed.value = false
            }
          },
          { eventName: 'keyup' },
        )
      }
    },
    {
      immediate: true,
    },
  )

  return isPressed
}
