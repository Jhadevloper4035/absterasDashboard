import { Col, Row } from 'react-bootstrap'
import { useParams } from 'react-router-dom'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import TaskCreateCard from '@/components/TaskCreateCard'

const UpdateTask = () => {
  const { taskId } = useParams()

  return (
    <>
      <PageBreadcrumb subName="Task Management" title="Update Task" />
      <PageMetaData title="Update Task" />
      <Row>
        <Col>
          <TaskCreateCard taskId={taskId} />
        </Col>
      </Row>
    </>
  )
}

export default UpdateTask
