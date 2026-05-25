import { Helmet } from 'react-helmet-async'

const SITE  = 'Southampton Spitfires'
const IMAGE = 'https://southamptonspitfires.me/logo.png'

export default function PageMeta({ title, description, ogImage }) {
  const fullTitle = title ? `${title} | ${SITE}` : `${SITE} | University Ice Hockey Club`
  const img = ogImage || IMAGE
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:site_name"   content={SITE} />
      <meta property="og:type"        content="website" />
      <meta property="og:title"       content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:image"       content={img} />
      <meta name="twitter:card"       content="summary" />
      <meta name="twitter:title"      content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image"      content={img} />
    </Helmet>
  )
}
