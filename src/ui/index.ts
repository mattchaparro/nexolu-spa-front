// Barrel de Nexolu UI - las pantallas importan de aca, nunca de "primevue"
// directamente. Ver README.md seccion "Nexolu UI".
export { default as NxButton } from './NxButton.vue'
export type { NxButtonSize, NxButtonVariant } from './NxButton.vue'

export { default as NxCard } from './NxCard.vue'

// Re-export directo (no una SFC wrapper) a proposito: DataTable de PrimeVue
// reconoce sus columnas inspeccionando el slot default y comparando
// `child.type.name === 'Column'` (ver @primevue/core/utils HelperSet) - una
// wrapper propia con otro nombre de componente rompe esa deteccion y
// DataTable no renderiza ninguna columna (ni filas). Column no tiene
// superficie visual propia que valga la pena re-tematizar, asi que el
// re-export es seguro.
export { default as NxColumn } from 'primevue/column'

export { default as NxDataTable } from './NxDataTable.vue'

export { default as NxDatePicker } from './NxDatePicker.vue'

export { default as NxInput } from './NxInput.vue'
export type { NxInputSize } from './NxInput.vue'

export { default as NxInputNumber } from './NxInputNumber.vue'

export { default as NxModal } from './NxModal.vue'

export { default as NxNavbar } from './NxNavbar.vue'

export { default as NxPageHeader } from './NxPageHeader.vue'

export { default as NxSelect } from './NxSelect.vue'

export { default as NxSidebar } from './NxSidebar.vue'

export { default as NxStatCard } from './NxStatCard.vue'

export { default as NxSwitch } from './NxSwitch.vue'

export { default as NxTab } from './NxTab.vue'

export { default as NxTabList } from './NxTabList.vue'

export { default as NxTabPanel } from './NxTabPanel.vue'

export { default as NxTabPanels } from './NxTabPanels.vue'

export { default as NxTabs } from './NxTabs.vue'

export { default as NxTextarea } from './NxTextarea.vue'

export { default as NxToast } from './NxToast.vue'

export { default as NxToggleButton } from './NxToggleButton.vue'
