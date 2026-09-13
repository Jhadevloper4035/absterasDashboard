import { Col, Form } from 'react-bootstrap'

type TransportationCostFieldsProps = {
  cost: string
  onCostChange: (value: string) => void
}

export default function TransportationCostFields({ cost, onCostChange }: TransportationCostFieldsProps) {
  return <Col md={4}><Form.Label>Transportation cost</Form.Label><Form.Control type="number" min="0" step="0.01" value={cost} onChange={(event) => onCostChange(event.target.value)} placeholder="Third-party payment amount" /></Col>
}
