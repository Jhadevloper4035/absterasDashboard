import LeadsPage from '../page'

const WonLeadsPage = () => {
  return <LeadsPage title="My Closed Leads" apiPath="/leads?limit=50&closed=true&closedByMe=true" />
}

export default WonLeadsPage
