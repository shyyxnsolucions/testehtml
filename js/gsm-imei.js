const api = {
  async getServices() {
    const response = await fetch('/api/dhru', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'services' }),
    });
    return response.json();
  },
  async getService(id) {
    const data = await api.getServices();
    const services = data.services || [];
    const service = services.find(
      (item) => String(item.serviceId ?? item.serviceid ?? item.id) === String(id)
    );

    if (!service) {
      return { error: 'Serviço não encontrado.', details: null };
    }

    return { details: service };
  },
  async createOrder(payload) {
    const response = await fetch('/api/dhru', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'order',
        serviceId: payload.serviceId,
        imeiOrSn: payload.imeiOrSn,
      }),
    });
    return response.json();
  },
};

const formatCurrency = (value) => {
  if (typeof value !== 'number') return value || '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const createServiceCard = (service) => {
  const card = document.createElement('article');
  card.className = 'service-card';

  const title = document.createElement('h3');
  title.textContent = service.name || service.title || 'Serviço GSM';

  const description = document.createElement('p');
  description.textContent = service.description || service.info || 'Detalhes disponíveis.';

  const price = document.createElement('div');
  price.className = 'service-card__meta';
  const priceValue = service.price ?? service.charge ?? service.cost;
  price.innerHTML = `<span>Preço</span><strong>${formatCurrency(priceValue)}</strong>`;

  const actions = document.createElement('div');
  actions.className = 'service-card__meta';
  const detailLink = document.createElement('a');
  const serviceId = service.serviceId || service.serviceid || service.id;
  detailLink.className = 'btn btn--ghost';
  detailLink.href = `service.html?id=${encodeURIComponent(serviceId)}`;
  detailLink.textContent = 'Detalhes';

  const orderLink = document.createElement('a');
  orderLink.className = 'btn btn--primary';
  orderLink.href = `order.html?serviceId=${encodeURIComponent(serviceId)}`;
  orderLink.textContent = 'Pedir agora';

  actions.append(detailLink, orderLink);

  card.append(title, description, price, actions);
  return card;
};

const renderServicesPage = async () => {
  const list = document.querySelector('[data-services-list]');
  const search = document.querySelector('[data-services-search]');
  const filter = document.querySelector('[data-services-filter]');
  const notice = document.querySelector('[data-services-notice]');

  if (!list) return;

  const data = await api.getServices();
  const services = data.services || [];

  if (data.stub && notice) {
    notice.textContent =
      data.message ||
      'Endpoint de serviços não configurado. Atualize a configuração do backend.';
    notice.classList.remove('hidden');
  }

  const filterOptions = new Set();
  services.forEach((service) => {
    const value = service.category || service.brand || service.type;
    if (value) filterOptions.add(value);
  });

  if (filter) {
    filter.innerHTML = '<option value="">Todos</option>';
    [...filterOptions].sort().forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      filter.append(option);
    });
  }

  const render = () => {
    const query = search?.value?.toLowerCase() || '';
    const filterValue = filter?.value || '';

    list.innerHTML = '';

    services
      .filter((service) => {
        const matchQuery = [service.name, service.title, service.description, service.info]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
        const category = service.category || service.brand || service.type || '';
        const matchFilter = !filterValue || category === filterValue;
        return matchQuery && matchFilter;
      })
      .forEach((service) => {
        list.append(createServiceCard(service));
      });
  };

  render();

  search?.addEventListener('input', render);
  filter?.addEventListener('change', render);
};

const renderServiceDetails = async () => {
  const container = document.querySelector('[data-service-details]');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const serviceId = params.get('id');

  if (!serviceId) {
    container.textContent = 'Serviço não informado.';
    return;
  }

  const data = await api.getService(serviceId);
  container.innerHTML = '';

  if (data.error) {
    container.textContent = data.error;
    return;
  }

  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(data.details, null, 2);
  pre.className = 'code-block';
  container.append(pre);
};

const renderOrderForm = async () => {
  const form = document.querySelector('[data-order-form]');
  if (!form) return;

  const serviceSelect = form.querySelector('[name="serviceId"]');
  const inputField = form.querySelector('[name="identifier"]');
  const status = form.querySelector('[data-order-status]');
  const params = new URLSearchParams(window.location.search);

  const data = await api.getServices();
  const services = data.services || [];

  serviceSelect.innerHTML = '<option value="">Selecione</option>';
  services.forEach((service) => {
    const option = document.createElement('option');
    option.value = service.serviceId || service.serviceid || service.id;
    option.textContent = service.name || service.title || option.value;
    if (params.get('serviceId') === option.value) {
      option.selected = true;
    }
    serviceSelect.append(option);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = 'Enviando pedido...';
    status.classList.remove('hidden');

    const payload = {
      serviceId: serviceSelect.value,
      imeiOrSn: inputField.value,
    };

    const result = await api.createOrder(payload);

    if (result.error) {
      status.textContent = result.error;
      status.classList.add('status--error');
      return;
    }

    const createdOrderId = result.orderId || result.order?.id || '-';
    const orderMessage = result.message ? ` (${result.message})` : '';
    status.textContent = `Pedido criado: ${createdOrderId}${orderMessage}`;
    status.classList.remove('status--error');
  });
};


renderServicesPage();
renderServiceDetails();
renderOrderForm();
