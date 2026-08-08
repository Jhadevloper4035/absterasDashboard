import { Link } from 'react-router-dom'
import { Card, CardBody, Col, Row } from 'react-bootstrap'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'

const AccessDenied = () => (
  <>
    <PageBreadcrumb title="403" subName="Access Denied" />
    <Row className="justify-content-center">
      <Col xl={5}>
        <Card>
          <CardBody className="px-3 py-5 text-center">
            <h1 className="mb-3 fw-bold fs-60">403</h1>
            <h2 className="fs-22 lh-base">Access Denied</h2>
            <p className="text-muted mt-1 mb-4">You do not have permission to view this page.</p>
            <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
          </CardBody>
        </Card>
      </Col>
    </Row>
  </>
)

export default AccessDenied
