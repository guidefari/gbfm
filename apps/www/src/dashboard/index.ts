// oxlint-disable-next-line import/no-unassigned-import -- submodel-owned styles
import './dashboard.css'

export { init, initialModel, Message, Model, Principal, Role, update } from './model'

export { DashboardService, DashboardServiceLive, makeDashboardServiceLayer } from './service'

export { view, type ViewInputs } from './view'
