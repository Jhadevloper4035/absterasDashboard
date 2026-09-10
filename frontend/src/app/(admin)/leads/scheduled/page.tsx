import LeadsPage from '../page'

const ScheduledLeadsPage = () => (
  <LeadsPage
    title="My Scheduled Meetings"
    description="This private view shows only active meetings you scheduled. Meetings scheduled by other users are not shown here."
    emptyMessage="You have not scheduled any meetings yet. Open a lead and choose Schedule to add one."
    apiPath="/leads?limit=50&status=MEETING_SCHEDULED&scheduledByMe=true"
  />
)

export default ScheduledLeadsPage
