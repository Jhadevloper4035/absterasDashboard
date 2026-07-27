export type StatType = {
  name: string
  amount: string
  icon: string
  iconColor: string
  change: string
  changeColor: string
}

export type TransactionType = {
  image: string
  name: string
  description: string
  amount: string
  date: string
  time: string
  status: 'Success' | 'Cancelled' | 'OnHold' | 'Failed'
}
