import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Lumine - Beleza Luminosa</title>
        <meta name="description" content="Lumine - Elixir de beleza incrível" />
      </Head>
      <main className={styles.main}>
        <img
          src="https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=400&h=250&q=80"
          alt="Frasco do soro Lumine"
          width={400}
          height={250}
        />
        <h1 className={styles.title}>Lumine</h1>
        <p className={styles.description}>
          Revitalize sua pele com o elixir premium da Lumine.
        </p>
        <a href="#" className={styles.cta}>Comprar Agora</a>
      </main>
    </div>
  );
}
