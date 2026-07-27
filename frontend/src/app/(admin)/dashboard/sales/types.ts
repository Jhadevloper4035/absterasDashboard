export type StatType = {
  icon: string
  iconColor: string
  amount: string
  title: string
  change: string
  changeColor: string
  badgeIcon: string
}

type UserType = {
  avatar: string
  name: string
}

export type AccountType = {
  id: string
  date: string
  user: UserType
  status: 'Verified' | 'Pending' | 'Blocked'
  username: string
}

export type TransactionType = {
  id: string
  date: string
  amount: string
  status: 'Cr' | 'Dr'
  description: string
}
