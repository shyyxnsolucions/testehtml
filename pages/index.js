import fs from 'fs';
import path from 'path';
import Head from 'next/head';
import parse from 'html-react-parser';

export async function getStaticProps() {
  const filePath = path.join(process.cwd(), 'public', 'index.html');
  const html = fs.readFileSync(filePath, 'utf8');
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return {
    props: {
      headContent: headMatch ? headMatch[1] : '',
      bodyContent: bodyMatch ? bodyMatch[1] : ''
    }
  };
}

export default function Home({ headContent, bodyContent }) {
  return (
    <>
      <Head>{parse(headContent)}</Head>
      <div>{parse(bodyContent)}</div>
    </>
  );
}
