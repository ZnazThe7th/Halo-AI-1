import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { ClientRating, Staff } from '../types';

interface RatingFormProps {
  appointmentId: string;
  clientId: string;
  clientName: string;
  staff?: Staff[];
  staffId?: string; // Pre-selected staff member
  onSubmit: (rating: ClientRating) => void;
  onCancel: () => void;
}

const RatingForm: React.FC<RatingFormProps> = ({
  appointmentId,
  clientId,
  clientName,
  staff = [],
  staffId,
  onSubmit,
  onCancel
}) => {
  const [businessRating, setBusinessRating] = useState<number>(0);
  const [staffRating, setStaffRating] = useState<number>(0);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffId || '');
  const [comment, setComment] = useState<string>('');
  const [hoveredBusiness, setHoveredBusiness] = useState<number>(0);
  const [hoveredStaff, setHoveredStaff] = useState<number>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (businessRating === 0 && staffRating === 0) {
      alert('Please provide at least one rating');
      return;
    }

    const rating: ClientRating = {
      id: Math.random().toString(36).substr(2, 9),
      appointmentId,
      clientId,
      businessRating: businessRating > 0 ? businessRating : undefined,
      staffRating: staffRating > 0 ? staffRating : undefined,
      staffId: selectedStaffId || undefined,
      comment: comment.trim() || undefined,
      date: new Date().toISOString()
    };

    onSubmit(rating);
  };

  const renderStars = (rating: number, setRating: (r: number) => void, hovered: number, setHovered: (r: number) => void, label: string) => {
    return (
      <div className="space-y-2">
        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">{label}</label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-6 h-6 ${
                  star <= (hovered || rating)
                    ? 'fill-yellow-500 text-yellow-500'
                    : 'text-zinc-400'
                }`}
              />
            </button>
          ))}
          {(rating > 0 || hovered > 0) && (
            <span className="text-sm text-zinc-500 ml-2">
              {hovered > 0 ? hovered : rating}/5
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 p-6 lg:p-8 max-w-md w-full relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-2">
          Rate Your Experience
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Help us improve by rating your experience with {clientName}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {renderStars(
            businessRating,
            setBusinessRating,
            hoveredBusiness,
            setHoveredBusiness,
            'Business Rating'
          )}

          {staff.length > 0 && (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  Staff Member
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 p-3 text-white focus:border-orange-600 outline-none"
                >
                  <option value="">Select staff member (optional)</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.role ? `- ${s.role}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStaffId && renderStars(
                staffRating,
                setStaffRating,
                hoveredStaff,
                setHoveredStaff,
                'Staff Rating'
              )}
            </>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Comments (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your feedback..."
              className="w-full bg-zinc-900 border border-zinc-800 p-3 text-white placeholder-zinc-600 focus:border-orange-600 outline-none resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-800 transition-colors uppercase font-bold text-xs tracking-widest py-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-orange-600 text-black hover:bg-white transition-colors uppercase font-bold text-xs tracking-widest py-3"
            >
              Submit Rating
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RatingForm;
