import type { ComponentType } from 'react'
import type { ReactMdeProps } from 'react-mde'
import ReactMdePackage from 'react-mde'

type ReactMdeComponent = ComponentType<ReactMdeProps>

export const ReactMde: ReactMdeComponent = getReactMdeComponent(ReactMdePackage)

function getReactMdeComponent(module: unknown): ReactMdeComponent {
  if (isReactMdeComponent(module)) {
    return module
  }

  if (
    module &&
    typeof module === 'object' &&
    'default' in module &&
    isReactMdeComponent(module.default)
  ) {
    return module.default
  }

  throw new Error('react-mde did not provide a React component export')
}

function isReactMdeComponent(value: unknown): value is ReactMdeComponent {
  return typeof value === 'function'
}
