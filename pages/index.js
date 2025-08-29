import fs from 'fs'
import path from 'path'
import Head from 'next/head'
import parse from 'html-react-parser'

export async function getStaticProps() {
  const filePath = path.join(process.cwd(), 'public', 'index.html')
  const content = fs.readFileSync(filePath, 'utf-8')
  const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return {
    props: {
      headContent: headMatch ? headMatch[1] : '',
      bodyContent: bodyMatch ? bodyMatch[1] : content
    }
  }
}

export default function Home({ headContent, bodyContent }) {
  return (
    <>
      <Head>{parse(headContent)}</Head>
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
    </>
  )
}
