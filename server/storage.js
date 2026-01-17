const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'gsm-imei-cache.json');
let memoryCache = {
  services: null,
  servicesExpiresAt: 0,
  orders: [],
};

const ensureFile = () => {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(memoryCache, null, 2));
  }
};

const readFileCache = () => {
  try {
    ensureFile();
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    memoryCache = { ...memoryCache, ...parsed };
  } catch (error) {
    return;
  }
};

const writeFileCache = () => {
  try {
    ensureFile();
    fs.writeFileSync(DATA_PATH, JSON.stringify(memoryCache, null, 2));
  } catch (error) {
    return;
  }
};

const getCachedServices = () => {
  if (memoryCache.services && Date.now() < memoryCache.servicesExpiresAt) {
    return memoryCache.services;
  }
  return null;
};

const setCachedServices = (services, ttlSeconds) => {
  memoryCache.services = services;
  memoryCache.servicesExpiresAt = Date.now() + ttlSeconds * 1000;
  writeFileCache();
};

const getOrders = () => {
  return memoryCache.orders || [];
};

const addOrder = (order) => {
  memoryCache.orders = [...(memoryCache.orders || []), order];
  writeFileCache();
};

const findOrder = (orderId) => {
  return (memoryCache.orders || []).find((order) => order.id === orderId);
};

readFileCache();

module.exports = {
  getCachedServices,
  setCachedServices,
  getOrders,
  addOrder,
  findOrder,
};
