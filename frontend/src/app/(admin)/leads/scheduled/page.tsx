import LeadsPage from '../page'

const ScheduledLeadsPage = () => <LeadsPage title="Meeting Scheduled Leads" apiPath="/leads?limit=50&status=MEETING_SCHEDULED" />

export default ScheduledLeadsPage
