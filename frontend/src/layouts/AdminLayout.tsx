import { Suspense } from 'react'

import Footer from '@/components/layout/Footer'
import TopNavigationBar from '@/components/layout/TopNavigationBar'
import VerticalNavigationBar from '@/components/layout/VerticalNavigationBar'
import type { ChildrenType } from '@/types/component-props'
import Preloader from '@/components/Preloader'

const AdminLayout = ({ children }: ChildrenType) => {
  return (
    <div className="wrapper">
      <TopNavigationBar />
      <VerticalNavigationBar />

      <div className="page-content">
        <div className="container-xxl">
          <Suspense fallback={<Preloader />}>{children}</Suspense>
        </div>

        <Footer />
      </div>
    </div>
  )
}

export default AdminLayout
