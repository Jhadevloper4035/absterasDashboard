import LeadsPage from '../page'

const WonLeadsPage = () => <LeadsPage title="Closed Leads" apiPath="/leads?limit=50&closed=true" />

export default WonLeadsPage
