"use client"

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { User, Phone, History, Sun, Moon } from 'lucide-react'
import { toast } from 'sonner'

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
  const [nameResults, setNameResults] = useState<Customer[]>([])
  const modalRef = useRef<HTMLDivElement>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [globalLoading, setGlobalLoading] = useState(false)

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

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

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
    setNameResults([])
    try {
      const input = searchPhone.trim()
      const isPhone = /^\d{7,}$/.test(input) // 7+ digits = phone
      let data = null
      let error = null
      if (isPhone) {
        // Search by phone number
        const res = await supabase
          .from('customers')
          .select('*')
          .eq('phone_number', input)
          .maybeSingle()
        data = res.data
        error = res.error
      } else {
        // Search by name (case-insensitive, exact match, allow multiple)
        const res = await supabase
          .from('customers')
          .select('*')
          .ilike('name', input)
        if (res.error) throw res.error
        if (res.data && res.data.length === 1) {
          data = res.data[0]
        } else if (res.data && res.data.length > 1) {
          setNameResults(res.data)
          setCurrentCustomer(null)
          setShowAddForm(false)
          setError('')
          setLoading(false)
          return
        } else {
          data = null
        }
      }
      if (error) {
        console.error('Search error:', error)
        throw error
      }
      if (data) {
        setCurrentCustomer(data)
        setShowAddForm(false)
        setError('')
      } else {
        setCurrentCustomer(null)
        // Only show add form if searching by phone
        setShowAddForm(isPhone)
        if (isPhone) {
          setNewCustomer({ ...newCustomer, phoneNumber: input })
        }
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
      toast.error('Phone number is required')
      return
    }
    setLoading(true)
    setGlobalLoading(true)
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
      toast.success('Customer added!')
    } catch (error: any) {
      console.error('Error adding customer:', error)
      if (error.code === '23505') {
        setError('This phone number already exists')
        toast.error('This phone number already exists')
      } else {
        setError('Failed to add customer')
        toast.error('Failed to add customer')
      }
    } finally {
      setLoading(false)
      setGlobalLoading(false)
    }
  }

  const handleAddPoints = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCustomer) return
    const amount = Math.floor(Number(purchaseAmount))
    if (amount <= 0) {
      setError('Please enter a valid purchase amount')
      toast.error('Please enter a valid purchase amount')
      return
    }
    setLoading(true)
    setGlobalLoading(true)
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
      toast.success('Points added!')
    } catch (error) {
      setError('Failed to add points')
      toast.error('Failed to add points')
    } finally {
      setLoading(false)
      setGlobalLoading(false)
    }
  }

  const handleRedeem = async (redeemAmount: number) => {
    if (!currentCustomer) return
    // Only allow redeeming in $5 increments and only if enough points
    if (redeemAmount % 5 !== 0) {
      setError('Redemption must be in $5 increments.')
      toast.error('Redemption must be in $5 increments.')
      return
    }
    const pointsNeeded = (redeemAmount / 5) * 100
    if (currentCustomer.total_points < pointsNeeded) {
      setError('Not enough points for this redemption.')
      toast.error('Not enough points for this redemption.')
      return
    }
    setLoading(true)
    setGlobalLoading(true)
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
      toast.success('Points redeemed!')
    } catch (error) {
      setError('Failed to redeem points')
      toast.error('Failed to redeem points')
    } finally {
      setLoading(false)
      setGlobalLoading(false)
    }
  }

  const getRedemptionOptions = (points: number) => {
    const options = []
    const maxRedemption = Math.floor(points / 100) * 5
    for (let i = 5; i <= maxRedemption; i += 5) {
      options.push(i)
    }
    return options
  }

  const formatPointsToDollars = (points: number) => {
    return ((points / 100) * 5).toFixed(2)
  }

  // Pagination logic
  const paginatedTransactions = transactions.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize)
  const totalPages = Math.ceil(transactions.length / historyPageSize)

  return (
    <main className="min-h-screen bg-[#f7fcfa] dark:bg-[#18181b] font-sans transition-colors">
      {/* Header Bar */}
      <header className="w-full bg-black py-4 px-8 flex items-center mb-10 justify-between">
        <h1 className="text-2xl font-bold text-white">Customer Points Tracker</h1>
        <button
          className="ml-auto bg-gray-800 hover:bg-gray-700 text-white rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-white"
          onClick={() => setDarkMode((d) => !d)}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>
      {/* Loading spinner overlay */}
      {globalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <div className="flex flex-col md:flex-row items-start justify-center gap-8 w-full px-4">
        {/* Left Column: Search & Add Customer */}
        <div className="flex flex-col gap-8 w-full max-w-xl">
          {/* Search Card */}
          <div className="bg-white dark:bg-zinc-800 shadow dark:shadow-lg rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-6 text-black dark:text-white">Search Customer</h2>
            <form onSubmit={handleSearch} className="space-y-6">
              <div>
                <label className="block text-base font-semibold mb-1 text-black dark:text-white">Phone Number</label>
                <input
                  type="text"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-black bg-white dark:bg-zinc-900 text-black dark:text-white"
                  placeholder="Enter phone number or name"
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
            <div className="bg-white dark:bg-zinc-800 shadow dark:shadow-lg rounded-xl p-8">
              <h2 className="text-2xl font-bold mb-6 text-black dark:text-white">Add New Customer</h2>
              <form onSubmit={handleAddCustomer} className="space-y-6">
                <div>
                  <label className="block text-base font-semibold mb-1 text-black dark:text-white">Phone Number</label>
                  <input
                    type="tel"
                    value={newCustomer.phoneNumber}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phoneNumber: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-black bg-white dark:bg-zinc-900 text-black dark:text-white border border-gray-300 dark:border-zinc-700"
                    placeholder="Enter phone number"
                    pattern="[0-9]*"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold mb-1 text-black dark:text-white">Name (Optional)</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-black bg-white dark:bg-zinc-900 text-black dark:text-white border border-gray-300 dark:border-zinc-700"
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

          {nameResults.length > 1 && (
            <div className="bg-white dark:bg-zinc-800 shadow dark:shadow-lg rounded-xl p-6 mt-4">
              <h3 className="text-lg font-bold mb-4 text-black dark:text-white">Select a Customer</h3>
              <table className="min-w-full text-left text-sm mb-4 text-black dark:text-white">
                <thead>
                  <tr>
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1">Phone</th>
                    <th className="px-2 py-1">Points</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {nameResults.map(cust => (
                    <tr key={cust.id}>
                      <td className="px-2 py-1">{cust.name}</td>
                      <td className="px-2 py-1">{cust.phone_number}</td>
                      <td className="px-2 py-1">{cust.total_points}</td>
                      <td className="px-2 py-1">
                        <button
                          className="bg-black text-white font-semibold py-1 px-4 rounded-lg shadow hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                          onClick={() => {
                            setCurrentCustomer(cust)
                            setNameResults([])
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Customer Details */}
        {currentCustomer && (
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-800 shadow dark:shadow-lg rounded-xl p-8 flex flex-col gap-6 relative">
            {/* Show History Icon Button (top right) */}
            <button
              className="absolute top-6 right-6 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full p-2 shadow focus:outline-none focus:ring-2 focus:ring-black"
              onClick={() => setShowHistory(true)}
              title="Show History"
              aria-label="Show History"
            >
              <History className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-green-400 flex items-center justify-center text-white text-3xl font-bold shadow">
                {currentCustomer.name?.[0]?.toUpperCase() || currentCustomer.phone_number.slice(-2)}
              </div>
              <div className="flex items-center gap-4 text-black dark:text-white">
                <span className="text-2xl font-extrabold">{currentCustomer.name || "—"}</span>
                <User className="w-5 h-5 text-gray-400" />
                <span className="text-lg font-semibold tracking-wide ml-4">{currentCustomer.phone_number}</span>
                <Phone className="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <div className="flex flex-row items-center justify-between gap-6 mt-6 mb-2 w-full">
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">Points</span>
                <span className="text-4xl font-extrabold text-blue-600 flex items-center gap-2">
                  {currentCustomer.total_points}
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">pts</span>
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500 dark:text-gray-400">Available for Redemption</span>
                <span className="text-3xl font-bold text-green-600">${formatPointsToDollars(currentCustomer.total_points)}</span>
              </div>
            </div>
            {/* Add Points Form */}
            <div className="mb-8">
              <form onSubmit={handleAddPoints} className="space-y-4">
                <div>
                  <label className="block text-base font-semibold mb-1 text-black dark:text-white">Purchase Amount ($)</label>
                  <input
                    type="number"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-900 text-black dark:text-white"
                    min="0"
                    step="1"
                    placeholder="Enter purchase amount"
                    disabled={loading}
                  />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Earn 1 point per $1 spent</p>
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
                <h3 className="text-xl font-semibold mb-3 text-black dark:text-white">Redeem Points</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">100 points = $5</p>
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
            {/* Transaction History Modal */}
            {showHistory && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div
                  ref={modalRef}
                  className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl dark:shadow-lg p-8 w-full max-w-2xl relative animate-fade-in"
                  style={{ minWidth: 350 }}
                >
                  {/* Close Button */}
                  <button
                    className="absolute top-4 right-4 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200 rounded-full p-2 transition"
                    onClick={() => setShowHistory(false)}
                    aria-label="Close"
                  >
                    &times;
                  </button>
                  <h3 className="text-2xl font-bold mb-4 text-black dark:text-white">History</h3>
                  {/* Filters */}
                  <div className="flex gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">Start Date</label>
                      <input
                        type="date"
                        value={historyStartDate}
                        onChange={e => setHistoryStartDate(e.target.value)}
                        className="border rounded px-2 py-1 bg-white dark:bg-zinc-900 text-black dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">End Date</label>
                      <input
                        type="date"
                        value={historyEndDate}
                        onChange={e => setHistoryEndDate(e.target.value)}
                        className="border rounded px-2 py-1 bg-white dark:bg-zinc-900 text-black dark:text-white"
                      />
                    </div>
                  </div>
                  {/* Totals */}
                  {transactions.length > 0 && (() => {
                    const totalSpent = transactions.filter(tx => tx.type === 'add').reduce((sum, tx) => sum + (tx.amount || 0), 0);
                    const totalRedeemedPoints = transactions.filter(tx => tx.type === 'redeem').reduce((sum, tx) => sum + (tx.points_changed || 0), 0);
                    const totalRedeemedDollars = ((-totalRedeemedPoints / 100) * 5).toFixed(2);
                    return (
                      <div className="flex gap-8 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700">
                        <div className="text-base text-black dark:text-white">
                          <span className="font-semibold">Total Spent:</span> <span className="font-mono">${totalSpent}</span>
                        </div>
                        <div className="text-base text-black dark:text-white">
                          <span className="font-semibold">Total Redeemed:</span> <span className="font-mono">${totalRedeemedDollars}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <hr className="my-4 border-gray-200 dark:border-zinc-700" />
                  {/* Table */}
                  {paginatedTransactions.length === 0 ? (
                    <p className="text-gray-500 text-black dark:text-gray-400">No history for this range.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm mb-4 text-black dark:text-white">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-zinc-900">
                            <th className="px-2 py-2 font-bold">Date</th>
                            <th className="px-2 py-2 font-bold">Type</th>
                            <th className="px-2 py-2 font-bold text-right">Amount ($)</th>
                            <th className="px-2 py-2 font-bold text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTransactions.map(tx => (
                            <tr
                              key={tx.id}
                              className="hover:bg-gray-50 dark:hover:bg-zinc-700 transition"
                            >
                              <td className="px-2 py-1">{new Date(tx.created_at).toLocaleString()}</td>
                              <td className="px-2 py-1">
                                <span
                                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                    tx.type === 'add'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {tx.type === 'add' ? 'Add' : 'Redeem'}
                                </span>
                              </td>
                              <td className="px-2 py-1 text-right font-mono">{tx.amount}</td>
                              <td className="px-2 py-1 text-right font-mono">
                                {tx.points_changed > 0 ? `+${tx.points_changed}` : tx.points_changed}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* Pagination Controls */}
                  <div className="flex justify-between items-center mt-2">
                    <button
                      className="px-3 py-1 bg-gray-200 dark:bg-zinc-700 rounded disabled:opacity-50"
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                    >
                      Previous
                    </button>
                    <span>Page {historyPage} of {totalPages || 1}</span>
                    <button
                      className="px-3 py-1 bg-gray-200 dark:bg-zinc-700 rounded disabled:opacity-50"
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