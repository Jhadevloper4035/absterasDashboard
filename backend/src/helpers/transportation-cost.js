const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function transportationCostFrom(body = {}) {
  const transportationCost = Number(body.transportationCost ?? 0);
  if (!Number.isFinite(transportationCost) || transportationCost < 0) throw Object.assign(new Error('Transportation cost must be zero or greater'), { statusCode: 400 });
  return { transportationCost: money(transportationCost) };
}
