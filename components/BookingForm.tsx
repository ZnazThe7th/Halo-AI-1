
import React, { useState } from 'react';
import { BusinessProfile, Service, Appointment, Client, AppointmentStatus } from '../types';
import { Calendar, CheckCircle, Clock, User, ArrowRight, ArrowLeft } from 'lucide-react';
import { formatTime } from '../constants';

interface BookingFormProps {
  business: BusinessProfile;
  onBackToAdmin: () => void;
  // New prop to handle actual data entry - accepts array of clients for multi-client appointments
  onBookAppointment: (appt: Appointment, clients: Client[]) => void;
}

const BookingForm: React.FC<BookingFormProps> = ({ business, onBackToAdmin, onBookAppointment }) => {
  const [step, setStep] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [clientInfo, setClientInfo] = useState({ name: '', email: '', phone: '' });
  const [multipleClients, setMultipleClients] = useState<Array<{ name: '', email: '', phone: '' }>>([{ name: '', email: '', phone: '' }]);

  // Mock available times (stored as 24h, displayed as 12h)
  const timeSlots = ["09:00", "10:30", "13:00", "14:30", "16:00"];

  const handleBook = () => {
    if (!selectedService || !selectedDate || !selectedTime) return;

    const isMultiClient = selectedService.pricePerPerson && multipleClients.length > 0;
    const clientsToBook = isMultiClient ? multipleClients : [clientInfo];
    
    // Validate all clients have names
    if (clientsToBook.some(c => !c.name.trim())) return;

    // 1. Create Client Objects
    const newClients: Client[] = clientsToBook.map(clientInfo => ({
        id: Math.random().toString(36).substr(2, 9),
        name: clientInfo.name,
        email: clientInfo.email,
        phone: clientInfo.phone,
        notes: [],
        preferences: 'New Client via Online Booking',
        lastVisit: null
    }));

    // 2. Create Appointment Object (with multiple clients if applicable)
    const newAppt: Appointment = {
        id: Math.random().toString(36).substr(2, 9),
        clientId: newClients[0].id, // First client for backward compatibility
        clientName: newClients[0].name,
        clientIds: newClients.map(c => c.id),
        clientNames: newClients.map(c => c.name),
        serviceId: selectedService.id,
        date: selectedDate,
        time: selectedTime,
        status: AppointmentStatus.CONFIRMED // Auto-confirm for demo
    };

    // 3. Pass back to App with all clients
    onBookAppointment(newAppt, newClients);
    
    // 4. Show success
    setStep(4);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative">
       {/* Industrial decorative elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 to-black"></div>
      <div className="absolute top-10 right-10 flex gap-2">
           <div className="w-2 h-2 bg-zinc-800"></div>
           <div className="w-2 h-2 bg-zinc-800"></div>
           <div className="w-2 h-2 bg-orange-600"></div>
      </div>

      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 relative z-10">
        
        {/* Header */}
        <div className="bg-zinc-900 border-b border-zinc-800 p-8 flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold text-white uppercase tracking-wider">{business.name}</h1>
                <p className="text-zinc-500 mt-1 uppercase text-xs tracking-widest">Appointment Scheduling System</p>
            </div>
             <button onClick={onBackToAdmin} className="text-zinc-600 hover:text-white text-xs uppercase tracking-widest font-bold">
                Owner Login
            </button>
        </div>

        {/* Content */}
        <div className="p-8">
            {step === 1 && (
                <div className="animate-fade-in">
                    <div className="flex items-center gap-4 mb-8">
                         <div className="w-8 h-8 bg-orange-600 text-black font-bold flex items-center justify-center">1</div>
                         <h2 className="text-xl font-bold text-white uppercase tracking-wide">Select Service</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {business.services.map(service => (
                            <button
                                key={service.id}
                                onClick={() => { 
                                  setSelectedService(service); 
                                  // Reset multiple clients when selecting a new service
                                  if (service.pricePerPerson) {
                                    setMultipleClients([{ name: '', email: '', phone: '' }]);
                                  } else {
                                    setClientInfo({ name: '', email: '', phone: '' });
                                  }
                                  setStep(2); 
                                }}
                                className="w-full text-left p-6 border border-zinc-800 bg-zinc-900 hover:border-orange-600 hover:bg-zinc-800 transition-all group relative overflow-hidden"
                            >
                                <div className="flex justify-between items-center relative z-10">
                                    <span className="font-bold text-lg text-white group-hover:text-orange-500 uppercase tracking-wide">{service.name}</span>
                                    <span className="font-mono text-zinc-400 group-hover:text-white">${service.price}</span>
                                </div>
                                <p className="text-sm text-zinc-500 mt-2 font-mono group-hover:text-zinc-400">// {service.durationMin} MIN</p>
                                <div className="absolute bottom-0 right-0 w-0 h-[2px] bg-orange-600 transition-all group-hover:w-full"></div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="animate-fade-in">
                    <button onClick={() => setStep(1)} className="text-xs text-zinc-500 hover:text-white mb-8 flex items-center gap-2 uppercase tracking-widest font-bold">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    
                     <div className="flex items-center gap-4 mb-8">
                         <div className="w-8 h-8 bg-orange-600 text-black font-bold flex items-center justify-center">2</div>
                         <h2 className="text-xl font-bold text-white uppercase tracking-wide">Date & Time</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                         <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Select Date</label>
                            <input 
                                type="date" 
                                className="w-full p-4 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none appearance-none uppercase font-mono"
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                        {selectedDate && (
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Select Slot</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {timeSlots.map(time => (
                                        <button
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className={`p-3 text-sm font-bold font-mono transition-colors border ${
                                                selectedTime === time 
                                                ? 'bg-orange-600 text-black border-orange-600' 
                                                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                                            }`}
                                        >
                                            {formatTime(time)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        disabled={!selectedDate || !selectedTime}
                        onClick={() => setStep(3)}
                        className="w-full bg-white text-black py-4 font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                        Next Step <ArrowRight className="w-4 h-4"/>
                    </button>
                </div>
            )}

            {step === 3 && (
                <div className="animate-fade-in">
                    <button onClick={() => setStep(2)} className="text-xs text-zinc-500 hover:text-white mb-8 flex items-center gap-2 uppercase tracking-widest font-bold">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>

                     <div className="flex items-center gap-4 mb-8">
                         <div className="w-8 h-8 bg-orange-600 text-black font-bold flex items-center justify-center">3</div>
                         <h2 className="text-xl font-bold text-white uppercase tracking-wide">Finalize</h2>
                    </div>
                    
                    {selectedService?.pricePerPerson ? (
                      // Multi-client form
                      <div className="space-y-6 mb-8">
                        <div className="bg-orange-600/10 border border-orange-600/30 p-4 mb-4">
                          <p className="text-sm text-orange-500 uppercase tracking-wider font-bold mb-1">Multi-Client Service</p>
                          <p className="text-xs text-zinc-400">${selectedService.price} per person. Add multiple clients for this appointment.</p>
                        </div>
                        {multipleClients.map((client, index) => (
                          <div key={index} className="border border-zinc-800 p-4 bg-zinc-900/50">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Client {index + 1}</h4>
                              {multipleClients.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setMultipleClients(multipleClients.filter((_, i) => i !== index))}
                                  className="text-xs text-red-500 hover:text-red-400 uppercase tracking-wider"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Full Name</label>
                                <input 
                                  type="text"
                                  className="w-full p-4 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none"
                                  placeholder="JANE DOE"
                                  value={client.name}
                                  onChange={e => {
                                    const updated = [...multipleClients];
                                    updated[index] = { ...updated[index], name: e.target.value };
                                    setMultipleClients(updated);
                                  }}
                                />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Email</label>
                                  <input 
                                    type="email"
                                    className="w-full p-4 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none"
                                    placeholder="JANE@EXAMPLE.COM"
                                    value={client.email}
                                    onChange={e => {
                                      const updated = [...multipleClients];
                                      updated[index] = { ...updated[index], email: e.target.value };
                                      setMultipleClients(updated);
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Phone</label>
                                  <input 
                                    type="tel"
                                    className="w-full p-4 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none font-mono"
                                    placeholder="555-0123"
                                    value={client.phone}
                                    onChange={e => {
                                      const updated = [...multipleClients];
                                      updated[index] = { ...updated[index], phone: e.target.value };
                                      setMultipleClients(updated);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setMultipleClients([...multipleClients, { name: '', email: '', phone: '' }])}
                          className="w-full py-3 border-2 border-dashed border-zinc-700 text-zinc-400 hover:border-orange-600 hover:text-orange-600 transition-colors uppercase tracking-widest text-xs font-bold"
                        >
                          + Add Another Client
                        </button>
                      </div>
                    ) : (
                      // Single client form
                      <div className="space-y-6 mb-8">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Full Name</label>
                            <input 
                                type="text"
                                className="w-full p-4 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none"
                                placeholder="JANE DOE"
                                value={clientInfo.name}
                                onChange={e => setClientInfo({...clientInfo, name: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Email</label>
                                <input 
                                    type="email"
                                    className="w-full p-4 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none"
                                    placeholder="JANE@EXAMPLE.COM"
                                    value={clientInfo.email}
                                    onChange={e => setClientInfo({...clientInfo, email: e.target.value})}
                                />
                            </div>
                             <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Phone</label>
                                 <input 
                                    type="tel"
                                    className="w-full p-4 bg-zinc-900 border border-zinc-700 text-white focus:border-orange-600 outline-none font-mono"
                                    placeholder="555-0123"
                                    value={clientInfo.phone}
                                    onChange={e => setClientInfo({...clientInfo, phone: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                    )}

                    <div className="bg-zinc-900 border border-zinc-800 p-6 mb-8">
                        <h3 className="font-bold text-white uppercase tracking-wider mb-4 border-b border-zinc-800 pb-2">Booking Summary</h3>
                        <div className="space-y-2">
                             <div className="flex justify-between">
                                <span className="text-zinc-500 text-sm">Service</span>
                                <span className="text-white font-bold uppercase">{selectedService?.name}</span>
                             </div>
                             <div className="flex justify-between">
                                <span className="text-zinc-500 text-sm">Date</span>
                                <span className="text-white font-mono">{selectedDate}</span>
                             </div>
                             <div className="flex justify-between">
                                <span className="text-zinc-500 text-sm">Time</span>
                                <span className="text-white font-mono">{formatTime(selectedTime)}</span>
                             </div>
                             <div className="flex justify-between pt-4 border-t border-zinc-800 mt-2">
                                <span className="text-white font-bold uppercase">Total</span>
                                <span className="text-orange-500 font-mono font-bold">
                                  ${selectedService?.pricePerPerson 
                                    ? (selectedService.price * (selectedService.pricePerPerson ? multipleClients.length : 1)).toFixed(2)
                                    : selectedService?.price}
                                  {selectedService?.pricePerPerson && ` (${multipleClients.length} × $${selectedService.price})`}
                                </span>
                             </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleBook}
                        className="w-full bg-orange-600 text-black py-4 font-bold hover:bg-orange-500 transition-colors shadow-[0_0_20px_rgba(234,88,12,0.3)] uppercase tracking-widest"
                    >
                        Confirm Booking
                    </button>
                </div>
            )}

            {step === 4 && (
                <div className="text-center py-12 animate-fade-in">
                    <div className="w-20 h-20 border-2 border-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-orange-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-white uppercase tracking-wider mb-4">Confirmed</h2>
                    <p className="text-zinc-400 mb-8 max-w-xs mx-auto">
                        {selectedService?.pricePerPerson && multipleClients.length > 1 
                          ? `Confirmation sent to ${multipleClients.length} clients.`
                          : `Confirmation sent to ${clientInfo.email || multipleClients[0]?.email || 'client'}.`}
                    </p>
                    <p className="text-sm font-mono text-zinc-500 mb-10">{selectedDate} / {formatTime(selectedTime)}</p>
                    
                    <button onClick={() => setStep(1)} className="text-white font-bold uppercase tracking-widest text-xs hover:text-orange-600 border-b border-white hover:border-orange-600 pb-1 transition-all">
                        Book Another
                    </button>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default BookingForm;
