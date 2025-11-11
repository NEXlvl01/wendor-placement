import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { getProducts, pay, type Product } from '../services/api'
import { connectBackendWS, type BackendMessage } from '../services/websocket'

type Product = {
  id: number
  name: string
  price: number
  category?: string
  image_url?: string
}

export default function Products() {
  const [products, setProducts] = useState<Array<Product>>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState<string>('')
  const [activeMessage, setActiveMessage] = useState<string>('')
  const [isVending, setIsVending] = useState<boolean>(false)
  const wsRef = useRef<WebSocket | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)
  const [modal, setModal] = useState<{ open: boolean, stage: 'idle' | 'vending' | 'complete', text: string }>({ open: false, stage: 'idle', text: '' })
  const modalTimerRef = useRef<number | null>(null)

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    wsRef.current = connectBackendWS((msg: BackendMessage) => {
      if (msg.type === 'status') {
        if (msg.status === 'vending') {
          setIsVending(true)
          setActiveMessage(msg.message ?? 'Vending started')
          setModal({ open: true, stage: 'vending', text: 'Vending in progress…' })
        } else {
          setIsVending(false)
          setActiveMessage('')
          if (modal.stage !== 'complete') {
            setModal((m) => ({ ...m, open: false, stage: 'idle', text: '' }))
          }
        }
      } else if (msg.type === 'vend-response') {
        if (msg.success) {
          setIsVending(true)
          setActiveMessage('Vending started')
          setModal({ open: true, stage: 'vending', text: 'Vending started…' })
        } else {
          setIsVending(false)
          showToast(msg.message || 'Machine busy')
        }
      } else if (msg.type === 'vend-complete') {
        setIsVending(false)
        setModal({ open: true, stage: 'complete', text: 'Vending complete! 🎉' })
        if (modalTimerRef.current) window.clearTimeout(modalTimerRef.current)
        modalTimerRef.current = window.setTimeout(() => {
          setModal({ open: false, stage: 'idle', text: '' })
        }, 1500)
        showToast('Vending complete')
      }
    })
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close()
      }
      if (modalTimerRef.current) window.clearTimeout(modalTimerRef.current)
    }
  }, [])

  function showToast(text: string) {
    setActiveMessage(text)
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = window.setTimeout(() => setActiveMessage(''), 2500)
  }

  const productList = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category ?? '').toString().toLowerCase().includes(q)
    )
  }, [products, query])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '5px solid rgba(255,255,255,0.2)',
            borderTopColor: 'white',
            animation: 'spin 0.8s linear infinite'
          }}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: 18
      }}>
        {error}
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '32px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
      `}</style>

      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '0 auto 32px',
        maxWidth: 1200
      }}>
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            margin: 0,
            fontSize: 42,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.5px',
            textShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
        >
          Wendor Kiosk
        </motion.h1>
        <motion.span
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            padding: '10px 20px',
            borderRadius: 999,
            background: isVending 
              ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
              : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white',
            fontSize: 14,
            fontWeight: 700,
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease'
          }}
        >
          {isVending ? '⚡ Vending' : '✓ Ready'}
        </motion.span>
      </header>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{
          maxWidth: 1200,
          margin: '0 auto 32px',
          position: 'relative'
        }}
      >
        <div style={{ position: 'relative' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for snacks, drinks, or categories..."
            style={{
              width: '100%',
              padding: '16px 20px 16px 50px',
              borderRadius: 16,
              border: 'none',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(10px)',
              color: '#333',
              fontSize: 16,
              outline: 'none',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease'
            }}
            onFocus={(e) => {
              e.target.style.boxShadow = '0 12px 40px rgba(0,0,0,0.15)'
              e.target.style.transform = 'translateY(-2px)'
            }}
            onBlur={(e) => {
              e.target.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)'
              e.target.style.transform = 'translateY(0)'
            }}
          />
          <svg
            style={{
              position: 'absolute',
              left: 18,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 20,
              height: 20,
              opacity: 0.5
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </motion.div>

      <AnimatePresence>
        {activeMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.9))',
              backdropFilter: 'blur(10px)',
              color: '#333',
              padding: '14px 24px',
              borderRadius: 999,
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              zIndex: 50,
              fontWeight: 600,
              fontSize: 15
            }}
          >
            {activeMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 100
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ duration: 0.2 }}
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.95))',
                backdropFilter: 'blur(20px)',
                color: '#333',
                borderRadius: 24,
                padding: '32px 28px',
                width: 360,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                textAlign: 'center'
              }}
            >
              <div style={{ 
                marginBottom: 16, 
                fontSize: 24,
                fontWeight: 800,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                {modal.stage === 'vending' ? 'Processing' : 'Complete!'}
              </div>
              <div style={{ marginBottom: 24, opacity: 0.8, fontSize: 16 }}>{modal.text}</div>
              {modal.stage === 'vending' ? (
                <div style={{
                  width: 50,
                  height: 50,
                  margin: '0 auto',
                  borderRadius: '50%',
                  border: '4px solid rgba(102,126,234,0.2)',
                  borderTopColor: '#667eea',
                  animation: 'spin 0.8s linear infinite'
                }} />
              ) : (
                <motion.button
                  onClick={() => setModal({ open: false, stage: 'idle', text: '' })}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    appearance: 'none',
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 32px',
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'white',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(102,126,234,0.4)'
                  }}
                >
                  Close
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: 0.05, delayChildren: 0.1 }
          }
        }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 24,
          maxWidth: 1200,
          margin: '0 auto'
        }}
      >
        {productList.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onPay={async () => {
              setIsVending(true)
              await pay([Number(p.id)])
            }}
          />
        ))}
      </motion.div>
    </div>
  )
}

function ProductCard({ product, onPay }: { product: Product, onPay: () => Promise<void> }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1 }
      }}
      whileHover={{ y: -8, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.98 }}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.9))',
        backdropFilter: 'blur(10px)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        transition: 'box-shadow 0.3s ease',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.25)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,0.15)'
      }}
    >
      <div style={{
        aspectRatio: '16 / 10',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          />
        ) : (
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: 700,
            fontSize: 32
          }}>
            {product.name.slice(0, 1)}
          </div>
        )}
        {product.category && (
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            color: '#667eea',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            {product.category}
          </div>
        )}
      </div>
      <div style={{ padding: '16px 18px 18px' }}>
        <h3 style={{
          margin: '0 0 12px',
          fontSize: 18,
          lineHeight: 1.3,
          fontWeight: 700,
          color: '#333',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }} title={product.name}>
          {product.name}
        </h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto'
        }}>
          <span style={{
            fontSize: 24,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            ${product.price.toFixed(2)}
          </span>
          <motion.button
            onClick={onPay}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              appearance: 'none',
              border: 'none',
              borderRadius: 12,
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: 14,
              color: 'white',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(102,126,234,0.4)',
              transition: 'box-shadow 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102,126,234,0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102,126,234,0.4)'
            }}
          >
            Pay Now
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}