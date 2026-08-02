import ComponentContainerCard from '@/components/ComponentContainerCard'
import { Form } from 'react-bootstrap'

const defaultValue = 'Hello World!\n\nThis is a simple editable area.'

const SnowEditor = () => {
  return (
    <ComponentContainerCard id="text-editor" title="Text Editor">
      <Form.Control as="textarea" rows={8} defaultValue={defaultValue} />
    </ComponentContainerCard>
  )
}

const BubbleEditor = () => {
  return (
    <ComponentContainerCard id="plain-text-editor" title="Compact Text Editor">
      <Form.Control as="textarea" rows={6} defaultValue={defaultValue} />
    </ComponentContainerCard>
  )
}
const AllEditors = () => {
  return (
    <>
      <SnowEditor />
      <BubbleEditor />
    </>
  )
}

export default AllEditors
