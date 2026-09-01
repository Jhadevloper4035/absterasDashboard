import type { EmailLabelType, EmailType, SocialUserType } from './data'

export type ThemeType = 'light' | 'dark'

export type OffcanvasControlType = {
  open: boolean
  toggle: () => void
}

export type MenuType = {
  theme: ThemeType
  size: 'default' | 'condensed' | 'hidden' | 'sm-hover-active' | 'sm-hover'
}

export type LayoutState = {
  theme: ThemeType
  topbarTheme: ThemeType
  menu: MenuType
}

export type LayoutOffcanvasStatesType = {
  showActivityStream: boolean
  showBackdrop: boolean
}

export type LayoutType = LayoutState & {
  themeMode: ThemeType
  changeMenu: {
    size: (size: MenuType['size']) => void
  }
  activityStream: OffcanvasControlType
  toggleBackdrop: () => void
  resetSettings: () => void
}

export type ChatContextType = {
  activeChat?: SocialUserType
  changeActiveChat: (userId: SocialUserType['id']) => Promise<void>
  voiceCall: OffcanvasControlType
  videoCall: OffcanvasControlType
  chatList: OffcanvasControlType
  chatProfile: OffcanvasControlType
  chatSetting: OffcanvasControlType
}

export type ChatOffcanvasStatesType = {
  showChatList: boolean
  showUserProfile: boolean
  showVoiceCall: boolean
  showVideoCall: boolean
  showUserSetting: boolean
}

export type EmailContextType = {
  activeLabel: EmailLabelType
  changeActiveLabel: (label: EmailLabelType) => void
  activeMail: EmailType['id']
  changeActiveMail: (newMail: EmailType['id']) => void
  navigationBar: OffcanvasControlType
  emailDetails: OffcanvasControlType
  composeEmail: OffcanvasControlType
}

export type EmailOffcanvasStatesType = {
  showNavigationMenu: boolean
  showEmailDetails: boolean
  showComposeEmail: boolean
}
