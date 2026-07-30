import { Col, Row } from 'react-bootstrap'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import TaskCreateCard from '@/components/TaskCreateCard'

const CreateTask = () => (
  <>
    <PageBreadcrumb subName="Task Management" title="Create Task" />
    <PageMetaData title="Create Task" />
    <Row>
      <Col>
        <TaskCreateCard />
      </Col>
    </Row>
  </>
)

export default CreateTask
