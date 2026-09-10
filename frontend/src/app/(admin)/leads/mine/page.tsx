import LeadsPage from '../page'

const MyLeadsPage = () => (
  <LeadsPage
    title="My Leads"
    description="This private view brings together leads you created and leads assigned to you. Leads belonging to other users are not shown."
    emptyMessage="You do not have any leads yet. Create a lead or wait for one to be assigned to you."
    apiPath="/leads?limit=50"
  />
)

export default MyLeadsPage
