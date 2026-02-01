
import React, { useState, useMemo } from 'react';
import { Appointment, BusinessProfile, AppointmentStatus } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { Calendar, Clock, DollarSign, MoreVertical, Star, ArrowRight, CheckCircle, TrendingUp, Trash2, Edit3, X, Save, Ban } from 'lucide-react';
import { formatTime } from '../constants';

interface DashboardProps {
  business: BusinessProfile;
  appointments: Appointment[];
  onViewAllAppointments: () => void;
  onUpdateAppointment: (appt: Appointment) => void;
  onRemoveAppointment: (id: string) => void;
  onNavigateToCalendar: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  business, 
  appointments, 
  onViewAllAppointments, 
  onUpdateAppointment,
  onRemoveAppointment,
  onNavigateToCalendar
}) => {
    // Basic stats logic
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = appointments.filter(a => a.date === today).sort((a,b) => a.time.localeCompare(b.time));
    const upcomingAppointments = appointments.filter(a => a.date > today).sort((a,b) => a.date.localeCompare(b.date));
    
    // Revenue Estimate (Completed appointments only)
    const completedAppts = appointments.filter(a => a.status === AppointmentStatus.COMPLETED);
    const revenueEst = completedAppts.reduce((sum, appt) => {
        const s = business.services.find(serv => serv.id === appt.serviceId);
        return sum + (s ? s.price : 0);
    }, 0);

    // Today's Revenue
    const todayRevenue = todayAppointments
        .filter(a => a.status === AppointmentStatus.COMPLETED)
        .reduce((sum, appt) => {
            const s = business.services.find(serv => serv.id === appt.serviceId);
            return sum + (s ? s.price : 0);
        }, 0);
    
    // Dynamic Chart Data: Last 7 Days
    const chartData = useMemo(() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const data = [];
        const todayDate = new Date();
        
        // Generate last 7 days including today (reversed order for chart: oldest -> newest)
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(todayDate.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = days[d.getDay()];
            
            // Count actual bookings for this day
            const count = appointments.filter(a => 
                a.date === dateStr && a.status !== AppointmentStatus.CANCELLED && a.status !== AppointmentStatus.BLOCKED
            ).length;
            
            data.push({ name: dayName, bookings: count });
        }
        return data;
    }, [appointments]);

    // Halo Assistant: Schedule Analysis
    const findScheduleInsight = () => {
        const startHour = 9; // Shop open
        const endHour = 18;  // Shop close
        
        const sorted = todayAppointments.filter(a => a.status !== AppointmentStatus.CANCELLED).sort((a,b) => a.time.localeCompare(b.time));
        
        if (sorted.length === 0) {
            return "FULL DAY OPEN. CONSIDER A SOCIAL MEDIA PROMO.";
        }
        
        // Check Morning Gap
        if (sorted[0].time > "10:00") {
             return "MORNING OPENING: SCHEDULE IS FREE UNTIL " + formatTime(sorted[0].time).toUpperCase();
        }

        // Check gaps between appointments
        for (let i = 0; i < sorted.length - 1; i++) {
            const curr = sorted[i];
            const next = sorted[i+1];
            
            const service = business.services.find(s => s.id === curr.serviceId);
            const duration = service?.durationMin || 60;
            
            const [h, m] = curr.time.split(':').map(Number);
            const currEndTime = new Date(2000, 0, 1, h, m + duration);
            const nextStartTime = new Date(2000, 0, 1, ...next.time.split(':').map(Number));
            
            const diffMinutes = (nextStartTime.getTime() - currEndTime.getTime()) / 60000;
            
            if (diffMinutes >= 60) {
                const startStr = currEndTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
                const endStr = next.time;
                return `${(diffMinutes/60).toFixed(1)}HR GAP DETECTED BETWEEN ${startStr} AND ${endStr}`;
            }
        }
        
        // Check Evening Gap
        const last = sorted[sorted.length - 1];
        const lastService = business.services.find(s => s.id === last.serviceId);
        const lastDuration = lastService?.durationMin || 60;
        const [lh, lm] = last.time.split(':').map(Number);
        const lastEndTime = new Date(2000, 0, 1, lh, lm + lastDuration);
        
        if (lastEndTime.getHours() < endHour - 1) {
             return "EVENING SLOT AVAILABLE AFTER " + lastEndTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
        }

        return "SCHEDULE FULLY OPTIMIZED. GREAT WORK!";
    };

    const insightText = useMemo(() => findScheduleInsight(), [todayAppointments]);

    // Menu & Edit State
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);

    const handleComplete = (e: React.MouseEvent, appt: Appointment) => {
        e.stopPropagation();
        onUpdateAppointment({ ...appt, status: AppointmentStatus.COMPLETED });
    };

    const handleDelete = (id: string) => {
        if(confirm("Are you sure you want to remove this appointment?")) {
            onRemoveAppointment(id);
            setActiveMenuId(null);
        }
    };

    const handleSaveEdit = () => {
        if (editingAppt) {
            onUpdateAppointment(editingAppt);
            setEditingAppt(null);
        }
    };

    return (
        <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6 lg:pb-8 transition-colors">
                <div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white uppercase tracking-tighter mb-2 transition-colors">Made for <span className="text-zinc-400 dark:text-zinc-500">Real Work</span></h1>
                    <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-md">Welcome back, {business.ownerName}. Your daily overview is ready.</p>
                </div>
                <div className="text-left sm:text-right">
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-500 uppercase tracking-widest mb-1">System Time</p>
                    <p className="text-xl sm:text-2xl font-mono font-bold text-zinc-900 dark:text-white transition-colors">{new Date().toLocaleTimeString([], {hour: 'numeric', minute:'2-digit', hour12: true})}</p>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 lg:p-8 flex flex-col justify-between group hover:border-orange-600 dark:hover:border-orange-600 transition-colors duration-300 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Today's Load</p>
                        <Calendar className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                         <p className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-1 transition-colors">{todayAppointments.filter(a => a.status !== AppointmentStatus.BLOCKED).length}</p>
                         <p className="text-sm text-zinc-500">Appointments scheduled</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 lg:p-8 flex flex-col justify-between group hover:border-blue-500 transition-colors duration-300 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Today's Revenue</p>
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                         <p className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-1 transition-colors">${todayRevenue}</p>
                         <p className="text-sm text-zinc-500">Earned today</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 lg:p-8 flex flex-col justify-between group hover:border-emerald-600 transition-colors duration-300 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Gross Revenue</p>
                        <DollarSign className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                         <p className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-1 transition-colors">${revenueEst}</p>
                         <p className="text-sm text-zinc-500">Total collected (All time)</p>
                    </div>
                </div>

                 <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 lg:p-8 flex flex-col justify-between group hover:border-yellow-500 transition-colors duration-300 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Rating</p>
                        <Star className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                         <p className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-1 transition-colors">4.9</p>
                         <p className="text-sm text-zinc-500">Based on last 30 days</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
                
                {/* Main Content: Today's Schedule */}
                <div className="lg:col-span-2 space-y-4 lg:space-y-8">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
                        <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-wider transition-colors">Today's Schedule</h2>
                            <button 
                                onClick={onNavigateToCalendar}
                                className="text-xs font-bold text-orange-600 uppercase tracking-widest hover:text-zinc-900 dark:hover:text-white transition-colors"
                            >
                                Full Calendar
                            </button>
                        </div>
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 min-h-[300px]">
                            {todayAppointments.length > 0 ? todayAppointments.map(appt => {
                                const service = business.services.find(s => s.id === appt.serviceId);
                                const [timeStr, ampm] = formatTime(appt.time).split(' ');
                                const isBlocked = appt.status === AppointmentStatus.BLOCKED;

                                return (
                                <div key={appt.id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer group relative">
                                    <div className="flex flex-row sm:flex-col items-center gap-2 sm:gap-0 min-w-[60px] border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-zinc-800 pb-4 sm:pb-0 sm:pr-6 w-full sm:w-auto">
                                        <span className={`text-lg font-bold font-mono ${isBlocked ? 'text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>{timeStr}</span>
                                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">{ampm}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className={`font-bold text-lg transition-colors ${isBlocked ? 'text-zinc-500 italic flex items-center gap-2' : 'text-zinc-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-500'}`}>
                                                {isBlocked && <Ban className="w-4 h-4"/>}
                                                {appt.clientName}
                                            </h3>
                                            <span className={`text-[10px] px-2 py-1 uppercase tracking-wider font-bold rounded-sm ${
                                                appt.status === AppointmentStatus.CONFIRMED ? 'bg-zinc-100 dark:bg-zinc-800 text-green-600 dark:text-green-500 border border-zinc-200 dark:border-green-900' : 
                                                appt.status === AppointmentStatus.COMPLETED ? 'bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-500 border border-zinc-200 dark:border-blue-900' :
                                                appt.status === AppointmentStatus.BLOCKED ? 'bg-zinc-100 dark:bg-zinc-900/50 text-zinc-500 border border-zinc-200 dark:border-zinc-700 border-dashed' :
                                                'bg-zinc-100 dark:bg-zinc-800 text-yellow-600 dark:text-yellow-500 border border-zinc-200 dark:border-yellow-900'
                                            }`}>{appt.status}</span>
                                        </div>
                                        <p className="text-sm text-zinc-500 uppercase tracking-wide">
                                            {isBlocked ? 'Blocked Period' : `${service?.name || 'Unknown Service'} • ${service?.durationMin} min`}
                                        </p>
                                    </div>
                                    
                                    {appt.status !== AppointmentStatus.COMPLETED && !isBlocked && (
                                        <button 
                                            onClick={(e) => handleComplete(e, appt)}
                                            className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-600 hover:text-white dark:hover:text-black hover:border-emerald-600 text-emerald-600 dark:text-emerald-500 text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                                        >
                                            <CheckCircle className="w-3 h-3" /> Complete
                                        </button>
                                    )}

                                    {/* Action Menu */}
                                    <div className="relative">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === appt.id ? null : appt.id); }}
                                            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-2"
                                        >
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
                                        
                                        {activeMenuId === appt.id && (
                                            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 flex flex-col animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setEditingAppt(appt); setActiveMenuId(null); }}
                                                    className="px-4 py-3 text-left text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors uppercase tracking-wider flex items-center gap-2"
                                                >
                                                    <Edit3 className="w-4 h-4" /> Edit
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(appt.id); }}
                                                    className="px-4 py-3 text-left text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors uppercase tracking-wider flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Remove
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Click-outside listener mockup (simple overlay) */}
                                    {activeMenuId === appt.id && (
                                        <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)}></div>
                                    )}
                                </div>
                            )}) : (
                                <div className="p-10 text-center text-zinc-500 uppercase tracking-widest text-sm flex flex-col items-center justify-center h-full">
                                    <p>No appointments scheduled for today.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chart Section */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm transition-colors">
                        <div className="flex items-center justify-between mb-8">
                             <h2 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-wider transition-colors">Last 7 Days Activity</h2>
                             <div className="flex gap-2">
                                <span className="w-3 h-3 bg-orange-600 block"></span>
                                <span className="text-xs text-zinc-500 uppercase tracking-widest">Bookings</span>
                             </div>
                        </div>
                       
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12, fontWeight: 700}} dy={10} />
                                    <YAxis hide />
                                    <RechartsTooltip 
                                        cursor={{fill: '#f4f4f5'}}
                                        contentStyle={{backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff'}}
                                        itemStyle={{color: '#ea580c'}}
                                    />
                                    <Bar dataKey="bookings" fill="#ea580c" radius={[2, 2, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Sidebar: AI Actions & Upcoming */}
                <div className="space-y-8">
                     <div className="bg-orange-600 p-8 text-black relative overflow-hidden group shadow-lg">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <Star className="w-5 h-5" />
                                <h2 className="font-bold uppercase tracking-widest text-sm">Halo Assistant</h2>
                            </div>
                            <p className="font-bold text-2xl mb-6 leading-tight">
                                {insightText}
                            </p>
                            <button 
                                onClick={onNavigateToCalendar}
                                className="w-full py-4 bg-black text-white hover:bg-zinc-800 transition-colors uppercase font-bold text-xs tracking-widest flex items-center justify-center gap-2"
                            >
                                Fill Slot <ArrowRight className="w-3 h-3"/>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm transition-colors">
                         <h2 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-6 transition-colors">Upcoming</h2>
                         <div className="space-y-6">
                            {upcomingAppointments.length > 0 ? upcomingAppointments.slice(0, 3).map(appt => (
                                <div key={appt.id} className="flex items-start gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0 last:pb-0 group">
                                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 transition-colors">
                                        <span className="text-[10px] font-bold uppercase">{appt.date.slice(5,7)}</span>
                                        <span className="text-lg font-bold text-zinc-900 dark:text-white">{appt.date.slice(8,10)}</span>
                                    </div>
                                    <div>
                                        <p className="text-base font-bold text-zinc-900 dark:text-white group-hover:text-orange-600 transition-colors">{appt.clientName}</p>
                                        <p className="text-xs text-zinc-500 uppercase tracking-wide mt-1">{formatTime(appt.time)} • {appt.status === AppointmentStatus.BLOCKED ? 'Blocked' : (business.services.find(s => s.id === appt.serviceId)?.name || 'Service')}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-zinc-500 text-sm italic">No upcoming appointments.</div>
                            )}
                         </div>
                         <button 
                            onClick={onNavigateToCalendar}
                            className="w-full mt-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-900 dark:hover:border-white transition-colors uppercase font-bold text-xs tracking-widest"
                         >
                            View All
                         </button>
                    </div>
                </div>

            </div>

             {/* Edit Appointment Modal */}
            {editingAppt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 w-full max-w-md shadow-2xl relative">
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                        <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Edit Appointment</h3>
                        <button onClick={() => setEditingAppt(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X className="w-5 h-5"/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Client Name</label>
                            <input 
                                type="text" 
                                value={editingAppt.clientName}
                                onChange={e => setEditingAppt({...editingAppt, clientName: e.target.value})}
                                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none"
                            />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Time (24h Input)</label>
                            <input 
                                type="time" 
                                value={editingAppt.time}
                                onChange={e => setEditingAppt({...editingAppt, time: e.target.value})}
                                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none font-mono"
                            />
                        </div>
                        {editingAppt.status !== AppointmentStatus.BLOCKED && (
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Service</label>
                                <select 
                                    value={editingAppt.serviceId}
                                    onChange={e => setEditingAppt({...editingAppt, serviceId: e.target.value})}
                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none appearance-none"
                                >
                                    {business.services.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} - ${s.price}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                             <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Status</label>
                             <div className="flex gap-2">
                                {[AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED, AppointmentStatus.PENDING, AppointmentStatus.CANCELLED, AppointmentStatus.BLOCKED].map(status => (
                                    <button
                                        key={status}
                                        onClick={() => setEditingAppt({...editingAppt, status})}
                                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border ${
                                            editingAppt.status === status 
                                            ? 'bg-zinc-100 dark:bg-zinc-800 border-orange-600 text-zinc-900 dark:text-white' 
                                            : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400'
                                        }`}
                                    >
                                        {status.slice(0,4)}
                                    </button>
                                ))}
                             </div>
                        </div>

                        <button 
                            onClick={handleSaveEdit}
                            className="w-full mt-4 bg-orange-600 text-black py-3 font-bold uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> Save Changes
                        </button>
                    </div>
                </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
