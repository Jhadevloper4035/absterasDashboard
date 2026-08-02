import { Link } from 'react-router-dom'

import type { LogoBoxProps } from '@/types/component-props'

import logoSm from '@/assets/images/logo-sm.png'

const LogoBox = ({ containerClassName, squareLogo, textLogo }: LogoBoxProps) => {
  return (
    <div className={containerClassName ?? ''}>
      <Link to="/" className="logo-dark">
        <img src={logoSm} className={squareLogo?.className} height={squareLogo?.height ?? 30} width={squareLogo?.width ?? 19} alt="Absteras" />
        <span className={`brand-wordmark ${textLogo?.className ?? ''}`}>Absteras</span>
      </Link>
      <Link to="/" className="logo-light">
        <img src={logoSm} className={squareLogo?.className} height={squareLogo?.height ?? 30} width={squareLogo?.width ?? 19} alt="Absteras" />
        <span className={`brand-wordmark ${textLogo?.className ?? ''}`}>Absteras</span>
      </Link>
    </div>
  )
}

export default LogoBox
