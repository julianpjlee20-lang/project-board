import DbEnvBannerClient from './DbEnvBannerClient'

export default function DbEnvBanner() {
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  const dbEnv = process.env.NEXT_PUBLIC_DB_ENV
  if (!dbEnv) {
    return null
  }

  return <DbEnvBannerClient dbEnv={dbEnv} />
}
