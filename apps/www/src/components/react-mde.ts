import type { ComponentType } from 'react'
import type { ReactMdeProps } from 'react-mde'
import ReactMdePackage from 'react-mde'

type ReactMdeComponent = ComponentType<ReactMdeProps>
type ReactMdeModule = ReactMdeComponent | { default: ReactMdeComponent }

export const ReactMde: ReactMdeComponent = getReactMdeComponent(ReactMdePackage)

function getReactMdeComponent(module: ReactMdeModule): ReactMdeComponent {
  return 'default' in module ? module.default : module
}
