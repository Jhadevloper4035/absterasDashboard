import LogoBox from '@/components/LogoBox'
import PageMetaData from '@/components/PageTitle'
import PasswordFormInput from '@/components/form/PasswordFormInput'
import TextFormInput from '@/components/form/TextFormInput'
import { useNotificationContext } from '@/context/useNotificationContext'
import { useAuthStore } from '@/store/authStore'
import { yupResolver } from '@hookform/resolvers/yup'
import { useForm } from 'react-hook-form'
import { Button, Card, CardBody, Col, Row } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import * as yup from 'yup'

const setupSchema = yup.object({
  name: yup.string().required('Please enter your name'),
  email: yup.string().email('Please enter a valid email').required('Please enter your email'),
  phone: yup.string().required('Please enter your mobile number'),
  password: yup.string().min(8, 'Use at least 8 characters').required('Please enter a password'),
})

const SetupSuperadmin = () => {
  const setupSuperadmin = useAuthStore((state) => state.setupSuperadmin)
  const loading = useAuthStore((state) => state.loading)
  const { showNotification } = useNotificationContext()
  const navigate = useNavigate()
  const { control, handleSubmit } = useForm({
    resolver: yupResolver(setupSchema),
    defaultValues: { name: '', email: '', phone: '', password: '' },
  })

  const createSuperadmin = handleSubmit(async (values) => {
    try {
      await setupSuperadmin(values)
      showNotification({ message: 'Superadmin created.', variant: 'success' })
      navigate('/users')
    } catch (e) {
      showNotification({ message: e instanceof Error ? e.message : 'Setup failed', variant: 'danger' })
    }
  })

  return (
    <>
      <PageMetaData title="Setup Superadmin" />
      <Card className="auth-card">
        <CardBody>
          <div className="mx-auto mb-4 text-center auth-logo">
            <LogoBox textLogo={{ height: 24, width: 73 }} squareLogo={{ className: 'me-1' }} containerClassName="mx-auto mb-4 text-center auth-logo" />
          </div>
          <h2 className="fw-bold text-center fs-18">Setup Superadmin</h2>
          <p className="text-muted text-center mt-1 mb-4">Create the first account.</p>
          <Row className="justify-content-center">
            <Col xs={12} md={7}>
              <form onSubmit={createSuperadmin} className="authentication-form">
                <TextFormInput control={control} name="name" containerClassName="mb-3" label="Name" placeholder="Enter your name" />
                <TextFormInput control={control} name="email" containerClassName="mb-3" label="Email" type="email" placeholder="Enter your email" />
                <TextFormInput control={control} name="phone" containerClassName="mb-3" label="Mobile Number" type="tel" placeholder="10-digit mobile number" />
                <PasswordFormInput control={control} name="password" containerClassName="mb-3" label="Password" placeholder="Enter a password" />
                <div className="mb-1 text-center d-grid">
                  <Button variant="primary" type="submit" disabled={loading}>
                    Create Superadmin
                  </Button>
                </div>
              </form>
              <div className="text-center mt-3">
                <Link to="/auth/sign-in">Back to sign in</Link>
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>
    </>
  )
}

export default SetupSuperadmin
