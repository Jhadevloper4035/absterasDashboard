import { Col, Row } from 'react-bootstrap'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import TaskCreateCard from '@/components/TaskCreateCard'

const CreateTask = () => (
  <>
    <PageBreadcrumb subName="Task Management" title="Create Task" />
    <PageMetaData title="Create Task" />
    <Row className="justify-content-center">
      <Col lg={6} xl={5}>
        <TaskCreateCard />
      </Col>
    </Row>
  </>
)

export default CreateTask
