const Preloader = ({ fullScreen = false }: { fullScreen?: boolean }) =>
  fullScreen ? (
    <div className="app-loader" role="status" aria-label="Loading Absteras CRM">
      <div className="spinner-border text-primary" />
    </div>
  ) : (
    <div className="preloader-progress-bar">
      <div className="progress-value" />
    </div>
  )

export default Preloader
