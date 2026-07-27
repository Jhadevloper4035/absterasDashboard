import type { BootstrapVariantType } from '@/types/component-props'

export type StatType = {
  icon: string
  name: string
  amount: string
  variant: BootstrapVariantType
}

export type CountryType = {
  icon: string
  name: string
  value: number
  amount: number
  variant: BootstrapVariantType
}

export type BrowserType = {
  name: string
  percentage: number
  amount: number
}

export type PageType = {
  path: string
  views: number
  time: string
  rate: string
  variant: BootstrapVariantType
}
