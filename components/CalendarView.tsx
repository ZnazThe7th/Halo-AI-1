
import React, { useState, useEffect } from 'react';
import { Appointment, AppointmentStatus, BusinessProfile, RecurrenceRule } from '../types';
import { ChevronLeft, ChevronRight, Filter, Calendar as CalendarIcon, Clock, X, Edit3, User, Repeat, Save, Globe, Plus, CheckCircle, Ban, Lock, List, Grid } from 'lucide-react';
import { formatTime } from '../constants';

interface CalendarViewProps {
  appointments: Appointment[];
  business: BusinessProfile;
  onUpdateAppointment: (appt: Appointment) => void;
  onAddAppointment: (appt: Appointment) => void;
}

const TIME_ZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

const CalendarView: React.FC<CalendarViewProps> = ({ appointments, business, onUpdateAppointment, onAddAppointment }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK'>('MONTH');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'ALL'>('ALL');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment & { displayTime?: string } | null>(null);
  const [selectedTimeZone, setSelectedTimeZone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Sync selectedAppointment with appointments prop when it changes
  useEffect(() => {
    if (selectedAppointment) {
      const updatedAppt = appointments.find(a => a.id === selectedAppointment.id);
      if (updatedAppt) {
        // Preserve displayTime if it exists
        setSelectedAppointment({ 
          ...updatedAppt, 
          displayTime: selectedAppointment.displayTime || formatTime(updatedAppt.time) 
        });
      }
    }
  }, [appointments, selectedAppointment?.id]);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Appointment>>({});
  const [isNew, setIsNew] = useState(false);
  const [entryType, setEntryType] = useState<'APPOINTMENT' | 'BLOCK'>('APPOINTMENT');

  // Calendar Logic Helpers
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'MONTH') {
        newDate.setMonth(newDate.getMonth() - 1);
    } else {
        newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'MONTH') {
        newDate.setMonth(newDate.getMonth() + 1);
    } else {
        newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  // --- Date Math ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Generate grid cells for Month View
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
  const blanks = Array(firstDayOfMonth).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const totalSlots = [...blanks, ...days];

  // Helper to get formatted date string
  const getDateString = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Helper for Week View Dates
  const getWeekDates = () => {
      const dates = [];
      const curr = new Date(currentDate);
      const day = curr.getDay(); // 0-6
      const diff = curr.getDate() - day; // Adjust to Sunday
      
      const startOfWeek = new Date(curr.setDate(diff));
      
      for (let i = 0; i < 7; i++) {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          dates.push(d);
      }
      return dates;
  };

  /**
   * Checks if an appointment occurs on a specific BASE date (UTC), handling recurrence.
   */
  const isOccurrence = (appt: Appointment, targetDateStr: string): boolean => {
    // 1. Exact match (Base case)
    if (appt.date === targetDateStr) return true;

    // 2. No recurrence? No match.
    if (!appt.recurrence) return false;

    // 3. Check recurrence range
    const apptDate = new Date(appt.date);
    const targetDate = new Date(targetDateStr);
    
    // If target is before start date
    if (targetDate < apptDate) return false;
    
    // If target is after end date (if exists)
    if (appt.recurrence.endDate && targetDate > new Date(appt.recurrence.endDate)) return false;

    // 4. Check Interval logic
    const diffTime = Math.abs(targetDate.getTime() - apptDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (appt.recurrence.frequency === 'WEEKLY') {
        if (diffDays % 7 !== 0) return false;
        const weeksPassed = diffDays / 7;
        return weeksPassed % appt.recurrence.interval === 0;
    }

    if (appt.recurrence.frequency === 'MONTHLY') {
        if (targetDate.getDate() !== apptDate.getDate()) return false;
        const monthDiff = (targetDate.getFullYear() - apptDate.getFullYear()) * 12 + (targetDate.getMonth() - apptDate.getMonth());
        return monthDiff % appt.recurrence.interval === 0;
    }

    return false;
  };

  const getAppointmentsForDate = (date: Date) => {
    const targetDateStr = getDateString(date);

    // Create candidates for "Base Date" (UTC) checking.
    const candidates = [
        targetDateStr,
        new Date(date.getTime() - 86400000).toISOString().split('T')[0],
        new Date(date.getTime() + 86400000).toISOString().split('T')[0]
    ];

    const dayAppointments: (Appointment & { displayTime: string; _sortTime: string; _duration: number })[] = [];
    const seenIds = new Set<string>();

    appointments.forEach(appt => {
        if (statusFilter !== 'ALL' && appt.status !== statusFilter) return;

        candidates.forEach(baseDateStr => {
             if (isOccurrence(appt, baseDateStr)) {
                 // Treat stored time as local time in the selected timezone (not UTC)
                 // This means we display the time as-is without conversion
                 // The time stored should match what the user entered
                 
                 // Check if the appointment date matches the target date
                 if (baseDateStr === targetDateStr) {
                     if (!seenIds.has(appt.id)) {
                         // Find duration
                         const service = business.services.find(s => s.id === appt.serviceId);
                         const duration = service ? service.durationMin : 60; // Default 60 for blocked

                         // Display time directly (treating it as local time in selected timezone)
                         // No timezone conversion needed - time is stored as entered
                         dayAppointments.push({ 
                             ...appt, 
                             displayTime: formatTime(appt.time), 
                             _sortTime: appt.time,
                             _duration: duration
                         });
                         seenIds.add(appt.id);
                     }
                 }
             }
        });
    });
    
    return dayAppointments.sort((a, b) => a._sortTime.localeCompare(b._sortTime));
  };

  const getServiceName = (serviceId: string) => {
      return business.services.find(s => s.id === serviceId)?.name || 'Unknown Service';
  };

  const getServicePrice = (serviceId: string, appointment?: Appointment) => {
      const service = business.services.find(s => s.id === serviceId);
      if (!service) return 0;
      
      // If service is price per person, use numberOfPeople if available, otherwise use clientIds length
      if (service.pricePerPerson) {
        if (appointment?.numberOfPeople) {
          return service.price * appointment.numberOfPeople;
        } else if (appointment?.clientIds && appointment.clientIds.length > 1) {
          return service.price * appointment.clientIds.length;
        }
        // Default to 1 if no number specified
        return service.price;
      }
      
      return service.price;
  };
  
  // Helper to check if selected service has price per person
  const getSelectedService = () => {
    return business.services.find(s => s.id === editForm.serviceId);
  };

  const handleCellClick = (date: Date, timeStr = '09:00') => {
      const dateStr = getDateString(date);
      // Adjust dateStr if clicking in a timezone that pushes it to prev/next day in UTC? 
      // For MVP simplicity, we assume new bookings are created on the clicked Date string in Base time.
      
      const defaultService = business.services[0];
      if (!defaultService) {
          alert('Please add a service first in Settings before creating appointments.');
          return;
      }
      
      const newAppt: Appointment = {
          id: Math.random().toString(36).substring(2, 9),
          clientId: '',
          clientName: '',
          clientIds: [],
          clientNames: [],
          serviceId: defaultService.id,
          date: dateStr,
          time: timeStr,
          status: AppointmentStatus.CONFIRMED,
          recurrence: undefined,
          numberOfPeople: defaultService.pricePerPerson ? 1 : undefined
      };
      
      setSelectedAppointment({ ...newAppt, displayTime: formatTime(timeStr) });
      setEditForm(newAppt);
      setIsEditing(true);
      setIsNew(true);
      setEntryType('APPOINTMENT');
  };

  const handleEditClick = () => {
      if (selectedAppointment) {
          setEditForm({ ...selectedAppointment });
          setIsEditing(true);
          setIsNew(false);
          setEntryType(selectedAppointment.status === AppointmentStatus.BLOCKED ? 'BLOCK' : 'APPOINTMENT');
      }
  };

  const handleSave = () => {
      // Validate required fields
      if (entryType === 'APPOINTMENT' && !editForm.serviceId) {
          alert('Please select a service');
          return;
      }
      
      if (entryType === 'APPOINTMENT' && !editForm.clientName && !editForm.clientNames?.length) {
          alert('Please enter a client name');
          return;
      }

      if (!editForm.date || !editForm.time) {
          alert('Please enter date and time');
          return;
      }

      let updatedAppt = { ...selectedAppointment, ...editForm } as Appointment;
      
      if (entryType === 'BLOCK') {
          updatedAppt.status = AppointmentStatus.BLOCKED;
          updatedAppt.serviceId = 'BLOCK';
          updatedAppt.clientId = 'BLOCK';
          updatedAppt.clientName = editForm.clientName || 'Blocked Time';
          updatedAppt.clientIds = ['BLOCK'];
          updatedAppt.clientNames = [editForm.clientName || 'Blocked Time'];
      } else {
          // Ensure appointment has proper structure
          if (updatedAppt.status === AppointmentStatus.BLOCKED) {
              updatedAppt.status = AppointmentStatus.CONFIRMED;
          }
          
          // Handle client information
          if (editForm.clientNames && editForm.clientNames.length > 0) {
              // Multiple clients
              updatedAppt.clientNames = editForm.clientNames.filter((name: string) => name.trim() !== '');
              updatedAppt.clientName = updatedAppt.clientNames[0] || '';
              // Generate temporary client IDs if not provided
              if (!editForm.clientIds || editForm.clientIds.length !== updatedAppt.clientNames.length) {
                  updatedAppt.clientIds = updatedAppt.clientNames.map((_, i) => `temp_${Date.now()}_${i}`);
              } else {
                  updatedAppt.clientIds = editForm.clientIds;
              }
              updatedAppt.clientId = updatedAppt.clientIds[0] || '';
          } else if (editForm.clientName) {
              // Single client
              updatedAppt.clientName = editForm.clientName;
              updatedAppt.clientId = editForm.clientId || `temp_${Date.now()}`;
              updatedAppt.clientIds = [updatedAppt.clientId];
              updatedAppt.clientNames = [updatedAppt.clientName];
          }
          
          // Ensure service is valid
          if (!updatedAppt.serviceId || updatedAppt.serviceId === 'BLOCK') {
              const defaultService = business.services[0];
              if (defaultService) {
                  updatedAppt.serviceId = defaultService.id;
              } else {
                  alert('No services available. Please add a service first.');
                  return;
              }
          }
          
          // Handle numberOfPeople for price-per-person services
          const service = business.services.find(s => s.id === updatedAppt.serviceId);
          if (service?.pricePerPerson) {
              if (editForm.numberOfPeople) {
                  updatedAppt.numberOfPeople = editForm.numberOfPeople;
                  // Ensure clientNames array matches numberOfPeople
                  if (updatedAppt.clientNames.length < editForm.numberOfPeople) {
                      // Pad with placeholder names if needed
                      while (updatedAppt.clientNames.length < editForm.numberOfPeople) {
                          updatedAppt.clientNames.push(`Client ${updatedAppt.clientNames.length + 1}`);
                      }
                  }
              } else {
                  updatedAppt.numberOfPeople = updatedAppt.clientNames?.length || 1;
              }
          } else {
              // Not price per person, ensure single client
              updatedAppt.numberOfPeople = undefined;
          }
      }

      // Ensure all required fields are present
      if (!updatedAppt.id) {
          updatedAppt.id = Math.random().toString(36).substring(2, 9);
      }

      if (isNew) {
          onAddAppointment(updatedAppt);
          // Close modal after adding
          setSelectedAppointment(null);
          setIsEditing(false);
          setIsNew(false);
      } else {
          onUpdateAppointment(updatedAppt);
          // Update local state to reflect changes immediately
          const updatedWithDisplayTime = { ...updatedAppt, displayTime: formatTime(updatedAppt.time) };
          setSelectedAppointment(updatedWithDisplayTime);
          setIsEditing(false);
          setIsNew(false);
          // Keep modal open to show updated appointment
      }
  };

  const handleComplete = () => {
      if (selectedAppointment) {
          const completedAppt = { ...selectedAppointment, status: AppointmentStatus.COMPLETED };
          onUpdateAppointment(completedAppt);
          // Update local state to reflect the change immediately
          // Keep displayTime if it exists
          const updatedWithDisplayTime = { 
              ...completedAppt, 
              displayTime: selectedAppointment.displayTime || formatTime(completedAppt.time)
          };
          setSelectedAppointment(updatedWithDisplayTime);
      }
  };

  const toggleRecurrence = () => {
      if (editForm.recurrence) {
          setEditForm({ ...editForm, recurrence: undefined });
      } else {
          setEditForm({
              ...editForm,
              recurrence: { frequency: 'WEEKLY', interval: 1 }
          });
      }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col relative">
      {/* Header */}
      <header className="mb-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-4xl font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-3">
             <CalendarIcon className="w-8 h-8 text-orange-600" />
             Master Schedule
          </h1>
          <p className="text-zinc-500">Manage bookings and availability.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
             {/* View Toggle */}
             <div className="flex bg-zinc-900 border border-zinc-800 p-1">
                 <button 
                    onClick={() => setViewMode('MONTH')}
                    className={`px-3 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors ${viewMode === 'MONTH' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                 >
                     <Grid className="w-4 h-4" /> Month
                 </button>
                 <button 
                    onClick={() => setViewMode('WEEK')}
                    className={`px-3 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors ${viewMode === 'WEEK' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                 >
                     <List className="w-4 h-4" /> Week
                 </button>
             </div>

             {/* Timezone Selector */}
             <div className="relative group">
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-3 cursor-pointer hover:border-zinc-600 transition-colors min-w-[200px]">
                    <Globe className="w-4 h-4 text-orange-600" />
                    <select 
                        value={selectedTimeZone}
                        onChange={(e) => setSelectedTimeZone(e.target.value)}
                        className="bg-transparent text-white text-xs font-bold uppercase tracking-widest outline-none appearance-none cursor-pointer pr-4 w-full"
                    >
                        {TIME_ZONES.map(tz => (
                            <option key={tz.value} value={tz.value} className="text-black">{tz.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Filter */}
            <div className="relative group">
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-3 cursor-pointer hover:border-zinc-600 transition-colors">
                    <Filter className="w-4 h-4 text-zinc-500" />
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-transparent text-white text-xs font-bold uppercase tracking-widest outline-none appearance-none cursor-pointer pr-4"
                    >
                        <option value="ALL" className="text-black">All Status</option>
                        <option value={AppointmentStatus.CONFIRMED} className="text-black">Confirmed</option>
                        <option value={AppointmentStatus.PENDING} className="text-black">Pending</option>
                        <option value={AppointmentStatus.COMPLETED} className="text-black">Completed</option>
                        <option value={AppointmentStatus.BLOCKED} className="text-black">Blocked Time</option>
                    </select>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800">
                <button onClick={handlePrev} className="p-3 hover:bg-zinc-800 text-white transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-6 py-3 border-x border-zinc-800 min-w-[140px] text-center">
                    <span className="text-sm font-bold text-white uppercase tracking-widest">
                        {viewMode === 'MONTH' ? `${monthName} ${year}` : `${currentDate.toLocaleDateString()} (Week)`}
                    </span>
                </div>
                <button onClick={handleNext} className="p-3 hover:bg-zinc-800 text-white transition-colors">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
      </header>

      {/* --- MONTH VIEW GRID --- */}
      {viewMode === 'MONTH' && (
        <div className="flex-1 bg-zinc-900 border border-zinc-800 flex flex-col">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-zinc-800">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-4 text-center border-r border-zinc-800 last:border-r-0">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{day}</span>
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                {totalSlots.map((day, index) => {
                    if (day === null) {
                        return <div key={`blank-${index}`} className="bg-black/40 border-r border-b border-zinc-800 min-h-[120px]"></div>;
                    }

                    const date = new Date(year, month, day);
                    const dayAppointments = getAppointmentsForDate(date);
                    const isToday = new Date().toDateString() === date.toDateString();

                    return (
                        <div 
                            key={day} 
                            onClick={() => handleCellClick(date)}
                            className={`border-r border-b border-zinc-800 p-2 min-h-[120px] relative group hover:bg-zinc-800/30 transition-colors cursor-pointer ${index % 7 === 6 ? 'border-r-0' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-sm font-mono font-bold w-7 h-7 flex items-center justify-center rounded-sm ${isToday ? 'bg-orange-600 text-black' : 'text-zinc-400'}`}>
                                    {day}
                                </span>
                                {dayAppointments.length > 0 && (
                                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">{dayAppointments.length} Items</span>
                                )}
                            </div>
                            
                            <div className="space-y-1">
                                {dayAppointments.map(appt => {
                                    const isBlocked = appt.status === AppointmentStatus.BLOCKED;
                                    return (
                                        <div 
                                            key={appt.id} 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                // Get the latest appointment data from the appointments prop
                                                const latestAppt = appointments.find(a => a.id === appt.id) || appt;
                                                setSelectedAppointment({ ...latestAppt, displayTime: appt.displayTime });
                                                setIsEditing(false); 
                                                setIsNew(false); 
                                            }}
                                            className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wide border-l-2 truncate cursor-pointer hover:brightness-110 transition-all ${
                                                isBlocked ? 'bg-zinc-900/50 border-zinc-600 text-zinc-400 border-dashed italic' :
                                                appt.status === AppointmentStatus.CONFIRMED ? 'bg-zinc-800 border-emerald-500 text-white' : 
                                                appt.status === AppointmentStatus.PENDING ? 'bg-zinc-800 border-yellow-500 text-yellow-500' :
                                                appt.status === AppointmentStatus.COMPLETED ? 'bg-zinc-800 border-blue-500 text-blue-500' :
                                                'bg-zinc-800 border-zinc-500 text-zinc-500'
                                            }`}
                                        >
                                            {appt.recurrence && <Repeat className="inline w-3 h-3 mr-1 text-orange-500" />}
                                            {isBlocked && <Ban className="inline w-3 h-3 mr-1 text-zinc-500" />}
                                            <span className="mr-1 opacity-75">{appt.displayTime}</span>
                                            {appt.clientNames && appt.clientNames.length > 1 
                                              ? `${appt.clientNames.length} clients` 
                                              : (appt.clientName || 'No client name')}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Hover Add Icon */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                                <Plus className="w-8 h-8 text-zinc-700" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {/* --- WEEK VIEW GRID --- */}
      {viewMode === 'WEEK' && (
          <div className="flex-1 bg-zinc-900 border border-zinc-800 flex flex-col overflow-auto">
              <div className="flex flex-1 min-w-[800px]">
                  {/* Time Axis */}
                  <div className="w-16 border-r border-zinc-800 flex-shrink-0 bg-zinc-950">
                      <div className="h-10 border-b border-zinc-800"></div> {/* Header spacer */}
                      {Array.from({length: 10}).map((_, i) => { // 9 AM to 6 PM
                          const hour = i + 9;
                          return (
                            <div key={hour} className="h-24 border-b border-zinc-800 text-[10px] text-zinc-500 font-mono text-right pr-2 pt-2">
                                {hour}:00
                            </div>
                          )
                      })}
                  </div>
                  
                  {/* Columns */}
                  {getWeekDates().map((date, i) => {
                       const isToday = new Date().toDateString() === date.toDateString();
                       const dayAppointments = getAppointmentsForDate(date);
                       
                       return (
                           <div key={i} className="flex-1 border-r border-zinc-800 min-w-[120px] relative bg-zinc-900/50">
                               {/* Column Header */}
                               <div className={`h-10 border-b border-zinc-800 flex items-center justify-center gap-2 ${isToday ? 'bg-orange-600/10' : ''}`}>
                                    <span className="text-xs font-bold uppercase text-zinc-500">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()]}</span>
                                    <span className={`text-sm font-bold font-mono ${isToday ? 'text-orange-500' : 'text-white'}`}>{date.getDate()}</span>
                               </div>

                               {/* Time Slots Background */}
                               <div className="relative h-[960px]"> {/* 10 hours * 96px height */}
                                   {Array.from({length: 10}).map((_, idx) => (
                                       <div 
                                            key={idx} 
                                            onClick={(e) => {
                                                // Calculate time clicked (rough)
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const y = e.clientY - rect.top; // pixel within cell
                                                const minAdded = y > 48 ? 30 : 0;
                                                handleCellClick(date, `${idx+9}:${minAdded === 0 ? '00' : '30'}`);
                                            }}
                                            className="h-24 border-b border-zinc-800/50 hover:bg-zinc-800 transition-colors cursor-pointer"
                                       ></div>
                                   ))}

                                   {/* Appointments */}
                                   {dayAppointments.map(appt => {
                                       const [h, m] = appt._sortTime.split(':').map(Number);
                                       if (h < 9 || h > 18) return null; // Out of view for MVP
                                       
                                       // Calculate positions
                                       const startMin = (h - 9) * 60 + m;
                                       const top = (startMin / (10 * 60)) * 100; // % of height
                                       const height = (appt._duration / (10 * 60)) * 100; // % of height
                                       
                                       const isBlocked = appt.status === AppointmentStatus.BLOCKED;

                                       return (
                                           <div 
                                                key={appt.id}
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    // Get the latest appointment data from the appointments prop
                                                    const latestAppt = appointments.find(a => a.id === appt.id) || appt;
                                                    setSelectedAppointment({ ...latestAppt, displayTime: appt.displayTime });
                                                    setIsEditing(false); 
                                                    setIsNew(false); 
                                                }}
                                                className={`absolute inset-x-1 rounded-sm p-2 text-[10px] font-bold uppercase border-l-2 overflow-hidden cursor-pointer hover:z-10 hover:shadow-lg transition-all ${
                                                    isBlocked ? 'bg-zinc-900 border-zinc-600 text-zinc-400 border-dashed opacity-80' :
                                                    appt.status === AppointmentStatus.CONFIRMED ? 'bg-emerald-900/80 border-emerald-500 text-white' :
                                                    appt.status === AppointmentStatus.PENDING ? 'bg-yellow-900/80 border-yellow-500 text-yellow-100' :
                                                    'bg-blue-900/80 border-blue-500 text-blue-100'
                                                }`}
                                                style={{ top: `${top}%`, height: `${height}%` }}
                                           >
                                               <div className="flex justify-between">
                                                    <span>{appt.displayTime}</span>
                                                    {isBlocked && <Ban className="w-3 h-3" />}
                                               </div>
                                               <div className="truncate">
                                                 {appt.clientNames && appt.clientNames.length > 1 
                                                   ? `${appt.clientNames.length} clients` 
                                                   : (appt.clientName || 'No client name')}
                                               </div>
                                           </div>
                                       );
                                   })}
                               </div>
                           </div>
                       );
                  })}
              </div>
          </div>
      )}

       {/* Appointment Details/Edit Modal */}
       {selectedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-zinc-950 border border-zinc-700 w-full max-w-lg shadow-2xl relative">
                  <button 
                    onClick={() => setSelectedAppointment(null)}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                  >
                      <X className="w-6 h-6" />
                  </button>

                  <div className="p-8">
                      <div className="mb-6 border-b border-zinc-800 pb-4 flex justify-between items-center">
                          <div>
                            <h2 className="text-2xl font-bold text-white uppercase tracking-wider mb-1">
                                {isEditing ? (isNew ? (entryType === 'BLOCK' ? 'Block Time' : 'New Appointment') : 'Edit Entry') : (selectedAppointment.status === AppointmentStatus.BLOCKED ? 'Blocked Period' : 'Appointment Details')}
                            </h2>
                            <p className="text-zinc-500 font-mono text-sm uppercase">ID: {selectedAppointment.id}</p>
                          </div>
                          {selectedAppointment.recurrence && !isEditing && (
                              <div className="flex items-center gap-2 bg-zinc-900 border border-orange-900/50 px-3 py-1 rounded-sm">
                                  <Repeat className="w-3 h-3 text-orange-600" />
                                  <span className="text-[10px] uppercase font-bold text-orange-500 tracking-widest">Recurring</span>
                              </div>
                          )}
                      </div>

                      {!isEditing ? (
                          <div className="space-y-6">
                              {/* Read Only View */}
                              {selectedAppointment.status === AppointmentStatus.BLOCKED ? (
                                    <div className="flex items-center gap-4 p-6 bg-zinc-900/50 border border-dashed border-zinc-700">
                                        <div className="w-12 h-12 bg-zinc-800 flex items-center justify-center text-zinc-400 rounded-full">
                                            <Lock className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Reason</p>
                                            <p className="text-lg font-bold text-zinc-300">
                                              {selectedAppointment.clientNames && selectedAppointment.clientNames.length > 1
                                                ? selectedAppointment.clientNames.join(', ')
                                                : selectedAppointment.clientName}
                                            </p>
                                        </div>
                                    </div>
                              ) : (
                                <div className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800">
                                        <div className="w-12 h-12 bg-zinc-800 flex items-center justify-center text-zinc-400">
                                            <User className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Client{selectedAppointment.clientNames && selectedAppointment.clientNames.length > 1 ? 's' : ''}</p>
                                            {selectedAppointment.clientNames && selectedAppointment.clientNames.length > 1 ? (
                                              <div className="space-y-1">
                                                {selectedAppointment.clientNames.map((name, idx) => (
                                                  <p key={idx} className="text-lg font-bold text-white">{name}</p>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="text-lg font-bold text-white">{selectedAppointment.clientName}</p>
                                            )}
                                        </div>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-zinc-900 border border-zinc-800">
                                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <CalendarIcon className="w-3 h-3" /> Date
                                        </p>
                                        <p className="text-white font-mono">
                                            {selectedAppointment.date}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-zinc-900 border border-zinc-800">
                                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <Clock className="w-3 h-3" /> Time ({selectedTimeZone.split('/')[1] || 'Local'})
                                        </p>
                                        <p className="text-white font-mono text-xl">{selectedAppointment.displayTime}</p>
                                    </div>
                              </div>
                              
                              {selectedAppointment.status !== AppointmentStatus.BLOCKED && (
                                <div className="p-4 bg-zinc-900 border border-zinc-800">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Service</p>
                                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Price</p>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div>
                                              <p className="text-white font-bold">{getServiceName(selectedAppointment.serviceId)}</p>
                                              {(() => {
                                                const service = business.services.find(s => s.id === selectedAppointment.serviceId);
                                                if (service?.pricePerPerson && selectedAppointment.numberOfPeople) {
                                                  return (
                                                    <p className="text-xs text-zinc-500 mt-1">
                                                      {selectedAppointment.numberOfPeople} {selectedAppointment.numberOfPeople === 1 ? 'person' : 'people'}
                                                    </p>
                                                  );
                                                }
                                                return null;
                                              })()}
                                            </div>
                                            <div className="text-right">
                                              <p className="text-orange-500 font-mono font-bold">${getServicePrice(selectedAppointment.serviceId, selectedAppointment)}</p>
                                              {(() => {
                                                const service = business.services.find(s => s.id === selectedAppointment.serviceId);
                                                if (service?.pricePerPerson) {
                                                  const numPeople = selectedAppointment.numberOfPeople || (selectedAppointment.clientIds?.length || 1);
                                                  return (
                                                    <p className="text-xs text-zinc-500">
                                                      ({numPeople} × ${service.price})
                                                    </p>
                                                  );
                                                }
                                                return null;
                                              })()}
                                            </div>
                                        </div>
                                </div>
                              )}

                              {selectedAppointment.recurrence && (
                                  <div className="p-4 bg-zinc-900 border border-zinc-800 border-l-4 border-l-orange-600">
                                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                          <Repeat className="w-3 h-3" /> Recurrence Pattern
                                      </p>
                                      <p className="text-white text-sm">
                                          Repeats every <span className="font-bold text-orange-500">{selectedAppointment.recurrence.interval}</span> {selectedAppointment.recurrence.frequency.toLowerCase()}(s)
                                          {selectedAppointment.recurrence.endDate && ` until ${selectedAppointment.recurrence.endDate}`}.
                                      </p>
                                  </div>
                              )}

                              <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Status:</span>
                                    <span className={`px-3 py-1 text-xs font-bold uppercase tracking-widest border ${
                                        selectedAppointment.status === AppointmentStatus.CONFIRMED ? 'bg-emerald-950 text-emerald-500 border-emerald-900' : 
                                        selectedAppointment.status === AppointmentStatus.PENDING ? 'bg-yellow-950 text-yellow-500 border-yellow-900' :
                                        selectedAppointment.status === AppointmentStatus.COMPLETED ? 'bg-blue-950 text-blue-500 border-blue-900' :
                                        selectedAppointment.status === AppointmentStatus.BLOCKED ? 'bg-zinc-800 text-zinc-500 border-zinc-600 border-dashed' :
                                        'bg-zinc-800 text-zinc-400 border-zinc-700'
                                    }`}>
                                        {selectedAppointment.status}
                                    </span>
                              </div>

                              <div className="mt-8 flex gap-4">
                                  {selectedAppointment.status !== AppointmentStatus.COMPLETED && selectedAppointment.status !== AppointmentStatus.BLOCKED && (
                                      <button 
                                        onClick={handleComplete}
                                        className="flex-1 py-4 bg-emerald-700 text-white font-bold uppercase tracking-widest hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                                      >
                                          <CheckCircle className="w-4 h-4" /> Complete
                                      </button>
                                  )}
                                  <button 
                                    onClick={handleEditClick}
                                    className="flex-1 py-4 bg-orange-600 text-black font-bold uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2"
                                  >
                                      <Edit3 className="w-4 h-4" /> Edit
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-6">
                              {/* Edit Form */}
                              
                              {/* Type Switcher (Only if New) */}
                              {isNew && (
                                  <div className="flex border border-zinc-800 p-1 bg-zinc-900">
                                      <button 
                                        onClick={() => setEntryType('APPOINTMENT')}
                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${entryType === 'APPOINTMENT' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                                      >
                                          Appointment
                                      </button>
                                      <button 
                                        onClick={() => setEntryType('BLOCK')}
                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${entryType === 'BLOCK' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                                      >
                                          Block Time
                                      </button>
                                  </div>
                              )}

                              <div>
                                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">
                                      {entryType === 'BLOCK' ? 'Block Reason / Label' : 'Client Name'}
                                  </label>
                                  <input 
                                    type="text" 
                                    value={editForm.clientName}
                                    onChange={e => setEditForm({...editForm, clientName: e.target.value})}
                                    placeholder={entryType === 'BLOCK' ? 'e.g. Lunch Break, Closed' : 'Client Name'}
                                    className="w-full p-3 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none"
                                  />
                              </div>
                              
                              {entryType === 'APPOINTMENT' && (
                                <>
                                  <div>
                                      <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Service</label>
                                      <select
                                          value={editForm.serviceId}
                                          onChange={e => {
                                            const newServiceId = e.target.value;
                                            const service = business.services.find(s => s.id === newServiceId);
                                            // Reset numberOfPeople when changing service
                                            setEditForm({
                                              ...editForm, 
                                              serviceId: newServiceId,
                                              numberOfPeople: service?.pricePerPerson ? (editForm.numberOfPeople || 1) : undefined
                                            });
                                          }}
                                          className="w-full p-3 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none appearance-none"
                                      >
                                          {business.services.map(s => (
                                              <option key={s.id} value={s.id}>
                                                {s.name} - ${s.price}{s.pricePerPerson ? ' per person' : ''}
                                              </option>
                                          ))}
                                      </select>
                                  </div>
                                  {getSelectedService()?.pricePerPerson && (
                                    <div>
                                      <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Number of People</label>
                                      <input 
                                        type="number" 
                                        min="1"
                                        value={editForm.numberOfPeople || 1}
                                        onChange={e => setEditForm({...editForm, numberOfPeople: parseInt(e.target.value) || 1})}
                                        className="w-full p-3 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none font-mono"
                                        placeholder="1"
                                      />
                                    </div>
                                  )}
                                </>
                              )}

                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Date</label>
                                      <input 
                                        type="date" 
                                        value={editForm.date}
                                        onChange={e => setEditForm({...editForm, date: e.target.value})}
                                        className="w-full p-3 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none font-mono"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Time (24h format)</label>
                                      <input 
                                        type="time" 
                                        value={editForm.time}
                                        onChange={e => setEditForm({...editForm, time: e.target.value})}
                                        className="w-full p-3 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none font-mono"
                                      />
                                  </div>
                              </div>
                              <p className="text-[10px] text-zinc-500 -mt-2">Time is stored as entered and displayed in your selected timezone ({selectedTimeZone.split('/')[selectedTimeZone.split('/').length - 1] || selectedTimeZone}).</p>

                              {/* Recurrence Editor */}
                              <div className="border border-zinc-800 bg-zinc-900/50 p-4">
                                  <div className="flex items-center justify-between mb-4">
                                      <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                          <Repeat className="w-4 h-4 text-orange-600" /> Recurring {entryType === 'BLOCK' ? 'Block' : 'Appointment'}
                                      </span>
                                      <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={!!editForm.recurrence} onChange={toggleRecurrence} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                                      </label>
                                  </div>
                                  
                                  {editForm.recurrence && (
                                      <div className="space-y-4 pt-4 border-t border-zinc-800 animate-fade-in">
                                          <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                  <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Frequency</label>
                                                  <select 
                                                    value={editForm.recurrence.frequency}
                                                    onChange={e => setEditForm({
                                                        ...editForm, 
                                                        recurrence: { ...editForm.recurrence!, frequency: e.target.value as any }
                                                    })}
                                                    className="w-full p-2 bg-black border border-zinc-700 text-white text-sm outline-none focus:border-orange-600"
                                                  >
                                                      <option value="WEEKLY">Weekly</option>
                                                      <option value="MONTHLY">Monthly</option>
                                                  </select>
                                              </div>
                                              <div>
                                                  <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Every X Weeks/Months</label>
                                                  <input 
                                                    type="number" 
                                                    min="1"
                                                    value={editForm.recurrence.interval}
                                                    onChange={e => setEditForm({
                                                        ...editForm, 
                                                        recurrence: { ...editForm.recurrence!, interval: parseInt(e.target.value) }
                                                    })}
                                                    className="w-full p-2 bg-black border border-zinc-700 text-white text-sm outline-none focus:border-orange-600"
                                                  />
                                              </div>
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">End Date (Optional)</label>
                                              <input 
                                                type="date"
                                                value={editForm.recurrence.endDate || ''}
                                                onChange={e => setEditForm({
                                                    ...editForm, 
                                                    recurrence: { ...editForm.recurrence!, endDate: e.target.value }
                                                })}
                                                className="w-full p-2 bg-black border border-zinc-700 text-white text-sm outline-none focus:border-orange-600 font-mono"
                                              />
                                          </div>
                                      </div>
                                  )}
                              </div>

                              <div className="mt-8 flex gap-4">
                                  <button 
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 py-4 border border-zinc-700 text-white font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                                  >
                                      Cancel
                                  </button>
                                  <button 
                                    onClick={handleSave}
                                    className="flex-1 py-4 bg-white text-black font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                                  >
                                      <Save className="w-4 h-4" /> Save {isNew ? 'New' : 'Changes'}
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CalendarView;
