export interface Teacher {
  id: number;
  name: string;
  subject: string;
}

export interface TimeSlot {
  id: number;
  teacherId: number;
  time: string;
  date: string;
  booked: boolean;
  visitorType?: 'parent' | 'company';
  parentName?: string;
  companyName?: string;
  studentName?: string;
  traineeName?: string;
  className?: string;
  email?: string;
  message?: string;
}

export interface BookingFormData {
  visitorType: 'parent' | 'company';
  parentName?: string;
  companyName?: string;
  studentName?: string;
  traineeName?: string;
  className: string;
  email: string;
  message?: string;
}
