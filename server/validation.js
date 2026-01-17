const isDigits = (value) => /^\d+$/.test(value);

const luhnCheck = (value) => {
  let sum = 0;
  let shouldDouble = false;
  for (let i = value.length - 1; i >= 0; i -= 1) {
    let digit = Number(value[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
};

const validateServiceId = (value) =>
  typeof value === 'string' && value.trim().length >= 5;

const normalizeInput = (value) => (value ? String(value).trim() : '');

const validateImeiOrSn = (input) => {
  const value = normalizeInput(input);

  if (!value) {
    return { ok: false, reason: 'Informe um IMEI ou SN válido.' };
  }

  if (isDigits(value)) {
    if (value.length < 14 || value.length > 16) {
      return { ok: false, reason: 'IMEI deve ter 14 a 16 dígitos.' };
    }

    if (value.length === 15 && !luhnCheck(value)) {
      return { ok: false, reason: 'IMEI inválido (Luhn check falhou).' };
    }

    return { ok: true, type: 'imei', value };
  }

  if (/^[A-Za-z0-9-_.]{5,40}$/.test(value)) {
    return { ok: true, type: 'sn', value };
  }

  return { ok: false, reason: 'SN deve ter entre 5 e 40 caracteres válidos.' };
};

module.exports = {
  validateServiceId,
  validateImeiOrSn,
  normalizeInput,
};
