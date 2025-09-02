document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('[data-header]');
  const stickyCta = document.querySelector('[data-sticky-cta]');
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  // Header shrink + sticky CTA
  const onScroll = () => {
    const y = window.scrollY;
    if (y > 10) header.classList.add('is-scrolled'); else header.classList.remove('is-scrolled');
    if (y > 600) stickyCta.classList.add('show'); else stickyCta.classList.remove('show');
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  // Simple carousel
  const carousel = document.querySelector('[data-carousel]');
  if (carousel){
    const track = carousel.querySelector('.carousel__track');
    const prev = carousel.querySelector('.prev');
    const next = carousel.querySelector('.next');
    let index = 0;
    const move = (dir) => {
      const cards = track.children.length;
      index = (index + dir + cards) % cards;
      const width = track.children[0].getBoundingClientRect().width + 18; // gap
      track.scrollTo({left: index * width, behavior:'smooth'});
    };
    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
  }

  // Accordion
  document.querySelectorAll('[data-accordion] .acc__item').forEach(btn =>{
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
    });
  });

  // Newsletter validation
  const form = document.querySelector('[data-newsletter]');
  if (form){
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const valid = /.+@.+\..+/.test(input.value);
      if(!valid){
        input.setAttribute('aria-invalid','true');
        input.focus();
        alert('Por favor, informe um e-mail válido.');
        return;
      }
      form.reset();
      alert('Obrigado! Em breve você receberá nossas novidades.');
    });
  }
});

