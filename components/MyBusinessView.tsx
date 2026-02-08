
import React, { useState, useMemo } from 'react';
import { Appointment, AppointmentStatus, BusinessProfile, Expense, BonusEntry } from '../types';
import { DollarSign, TrendingUp, PieChart, Plus, Trash2, Calculator, Briefcase, Download, FileText, CheckSquare, Square, Printer, Target, Edit3, RotateCcw, Gift, Save, X } from 'lucide-react';

interface MyBusinessViewProps {
  business: BusinessProfile;
  appointments: Appointment[];
  expenses: Expense[];
  bonusEntries: BonusEntry[];
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  // Prop to update business profile (for goal setting)
  onUpdateBusiness?: (profile: BusinessProfile) => void;
  // Prop for earnings reset
  onResetEarnings?: () => void;
  // Prop for updating appointment prices
  onUpdateAppointment?: (appt: Appointment) => void;
  // Bonus entry handlers
  onAddBonus?: (entry: BonusEntry) => void;
  onUpdateBonus?: (entry: BonusEntry) => void;
  onDeleteBonus?: (id: string) => void;
}

const MyBusinessView: React.FC<MyBusinessViewProps> = ({ 
  business, 
  appointments, 
  expenses,
  bonusEntries,
  onAddExpense,
  onDeleteExpense,
  onUpdateBusiness,
  onResetEarnings,
  onUpdateAppointment,
  onAddBonus,
  onUpdateBonus,
  onDeleteBonus
}) => {
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    name: '',
    amount: 0,
    category: 'Supplies'
  });

  // Tax Setup State
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  // Goal Edit State
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(business.monthlyRevenueGoal || 5000);

  // Default deductible categories (Write-offs)
  const [deductibleCategories, setDeductibleCategories] = useState<string[]>(['Supplies', 'Rent', 'Marketing']);

  // Revenue Log Edit State
  const [editingRevenueId, setEditingRevenueId] = useState<string | null>(null);
  const [editRevenuePrice, setEditRevenuePrice] = useState<number>(0);

  // Bonus Money Form State
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [newBonus, setNewBonus] = useState<Partial<BonusEntry>>({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0]
  });

  // Bonus Edit State
  const [editingBonusId, setEditingBonusId] = useState<string | null>(null);
  const [editBonusAmount, setEditBonusAmount] = useState<number>(0);

  // Helper function to calculate appointment price (used in multiple places)
  const getAppointmentPrice = (appt: Appointment): number => {
    // If there's an override price, use that instead
    if (appt.overridePrice !== undefined && appt.overridePrice !== null) {
      return appt.overridePrice;
    }
    
    const service = business.services.find(s => s.id === appt.serviceId);
    if (!service) return 0;
    
    // If price per person, multiply by number of people
    if (service.pricePerPerson) {
      const numPeople = appt.numberOfPeople || (appt.clientIds?.length || appt.clientNames?.length || 1);
      return service.price * numPeople;
    }
    
    return service.price;
  };

  // Financial Calculations
  const { grossRevenue, netEarnings, estimatedTax, totalExpenses, totalWriteOffs, goalProgress, bonusTotal } = useMemo(() => {
    // 1. Calculate Gross Revenue from COMPLETED appointments
    const completedAppointments = appointments.filter(a => a.status === AppointmentStatus.COMPLETED);
    
    const appointmentRevenue = completedAppointments.reduce((total, appt) => {
      return total + getAppointmentPrice(appt);
    }, 0);

    // 1b. Add Bonus entries
    const bonusSum = (bonusEntries || []).reduce((total, entry) => total + entry.amount, 0);
    
    const gross = appointmentRevenue + bonusSum;

    // 2. Calculate Expenses
    const expenseTotal = expenses.reduce((total, exp) => total + exp.amount, 0);

    // 3. Calculate Write-offs (Deductible Expenses)
    const writeOffs = expenses
        .filter(exp => deductibleCategories.includes(exp.category))
        .reduce((total, exp) => total + exp.amount, 0);

    // 4. Calculate Tax
    // Taxable Income = Gross Revenue - Write Offs
    const taxableIncome = Math.max(0, gross - writeOffs);
    const tax = taxableIncome * (business.taxRate / 100);

    // 5. Net Earnings (Pocketable cash)
    // Gross - Expenses (Actual cash out) - Tax
    const net = gross - expenseTotal - tax;
    
    // 6. Goal Progress
    const progress = Math.min(100, (gross / (business.monthlyRevenueGoal || 1)) * 100);

    return {
      grossRevenue: gross,
      totalExpenses: expenseTotal,
      totalWriteOffs: writeOffs,
      estimatedTax: tax,
      netEarnings: net,
      goalProgress: progress,
      bonusTotal: bonusSum
    };
  }, [appointments, expenses, bonusEntries, business.services, business.taxRate, business.monthlyRevenueGoal, deductibleCategories]);

  const handleSaveExpense = () => {
    if (!newExpense.name || !newExpense.amount) return;
    
    const expense: Expense = {
      id: Math.random().toString(36).substr(2, 9),
      name: newExpense.name,
      amount: Number(newExpense.amount),
      date: new Date().toISOString().split('T')[0],
      category: newExpense.category as any || 'Other'
    };

    onAddExpense(expense);
    setNewExpense({ name: '', amount: 0, category: 'Supplies' });
  };

  const handleSaveRevenueEdit = (appt: Appointment) => {
    if (onUpdateAppointment) {
      onUpdateAppointment({ ...appt, overridePrice: editRevenuePrice });
    }
    setEditingRevenueId(null);
  };

  const handleSaveBonusEdit = (entry: BonusEntry) => {
    if (onUpdateBonus) {
      onUpdateBonus({ ...entry, amount: editBonusAmount });
    }
    setEditingBonusId(null);
  };

  const handleAddBonusEntry = () => {
    if (!newBonus.description || !newBonus.amount) return;
    
    const entry: BonusEntry = {
      id: Math.random().toString(36).substr(2, 9),
      description: newBonus.description!,
      amount: Number(newBonus.amount),
      date: newBonus.date || new Date().toISOString().split('T')[0]
    };

    if (onAddBonus) onAddBonus(entry);
    setNewBonus({ description: '', amount: 0, date: new Date().toISOString().split('T')[0] });
    setShowBonusForm(false);
  };

  const handleUpdateGoal = () => {
      if (onUpdateBusiness) {
          onUpdateBusiness({
              ...business,
              monthlyRevenueGoal: tempGoal
          });
      }
      setIsEditingGoal(false);
  }

  const handleDownloadExcel = () => {
      const incomeRows = appointments
        .filter(a => a.status === AppointmentStatus.COMPLETED)
        .map(a => {
            const service = business.services.find(s => s.id === a.serviceId);
            const price = getAppointmentPrice(a);
            return ['Income', a.date, `Client: ${a.clientName}`, service?.name || 'Service', price];
        });

      const bonusRows = (bonusEntries || []).map(b => {
          return ['Bonus', b.date, b.description, 'Bonus Income', b.amount];
      });

      const expenseRows = expenses.map(e => {
          return ['Expense', e.date, e.name, e.category, -e.amount];
      });

      const allRows = [...incomeRows, ...bonusRows, ...expenseRows].sort((a, b) => new Date(a[1] as string).getTime() - new Date(b[1] as string).getTime());

      // Add Financial Summary Section at the top
      const summaryRows = [
          ['', '', '', '', ''],
          ['FINANCIAL SUMMARY', '', '', '', ''],
          ['Gross Revenue', '', '', '', grossRevenue.toFixed(2)],
          ['Total Expenses', '', '', '', -totalExpenses.toFixed(2)],
          ['Estimated Tax', '', '', '', -estimatedTax.toFixed(2)],
          ['Net Earnings', '', '', '', netEarnings.toFixed(2)],
          ['', '', '', '', ''],
          ['TRANSACTION DETAILS', '', '', '', ''],
      ];

      // 1. Prepare Headers
      const headers = ['Type', 'Date', 'Description', 'Category/Service', 'Amount'];

      // 2. Convert to CSV string
      const csvContent = [
          ...summaryRows.map(row => row.join(',')),
          headers.join(','),
          ...allRows.map(row => row.join(','))
      ].join('\n');

      // 3. Trigger Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${business.name.replace(/\s+/g, '_')}_Financial_Report.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const toggleDeductibleCategory = (category: string) => {
      setDeductibleCategories(prev => {
          if (prev.includes(category)) {
              return prev.filter(c => c !== category);
          } else {
              return [...prev, category];
          }
      });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto pb-20">
      <header className="mb-10 border-b border-zinc-800 pb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
            <h1 className="text-4xl font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-3">
                <Briefcase className="w-8 h-8 text-orange-600" />
                My Business
            </h1>
            <p className="text-zinc-500">Financial overview, tax estimation, and expense tracking.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
              onClick={handleDownloadExcel}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white px-6 py-3 font-bold uppercase tracking-widest text-xs transition-colors"
          >
              <Download className="w-4 h-4 text-orange-600" />
              Download Excel Report
          </button>
          {onResetEarnings && (
            <button 
                onClick={onResetEarnings}
                className="flex items-center gap-2 bg-red-900/30 hover:bg-red-900/50 border border-red-700 text-red-400 hover:text-red-300 px-6 py-3 font-bold uppercase tracking-widest text-xs transition-colors"
            >
                <RotateCcw className="w-4 h-4" />
                Reset Earnings
            </button>
          )}
        </div>
      </header>

      {/* Goal Section (New) */}
      <div className="mb-12 bg-gradient-to-r from-zinc-900 to-black border border-zinc-800 p-8 relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-600/5 blur-[80px] pointer-events-none"></div>
         
         <div className="relative z-10">
             <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
                         <Target className="w-5 h-5 text-orange-600" />
                     </div>
                     <div>
                         <h2 className="text-lg font-bold text-white uppercase tracking-wider">Monthly Revenue Goal</h2>
                         <p className="text-xs text-zinc-500 uppercase tracking-widest">Target vs Actual</p>
                     </div>
                 </div>
                 {!isEditingGoal ? (
                    <button 
                        onClick={() => { setTempGoal(business.monthlyRevenueGoal); setIsEditingGoal(true); }}
                        className="text-zinc-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                    >
                        <Edit3 className="w-4 h-4" /> Change Target
                    </button>
                 ) : (
                    <div className="flex items-center gap-2 animate-fade-in">
                        <input 
                            type="number" 
                            className="bg-black border border-zinc-700 text-white p-2 w-32 font-mono text-sm focus:border-orange-600 outline-none"
                            value={tempGoal}
                            onChange={(e) => setTempGoal(parseFloat(e.target.value))}
                        />
                        <button onClick={handleUpdateGoal} className="text-orange-600 hover:text-white font-bold text-xs uppercase">Save</button>
                        <button onClick={() => setIsEditingGoal(false)} className="text-zinc-500 hover:text-white font-bold text-xs uppercase">Cancel</button>
                    </div>
                 )}
             </div>

             {/* Progress Bar */}
             <div className="relative h-6 bg-zinc-800 rounded-full overflow-hidden mb-2">
                 <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-1000 ease-out"
                    style={{ width: `${goalProgress}%` }}
                 ></div>
             </div>
             
             <div className="flex justify-between items-end font-mono">
                 <span className="text-white font-bold text-2xl">${grossRevenue.toFixed(0)} <span className="text-sm text-zinc-500 font-normal">Current</span></span>
                 <span className="text-zinc-500 text-sm">{goalProgress.toFixed(1)}% Achieved</span>
                 <span className="text-zinc-400 font-bold text-xl">${business.monthlyRevenueGoal.toLocaleString()} <span className="text-sm text-zinc-600 font-normal">Target</span></span>
             </div>
         </div>
      </div>

      {/* Financial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-zinc-900 border border-zinc-800 p-6 group hover:border-zinc-700 transition-all">
           <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Gross Revenue</span>
              <DollarSign className="w-5 h-5 text-white" />
           </div>
           <p className="text-3xl font-mono font-bold text-white">${grossRevenue.toFixed(2)}</p>
           <p className="text-[10px] text-zinc-500 mt-2 uppercase">From {appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length} Completed Services</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 group hover:border-red-900 transition-all">
           <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Expenses</span>
              <TrendingUp className="w-5 h-5 text-red-500" />
           </div>
           <p className="text-3xl font-mono font-bold text-red-500">-${totalExpenses.toFixed(2)}</p>
           <p className="text-[10px] text-zinc-500 mt-2 uppercase">{expenses.length} Recorded Items</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 group hover:border-yellow-900 transition-all relative">
           <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Est. Tax ({business.taxRate}%)</span>
              <Calculator className="w-5 h-5 text-yellow-500" />
           </div>
           <p className="text-3xl font-mono font-bold text-yellow-500">-${estimatedTax.toFixed(2)}</p>
           <div className="flex justify-between items-center mt-2">
                <p className="text-[10px] text-zinc-500 uppercase">Calculated on Taxable Income</p>
                <button 
                    onClick={() => setIsTaxModalOpen(true)}
                    className="text-[10px] font-bold text-orange-600 hover:text-white uppercase tracking-wider flex items-center gap-1"
                >
                    <FileText className="w-3 h-3" /> Setup Docs
                </button>
           </div>
        </div>

        <div className="bg-zinc-900 border border-emerald-900/50 p-6 group relative overflow-hidden">
           <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-xl -mr-8 -mt-8 pointer-events-none"></div>
           <div className="flex items-center justify-between mb-4 relative z-10">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Net Earnings</span>
              <PieChart className="w-5 h-5 text-emerald-500" />
           </div>
           <p className="text-3xl font-mono font-bold text-emerald-500 relative z-10">${netEarnings.toFixed(2)}</p>
           <p className="text-[10px] text-zinc-400 mt-2 uppercase relative z-10">Take Home Pay</p>
        </div>
      </div>

      {/* Revenue Log Section */}
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-orange-600" />
                Gross Revenue Log
            </h2>
            <button 
                onClick={() => setShowBonusForm(!showBonusForm)}
                className="flex items-center gap-2 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700 text-emerald-400 hover:text-emerald-300 px-4 py-2 font-bold uppercase tracking-widest text-xs transition-colors"
            >
                <Gift className="w-4 h-4" />
                Add Bonus Money
            </button>
        </div>

        {/* Add Bonus Money Form */}
        {showBonusForm && (
            <div className="bg-zinc-900 border border-emerald-800 p-6 mb-6 animate-in fade-in duration-200">
                <h3 className="font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2 text-sm">
                    <Gift className="w-4 h-4" /> New Bonus Entry
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Description</label>
                        <input 
                            type="text"
                            placeholder="e.g. Tips, Gift, Side job"
                            className="w-full bg-black border border-zinc-700 p-3 text-white focus:border-emerald-600 outline-none text-sm"
                            value={newBonus.description}
                            onChange={e => setNewBonus({ ...newBonus, description: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Amount ($)</label>
                        <input 
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full bg-black border border-zinc-700 p-3 text-white focus:border-emerald-600 outline-none font-mono text-sm"
                            value={newBonus.amount || ''}
                            onChange={e => setNewBonus({ ...newBonus, amount: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Date</label>
                        <input 
                            type="date"
                            className="w-full bg-black border border-zinc-700 p-3 text-white focus:border-emerald-600 outline-none font-mono text-sm"
                            value={newBonus.date}
                            onChange={e => setNewBonus({ ...newBonus, date: e.target.value })}
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <button 
                        onClick={handleAddBonusEntry}
                        className="bg-emerald-600 text-black py-2 px-6 font-bold uppercase tracking-widest text-xs hover:bg-emerald-500 transition-colors"
                    >
                        Add Bonus
                    </button>
                    <button 
                        onClick={() => setShowBonusForm(false)}
                        className="bg-zinc-800 text-zinc-400 py-2 px-6 font-bold uppercase tracking-widest text-xs hover:bg-zinc-700 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        )}

        <div className="bg-zinc-900 border border-zinc-800">
            <table className="w-full text-left">
                <thead className="bg-black border-b border-zinc-800">
                    <tr>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Source</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Date</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Details</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Amount</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 w-24"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                    {/* Completed Appointments */}
                    {appointments
                        .filter(a => a.status === AppointmentStatus.COMPLETED)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(appt => {
                            const service = business.services.find(s => s.id === appt.serviceId);
                            const price = getAppointmentPrice(appt);
                            const isEditing = editingRevenueId === appt.id;
                            
                            return (
                                <tr key={appt.id} className="hover:bg-zinc-800/50 transition-colors">
                                    <td className="p-4">
                                        <span className="bg-emerald-900/30 border border-emerald-900 text-emerald-500 px-2 py-1 text-[10px] uppercase font-bold tracking-wider">
                                            Service
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-zinc-500 font-mono">{appt.date}</td>
                                    <td className="p-4">
                                        <p className="font-bold text-white text-sm">{appt.clientName || 'Unknown'}</p>
                                        <p className="text-zinc-500 text-xs">{service?.name || 'Service'}</p>
                                    </td>
                                    <td className="p-4 text-right">
                                        {isEditing ? (
                                            <input 
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="w-24 bg-black border border-orange-600 p-1 text-white font-mono text-sm text-right outline-none"
                                                value={editRevenuePrice}
                                                onChange={e => setEditRevenuePrice(parseFloat(e.target.value) || 0)}
                                                autoFocus
                                            />
                                        ) : (
                                            <span className={`font-mono font-bold text-sm ${appt.overridePrice !== undefined ? 'text-orange-400' : 'text-emerald-500'}`}>
                                                ${price.toFixed(2)}
                                                {appt.overridePrice !== undefined && (
                                                    <span className="text-[9px] text-orange-600 block uppercase">edited</span>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        {isEditing ? (
                                            <div className="flex items-center gap-1 justify-end">
                                                <button 
                                                    onClick={() => handleSaveRevenueEdit(appt)}
                                                    className="text-emerald-500 hover:text-emerald-400 transition-colors p-1"
                                                    title="Save"
                                                >
                                                    <Save className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => setEditingRevenueId(null)}
                                                    className="text-zinc-600 hover:text-zinc-400 transition-colors p-1"
                                                    title="Cancel"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => { setEditingRevenueId(appt.id); setEditRevenuePrice(price); }}
                                                className="text-zinc-600 hover:text-orange-500 transition-colors p-1"
                                                title="Edit price"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    }

                    {/* Bonus Entries */}
                    {(bonusEntries || [])
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(entry => {
                            const isEditing = editingBonusId === entry.id;
                            
                            return (
                                <tr key={`bonus-${entry.id}`} className="hover:bg-zinc-800/50 transition-colors">
                                    <td className="p-4">
                                        <span className="bg-amber-900/30 border border-amber-900 text-amber-500 px-2 py-1 text-[10px] uppercase font-bold tracking-wider">
                                            Bonus
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-zinc-500 font-mono">{entry.date}</td>
                                    <td className="p-4">
                                        <p className="font-bold text-white text-sm">{entry.description}</p>
                                        <p className="text-zinc-500 text-xs">Bonus Income</p>
                                    </td>
                                    <td className="p-4 text-right">
                                        {isEditing ? (
                                            <input 
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="w-24 bg-black border border-orange-600 p-1 text-white font-mono text-sm text-right outline-none"
                                                value={editBonusAmount}
                                                onChange={e => setEditBonusAmount(parseFloat(e.target.value) || 0)}
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="font-mono font-bold text-amber-400 text-sm">
                                                ${entry.amount.toFixed(2)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        {isEditing ? (
                                            <div className="flex items-center gap-1 justify-end">
                                                <button 
                                                    onClick={() => handleSaveBonusEdit(entry)}
                                                    className="text-emerald-500 hover:text-emerald-400 transition-colors p-1"
                                                    title="Save"
                                                >
                                                    <Save className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => setEditingBonusId(null)}
                                                    className="text-zinc-600 hover:text-zinc-400 transition-colors p-1"
                                                    title="Cancel"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 justify-end">
                                                <button 
                                                    onClick={() => { setEditingBonusId(entry.id); setEditBonusAmount(entry.amount); }}
                                                    className="text-zinc-600 hover:text-orange-500 transition-colors p-1"
                                                    title="Edit amount"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => onDeleteBonus && onDeleteBonus(entry.id)}
                                                    className="text-zinc-600 hover:text-red-500 transition-colors p-1"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    }

                    {/* Empty State */}
                    {appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length === 0 && (bonusEntries || []).length === 0 && (
                        <tr>
                            <td colSpan={5} className="p-8 text-center text-zinc-500 uppercase tracking-widest text-sm">
                                No revenue recorded yet. Complete appointments or add bonus money to see entries here.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Revenue Log Footer */}
            {(appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length > 0 || (bonusEntries || []).length > 0) && (
                <div className="border-t border-zinc-700 px-4 py-3 bg-black flex justify-between items-center">
                    <span className="text-xs text-zinc-500 uppercase tracking-widest">
                        {appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length} services + {(bonusEntries || []).length} bonuses
                    </span>
                    <span className="font-mono font-bold text-white text-lg">
                        Total: ${grossRevenue.toFixed(2)}
                    </span>
                </div>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Expenses List */}
        <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white uppercase tracking-wider">Expenses Log</h2>
            </div>

            <div className="bg-zinc-900 border border-zinc-800">
                <table className="w-full text-left">
                    <thead className="bg-black border-b border-zinc-800">
                        <tr>
                            <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Item</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Category</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Date</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Amount</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {expenses.length > 0 ? expenses.map(exp => (
                            <tr key={exp.id} className="hover:bg-zinc-800/50 transition-colors">
                                <td className="p-4 font-bold text-white">{exp.name}</td>
                                <td className="p-4 text-sm text-zinc-400">
                                    <span className={`border px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded-sm ${deductibleCategories.includes(exp.category) ? 'bg-emerald-900/30 border-emerald-900 text-emerald-500' : 'bg-zinc-800 border-zinc-700'}`}>
                                        {exp.category}
                                    </span>
                                </td>
                                <td className="p-4 text-sm text-zinc-500 font-mono">{exp.date}</td>
                                <td className="p-4 text-sm text-white font-mono font-bold text-right">${exp.amount.toFixed(2)}</td>
                                <td className="p-4 text-right">
                                    <button onClick={() => onDeleteExpense(exp.id)} className="text-zinc-600 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-zinc-500 uppercase tracking-widest text-sm">
                                    No expenses recorded yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Add Expense Form */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 h-fit">
            <h3 className="font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-600" /> Add Expense
            </h3>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Description</label>
                    <input 
                        type="text" 
                        placeholder="e.g. Shampoo restock"
                        className="w-full bg-black border border-zinc-700 p-3 text-white focus:border-orange-600 outline-none"
                        value={newExpense.name}
                        onChange={e => setNewExpense({...newExpense, name: e.target.value})}
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Amount ($)</label>
                        <input 
                            type="number" 
                            min="0"
                            placeholder="0.00"
                            className="w-full bg-black border border-zinc-700 p-3 text-white focus:border-orange-600 outline-none font-mono"
                            value={newExpense.amount}
                            onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Category</label>
                        <select 
                            className="w-full bg-black border border-zinc-700 p-3 text-white focus:border-orange-600 outline-none appearance-none"
                            value={newExpense.category}
                            onChange={e => setNewExpense({...newExpense, category: e.target.value as any})}
                        >
                            <option value="Supplies">Supplies</option>
                            <option value="Rent">Rent</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>

                <button 
                    onClick={handleSaveExpense}
                    className="w-full mt-4 bg-white text-black py-3 font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
                >
                    Record Expense
                </button>
            </div>
        </div>

      </div>

      {/* Tax Setup Modal */}
      {isTaxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-950 border border-zinc-700 w-full max-w-2xl shadow-2xl">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                    <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-5 h-5 text-orange-600" /> Tax Document Setup
                    </h3>
                    <button onClick={() => setIsTaxModalOpen(false)} className="text-zinc-500 hover:text-white">
                        <Plus className="w-5 h-5 rotate-45"/>
                    </button>
                </div>
                
                <div className="p-8 space-y-8">
                    {/* Section: Write-offs */}
                    <div>
                        <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Write-off Configuration</h4>
                        <p className="text-zinc-500 text-sm mb-6">Select which expense categories are considered tax-deductible for your business type. These will lower your estimated taxable income.</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {['Supplies', 'Rent', 'Marketing', 'Other'].map(category => {
                                const isSelected = deductibleCategories.includes(category);
                                return (
                                    <button 
                                        key={category}
                                        onClick={() => toggleDeductibleCategory(category)}
                                        className={`flex items-center justify-between p-4 border transition-all ${
                                            isSelected 
                                            ? 'bg-emerald-900/20 border-emerald-900' 
                                            : 'bg-black border-zinc-800 hover:border-zinc-700'
                                        }`}
                                    >
                                        <span className={`text-sm font-bold uppercase tracking-wider ${isSelected ? 'text-emerald-500' : 'text-zinc-400'}`}>
                                            {category}
                                        </span>
                                        {isSelected ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5 text-zinc-700" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section: Preview */}
                    <div className="bg-black border border-zinc-800 p-6">
                        <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Current Year Preview</h4>
                        <div className="space-y-3 font-mono text-sm">
                            <div className="flex justify-between text-zinc-400">
                                <span>Total Revenue</span>
                                <span>${grossRevenue.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-emerald-500">
                                <span>Total Write-offs (Deductible)</span>
                                <span>-${totalWriteOffs.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-zinc-800 my-2 pt-2 flex justify-between text-white font-bold">
                                <span>Est. Taxable Income</span>
                                <span>${Math.max(0, grossRevenue - totalWriteOffs).toFixed(2)}</span>
                            </div>
                             <div className="flex justify-between text-yellow-600 text-xs">
                                <span>Est. Tax Due ({business.taxRate}%)</span>
                                <span>${estimatedTax.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                         <button 
                            onClick={() => setIsTaxModalOpen(false)}
                            className="flex-1 py-4 border border-zinc-700 text-white font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                        >
                            Save Settings
                        </button>
                         <button className="flex-1 py-4 bg-white text-black font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                            <Printer className="w-4 h-4" /> Generate Tax PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default MyBusinessView;
