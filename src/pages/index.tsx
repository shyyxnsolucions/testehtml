import Head from 'next/head';
import type { GetStaticProps } from 'next';
import { loadHtml, HtmlContent } from '@/lib/loadHtml';

export const getStaticProps: GetStaticProps<HtmlContent> = async () => {
  const { head, body } = loadHtml();
  return { props: { head, body } };
};

export default function Home({ head, body }: HtmlContent) {
  return (
    <>
      <Head>
        <div dangerouslySetInnerHTML={{ __html: head }} />
      </Head>
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}
