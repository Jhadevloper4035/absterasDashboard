import { renderPdf } from '../../../services/pdf.service.js';

const escape = (value) => String(value ?? '-').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const detail = (label, value) => `<div class="detail-row"><div>${escape(label)}</div><div>:</div><div class="detail-value">${escape(value)}</div></div>`;
const styles = `
  @page { size: 84.667mm 125mm; margin: 0 }
  * { box-sizing: border-box }
  html, body { width: 320px; height: 100%; margin: 0; overflow: hidden; background: #282326; font-family: Arial, sans-serif }
  .id-card { width: 320px; height: 100%; overflow: hidden; border: 0; border-radius: 0; outline: 0; background: #fff; color: #202020 }
  .card-header { height: 225px; position: relative; overflow: hidden; border: 0 !important; border-bottom: 0 !important; outline: 0; background: #282326 }
  .company-area { position: absolute; top: 26px; left: 0; width: 100%; display: flex; justify-content: center; z-index: 10 }
  .company-logo { width: 200px; height: 52px; object-fit: contain }
  .curve-area { position: absolute; inset: auto 0 0; height: 150px; z-index: 2 }
  .curve-area svg { display: block; width: 100%; height: 100% }
  .photo-frame { width: 106px; height: 120px; position: absolute; top: 105px; left: 50%; transform: translateX(-50%); padding: 4px; border-radius: 13px; background: linear-gradient(145deg, #ffac18, #f47e0d); box-shadow: 0 4px 10px #00000038; z-index: 12 }
  .photo-inner { width: 100%; height: 100%; overflow: hidden; border-radius: 9px; background: #eee }
  .employee-photo, .photo-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; object-fit: cover; object-position: center top; color: #555; font-size: 36px; font-weight: 600 }
  .card-body { position: relative; margin-top: -1px; padding: 13px 43px 24px; border: 0 !important; border-top: 0 !important; outline: 0; text-align: center }
  .employee-name { color: #191919; font-size: 21px; font-weight: 600; line-height: 1.15; letter-spacing: -.4px; text-transform: uppercase; word-break: break-word }
  .employee-position { margin-top: 3px; color: #b88346; font-size: 12px; font-weight: 500; line-height: 1.4 }
  .employee-details { width: 100%; margin-top: 28px; text-align: left }
  .detail-row { display: grid; grid-template-columns: 55px 12px minmax(0, 1fr); align-items: start; margin-bottom: 4px; color: #292929; font-size: 12px; line-height: 1.35 }
  .detail-value { font-weight: 400; word-break: break-word; overflow-wrap: anywhere }
  .card-footer { height: 38px; display: flex; align-items: center; justify-content: center; padding: 0 12px; background: linear-gradient(90deg, #ffa313, #ff7e0c); color: #fff; font-size: 10px; letter-spacing: .2px }
`;

export function idCardHtml(employee) {
  const name = employee.user?.name || 'Employee';
  const photo = employee.photo?.url ? `<img class="employee-photo" src="${escape(employee.photo.url)}" alt="${escape(name)}">` : `<div class="photo-placeholder">${escape(name.slice(0, 1))}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${styles}</style></head><body><main class="id-card" id="employee-id-card"><div class="card-header"><div class="company-area"><img class="company-logo" src="https://absteras.com/images/logo/logo.png" alt="Absteras"></div><div class="curve-area"><svg viewBox="0 0 320 150" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="orangeGradient" x1="0" y1="0" x2="320" y2="150" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#ffad18"/><stop offset="100%" stop-color="#ff7d0b"/></linearGradient></defs><path d="M0 105C50 67 103 43 165 27C221 13 270 10 320 17L320 60C268 52 222 55 172 67C111 82 55 108 0 148Z" fill="url(#orangeGradient)"/><path d="M0 127C55 87 111 65 176 50C231 38 277 38 320 45L320 150L0 150Z" fill="#fff"/></svg></div><div class="photo-frame"><div class="photo-inner">${photo}</div></div></div><div class="card-body"><div class="employee-name">${escape(name)}</div><div class="employee-position">${escape(employee.designation?.name || 'Employee')}</div><div class="employee-details">${detail('ID No', String(employee._id).slice(-8).toUpperCase())}${detail('Dept.', employee.department?.name)}${detail('Deg.', employee.designation?.name)}${detail('Phone', employee.user?.phone)}${detail('Email', employee.user?.email)}</div></div><footer class="card-footer">www.absteras.com</footer></main></body></html>`;
}

export const createEmployeeIdCardPdf = (employee) => renderPdf(idCardHtml(employee), { width: '84.667mm', height: '125mm', margin: 0 });
