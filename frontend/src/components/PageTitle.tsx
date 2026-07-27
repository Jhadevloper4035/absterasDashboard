import { DEFAULT_PAGE_TITLE } from '@/context/constants'
import { Helmet } from 'react-helmet'

const PageMetaData = ({ title }: { title: string }) => {
  const defaultTitle = DEFAULT_PAGE_TITLE
  return (
    <Helmet>
      <title>{title ? title + ' | ' + defaultTitle : defaultTitle}</title>
    </Helmet>
  )
}

export default PageMetaData
