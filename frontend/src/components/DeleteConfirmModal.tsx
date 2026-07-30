import { Alert, Button, Modal } from 'react-bootstrap'

type DeleteConfirmModalProps = {
  show: boolean
  title: string
  itemName?: string
  message?: string
  confirming?: boolean
  onCancel: () => void
  onConfirm: () => void
}

const DeleteConfirmModal = ({ show, title, itemName, message, confirming, onCancel, onConfirm }: DeleteConfirmModalProps) => (
  <Modal show={show} onHide={onCancel} centered backdrop="static" keyboard={!confirming}>
    <Modal.Header closeButton={!confirming}>
      <Modal.Title>{title}</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      {itemName && <div className="fw-semibold mb-2">{itemName}</div>}
      <Alert variant="danger" className="mb-0">
        {message || 'This record will be permanently deleted. This action cannot be undone.'}
      </Alert>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="light" type="button" disabled={confirming} onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="danger" type="button" disabled={confirming} onClick={onConfirm}>
        {confirming ? 'Deleting...' : 'Delete permanently'}
      </Button>
    </Modal.Footer>
  </Modal>
)

export default DeleteConfirmModal
