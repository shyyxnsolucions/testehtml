document.addEventListener('DOMContentLoaded', () => {
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  const menuToggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  if (menuToggle && menu) {
    menuToggle.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  const currencyToggle = document.querySelector('[data-currency-toggle]');
  const currencyMenu = document.querySelector('[data-currency-menu]');
  if (currencyToggle && currencyMenu) {
    currencyToggle.addEventListener('click', () => {
      const isOpen = currencyMenu.style.display === 'block';
      currencyMenu.style.display = isOpen ? 'none' : 'block';
    });

    document.addEventListener('click', (event) => {
      if (!currencyToggle.contains(event.target) && !currencyMenu.contains(event.target)) {
        currencyMenu.style.display = 'none';
      }
    });
  }

  const carouselTrack = document.querySelector('[data-carousel] .carousel__track');
  const prevBtn = document.querySelector('[data-carousel-prev]');
  const nextBtn = document.querySelector('[data-carousel-next]');
  if (carouselTrack && prevBtn && nextBtn) {
    const slides = Array.from(carouselTrack.children);
    let index = 0;

    const updateCarousel = () => {
      carouselTrack.style.transform = `translateX(-${index * 100}%)`;
    };

    prevBtn.addEventListener('click', () => {
      index = (index - 1 + slides.length) % slides.length;
      updateCarousel();
    });

    nextBtn.addEventListener('click', () => {
      index = (index + 1) % slides.length;
      updateCarousel();
    });

    setInterval(() => {
      index = (index + 1) % slides.length;
      updateCarousel();
    }, 6500);
  }

  const form = document.querySelector('[data-newsletter]');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const valid = /.+@.+\..+/.test(input.value);
      if (!valid) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        alert('Por favor, informe um e-mail válido.');
        return;
      }
      form.reset();
      alert('Obrigado! Em breve você receberá nossas novidades.');
    });
  }
});
