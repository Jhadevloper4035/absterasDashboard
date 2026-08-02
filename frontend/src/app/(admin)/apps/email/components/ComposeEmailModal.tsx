import { useState } from 'react'
import { Button, Dropdown, DropdownDivider, DropdownMenu, DropdownToggle, Form, Modal, ModalBody, ModalHeader, ModalTitle } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useEmailContext } from '@/context/useEmailContext'

const ComposeEmailModal = () => {
  const [quillEditorContent, setQuillEditorContent] = useState('')

  const {
    composeEmail: { open, toggle },
  } = useEmailContext()

  return (
    <Modal show={open} onHide={toggle} size="lg" className="fade compose-mail" tabIndex={-1} aria-labelledby="compose-modalLabel" aria-hidden="true">
      <ModalHeader closeButton closeVariant="white" className="overflow-hidden bg-primary p-2">
        <ModalTitle as="h5" className="text-white">
          New Message
        </ModalTitle>
      </ModalHeader>
      <ModalBody className="p-4">
        <div className="overflow-hidden">
          <div className="mb-2">
            <input type="email" className="form-control" placeholder="To: " />
          </div>
          <div className="mb-2">
            <input type="text" className="form-control" placeholder="Subject " />
          </div>
          <div className="mt-2 mb-5">
            <Form.Control as="textarea" rows={8} value={quillEditorContent} onChange={(event) => setQuillEditorContent(event.target.value)} />
          </div>
          <div className="d-flex float-end">
            <Dropdown className="dropdown me-1">
              <DropdownToggle className="arrow-none btn btn-light" aria-expanded="false">
                <IconifyIcon icon="bx:dots-vertical-rounded" className="fs-18" />
              </DropdownToggle>
              <DropdownMenu className="dropdown-menu-up">
                <span role="button" className="dropdown-item">
                  Default to full screen
                </span>
                <DropdownDivider />
                <span role="button" className="dropdown-item">
                  Label
                </span>
                <span role="button" className="dropdown-item">
                  Palin text mode
                </span>
                <DropdownDivider />
                <span role="button" className="dropdown-item">
                  Smart Compose Feedback
                </span>
              </DropdownMenu>
            </Dropdown>
            <button onClick={() => setQuillEditorContent('')} className="btn btn-light compose-close">
              <IconifyIcon icon="bxs:trash" className="fs-18" />
            </button>
          </div>
          <div>
            <Button onClick={toggle} variant="primary">
              Send
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  )
}

export default ComposeEmailModal
