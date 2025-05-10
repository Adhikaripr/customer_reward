"use client"

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface Customer {
  id: string
  phone_number: string
  name: string | null
  total_points: number
  created_at: string
}

interface Transaction {
  id: string
  customer_id: string
  type: string
  amount: number
  points_changed: number
  created_at: string
}

export default function Home() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchPhone, setSearchPhone] = useState('')
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ phoneNumber: '', name: '', total_points: 0 })
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize] = useState(10)
  const [historyStartDate, setHistoryStartDate] = useState<string>('')
  const [historyEndDate, setHistoryEndDate] = useState<string>('')
  const modalRef = useRef<HTMLDivElement>(null)

  // Load all customers on initial render
  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    if (currentCustomer) {
      loadTransactions(currentCustomer.id)
    } else {
      setTransactions([])
    }
  }, [currentCustomer])

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading customers:', error)
        throw error
      }
      console.log('Loaded customers:', data)
      setCustomers(data || [])
    } catch (error) {
      console.error('Error loading customers:', error)
      setError('Failed to load customers')
    }
  }

  const loadTransactions = async (customerId: string) => {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
    if (historyStartDate) {
      query = query.gte('created_at', historyStartDate)
    }
    if (historyEndDate) {
      // Add 1 day to end date to make it inclusive
      const end = new Date(historyEndDate)
      end.setDate(end.getDate() + 1)
      query = query.lt('created_at', end.toISOString().slice(0, 10))
    }
    const { data, error } = await query
    if (!error) setTransactions(data || [])
  }

  // Reload transactions when date range or page changes
  useEffect(() => {
    if (currentCustomer && showHistory) {
      loadTransactions(currentCustomer.id)
    }
    setHistoryPage(1)
  }, [historyStartDate, historyEndDate, currentCustomer, showHistory])

  // Modal close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowHistory(false)
      }
    }
    if (showHistory) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showHistory])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      console.log('Searching for phone:', searchPhone)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone_number', searchPhone)
        .maybeSingle()

      if (error) {
        console.error('Search error:', error)
        throw error
      }

      console.log('Search result:', data)

      if (data) {
        setCurrentCustomer(data)
        setShowAddForm(false)
        setError('')
      } else {
        setCurrentCustomer(null)
        setShowAddForm(true)
        setNewCustomer({ ...newCustomer, phoneNumber: searchPhone })
      }
    } catch (error) {
      console.error('Error searching customer:', error)
      setError('Failed to search customer')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomer.phoneNumber.trim()) {
      setError('Phone number is required')
      return
    }

    setLoading(true)
    try {
      console.log('Adding new customer:', {
        phone_number: newCustomer.phoneNumber,
        name: newCustomer.name || null,
        total_points: 0
      })

      const { data, error } = await supabase
        .from('customers')
        .insert([
          {
            phone_number: newCustomer.phoneNumber,
            name: newCustomer.name || null,
            total_points: 0
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Add customer error:', error)
        throw error
      }

      console.log('Added customer:', data)
      setCustomers([...customers, data])
      setCurrentCustomer(data)
      setShowAddForm(false)
      setNewCustomer({ phoneNumber: '', name: '', total_points: 0 })
      setError('')
    } catch (error: any) {
      console.error('Error adding customer:', error)
      if (error.code === '23505') {
        setError('This phone number already exists')
      } else {
        setError('Failed to add customer')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddPoints = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCustomer) return
    const amount = Math.floor(Number(purchaseAmount))
    if (amount <= 0) {
      setError('Please enter a valid purchase amount')
      return
    }
    setLoading(true)
    try {
      const newPoints = currentCustomer.total_points + amount
      const { data, error } = await supabase
        .from('customers')
        .update({ total_points: newPoints })
        .eq('id', currentCustomer.id)
        .select()
        .single()
      if (error) throw error
      // Insert transaction
      await supabase.from('transactions').insert([{
        customer_id: currentCustomer.id,
        type: 'add',
        amount: amount,
        points_changed: amount
      }])
      const updatedCustomers = customers.map(c =>
        c.id === currentCustomer.id ? data : c
      )
      setCustomers(updatedCustomers)
      setCurrentCustomer(data)
      setPurchaseAmount('')
      setError('')
      // Reload transactions
      loadTransactions(currentCustomer.id)
    } catch (error) {
      setError('Failed to add points')
    } finally {
      setLoading(false)
    }
  }

  const handleRedeem = async (redeemAmount: number) => {
    if (!currentCustomer) return
    // Only allow redeeming in $10 increments and only if enough points
    if (redeemAmount % 10 !== 0) {
      setError('Redemption must be in $10 increments.')
      return
    }
    const pointsNeeded = redeemAmount * 10
    if (currentCustomer.total_points < pointsNeeded) {
      setError('Not enough points for this redemption.')
      return
    }
    setLoading(true)
    try {
      const newPoints = currentCustomer.total_points - pointsNeeded
      const { data, error } = await supabase
        .from('customers')
        .update({ total_points: newPoints })
        .eq('id', currentCustomer.id)
        .select()
        .single()
      if (error) throw error
      // Insert transaction
      await supabase.from('transactions').insert([{
        customer_id: currentCustomer.id,
        type: 'redeem',
        amount: redeemAmount,
        points_changed: -pointsNeeded
      }])
      const updatedCustomers = customers.map(c =>
        c.id === currentCustomer.id ? data : c
      )
      setCustomers(updatedCustomers)
      setCurrentCustomer(data)
      setError('')
      // Reload transactions
      loadTransactions(currentCustomer.id)
    } catch (error) {
      setError('Failed to redeem points')
    } finally {
      setLoading(false)
    }
  }

  const getRedemptionOptions = (points: number) => {
    const options = []
    const maxRedemption = Math.floor(points / 100) * 10
    for (let i = 10; i <= maxRedemption; i += 10) {
      options.push(i)
    }
    return options
  }

  const formatPointsToDollars = (points: number) => {
    return (points / 10).toFixed(2)
  }

  // Pagination logic
  const paginatedTransactions = transactions.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize)
  const totalPages = Math.ceil(transactions.length / historyPageSize)

  return (
    <main className="min-h-screen bg-[#f7fcfa] font-sans">
      {/* Header Bar */}
      <header className="w-full bg-black py-4 px-8 flex items-center mb-10">
        <h1 className="text-2xl font-bold text-white">Customer Points Tracker</h1>
      </header>
      <div className="flex flex-col md:flex-row items-start justify-center gap-8 w-full px-4">
        {/* Left Column: Search & Add Customer */}
        <div className="flex flex-col gap-8 w-full max-w-xl">
          {/* Search Card */}
          <div className="bg-white shadow rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-6">Search Customer</h2>
            <form onSubmit={handleSearch} className="space-y-6">
              <div>
                <label className="block text-base font-semibold mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Enter 10-digit phone number"
                  pattern="[0-9]*"
                  disabled={loading}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-black text-white font-semibold py-2 px-6 rounded-lg shadow hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                  disabled={loading}
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
                <button
                  type="button"
                  className="bg-white border border-black text-black font-semibold py-2 px-6 rounded-lg shadow hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
                  onClick={() => {
                    setSearchPhone('');
                    setCurrentCustomer(null);
                    setShowAddForm(false);
                    setError('');
                  }}
                  disabled={loading}
                >
                  Reset
                </button>
              </div>
            </form>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow">
              {error}
            </div>
          )}

          {/* Add New Customer Card */}
          {showAddForm && (
            <div className="bg-white shadow rounded-xl p-8">
              <h2 className="text-2xl font-bold mb-6">Add New Customer</h2>
              <form onSubmit={handleAddCustomer} className="space-y-6">
                <div>
                  <label className="block text-base font-semibold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={newCustomer.phoneNumber}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phoneNumber: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Enter phone number"
                    pattern="[0-9]*"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold mb-1">Name (Optional)</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Enter customer name"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  className="bg-black text-white font-semibold py-2 px-6 rounded-lg shadow hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Add Customer'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Customer Details */}
        {currentCustomer && (
          <div className="w-full max-w-2xl bg-white shadow rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-6">Customer Details</h2>
            <div className="mb-6 space-y-1">
              <p className="text-lg"><span className="font-semibold">Phone:</span> {currentCustomer.phone_number}</p>
              {currentCustomer.name && <p className="text-lg"><span className="font-semibold">Name:</span> {currentCustomer.name}</p>}
              <p className="text-xl font-bold mt-2">Points: {currentCustomer.total_points}</p>
              <p className="text-lg text-gray-600">Available for Redemption: ${formatPointsToDollars(currentCustomer.total_points)}</p>
            </div>

            {/* Add Points Form */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-3">Add Points</h3>
              <form onSubmit={handleAddPoints} className="space-y-4">
                <div>
                  <label className="block text-base font-semibold mb-1">Purchase Amount ($)</label>
                  <input
                    type="number"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1"
                    placeholder="Enter purchase amount"
                    disabled={loading}
                  />
                  <p className="text-sm text-gray-500 mt-1">Earn 1 point per $1 spent</p>
                </div>
                <button
                  type="submit"
                  className="w-full bg-black text-white font-semibold py-2 px-6 rounded-lg shadow hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                  disabled={loading}
                >
                  {loading ? 'Adding Points...' : 'Add Points'}
                </button>
              </form>
            </div>

            {/* Redemption Options */}
            {currentCustomer.total_points >= 100 && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-3">Redeem Points</h3>
                <p className="text-sm text-gray-600 mb-3">100 points = $10</p>
                <div className="grid grid-cols-2 gap-4">
                  {getRedemptionOptions(currentCustomer.total_points).map(amount => (
                    <button
                      key={amount}
                      onClick={() => handleRedeem(amount)}
                      className="bg-black text-white font-semibold py-2 px-6 rounded-lg shadow hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : `Redeem $${amount}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Toggle History Button */}
            <button
              className="mb-4 mt-8 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg"
              onClick={() => setShowHistory(true)}
            >
              Show History
            </button>

            {/* Transaction History Modal */}
            {showHistory && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div ref={modalRef} className="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl relative">
                  <button
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl"
                    onClick={() => setShowHistory(false)}
                  >
                    &times;
                  </button>
                  <h3 className="text-xl font-semibold mb-3">History</h3>
                  <div className="flex gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Start Date</label>
                      <input
                        type="date"
                        value={historyStartDate}
                        onChange={e => setHistoryStartDate(e.target.value)}
                        className="border rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">End Date</label>
                      <input
                        type="date"
                        value={historyEndDate}
                        onChange={e => setHistoryEndDate(e.target.value)}
                        className="border rounded px-2 py-1"
                      />
                    </div>
                  </div>
                  {paginatedTransactions.length === 0 ? (
                    <p className="text-gray-500">No history for this range.</p>
                  ) : (
                    <table className="min-w-full text-left text-sm mb-4">
                      <thead>
                        <tr>
                          <th className="px-2 py-1">Date</th>
                          <th className="px-2 py-1">Type</th>
                          <th className="px-2 py-1">Amount ($)</th>
                          <th className="px-2 py-1">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.map(tx => (
                          <tr key={tx.id}>
                            <td className="px-2 py-1">{new Date(tx.created_at).toLocaleString()}</td>
                            <td className="px-2 py-1 capitalize">{tx.type}</td>
                            <td className="px-2 py-1">{tx.amount}</td>
                            <td className="px-2 py-1">{tx.points_changed > 0 ? `+${tx.points_changed}` : tx.points_changed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {/* Pagination Controls */}
                  <div className="flex justify-between items-center">
                    <button
                      className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                    >
                      Previous
                    </button>
                    <span>Page {historyPage} of {totalPages || 1}</span>
                    <button
                      className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                      onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                      disabled={historyPage === totalPages || totalPages === 0}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}