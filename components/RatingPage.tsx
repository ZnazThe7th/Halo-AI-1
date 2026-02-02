/**
 * Public Rating Page
 * Accessible via email link: /rate/:appointmentId?token=...
 */
import React, { useState, useEffect } from 'react';
import { Appointment, ClientRating, Client, BusinessProfile } from '../types';
import { AppointmentStatus } from '../types';

interface RatingPageProps {
  appointmentId: string;
  token: string;
  appointment?: Appointment;
  client?: Client;
  business?: BusinessProfile;
  onSubmitRating: (rating: Omit<ClientRating, 'id'>) => void;
}

const RatingPage: React.FC<RatingPageProps> = ({
  appointmentId,
  token,
  appointment,
  client,
  business,
  onSubmitRating
}) => {
  const [businessRating, setBusinessRating] = useState<number>(0);
  const [staffRating, setStaffRating] = useState<number>(0);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>('');

  // Verify token
  useEffect(() => {
    try {
      const decoded = atob(token);
      const [apptId, clientId] = decoded.split(':');
      if (apptId !== appointmentId) {
        setError('Invalid rating link. Please contact the business for a new link.');
      }
    } catch (e) {
      setError('Invalid rating link format.');
    }
  }, [token, appointmentId]);

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-orange-500">Error</h1>
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!appointment || !client || !business) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p className="text-zinc-400">Please wait while we load your rating form.</p>
        </div>
      </div>
    );
  }

  if (appointment.status !== AppointmentStatus.COMPLETED) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-orange-500">Appointment Not Completed</h1>
          <p className="text-zinc-400">This appointment has not been marked as completed yet.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">✓</div>
          <h1 className="text-3xl font-bold mb-4 text-orange-500">Thank You!</h1>
          <p className="text-zinc-400 mb-6">
            Your feedback has been submitted. We appreciate you taking the time to rate your experience at {business.name}.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (businessRating === 0) {
      setError('Please rate your overall experience.');
      return;
    }

    const rating: Omit<ClientRating, 'id'> = {
      appointmentId: appointment.id,
      clientId: client.id,
      businessRating,
      staffRating: staffRating > 0 ? staffRating : undefined,
      staffId: selectedStaffId || undefined,
      comment: comment.trim() || undefined,
    };

    onSubmitRating(rating);
    setSubmitted(true);
  };

  const StarRating: React.FC<{ rating: number; onRate: (rating: number) => void; label: string }> = ({ rating, onRate, label }) => (
    <div className="mb-6">
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRate(star)}
            className={`text-3xl transition-colors ${
              star <= rating ? 'text-orange-500' : 'text-zinc-600'
            } hover:text-orange-400`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-zinc-900 rounded-lg p-6 md:p-8 border border-zinc-800">
          <h1 className="text-3xl font-bold mb-2 text-orange-500">Rate Your Experience</h1>
          <p className="text-zinc-400 mb-6">
            Thank you for visiting <strong>{business.name}</strong>!
          </p>

          <div className="mb-6 p-4 bg-zinc-800 rounded border border-zinc-700">
            <p className="text-sm text-zinc-400 mb-2">Appointment Details:</p>
            <p className="font-medium">{appointment.date}</p>
            <p className="text-zinc-400">{appointment.time}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <StarRating
              rating={businessRating}
              onRate={setBusinessRating}
              label="Overall Experience *"
            />

            {business.staff && business.staff.length > 0 && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Staff Member (Optional)</label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 text-white"
                  >
                    <option value="">Select a staff member</option>
                    {business.staff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedStaffId && (
                  <StarRating
                    rating={staffRating}
                    onRate={setStaffRating}
                    label="Staff Rating (Optional)"
                  />
                )}
              </>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Comments (Optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 text-white resize-none"
                placeholder="Tell us about your experience..."
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-orange-500 text-black font-bold py-3 px-6 rounded hover:bg-orange-600 transition-colors"
            >
              Submit Rating
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RatingPage;
