import { Card, CardBody, CardTitle, Col, Row } from 'react-bootstrap'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import AllEditors from './components/AllEditors'

const Editors = () => {
  return (
    <>
      <PageBreadcrumb subName="Form" title="Editors" />
      <PageMetaData title="Editors" />
      <Row>
        <Col xl={12}>
          <Card>
            <CardBody>
              <CardTitle as={'h5'} className="mb-1 anchor" id="overview">
                Overview
              </CardTitle>
              <p className="text-muted mb-3">Basic text editing fields for internal CRM notes.</p>
            </CardBody>
          </Card>
          <AllEditors />
        </Col>
      </Row>
    </>
  )
}

export default Editors
