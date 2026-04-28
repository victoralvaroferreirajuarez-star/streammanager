export const currencies = [
    { code: 'PEN', name: 'Sol Peruano', symbol: 'S/', rate: 1 },
    { code: 'USD', name: 'Dólar Estadounidense', symbol: '$', rate: 3.7 },
    { code: 'EUR', name: 'Euro', symbol: '€', rate: 4.0 },
    { code: 'MXN', name: 'Peso Mexicano', symbol: '$', rate: 0.21 },
    { code: 'COP', name: 'Peso Colombiano', symbol: '$', rate: 0.00095 },
    { code: 'ARS', name: 'Peso Argentino', symbol: '$', rate: 0.004 },
    { code: 'CLP', name: 'Peso Chileno', symbol: '$', rate: 0.004 },
    { code: 'GBP', name: 'Libra Esterlina', symbol: '£', rate: 4.7 },
    { code: 'BRL', name: 'Real Brasileño', symbol: 'R$', rate: 0.75 },
    { code: 'JPY', name: 'Yen Japonés', symbol: '¥', rate: 0.025 }
]

export const mainCurrency = 'EUR'

export function convertToMainCurrency(amount, fromCurrency) {
    const from = currencies.find(c => c.code === fromCurrency)
    const to = currencies.find(c => c.code === mainCurrency)
    
    if (!from || !to) return amount
    
    const amountInPEN = amount / from.rate
    const amountInMain = amountInPEN * to.rate
    
    return amountInMain
}

export function formatCurrency(amount, currencyCode = mainCurrency) {
    const currency = currencies.find(c => c.code === currencyCode)
    if (!currency) return `€${amount.toFixed(2)}`
    
    const formatted = amount.toFixed(2)
    return `${currency.symbol}${formatted}`
}

export function getCurrencySymbol(code) {
    const currency = currencies.find(c => c.code === code)
    return currency ? currency.symbol : code
}
