const suffix = () => crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()

export const generatedInvoiceNumber = (financialYear: string) => `ABS-${financialYear}-${suffix()}`
export const generatedChallanNumber = () => `DC-${suffix()}`
