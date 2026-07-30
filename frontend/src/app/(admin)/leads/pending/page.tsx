import LeadsPage from '../page'

const PendingLeadsPage = () => <LeadsPage title="Pending Lead Assignment" apiPath="/leads?limit=50&assignmentException=true" />

export default PendingLeadsPage
