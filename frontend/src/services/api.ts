const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

export type Product = {
  id: string
  name: string
  price: number
  image_url?: string
  category?: string | null
}

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/api/products`)
  if (!res.ok) throw new Error('Failed to fetch products')
  return res.json()
}

export async function pay(items: number[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  })
  if (!res.ok) throw new Error('Payment failed')
}

