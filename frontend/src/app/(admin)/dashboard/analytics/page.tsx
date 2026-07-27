import { Col, Row } from 'react-bootstrap'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Conversions from './components/Conversions'
import SessionByBrowser from './components/SessionByBrowser'
import SessionsByCountry from './components/SessionsByCountry'
import Stats from './components/Stats'
import TopPages from './components/TopPages'

export default function Home() {
  return (
    <>
      <PageBreadcrumb title="Analytics" subName="Dashboards" />
      <PageMetaData title="Analytics" />

      <Row>
        <Col xxl={3}>
          <Stats />
        </Col>
        <Col xxl={9}>
          <Conversions />
        </Col>
      </Row>
      <Row>
        <Col xs={12}>
          <SessionsByCountry />
        </Col>
      </Row>
      <Row>
        <Col lg={4}>
          <SessionByBrowser />
        </Col>
        <Col lg={8}>
          <TopPages />
        </Col>
      </Row>
    </>
  )
}
