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
  parentName?: string;
  studentName?: string;
  className?: string;
}

export interface BookingFormData {
  parentName: string;
  studentName: string;
  className: string;
}
